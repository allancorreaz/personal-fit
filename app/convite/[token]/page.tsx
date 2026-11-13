import { notFound } from "next/navigation";
import { Aviso } from "@/components/aviso";
import { Enviar } from "@/components/ui";
import { clienteServico } from "@/lib/supabase/servico";
import { createClient } from "@/lib/supabase/server";
import { tokenValido } from "@/lib/token";
import { PRODUTO } from "@/lib/marca";
import { um } from "@/lib/formato";
import { criarAcesso, vincularContaLogada } from "./actions";

export const metadata = { title: "Convite", robots: { index: false } };

function mascarar(email: string) {
  const [u, d] = email.split("@");
  return `${u.slice(0, 2)}${"•".repeat(Math.max(1, u.length - 2))}@${d}`;
}

export default async function ConvitePage({
  params,
  searchParams
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const { token } = await params;
  const { erro } = await searchParams;
  if (!tokenValido(token)) notFound();

  // lê com a chave de serviço só os campos necessários para a tela
  const { data: aluno } = await clienteServico()
    .from("alunos")
    .select("nome, email, user_id, ativo, personais ( nome, nome_marca )")
    .eq("convite_token", token)
    .maybeSingle();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!aluno || !aluno.ativo || aluno.user_id || !aluno.email) {
    return (
      <main className="conteudo-estreito pilha">
        <h1>Convite inválido</h1>
        <p className="suave">Este link já foi usado ou expirou. Peça um novo ao seu personal.</p>
      </main>
    );
  }

  const p = um(aluno.personais);
  const personal = p?.nome_marca || p?.nome;
  return (
    <main className="conteudo-estreito pilha">
      <div className="marca"><span className="marca-icone">▮▮</span>{PRODUTO.nome}</div>
      <h1>Olá, {aluno.nome.split(" ")[0]}!</h1>
      <p className="suave">{personal} convidou você para acompanhar seus treinos, avaliações e pagamentos pelo app.</p>
      <Aviso erro={erro} />
      {user ? (
        <form action={vincularContaLogada} className="pilha">
          <input type="hidden" name="token" value={token} />
          <p className="suave">Você está conectado como {user.email}.</p>
          <Enviar className="botao botao-bloco">Aceitar convite</Enviar>
        </form>
      ) : (
        <form action={criarAcesso} className="pilha">
          <input type="hidden" name="token" value={token} />
          <label className="campo">Seu e-mail de acesso<input value={mascarar(aluno.email)} disabled /></label>
          <label className="campo">Crie uma senha (mín. 8)<input name="senha" type="password" required minLength={8} autoComplete="new-password" /></label>
          <label className="campo">Repita a senha<input name="confirma" type="password" required minLength={8} autoComplete="new-password" /></label>
          <Enviar className="botao botao-bloco">Criar meu acesso</Enviar>
        </form>
      )}
    </main>
  );
}
