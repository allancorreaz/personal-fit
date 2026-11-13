"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirAluno } from "@/lib/supabase/server";

const UUID = /^[0-9a-f-]{36}$/;

type SeriePayload = { fichaExercicioId: string; serie: number; repeticoes: number | null; carga: number | null };

/**
 * Salva o treino feito. Confiamos só no que o banco confirma:
 *  - o treino precisa ser da ficha ATIVA do aluno (o RLS só mostra essa);
 *  - cada série precisa ser de um exercício DESSE treino;
 *  - números são limitados (reps 0–500, carga 0–1000 kg, até 20 séries).
 */
export async function salvarSessao(f: FormData) {
  const { supabase, aluno } = await exigirAluno();
  const treinoId = String(f.get("treino_id") ?? "");
  if (!UUID.test(treinoId)) redirect("/app");

  const { data: treino } = await supabase
    .from("ficha_treinos")
    .select("id, nome, ficha_id, personal_id, ficha_exercicios ( id, exercicio_id )")
    .eq("id", treinoId)
    .maybeSingle();
  if (!treino) redirect("/app");

  let series: SeriePayload[] = [];
  try {
    series = JSON.parse(String(f.get("series") ?? "[]"));
  } catch {
    redirect(`/app/treino/${treinoId}?erro=dados`);
  }
  const mapa = new Map<string, string>((treino.ficha_exercicios ?? []).map((e: { id: string; exercicio_id: string }) => [e.id, e.exercicio_id]));
  const limpa = (Array.isArray(series) ? series : [])
    .filter((s) => mapa.has(s.fichaExercicioId) && Number.isInteger(s.serie) && s.serie >= 1 && s.serie <= 20)
    .map((s) => ({
      ficha_exercicio_id: s.fichaExercicioId,
      exercicio_id: mapa.get(s.fichaExercicioId)!,
      serie: s.serie,
      repeticoes: s.repeticoes === null ? null : Math.max(0, Math.min(500, Math.round(Number(s.repeticoes) || 0))),
      carga_kg: s.carga === null ? null : Math.max(0, Math.min(1000, Number(s.carga) || 0))
    }));
  // sem duplicata (mesmo exercício + série)
  const unicas = [...new Map(limpa.map((s) => [`${s.exercicio_id}-${s.serie}`, s])).values()].slice(0, 300);

  const esforco = Number(f.get("esforco"));
  const { data: sessao, error } = await supabase
    .from("sessoes_treino")
    .insert({
      personal_id: treino.personal_id,
      aluno_id: aluno.id,
      ficha_id: treino.ficha_id,
      treino_id: treino.id,
      nome_treino: treino.nome,
      iniciado_em: String(f.get("iniciado_em") ?? "") || new Date().toISOString(),
      concluido_em: new Date().toISOString(),
      percepcao_esforco: Number.isInteger(esforco) && esforco >= 1 && esforco <= 10 ? esforco : null,
      observacoes: String(f.get("observacoes") ?? "").trim().slice(0, 1000) || null
    })
    .select("id")
    .single();
  if (error) redirect(`/app/treino/${treinoId}?erro=salvar`);

  if (unicas.length) {
    const { error: e2 } = await supabase
      .from("sessao_series")
      .insert(unicas.map((s) => ({ ...s, personal_id: treino.personal_id, aluno_id: aluno.id, sessao_id: sessao.id })));
    if (e2) console.error("[salvarSessao] séries", e2.message);
  }
  revalidatePath("/app");
  redirect("/app/historico?ok=1");
}

/** Anamnese: cada envio é um registro novo (histórico). */
export async function salvarAnamnese(f: FormData) {
  const { supabase, aluno } = await exigirAluno();
  const respostas: Record<string, string> = {};
  for (const [k, v] of f.entries()) {
    if (k.startsWith("q:")) respostas[k.slice(2).slice(0, 120)] = String(v).slice(0, 1000);
  }
  const { error } = await supabase.from("anamneses").insert({ personal_id: aluno.personal_id, aluno_id: aluno.id, respostas });
  redirect(error ? "/app/perfil?erro=1" : "/app/perfil?ok=1");
}
