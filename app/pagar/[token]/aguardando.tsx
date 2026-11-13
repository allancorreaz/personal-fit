"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/** Pergunta ao servidor a cada 5s se o Pix foi pago e recarrega quando for. */
export function AguardandoPagamento({ token }: { token: string }) {
  const router = useRouter();
  const [esgotado, setEsgotado] = useState(false);

  useEffect(() => {
    let ativo = true;
    let tentativas = 0;
    async function checar() {
      if (!ativo) return;
      tentativas++;
      try {
        const res = await fetch(`/api/pagar/${token}`, { cache: "no-store" });
        const { status } = (await res.json()) as { status: string };
        if (status !== "pendente") return router.refresh();
      } catch { /* rede instável */ }
      if (tentativas >= 180) return setEsgotado(true);
      setTimeout(checar, 5000);
    }
    const t = setTimeout(checar, 5000);
    return () => { ativo = false; clearTimeout(t); };
  }, [token, router]);

  return (
    <p className="suave pequeno" aria-live="polite">
      {esgotado ? <>Já pagou? <button className="botao botao-sec botao-peq" onClick={() => router.refresh()}>Atualizar</button></>
        : "⏳ Aguardando pagamento… esta página atualiza sozinha."}
    </p>
  );
}
