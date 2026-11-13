"use server";

import { redirect } from "next/navigation";
import { clienteServico } from "@/lib/supabase/servico";
import { createClient } from "@/lib/supabase/server";
import { tokenValido } from "@/lib/token";

/*
 * Aceitar convite. O token (32 hex, secreto) é a prova de que o personal
 * convidou esta pessoa. Regras:
 *  - o login criado usa SEMPRE o e-mail que o personal cadastrou (não o digitado);
 *  - o token é de uso único (apagado ao vincular);
 *  - o vínculo só é gravado se o aluno ainda não tiver login (evita sequestro).
 */

function ir(token: string, msg: string): never {
  redirect(`/convite/${token}?erro=${encodeURIComponent(msg)}`);
}

async function alunoDoConvite(token: string) {
  const db = clienteServico();
  const { data } = await db
    .from("alunos")
    .select("id, email, user_id, ativo")
    .eq("convite_token", token)
    .maybeSingle();
  return { db, aluno: data };
}

async function vincular(db: ReturnType<typeof clienteServico>, alunoId: string, userId: string) {
  const { data } = await db
    .from("alunos")
    .update({ user_id: userId, convite_aceito_em: new Date().toISOString(), convite_token: null })
    .eq("id", alunoId)
    .is("user_id", null)
    .select("id")
    .maybeSingle();
  return Boolean(data);
}

export async function criarAcesso(f: FormData) {
  const token = String(f.get("token") ?? "");
  const senha = String(f.get("senha") ?? "");
  const confirma = String(f.get("confirma") ?? "");
  if (!tokenValido(token)) redirect("/entrar");
  if (senha.length < 8) ir(token, "A senha precisa ter pelo menos 8 caracteres.");
  if (senha !== confirma) ir(token, "As senhas não conferem.");

  const { db, aluno } = await alunoDoConvite(token);
  if (!aluno || !aluno.ativo || aluno.user_id || !aluno.email) ir(token, "Convite inválido ou já usado.");

  const { data: criado, error } = await db.auth.admin.createUser({
    email: aluno.email,
    password: senha,
    email_confirm: true,
    user_metadata: { tipo: "aluno" }
  });
  if (error || !criado.user) {
    // e-mail já tem conta (ex.: aluno de outro personal): pede para entrar e vincular
    redirect(`/entrar?destino=/convite/${token}&ok=${encodeURIComponent("Você já tem uma conta com este e-mail. Entre para aceitar o convite.")}`);
  }
  if (!(await vincular(db, aluno.id, criado.user.id))) ir(token, "Convite já usado.");

  const supabase = await createClient();
  await supabase.auth.signInWithPassword({ email: aluno.email, password: senha });
  redirect("/app");
}

export async function vincularContaLogada(f: FormData) {
  const token = String(f.get("token") ?? "");
  if (!tokenValido(token)) redirect("/entrar");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/entrar?destino=/convite/${token}`);

  const { db, aluno } = await alunoDoConvite(token);
  if (!aluno || !aluno.ativo || aluno.user_id || !aluno.email) ir(token, "Convite inválido ou já usado.");
  if (aluno.email.toLowerCase() !== (user.email ?? "").toLowerCase())
    ir(token, "Este convite é para outro e-mail. Saia e entre com o e-mail certo.");
  if (!(await vincular(db, aluno.id, user.id))) ir(token, "Convite já usado.");
  redirect("/app");
}
