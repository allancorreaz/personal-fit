import { redirect } from "next/navigation";
import { sessaoAtual } from "@/lib/supabase/server";

/** Decide para onde cada pessoa vai depois do login. */
export default async function InicioPage() {
  const { supabase, user, personal, alunos } = await sessaoAtual();
  if (!user) redirect("/entrar");
  if (personal) redirect("/painel");
  if (alunos.length > 0) redirect("/app");

  // primeiro acesso de quem se cadastrou como personal: cria o perfil
  const meta = user.user_metadata as { tipo?: string; nome?: string };
  if (meta?.tipo === "personal") {
    const { error } = await supabase.from("personais").insert({
      user_id: user.id,
      nome: (meta.nome ?? "Personal").slice(0, 120),
      email: user.email ?? ""
    });
    if (!error || error.code === "23505") redirect("/painel");
  }

  return (
    <main className="conteudo-estreito pilha">
      <h1>Conta sem vínculo</h1>
      <p className="suave">
        Este login ainda não está ligado a nenhum personal. Se você é aluno, abra o link de convite que seu
        personal enviou.
      </p>
      <form action="/sair" method="post"><button className="botao botao-sec">Sair</button></form>
    </main>
  );
}
