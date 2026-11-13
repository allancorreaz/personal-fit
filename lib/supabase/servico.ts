import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Cliente com a chave SECRETA (ignora o RLS). Só no servidor: o import
 * "server-only" faz o build falhar se um componente de navegador importar isto.
 *
 * Usado apenas onde o próprio código faz a verificação: aceitar convite
 * (token), página pública de pagamento (token), webhook (assinatura +
 * reconsulta), rotina diária (CRON_SECRET) e leitura das credenciais do
 * Mercado Pago no Vault.
 */
export function clienteServico() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SECRET_KEY;
  if (!url || !chave) throw new Error("SUPABASE_SECRET_KEY não configurada.");
  return createClient<Database>(url, chave, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}
