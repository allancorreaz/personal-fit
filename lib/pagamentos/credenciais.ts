import "server-only";
import { clienteServico } from "@/lib/supabase/servico";

/**
 * Lê as credenciais do Mercado Pago de um personal no Vault.
 * Só o cliente de serviço consegue (função liberada apenas para service_role).
 * Nunca devolva isto para o navegador.
 */
export async function credenciaisMP(personalId: string) {
  const db = clienteServico();
  const { data, error } = await db.rpc("obter_credenciais_mp", { p_personal_id: personalId });
  if (error) throw new Error("Falha ao ler credenciais de pagamento.");
  const linha = (data as { access_token: string | null; webhook_secret: string | null }[] | null)?.[0];
  return {
    accessToken: linha?.access_token ?? null,
    webhookSecret: linha?.webhook_secret ?? null
  };
}
