import Link from "next/link";
import { Aviso } from "@/components/aviso";
import { Enviar } from "@/components/ui";
import { PRODUTO } from "@/lib/marca";
import { entrar } from "./actions";

export const metadata = { title: "Entrar" };

export default async function EntrarPage({
  searchParams
}: {
  searchParams: Promise<{ ok?: string; erro?: string; destino?: string }>;
}) {
  const { ok, erro, destino } = await searchParams;
  return (
    <main className="conteudo-estreito pilha">
      <div className="marca"><span className="marca-icone">▮▮</span>{PRODUTO.nome}</div>
      <h1>Entrar</h1>
      <p className="suave">Personal ou aluno: use o mesmo acesso.</p>
      <Aviso ok={ok} erro={erro} />
      <form action={entrar} className="pilha">
        <input type="hidden" name="destino" value={destino ?? ""} />
        <label className="campo">E-mail<input name="email" type="email" autoComplete="email" required /></label>
        <label className="campo">Senha<input name="senha" type="password" autoComplete="current-password" required minLength={6} /></label>
        <Enviar className="botao botao-bloco">Entrar</Enviar>
      </form>
      <p className="suave">
        É personal e ainda não tem conta? <Link href="/cadastro" className="destaque">Criar conta grátis</Link>
      </p>
      <p className="suave pequeno">Aluno: o acesso é criado pelo link de convite que seu personal envia.</p>
    </main>
  );
}
