import Link from "next/link";
import { Navegacao } from "@/components/navegacao";
import { exigirAluno } from "@/lib/supabase/server";

export const metadata = { title: "Meu treino", robots: { index: false, follow: false } };

export default async function AppAlunoLayout({ children }: { children: React.ReactNode }) {
  const { aluno } = await exigirAluno();
  return (
    <div className="shell">
      <header className="topbar">
        <Link href="/app" className="marca">
          <span className="marca-icone">▮▮</span>
          {aluno.personais?.nome_marca || aluno.personais?.nome}
        </Link>
        <Navegacao area="aluno" posicao="topo" />
      </header>
      <main className="conteudo">{children}</main>
      <Navegacao area="aluno" posicao="inferior" />
    </div>
  );
}
