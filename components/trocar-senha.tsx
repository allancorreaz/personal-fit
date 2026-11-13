import { Enviar } from "@/components/ui";
import { trocarSenha } from "@/app/conta/actions";

export function TrocarSenha({ volta }: { volta: string }) {
  return (
    <section className="cartao pilha">
      <details>
        <summary><h2>Trocar senha</h2></summary>
        <form action={trocarSenha} className="pilha" style={{ marginTop: 12 }}>
          <input type="hidden" name="volta" value={volta} />
          <label className="campo">Senha atual<input name="atual" type="password" required autoComplete="current-password" /></label>
          <label className="campo">Nova senha (mín. 8)<input name="nova" type="password" required minLength={8} autoComplete="new-password" /></label>
          <label className="campo">Repita a nova senha<input name="confirma" type="password" required minLength={8} autoComplete="new-password" /></label>
          <Enviar>Salvar nova senha</Enviar>
        </form>
      </details>
    </section>
  );
}
