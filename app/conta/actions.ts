"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Troca a senha de quem está logado (personal ou aluno).
 * Pede a senha atual: se alguém pegar o celular desbloqueado, não troca a senha sem saber a antiga.
 */
export async function trocarSenha(f: FormData) {
  const volta = String(f.get("volta") ?? "/inicio").startsWith("/app") ? "/app/perfil" : "/painel/configuracoes";
  const atual = String(f.get("atual") ?? "");
  const nova = String(f.get("nova") ?? "");
  const confirma = String(f.get("confirma") ?? "");
  const erro = (m: string) => redirect(`${volta}?erro=${encodeURIComponent(m)}`);

  if (nova.length < 8) erro("A nova senha precisa ter pelo menos 8 caracteres.");
  if (nova !== confirma) erro("A confirmação não confere.");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) redirect("/entrar");

  const { error: errLogin } = await supabase.auth.signInWithPassword({ email: user.email, password: atual });
  if (errLogin) erro("Senha atual incorreta.");

  const { error } = await supabase.auth.updateUser({ password: nova });
  if (error) erro("Não foi possível trocar a senha. Use uma senha diferente da atual.");
  redirect(`${volta}?ok=${encodeURIComponent("Senha alterada.")}`);
}
