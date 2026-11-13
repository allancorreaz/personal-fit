import { NextResponse } from "next/server";
import { confirmarPagamento } from "@/lib/cobrancas";
import { clienteServico } from "@/lib/supabase/servico";
import { tokenValido } from "@/lib/token";

export const dynamic = "force-dynamic";
const SEM_CACHE = { "Cache-Control": "no-store, max-age=0" };

/** Só responde { status }. No máximo 1 consulta ao Mercado Pago a cada 10s por cobrança. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!tokenValido(token)) return NextResponse.json({ status: "invalido" }, { status: 404, headers: SEM_CACHE });

  const db = clienteServico();
  const { data: c } = await db.from("cobrancas").select("id, status, provedor_pagamento_id").eq("link_token", token).maybeSingle();
  if (!c) return NextResponse.json({ status: "invalido" }, { status: 404, headers: SEM_CACHE });
  if (c.status !== "pendente" || !c.provedor_pagamento_id) return NextResponse.json({ status: c.status }, { headers: SEM_CACHE });

  const limite = new Date(Date.now() - 10_000).toISOString();
  const { data: reservada } = await db
    .from("cobrancas")
    .update({ ultima_verificacao_em: new Date().toISOString() })
    .eq("id", c.id)
    .eq("status", "pendente")
    .or(`ultima_verificacao_em.is.null,ultima_verificacao_em.lt.${limite}`)
    .select("id")
    .maybeSingle();
  if (!reservada) return NextResponse.json({ status: "pendente" }, { headers: SEM_CACHE });

  try {
    const r = await confirmarPagamento(db, c.id);
    return NextResponse.json({ status: r === "paga" ? "paga" : "pendente" }, { headers: SEM_CACHE });
  } catch (e) {
    console.error("[api/pagar]", e instanceof Error ? e.message : e);
    return NextResponse.json({ status: "pendente" }, { headers: SEM_CACHE });
  }
}
