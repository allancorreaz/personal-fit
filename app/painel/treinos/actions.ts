"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirPersonal } from "@/lib/supabase/server";
import { GRUPOS_MUSCULARES } from "@/lib/formato";

/*
 * Treinos: tudo com o cliente da sessão do personal → o RLS garante que ele só
 * cria/edita fichas e exercícios dele. As chaves compostas (personal_id, id)
 * no banco impedem ligar uma ficha a aluno de outro personal.
 */

const UUID = /^[0-9a-f-]{36}$/;
const uuid = (v: FormDataEntryValue | null) => (UUID.test(String(v ?? "")) ? String(v) : null);
const texto = (f: FormData, c: string, max = 300) => {
  const v = String(f.get(c) ?? "").trim();
  return v ? v.slice(0, max) : null;
};
const inteiro = (v: FormDataEntryValue | null, min: number, max: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
};
function ir(caminho: string, tipo: "ok" | "erro", msg: string): never {
  redirect(`${caminho}${caminho.includes("?") ? "&" : "?"}${tipo}=${encodeURIComponent(msg)}`);
}

/* ---------------------------------------------------------------- */
/* Fichas                                                            */
/* ---------------------------------------------------------------- */

export async function criarFicha(f: FormData) {
  const { supabase, personal } = await exigirPersonal();
  const alunoId = uuid(f.get("aluno_id"));
  const modeloId = uuid(f.get("modelo_id"));
  const nome = texto(f, "nome", 120);
  const volta = `/painel/treinos/nova${alunoId ? `?aluno=${alunoId}` : ""}`;
  if (!nome || nome.length < 2) ir(volta, "erro", "Dê um nome à ficha.");

  const { data: ficha, error } = await supabase
    .from("fichas")
    .insert({
      personal_id: personal.id,
      aluno_id: alunoId,
      nome,
      objetivo: texto(f, "objetivo", 300),
      inicio: texto(f, "inicio", 10),
      fim: texto(f, "fim", 10)
    })
    .select("id")
    .single();
  if (error) ir(volta, "erro", "Não foi possível criar a ficha.");

  if (modeloId) {
    await copiarConteudo(supabase, personal.id, modeloId, ficha.id);
  } else {
    await supabase.from("ficha_treinos").insert({ personal_id: personal.id, ficha_id: ficha.id, nome: "Treino A", ordem: 0 });
  }

  // aluno com ficha nova: arquiva as anteriores (só uma ativa por vez)
  if (alunoId) {
    await supabase.from("fichas").update({ ativa: false }).eq("aluno_id", alunoId).neq("id", ficha.id).eq("ativa", true);
  }
  ir(`/painel/treinos/${ficha.id}`, "ok", "Ficha criada. Agora adicione os exercícios.");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function copiarConteudo(supabase: any, personalId: string, origemId: string, destinoId: string) {
  const { data: treinos } = await supabase
    .from("ficha_treinos")
    .select("id, nome, ordem, observacoes, ficha_exercicios ( exercicio_id, ordem, series, repeticoes, carga, descanso_seg, metodo, observacoes )")
    .eq("ficha_id", origemId)
    .order("ordem");
  for (const t of treinos ?? []) {
    const { data: novo } = await supabase
      .from("ficha_treinos")
      .insert({ personal_id: personalId, ficha_id: destinoId, nome: t.nome, ordem: t.ordem, observacoes: t.observacoes })
      .select("id")
      .single();
    if (!novo) continue;
    const exs = (t.ficha_exercicios ?? []).map((e: Record<string, unknown>) => ({ ...e, personal_id: personalId, treino_id: novo.id }));
    if (exs.length) await supabase.from("ficha_exercicios").insert(exs);
  }
}

/** Copia a ficha para outro aluno ou para virar modelo. */
export async function duplicarFicha(f: FormData) {
  const { supabase, personal } = await exigirPersonal();
  const origem = uuid(f.get("id"));
  const alunoId = uuid(f.get("aluno_id"));
  if (!origem) return;
  const { data: ficha } = await supabase.from("fichas").select("nome, objetivo, observacoes").eq("id", origem).maybeSingle();
  if (!ficha) ir("/painel/treinos", "erro", "Ficha não encontrada.");

  const { data: nova, error } = await supabase
    .from("fichas")
    .insert({ personal_id: personal.id, aluno_id: alunoId, nome: alunoId ? ficha.nome : `${ficha.nome} (modelo)`.slice(0, 120), objetivo: ficha.objetivo, observacoes: ficha.observacoes })
    .select("id")
    .single();
  if (error) ir(`/painel/treinos/${origem}`, "erro", "Não foi possível duplicar.");
  await copiarConteudo(supabase, personal.id, origem, nova.id);
  if (alunoId) await supabase.from("fichas").update({ ativa: false }).eq("aluno_id", alunoId).neq("id", nova.id).eq("ativa", true);
  ir(`/painel/treinos/${nova.id}`, "ok", alunoId ? "Ficha copiada para o aluno." : "Modelo criado.");
}

export async function atualizarFicha(f: FormData) {
  const { supabase } = await exigirPersonal();
  const id = uuid(f.get("id"));
  if (!id) return;
  const nome = texto(f, "nome", 120);
  if (!nome) ir(`/painel/treinos/${id}`, "erro", "Nome obrigatório.");
  const { error } = await supabase
    .from("fichas")
    .update({ nome, objetivo: texto(f, "objetivo", 300), observacoes: texto(f, "observacoes", 2000), inicio: texto(f, "inicio", 10), fim: texto(f, "fim", 10) })
    .eq("id", id);
  if (error) ir(`/painel/treinos/${id}`, "erro", "Não foi possível salvar (confira as datas).");
  revalidatePath(`/painel/treinos/${id}`);
  ir(`/painel/treinos/${id}`, "ok", "Ficha salva.");
}

export async function alternarFichaAtiva(f: FormData) {
  const { supabase } = await exigirPersonal();
  const id = uuid(f.get("id"));
  if (!id) return;
  const ativa = f.get("ativa") === "true";
  const { data: ficha } = await supabase.from("fichas").select("aluno_id").eq("id", id).maybeSingle();
  if (ativa && ficha?.aluno_id) {
    await supabase.from("fichas").update({ ativa: false }).eq("aluno_id", ficha.aluno_id).neq("id", id);
  }
  await supabase.from("fichas").update({ ativa }).eq("id", id);
  revalidatePath(`/painel/treinos/${id}`);
  ir(`/painel/treinos/${id}`, "ok", ativa ? "Ficha ativada: o aluno já vê no app." : "Ficha arquivada.");
}

/* ---------------------------------------------------------------- */
/* Divisões (Treino A, B…)                                           */
/* ---------------------------------------------------------------- */

export async function adicionarDivisao(f: FormData) {
  const { supabase, personal } = await exigirPersonal();
  const fichaId = uuid(f.get("ficha_id"));
  if (!fichaId) return;
  const { count } = await supabase.from("ficha_treinos").select("id", { count: "exact", head: true }).eq("ficha_id", fichaId);
  const letra = String.fromCharCode(65 + Math.min(count ?? 0, 25));
  const nome = texto(f, "nome", 80) ?? `Treino ${letra}`;
  const { error } = await supabase.from("ficha_treinos").insert({ personal_id: personal.id, ficha_id: fichaId, nome, ordem: count ?? 0 });
  if (error) ir(`/painel/treinos/${fichaId}`, "erro", "Não foi possível adicionar.");
  revalidatePath(`/painel/treinos/${fichaId}`);
  ir(`/painel/treinos/${fichaId}`, "ok", `${nome} adicionado.`);
}

export async function renomearDivisao(f: FormData) {
  const { supabase } = await exigirPersonal();
  const id = uuid(f.get("id"));
  const fichaId = uuid(f.get("ficha_id"));
  const nome = texto(f, "nome", 80);
  if (!id || !fichaId || !nome) return;
  await supabase.from("ficha_treinos").update({ nome, observacoes: texto(f, "observacoes", 1000) }).eq("id", id);
  revalidatePath(`/painel/treinos/${fichaId}`);
  ir(`/painel/treinos/${fichaId}`, "ok", "Divisão salva.");
}

export async function removerDivisao(f: FormData) {
  const { supabase } = await exigirPersonal();
  const id = uuid(f.get("id"));
  const fichaId = uuid(f.get("ficha_id"));
  if (!id || !fichaId) return;
  await supabase.from("ficha_treinos").delete().eq("id", id);
  revalidatePath(`/painel/treinos/${fichaId}`);
  ir(`/painel/treinos/${fichaId}`, "ok", "Divisão removida.");
}

/* ---------------------------------------------------------------- */
/* Exercícios da ficha                                               */
/* ---------------------------------------------------------------- */

function dadosItem(f: FormData) {
  return {
    series: inteiro(f.get("series"), 1, 20) ?? 3,
    repeticoes: texto(f, "repeticoes", 20) ?? "10",
    carga: texto(f, "carga", 30),
    descanso_seg: inteiro(f.get("descanso_seg"), 0, 900),
    metodo: texto(f, "metodo", 60),
    observacoes: texto(f, "observacoes", 500)
  };
}

export async function adicionarExercicio(f: FormData) {
  const { supabase, personal } = await exigirPersonal();
  const fichaId = uuid(f.get("ficha_id"));
  const treinoId = uuid(f.get("treino_id"));
  const exercicioId = uuid(f.get("exercicio_id"));
  if (!fichaId || !treinoId || !exercicioId) ir(`/painel/treinos/${fichaId}`, "erro", "Escolha um exercício.");
  const { count } = await supabase.from("ficha_exercicios").select("id", { count: "exact", head: true }).eq("treino_id", treinoId);
  const { error } = await supabase.from("ficha_exercicios").insert({
    personal_id: personal.id,
    treino_id: treinoId,
    exercicio_id: exercicioId,
    ordem: count ?? 0,
    ...dadosItem(f)
  });
  if (error) ir(`/painel/treinos/${fichaId}`, "erro", "Não foi possível adicionar o exercício.");
  revalidatePath(`/painel/treinos/${fichaId}`);
  ir(`/painel/treinos/${fichaId}#t-${treinoId}`, "ok", "Exercício adicionado.");
}

export async function atualizarExercicio(f: FormData) {
  const { supabase } = await exigirPersonal();
  const id = uuid(f.get("id"));
  const fichaId = uuid(f.get("ficha_id"));
  if (!id || !fichaId) return;
  await supabase.from("ficha_exercicios").update(dadosItem(f)).eq("id", id);
  revalidatePath(`/painel/treinos/${fichaId}`);
  ir(`/painel/treinos/${fichaId}`, "ok", "Exercício atualizado.");
}

export async function removerExercicio(f: FormData) {
  const { supabase } = await exigirPersonal();
  const id = uuid(f.get("id"));
  const fichaId = uuid(f.get("ficha_id"));
  if (!id || !fichaId) return;
  await supabase.from("ficha_exercicios").delete().eq("id", id);
  revalidatePath(`/painel/treinos/${fichaId}`);
  ir(`/painel/treinos/${fichaId}`, "ok", "Exercício removido.");
}

/** Sobe ou desce um exercício trocando a ordem com o vizinho. */
export async function moverExercicio(f: FormData) {
  const { supabase } = await exigirPersonal();
  const id = uuid(f.get("id"));
  const fichaId = uuid(f.get("ficha_id"));
  const direcao = f.get("direcao") === "cima" ? -1 : 1;
  if (!id || !fichaId) return;
  const { data: item } = await supabase.from("ficha_exercicios").select("id, treino_id").eq("id", id).maybeSingle();
  if (!item) return;
  const { data: todos } = await supabase.from("ficha_exercicios").select("id").eq("treino_id", item.treino_id).order("ordem").order("id");
  const ids = (todos ?? []).map((t) => t.id as string);
  const i = ids.indexOf(id);
  const j = i + direcao;
  if (i < 0 || j < 0 || j >= ids.length) ir(`/painel/treinos/${fichaId}`, "ok", "Ordem mantida.");
  [ids[i], ids[j]] = [ids[j], ids[i]];
  await Promise.all(ids.map((eid, ordem) => supabase.from("ficha_exercicios").update({ ordem }).eq("id", eid)));
  revalidatePath(`/painel/treinos/${fichaId}`);
  redirect(`/painel/treinos/${fichaId}#t-${item.treino_id}`);
}

/* ---------------------------------------------------------------- */
/* Biblioteca de exercícios do personal                              */
/* ---------------------------------------------------------------- */

export async function salvarExercicioBiblioteca(f: FormData) {
  const { supabase, personal } = await exigirPersonal();
  const id = uuid(f.get("id"));
  const volta = "/painel/treinos/exercicios";
  const nome = texto(f, "nome", 120);
  const grupo = String(f.get("grupo_muscular") ?? "");
  const video = texto(f, "video_url", 500);
  if (!nome || nome.length < 2) ir(volta, "erro", "Informe o nome.");
  if (!(grupo in GRUPOS_MUSCULARES)) ir(volta, "erro", "Escolha o grupo muscular.");
  if (video && !/^https:\/\/[^\s]+$/.test(video)) ir(volta, "erro", "O link do vídeo precisa começar com https://");

  const dados: Record<string, unknown> = {
    nome,
    grupo_muscular: grupo,
    equipamento: texto(f, "equipamento", 60),
    instrucoes: texto(f, "instrucoes", 2000),
    video_url: video
  };

  // mídia enviada direto do navegador ao Storage: só aceita caminho da pasta do próprio personal
  const midia = texto(f, "midia_path", 300);
  if (midia) {
    if (!new RegExp(`^${personal.id}/[0-9a-f-]{36}\\.(gif|jpg|png|webp|mp4|webm)$`).test(midia))
      ir(volta, "erro", "Arquivo inválido.");
    dados.midia_path = midia;
  }

  const { error } = id
    ? await supabase.from("exercicios").update(dados).eq("id", id)
    : await supabase.from("exercicios").insert({ ...dados, personal_id: personal.id });
  if (error) ir(volta, "erro", "Não foi possível salvar o exercício.");
  revalidatePath(volta);
  ir(volta, "ok", "Exercício salvo.");
}

export async function removerExercicioBiblioteca(f: FormData) {
  const { supabase } = await exigirPersonal();
  const id = uuid(f.get("id"));
  if (!id) return;
  const { data: ex } = await supabase.from("exercicios").select("midia_path, personal_id").eq("id", id).maybeSingle();
  const { error } = await supabase.from("exercicios").delete().eq("id", id);
  if (error) ir("/painel/treinos/exercicios", "erro", "Esse exercício está em uso numa ficha ou no histórico. Ele não pode ser apagado.");
  if (ex?.midia_path) await supabase.storage.from("exercicios").remove([ex.midia_path]);
  revalidatePath("/painel/treinos/exercicios");
  ir("/painel/treinos/exercicios", "ok", "Exercício removido.");
}
