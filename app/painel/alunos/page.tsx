import Link from "next/link";
import { exigirPersonal } from "@/lib/supabase/server";
import { SITUACOES, formatBRL, type Situacao } from "@/lib/formato";

export const metadata = { title: "Alunos" };

export default async function AlunosPage({ searchParams }: { searchParams: Promise<{ q?: string; inativos?: string }> }) {
  const { q, inativos } = await searchParams;
  const { supabase } = await exigirPersonal();

  let query = supabase.from("vw_situacao_alunos").select("*").order("nome");
  if (!inativos) query = query.eq("ativo", true);
  if (q) query = query.ilike("nome", `%${q.replace(/[%_]/g, "")}%`);
  const { data: alunos } = await query;

  return (
    <div className="pilha">
      <div className="linha entre">
        <h1>Alunos</h1>
        <Link href="/painel/alunos/novo" className="botao">+ Novo aluno</Link>
      </div>
      <form className="linha">
        <input name="q" placeholder="Buscar por nome" defaultValue={q ?? ""} style={{ flex: 1, minWidth: 180 }} />
        <label className="linha suave pequeno"><input type="checkbox" name="inativos" value="1" defaultChecked={!!inativos} /> inativos</label>
        <button className="botao botao-sec">Buscar</button>
      </form>
      <div className="cartao">
        {(alunos ?? []).length === 0 ? (
          <p className="suave">Nenhum aluno encontrado.</p>
        ) : (
          <div className="lista">
            {(alunos ?? []).map((a) => (
              <Link key={a.aluno_id} href={`/painel/alunos/${a.aluno_id}`} className="linha entre">
                <span className="pilha" style={{ gap: 2 }}>
                  <strong>{a.nome}{!a.ativo && <span className="suave"> (inativo)</span>}</strong>
                  <span className="suave pequeno">{a.tem_app ? "Usa o app" : "Sem acesso ao app"}</span>
                </span>
                <span className={`tag ${SITUACOES[a.situacao as Situacao].classe}`}>
                  {a.situacao === "atrasado" ? `Atrasado · ${formatBRL(a.valor_atrasado)}` : SITUACOES[a.situacao as Situacao].label}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
