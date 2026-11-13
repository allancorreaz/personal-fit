import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirPersonal } from "@/lib/supabase/server";
import { formatDataHora } from "@/lib/formato";

export default async function SessaoPage({ params }: { params: Promise<{ id: string; sid: string }> }) {
  const { id, sid } = await params;
  if (!/^[0-9a-f-]{36}$/.test(sid)) notFound();
  const { supabase } = await exigirPersonal();
  const { data: s } = await supabase
    .from("sessoes_treino")
    .select("*, alunos ( nome ), sessao_series ( serie, repeticoes, carga_kg, concluida, exercicios ( nome ) )")
    .eq("id", sid)
    .maybeSingle();
  if (!s) notFound();

  const porExercicio = new Map<string, { serie: number; repeticoes: number | null; carga_kg: number | null }[]>();
  for (const x of s.sessao_series ?? []) {
    const nome = x.exercicios?.nome ?? "?";
    porExercicio.set(nome, [...(porExercicio.get(nome) ?? []), x].sort((a, b) => a.serie - b.serie));
  }

  return (
    <div className="pilha" style={{ maxWidth: 720 }}>
      <Link href={`/painel/alunos/${id}`} className="suave">← {s.alunos?.nome}</Link>
      <h1>{s.nome_treino}</h1>
      <p className="suave">
        {formatDataHora(s.iniciado_em)}{s.concluido_em ? ` → ${formatDataHora(s.concluido_em)}` : " (não concluído)"}
        {s.percepcao_esforco ? ` · esforço ${s.percepcao_esforco}/10` : ""}
      </p>
      {s.observacoes && <div className="aviso">💬 {s.observacoes}</div>}
      <div className="cartao lista">
        {[...porExercicio.entries()].map(([nome, series]) => (
          <div key={nome}>
            <strong>{nome}</strong>
            <p className="suave pequeno">{series.map((x) => `${x.repeticoes ?? "-"} × ${x.carga_kg ?? 0}kg`).join("  ·  ")}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
