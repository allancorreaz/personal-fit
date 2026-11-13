import { exigirAluno } from "@/lib/supabase/server";
import { formatBRL, formatData, formatDataHora, hojeSP } from "@/lib/formato";

export const metadata = { title: "Pagamentos" };

export default async function PagamentosPage() {
  const { supabase, aluno } = await exigirAluno();
  const { data: cobrancas } = await supabase
    .from("cobrancas")
    .select("id, descricao, valor_centavos, vencimento, status, pago_em, link_token")
    .eq("aluno_id", aluno.id)
    .neq("status", "cancelada")
    .order("vencimento", { ascending: false })
    .limit(36);
  const hoje = hojeSP();

  return (
    <div className="pilha">
      <h1>Pagamentos</h1>
      <div className="cartao lista">
        {(cobrancas ?? []).length === 0 ? <p className="suave">Nenhuma cobrança.</p> :
          (cobrancas ?? []).map((c) => (
            <div key={c.id} className="linha entre">
              <span className="pilha" style={{ gap: 2 }}>
                <strong>{c.descricao}</strong>
                <span className="suave pequeno">{formatBRL(c.valor_centavos)} · vence {formatData(c.vencimento)}{c.pago_em ? ` · pago ${formatDataHora(c.pago_em)}` : ""}</span>
              </span>
              {c.status === "paga" ? <span className="tag tag-verde">Pago</span> : (
                <a href={`/pagar/${c.link_token}`} className="botao botao-peq">{c.vencimento < hoje ? "Pagar (atrasado)" : "Pagar"}</a>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}
