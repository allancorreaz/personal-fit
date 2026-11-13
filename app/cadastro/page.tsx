import Link from "next/link";
import { Aviso, type ParamsAviso } from "@/components/aviso";
import { Enviar } from "@/components/ui";
import { cadastrarPersonal } from "../entrar/actions";

export const metadata = { title: "Criar conta" };

export default async function CadastroPage({ searchParams }: { searchParams: ParamsAviso }) {
  const { ok, erro } = await searchParams;
  return (
    <main className="conteudo-estreito pilha">
      <h1>Criar conta de personal</h1>
      <p className="suave">30 dias grátis. Sem cartão.</p>
      <Aviso ok={ok} erro={erro} />
      <form action={cadastrarPersonal} className="pilha">
        <label className="campo">Seu nome<input name="nome" required minLength={2} maxLength={120} autoComplete="name" /></label>
        <label className="campo">E-mail<input name="email" type="email" required autoComplete="email" /></label>
        <label className="campo">Senha (mín. 8)<input name="senha" type="password" required minLength={8} autoComplete="new-password" /></label>
        <Enviar className="botao botao-bloco">Criar conta</Enviar>
      </form>
      <p className="suave">Já tem conta? <Link href="/entrar" className="destaque">Entrar</Link></p>
    </main>
  );
}
