import Link from "next/link";
import { exigirAluno } from "@/lib/supabase/server";
import { formatDataHora, hojeSP, somarDias } from "@/lib/formato";

export const metadata = { title: "Histórico" };

export default async function HistoricoPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const { ok } = await searchParams;
  const { supabase, aluno } = await exigirAluno();
  const { data: sessoes } = await supabase
    .from("sessoes_treino")
    .select("id, nome_treino, iniciado_em, concluido_em, percepcao_esforco, sessao_series ( id )")
    .eq("aluno_id", aluno.id)
    .order("iniciado_em", { ascending: false })
    .limit(60);

  const desde = `${somarDias(hojeSP(), -30)}T00:00:00-03:00`;
  const mes = (sessoes ?? []).filter((s) => s.iniciado_em >= desde).length;

  return (
    <div className="pilha">
      <h1>Histórico</h1>
      {ok && <div className="aviso aviso-ok">Treino salvo! Seu personal já pode ver. 🔥</div>}
      <div className="grade">
        <div className="cartao"><div className="rotulo">Últimos 30 dias</div><div className="numero">{mes} treinos</div></div>
        <div className="cartao"><div className="rotulo">Total registrado</div><div className="numero">{sessoes?.length ?? 0}{(sessoes?.length ?? 0) >= 60 ? "+" : ""}</div></div>
      </div>
      <div className="cartao lista">
        {(sessoes ?? []).length === 0 ? <p className="suave">Nenhum treino ainda. <Link href="/app" className="destaque">Começar</Link></p> :
          (sessoes ?? []).map((s) => (
            <div key={s.id} className="linha entre">
              <span className="pilha" style={{ gap: 2 }}>
                <strong>{s.nome_treino}</strong>
                <span className="suave pequeno">{s.sessao_series?.length ?? 0} séries{s.percepcao_esforco ? ` · esforço ${s.percepcao_esforco}/10` : ""}</span>
              </span>
              <span className="suave pequeno">{formatDataHora(s.iniciado_em)}</span>
            </div>
          ))}
      </div>
    </div>
  );
}
