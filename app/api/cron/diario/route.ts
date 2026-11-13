import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { gerarCobrancasProximas, gerarPixPendentes, sincronizarPendentes } from "@/lib/cobrancas";
import { clienteServico } from "@/lib/supabase/servico";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function autorizado(req: Request) {
  const segredo = process.env.CRON_SECRET;
  const enviado = req.headers.get("authorization") ?? "";
  if (!segredo) return false;
  const esperado = Buffer.from(`Bearer ${segredo}`);
  const recebido = Buffer.from(enviado);
  return esperado.length === recebido.length && timingSafeEqual(esperado, recebido);
}

/** Rotina diária (Vercel Cron): cobranças → Pix → conferência de pagamentos, para todos os personais. */
export async function GET(req: Request) {
  if (!autorizado(req)) return NextResponse.json({ ok: false }, { status: 401 });
  const db = clienteServico();
  const resultado: Record<string, unknown> = {};
  for (const [nome, passo] of [
    ["cobrancas", () => gerarCobrancasProximas(db, {}, 5)],
    ["pix", () => gerarPixPendentes(db, 5)],
    ["conferencia", () => sincronizarPendentes(db)]
  ] as const) {
    try {
      resultado[nome] = await passo();
    } catch (e) {
      resultado[nome] = { erro: e instanceof Error ? e.message : "falha" };
    }
  }
  return NextResponse.json({ ok: true, ...resultado });
}
