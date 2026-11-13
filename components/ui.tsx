"use client";
import { useFormStatus } from "react-dom";
import { useState } from "react";

/** Botão de formulário que desabilita enquanto envia (evita clique duplo). */
export function Enviar({
  children,
  className = "botao",
  confirmar
}: {
  children: React.ReactNode;
  className?: string;
  confirmar?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      onClick={(e) => {
        if (confirmar && !window.confirm(confirmar)) e.preventDefault();
      }}
    >
      {pending ? "Aguarde…" : children}
    </button>
  );
}

export function Copiar({ texto, rotulo = "Copiar" }: { texto: string; rotulo?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      className="botao botao-sec botao-peq"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto);
          setOk(true);
          setTimeout(() => setOk(false), 2000);
        } catch {
          window.prompt("Copie:", texto);
        }
      }}
    >
      {ok ? "Copiado ✓" : rotulo}
    </button>
  );
}
