import "server-only";
import { ErroPagamento, type PixCriado, type SituacaoPagamento } from "./tipos";

/**
 * Pix via Mercado Pago — API de Orders.
 * No SaaS, cada personal usa o PRÓPRIO Access Token (o dinheiro cai na conta dele).
 * O token chega aqui vindo do Vault, lido só no servidor.
 */

const API = "https://api.mercadopago.com/v1/orders";
const reais = (centavos: number) => (centavos / 100).toFixed(2);

type OrderMP = {
  id: string;
  status: string;
  status_detail: string;
  total_amount: string;
  total_paid_amount?: string;
  external_reference?: string;
  last_updated_date?: string;
  transactions?: {
    payments?: {
      id: string;
      amount: string;
      date_of_expiration?: string;
      payment_method?: { id: string; ticket_url?: string; qr_code?: string };
    }[];
  };
  errors?: { code: string; message: string }[];
  message?: string;
};

async function lerErro(res: Response) {
  try {
    const body = (await res.json()) as OrderMP;
    const detalhe = body.errors?.map((e) => `${e.code}: ${e.message}`).join("; ") || body.message;
    return `Mercado Pago respondeu ${res.status}${detalhe ? ` — ${detalhe}` : ""}`;
  } catch {
    return `Mercado Pago respondeu ${res.status}`;
  }
}

export async function criarPixMP(
  accessToken: string,
  p: { referencia: string; valorCentavos: number; emailPagador: string; expiraEmDias: number }
): Promise<PixCriado> {
  const res = await fetch(API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": crypto.randomUUID()
    },
    body: JSON.stringify({
      type: "online",
      processing_mode: "automatic",
      external_reference: p.referencia,
      total_amount: reais(p.valorCentavos),
      payer: { email: p.emailPagador },
      transactions: {
        payments: [
          {
            amount: reais(p.valorCentavos),
            payment_method: { id: "pix", type: "bank_transfer" },
            expiration_time: `P${p.expiraEmDias}D`
          }
        ]
      }
    }),
    cache: "no-store"
  });
  if (!res.ok) throw new ErroPagamento(await lerErro(res));

  const order = (await res.json()) as OrderMP;
  const pagamento = order.transactions?.payments?.[0];
  const copiaECola = pagamento?.payment_method?.qr_code;
  if (!copiaECola) throw new ErroPagamento("O Mercado Pago não retornou o código Pix.");

  return {
    provedor: "mercadopago",
    idPagamento: order.id,
    copiaECola,
    link: pagamento?.payment_method?.ticket_url ?? null,
    expiraEm: pagamento?.date_of_expiration ?? new Date(Date.now() + p.expiraEmDias * 86_400_000).toISOString()
  };
}

export async function consultarPixMP(accessToken: string, idPagamento: string): Promise<SituacaoPagamento> {
  const res = await fetch(`${API}/${encodeURIComponent(idPagamento)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store"
  });
  if (!res.ok) throw new ErroPagamento(await lerErro(res));
  const order = (await res.json()) as OrderMP;

  if (order.status === "processed" && order.status_detail === "accredited") {
    return {
      pago: true,
      valorCentavos: Math.round(Number(order.total_paid_amount ?? order.total_amount) * 100),
      pagoEm: order.last_updated_date ?? new Date().toISOString(),
      referencia: order.external_reference ?? null
    };
  }
  const encerrado = ["canceled", "expired", "failed", "refunded"].includes(order.status);
  return { pago: false, encerrado, detalhe: `${order.status}/${order.status_detail}` };
}

/** Testa o token ao salvar: uma consulta simples que só funciona com token válido. */
export async function testarTokenMP(accessToken: string) {
  const res = await fetch("https://api.mercadopago.com/users/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store"
  });
  return res.ok;
}
