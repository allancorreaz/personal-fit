"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirPersonal } from "@/lib/supabase/server";
import { CIRCUNFERENCIAS, DOBRAS, percentualGordura } from "@/lib/avaliacao";
import { idade, numeroOuNulo } from "@/lib/formato";

const UUID = /^[0-9a-f-]{36}$/;
function ir(caminho: string, tipo: "ok" | "erro", msg: string): never {
  redirect(`${caminho}${caminho.includes("?") ? "&" : "?"}${tipo}=${encodeURIComponent(msg)}`);
}

export async function salvarAvaliacao(f: FormData) {
  const { supabase, personal } = await exigirPersonal();
  const alunoId = String(f.get("aluno_id") ?? "");
  if (!UUID.test(alunoId)) ir("/painel/alunos", "erro", "Aluno inválido.");
  const volta = `/painel/avaliacoes/nova?aluno=${alunoId}`;

  // RLS: só encontra se o aluno for deste personal
  const { data: aluno } = await supabase.from("alunos").select("id, sexo, data_nascimento").eq("id", alunoId).maybeSingle();
  if (!aluno) ir("/painel/alunos", "erro", "Aluno não encontrado.");

  const protocolo = String(f.get("protocolo") ?? "manual");
  const dados: Record<string, unknown> = {
    personal_id: personal.id,
    aluno_id: alunoId,
    data: String(f.get("data") ?? "") || undefined,
    peso_kg: numeroOuNulo(f.get("peso_kg")),
    altura_cm: numeroOuNulo(f.get("altura_cm")),
    protocolo: ["pollock3", "pollock7", "bioimpedancia", "manual"].includes(protocolo) ? protocolo : "manual",
    observacoes: String(f.get("observacoes") ?? "").trim().slice(0, 2000) || null
  };
  for (const [k] of [...CIRCUNFERENCIAS, ...DOBRAS]) dados[k] = numeroOuNulo(f.get(k));

  // % gordura: calculado pelas dobras (Pollock) ou informado (bioimpedância/manual)
  const calculado = percentualGordura(dados.protocolo as string, aluno.sexo, idade(aluno.data_nascimento), dados);
  dados.percentual_gordura = calculado ?? numeroOuNulo(f.get("percentual_gordura"));

  const { data: av, error } = await supabase.from("avaliacoes").insert(dados).select("id").single();
  if (error) ir(volta, "erro", "Confira os valores (algum número ficou fora da faixa aceita).");

  // fotos já enviadas pelo navegador ao Storage; só aceita caminhos da pasta deste personal/aluno
  const padrao = new RegExp(`^${personal.id}/${alunoId}/[0-9a-f-]{36}\\.(jpg|png|webp|heic)$`);
  const fotos = (["frente", "lado", "costas"] as const)
    .map((posicao) => ({ posicao, path: String(f.get(`foto_${posicao}`) ?? "") }))
    .filter((x) => padrao.test(x.path))
    .map((x) => ({ ...x, personal_id: personal.id, aluno_id: alunoId, avaliacao_id: av.id }));
  if (fotos.length) await supabase.from("avaliacao_fotos").insert(fotos);

  revalidatePath(`/painel/alunos/${alunoId}`);
  ir(`/painel/avaliacoes/${av.id}`, "ok", calculado ? `Avaliação salva. % de gordura calculado: ${calculado}%.` : "Avaliação salva.");
}

export async function excluirAvaliacao(f: FormData) {
  const { supabase } = await exigirPersonal();
  const id = String(f.get("id") ?? "");
  if (!UUID.test(id)) return;
  const { data: av } = await supabase.from("avaliacoes").select("aluno_id, avaliacao_fotos ( path )").eq("id", id).maybeSingle();
  if (!av) return;
  await supabase.from("avaliacoes").delete().eq("id", id);
  const paths = (av.avaliacao_fotos ?? []).map((x: { path: string }) => x.path);
  if (paths.length) await supabase.storage.from("avaliacoes").remove(paths);
  ir(`/painel/alunos/${av.aluno_id}`, "ok", "Avaliação excluída.");
}
