"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function entrar(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const senha = String(formData.get("senha") ?? "");
  const destino = String(formData.get("destino") ?? "");
  if (!EMAIL.test(email) || senha.length < 6) redirect("/entrar?erro=" + encodeURIComponent("Informe e-mail e senha."));

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
  // mensagem genérica: não revela se o e-mail existe
  if (error) redirect("/entrar?erro=" + encodeURIComponent("E-mail ou senha incorretos (ou e-mail ainda não confirmado)."));

  // só aceita destino interno (evita redirecionamento para site falso)
  redirect(/^\/convite\/[a-f0-9]{32}$/.test(destino) ? destino : "/inicio");
}

export async function cadastrarPersonal(formData: FormData) {
  const nome = String(formData.get("nome") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const senha = String(formData.get("senha") ?? "");
  const volta = (m: string) => redirect("/cadastro?erro=" + encodeURIComponent(m));

  if (nome.length < 2) volta("Informe seu nome.");
  if (!EMAIL.test(email)) volta("E-mail inválido.");
  if (senha.length < 8) volta("A senha precisa ter pelo menos 8 caracteres.");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password: senha,
    options: { data: { tipo: "personal", nome } }
  });
  if (error) volta("Não foi possível criar a conta. Tente outro e-mail ou mais tarde.");

  // com confirmação de e-mail ligada não há sessão ainda
  if (!data.session) redirect("/entrar?ok=" + encodeURIComponent("Conta criada! Confirme pelo link enviado ao seu e-mail e entre."));
  redirect("/inicio");
}

export async function sair() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/entrar");
}
