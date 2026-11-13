import "server-only";
import { headers } from "next/headers";

/**
 * Endereço base do site para montar links enviados aos alunos.
 * Usa SITE_URL (ex.: https://www.academia.com.br) quando configurada;
 * senão, o próprio endereço acessado (funciona também nos previews da Vercel).
 */
export async function urlBase() {
  const fixa = process.env.SITE_URL?.replace(/\/$/, "");
  if (fixa) return fixa;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function linkPagamento(token: string) {
  return `${await urlBase()}/pagar/${token}`;
}
