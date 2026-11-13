import { NextResponse } from "next/server";
import { InvalidWebhookSignatureError, WebhookSignatureValidator } from "mercadopago";
import { confirmarPagamento } from "@/lib/cobrancas";
import { credenciaisMP } from "@/lib/pagamentos/credenciais";
import { clienteServico } from "@/lib/supabase/servico";

export const dynamic = "force-dynamic";

/**
 * Webhook do Mercado Pago, UM POR PERSONAL (/api/webhooks/mercadopago/{personal_id}).
 * Dupla verificação:
 *  1ª — assinatura conferida com o segredo DESTE personal (guardado no Vault);
 *  2ª — nada do corpo é aceito: a order é reconsultada na API com o token dele
 *       e só a cobrança DESTE personal pode ser baixada.
 */
export async function POST(req: Request, { params }: { params: Promise<{ personal: string }> }) {
  const { personal } = await params;
  if (!/^[0-9a-f-]{36}$/.test(personal)) return NextResponse.json({ ok: false }, { status: 404 });

  const { webhookSecret } = await credenciaisMP(personal);
  if (!webhookSecret) return NextResponse.json({ ok: false }, { status: 404 });

  const url = new URL(req.url);
  let corpo: { type?: string; data?: { id?: string } } = {};
  try { corpo = await req.json(); } catch { /* vazio */ }
  const dataId = url.searchParams.get("data.id") ?? corpo.data?.id ?? "";

  const validar = (id: string) =>
    WebhookSignatureValidator.validate({
      xSignature: req.headers.get("x-signature") ?? "",
      xRequestId: req.headers.get("x-request-id") ?? "",
      dataId: id,
      secret: webhookSecret
    });
  try {
    try {
      validar(dataId.toLowerCase());
    } catch (e) {
      if (e instanceof InvalidWebhookSignatureError && dataId !== dataId.toLowerCase()) validar(dataId);
      else throw e;
    }
  } catch (e) {
    if (e instanceof InvalidWebhookSignatureError) return NextResponse.json({ ok: false }, { status: 401 });
    throw e;
  }

  const tipo = url.searchParams.get("type") ?? corpo.type ?? "";
  if (tipo !== "order" || !/^[A-Za-z0-9-]+$/.test(dataId)) return NextResponse.json({ ok: true, ignorado: true });

  const db = clienteServico();
  const { data: cobranca } = await db
    .from("cobrancas")
    .select("id")
    .eq("personal_id", personal)
    .eq("provedor", "mercadopago")
    .ilike("provedor_pagamento_id", dataId)
    .maybeSingle();
  if (!cobranca) return NextResponse.json({ ok: true, ignorado: true });

  try {
    return NextResponse.json({ ok: true, resultado: await confirmarPagamento(db, cobranca.id) });
  } catch (e) {
    console.error("[webhook MP]", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false }, { status: 500 }); // MP tenta de novo depois
  }
}
