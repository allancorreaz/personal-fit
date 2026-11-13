"use client";
import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente do navegador (chave pública + sessão do usuário).
 * Usado só para ENVIAR ARQUIVOS direto ao Storage: assim fotos e vídeos não
 * passam pelo servidor (a Vercel limita o corpo a ~4,5 MB). Quem decide se o
 * envio é permitido é o RLS do Storage (pasta do próprio personal).
 */
export function clienteNavegador() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
