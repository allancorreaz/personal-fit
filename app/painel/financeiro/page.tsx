import Link from "next/link";
import { Aviso } from "@/components/aviso";
import { Enviar } from "@/components/ui";
import { exigirPersonal } from "@/lib/supabase/server";
import { urlBase } from "@/lib/url";
import { formatBRL, hojeSP } from "@/lib/formato";
import { gerarCobrancasAgora, verificarPagamentos } from "../actions";
import { CobrancaItem, type CobrancaLinha } from "../cobranca-item";

export const metadata = { title: "Financeiro" };

export default async function FinanceiroPage({
  searchParams
}: {
  searchParams: Promise<{ ok?: string; erro?: string; filtro?: string }>;
}) {
  const { ok, erro, filtro = "abertas" } = await searchParams;
  const { supabase } = await exigirPersonal();
  const hoje = hojeSP();

  let q = supabase
    .from("cobrancas")
    .select("*, alunos ( nome, whatsapp )")
    .order("vencimento", { ascending: filtro !== "pagas" })
    .limit(150);
  if (filtro === "atrasado") q = q.eq("status", "pendente").lt("vencimento", hoje);
  else if (filtro === "pagas") q = q.eq("status", "paga");
  else q = q.eq("status", "pendente");
  const { data: cobrancas } = await q;
  const total = (cobrancas ?? []).reduce((t, c) => t + c.valor_centavos, 0);
  const base = await urlBase();
  const volta = `/painel/financeiro?filtro=${filtro}`;

  const abas = [["abertas", "Em aberto"], ["atrasado", "Atrasadas"], ["pagas", "Pagas"]];

  return (
    <div className="pilha">
      <div className="linha entre">
        <h1>Financeiro</h1>
        <Link href="/painel/financeiro/planos" className="botao botao-sec">Planos</Link>
      </div>
      <Aviso ok={ok} erro={erro} />
      <div className="linha">
        <form action={gerarCobrancasAgora}><Enviar className="botao botao-sec botao-peq">Gerar cobranças dos próximos 5 dias</Enviar></form>
        <form action={verificarPagamentos}><input type="hidden" name="volta" value={volta} /><Enviar className="botao botao-sec botao-peq">Verificar Pix</Enviar></form>
      </div>
      <p className="suave pequeno">A rotina diária já faz isso sozinha todo dia às 7h. Os botões servem para adiantar.</p>
      <div className="linha">
        {abas.map(([k, v]) => (
          <Link key={k} href={`/painel/financeiro?filtro=${k}`} className={`botao botao-peq ${filtro === k ? "" : "botao-sec"}`}>{v}</Link>
        ))}
      </div>
      <div className="cartao pilha">
        <div className="linha entre"><span className="rotulo">{(cobrancas ?? []).length} cobranças</span><strong>{formatBRL(total)}</strong></div>
        {(cobrancas ?? []).length === 0 ? <p className="suave">Nada aqui.</p> : (
          <div className="lista">
            {(cobrancas ?? []).map((c) => <CobrancaItem key={c.id} c={c as CobrancaLinha} volta={volta} base={base} mostrarAluno />)}
          </div>
        )}
      </div>
    </div>
  );
}
