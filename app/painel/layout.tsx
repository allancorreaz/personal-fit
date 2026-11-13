import Link from "next/link";
import { Navegacao } from "@/components/navegacao";
import { exigirPersonal } from "@/lib/supabase/server";
import { formatData, hojeSP } from "@/lib/formato";

export const metadata = { title: "Painel", robots: { index: false, follow: false } };

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const { personal } = await exigirPersonal();
  const emTeste = personal.plano_plataforma === "teste";
  const testeAcabou = emTeste && personal.teste_ate < hojeSP();

  return (
    <div className="shell">
      <header className="topbar">
        <Link href="/painel" className="marca">
          <span className="marca-icone">▮▮</span>
          {personal.nome_marca || personal.nome}
        </Link>
        <Navegacao area="painel" posicao="topo" />
        <form action="/sair" method="post"><button className="botao botao-sec botao-peq">Sair</button></form>
      </header>
      {emTeste && (
        <div className={`aviso ${testeAcabou ? "aviso-erro" : ""}`} style={{ borderRadius: 0, textAlign: "center" }}>
          {testeAcabou
            ? "Seu período de teste terminou. Fale com o suporte para continuar."
            : `Período de teste até ${formatData(personal.teste_ate)}.`}
        </div>
      )}
      <main className="conteudo">{children}</main>
      <Navegacao area="painel" posicao="inferior" />
    </div>
  );
}
