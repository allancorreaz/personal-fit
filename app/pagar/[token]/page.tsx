import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { Copiar } from "@/components/ui";
import { clienteServico } from "@/lib/supabase/servico";
import { tokenValido } from "@/lib/token";
import { garantirPix, pixValido } from "@/lib/cobrancas";
import { ErroPagamento } from "@/lib/pagamentos/tipos";
import { formatBRL, formatData, formatDataHora, um } from "@/lib/formato";
import { AguardandoPagamento } from "./aguardando";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pagamento", robots: { index: false, follow: false } };

/**
 * Página pública de pagamento. Quem tem o link (token secreto de 32 hex) vê
 * apenas: nome do personal, primeiro nome do aluno, descrição, valor e o Pix.
 */
export default async function PagarPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!tokenValido(token)) notFound();
  const db = clienteServico();
  const { data: c } = await db
    .from("cobrancas")
    .select("id, descricao, valor_centavos, vencimento, status, pago_em, pix_copia_cola, pix_expira_em, alunos ( nome ), personais ( nome, nome_marca )")
    .eq("link_token", token)
    .maybeSingle();
  if (!c) notFound();

  const p = um(c.personais);
  const personal = p?.nome_marca || p?.nome;
  const primeiro = um(c.alunos)?.nome?.split(" ")[0];

  let pix = pixValido(c) ? { copiaECola: c.pix_copia_cola as string, expiraEm: c.pix_expira_em as string } : null;
  let erro: string | null = null;
  if (c.status === "pendente" && !pix) {
    try {
      pix = await garantirPix(db, c.id);
    } catch (e) {
      erro = e instanceof ErroPagamento ? "O Pix ainda não está disponível. Fale com seu personal." : "Não foi possível gerar o Pix agora. Tente em instantes.";
    }
  }
  const qr = pix ? await QRCode.toDataURL(pix.copiaECola, { margin: 1, width: 260 }) : null;

  return (
    <main className="conteudo-estreito pilha" style={{ textAlign: "center" }}>
      <p className="rotulo">{personal}</p>
      <h1>{c.status === "paga" ? "Pagamento confirmado ✓" : `Olá, ${primeiro}!`}</h1>
      <div className="cartao pilha">
        <p>{c.descricao}</p>
        <div className="numero">{formatBRL(c.valor_centavos)}</div>
        <p className="suave pequeno">Vencimento {formatData(c.vencimento)}</p>
      </div>

      {c.status === "paga" && <p className="destaque">Recebido em {formatDataHora(c.pago_em)}. Obrigado! 💪</p>}
      {c.status === "cancelada" && <p className="suave">Esta cobrança foi cancelada.</p>}
      {c.status === "pendente" && erro && <div className="aviso aviso-erro">{erro}</div>}
      {c.status === "pendente" && pix && qr && (
        <div className="cartao pilha" style={{ alignItems: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="QR Code Pix" width={240} height={240} style={{ background: "#fff", borderRadius: 12, padding: 8 }} />
          <p className="suave pequeno">Abra o app do seu banco → Pix → Ler QR Code, ou copie o código:</p>
          <Copiar texto={pix.copiaECola} rotulo="Copiar código Pix" />
          <p className="suave pequeno">Válido até {formatDataHora(pix.expiraEm)}</p>
          <AguardandoPagamento token={token} />
        </div>
      )}
    </main>
  );
}
