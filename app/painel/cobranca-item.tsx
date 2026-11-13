import { Copiar, Enviar } from "@/components/ui";
import { formatBRL, formatData, formatDataHora, hojeSP, linkWhatsapp } from "@/lib/formato";
import { cancelarCobranca, desfazerPagamento, gerarPix, marcarPaga } from "./actions";

export type CobrancaLinha = {
  id: string; descricao: string; vencimento: string; valor_centavos: number; status: string;
  pago_em: string | null; forma_pagamento: string | null; origem_baixa: string | null;
  link_token: string; pix_copia_cola: string | null; pix_expira_em: string | null;
  alunos?: { nome: string; whatsapp: string | null } | null;
};

const FORMAS: Record<string, string> = { pix: "Pix", dinheiro: "Dinheiro", transferencia: "Transferência", cartao: "Cartão", outro: "Outro" };

export function CobrancaItem({ c, volta, base, mostrarAluno = false }: { c: CobrancaLinha; volta: string; base: string; mostrarAluno?: boolean }) {
  const atrasada = c.status === "pendente" && c.vencimento < hojeSP();
  const link = `${base}/pagar/${c.link_token}`;
  const pixAtivo = Boolean(c.pix_copia_cola && c.pix_expira_em && new Date(c.pix_expira_em) > new Date());
  const tag =
    c.status === "paga" ? <span className="tag tag-verde">Paga · {FORMAS[c.forma_pagamento ?? ""] ?? ""}{c.origem_baixa === "automatica" ? " (auto)" : ""}</span>
    : c.status === "cancelada" ? <span className="tag tag-cinza">Cancelada</span>
    : atrasada ? <span className="tag tag-vermelho">Atrasada</span>
    : <span className="tag tag-amarelo">Pendente</span>;

  const zap = c.alunos?.whatsapp
    ? linkWhatsapp(c.alunos.whatsapp, `Olá, ${c.alunos.nome.split(" ")[0]}! Segue o link para pagar ${c.descricao} (${formatBRL(c.valor_centavos)}, vence ${formatData(c.vencimento)}):\n${link}`)
    : null;

  return (
    <div className="pilha" style={{ gap: 8 }}>
      <div className="linha entre">
        <span className="pilha" style={{ gap: 2 }}>
          <strong>{mostrarAluno && c.alunos ? `${c.alunos.nome} · ` : ""}{c.descricao}</strong>
          <span className="suave pequeno">
            {formatBRL(c.valor_centavos)} · vence {formatData(c.vencimento)}
            {c.pago_em && ` · pago ${formatDataHora(c.pago_em)}`}
          </span>
        </span>
        {tag}
      </div>
      {c.status === "pendente" && (
        <div className="linha">
          <Copiar texto={link} rotulo="Copiar link" />
          {zap && <a className="botao botao-sec botao-peq" href={zap} target="_blank" rel="noopener noreferrer">WhatsApp</a>}
          {!pixAtivo && (
            <form action={gerarPix}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="volta" value={volta} /><Enviar className="botao botao-sec botao-peq">Gerar Pix</Enviar></form>
          )}
          <details>
            <summary className="botao botao-sec botao-peq">Recebi</summary>
            <form action={marcarPaga} className="linha" style={{ marginTop: 8 }}>
              <input type="hidden" name="id" value={c.id} /><input type="hidden" name="volta" value={volta} />
              <select name="forma" defaultValue="dinheiro" style={{ width: "auto" }}>
                {Object.entries(FORMAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <Enviar className="botao botao-peq">Confirmar</Enviar>
            </form>
          </details>
          <form action={cancelarCobranca}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="volta" value={volta} /><Enviar className="botao botao-perigo botao-peq" confirmar="Cancelar esta cobrança?">Cancelar</Enviar></form>
        </div>
      )}
      {c.status === "paga" && c.origem_baixa === "manual" && (
        <form action={desfazerPagamento}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="volta" value={volta} /><Enviar className="botao botao-sec botao-peq" confirmar="Desfazer este pagamento?">Desfazer</Enviar></form>
      )}
    </div>
  );
}
