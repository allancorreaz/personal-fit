import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirAluno } from "@/lib/supabase/server";
import { Midia, urlsAssinadas } from "@/lib/midia";
import { Execucao, type ItemExec } from "./execucao";
import { um } from "@/lib/formato";

type Ex = {
  id: string; ordem: number; series: number; repeticoes: string; carga: string | null; descanso_seg: number | null;
  metodo: string | null; observacoes: string | null;
  exercicios: { id: string; nome: string; video_url: string | null; midia_path: string | null; instrucoes: string | null } | null;
};

export default async function TreinoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ erro?: string }> }) {
  const { id } = await params;
  const { erro } = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { supabase, aluno } = await exigirAluno();

  // RLS: só retorna se o treino for da ficha ATIVA deste aluno
  const { data: treino } = await supabase
    .from("ficha_treinos")
    .select("id, nome, observacoes, ficha_exercicios ( id, ordem, series, repeticoes, carga, descanso_seg, metodo, observacoes, exercicios ( id, nome, video_url, midia_path, instrucoes ) )")
    .eq("id", id)
    .maybeSingle();
  if (!treino) notFound();

  const itens = [...((treino.ficha_exercicios ?? []) as unknown as (Omit<Ex, "exercicios"> & { exercicios: Ex["exercicios"] | Ex["exercicios"][] })[])].map((i) => ({ ...i, exercicios: um(i.exercicios) }) as Ex).sort((a, b) => a.ordem - b.ordem);
  const exIds = itens.map((i) => i.exercicios?.id).filter(Boolean) as string[];

  const [{ data: historico }, urls] = await Promise.all([
    exIds.length
      ? supabase.from("sessao_series").select("exercicio_id, repeticoes, carga_kg, criado_em").eq("aluno_id", aluno.id).in("exercicio_id", exIds).order("criado_em", { ascending: false }).limit(400)
      : Promise.resolve({ data: [] as { exercicio_id: string; repeticoes: number | null; carga_kg: number | null }[] }),
    urlsAssinadas(supabase, "exercicios", itens.map((i) => i.exercicios?.midia_path))
  ]);
  const ultimo = new Map<string, { repeticoes: number | null; carga_kg: number | null }>();
  for (const h of historico ?? []) if (!ultimo.has(h.exercicio_id)) ultimo.set(h.exercicio_id, h);

  const exec: ItemExec[] = itens.map((i) => {
    const e = i.exercicios;
    const u = e ? ultimo.get(e.id) : undefined;
    const temMidia = e && (e.video_url || e.midia_path);
    return {
      id: i.id,
      nome: e?.nome ?? "Exercício",
      series: i.series,
      repeticoes: i.repeticoes,
      carga: i.carga,
      descanso: i.descanso_seg,
      metodo: i.metodo,
      observacoes: [i.observacoes, e?.instrucoes].filter(Boolean).join(" — ") || null,
      midia: temMidia ? <Midia videoUrl={e.video_url} arquivoUrl={e.midia_path ? urls.get(e.midia_path) : null} nome={e.nome} /> : null,
      ultimaCarga: u?.carga_kg !== undefined && u?.carga_kg !== null ? Number(u.carga_kg) : null,
      ultimasReps: u?.repeticoes ?? null
    };
  });

  return (
    <div className="pilha" style={{ maxWidth: 640, margin: "0 auto" }}>
      <Link href="/app" className="suave">← Treinos</Link>
      <h1>{treino.nome}</h1>
      {treino.observacoes && <p className="suave">{treino.observacoes}</p>}
      {erro && <div className="aviso aviso-erro">Não foi possível salvar. Verifique a internet e tente de novo.</div>}
      {exec.length === 0 ? <p className="suave">Este treino ainda não tem exercícios.</p> : <Execucao treinoId={treino.id} itens={exec} />}
    </div>
  );
}
