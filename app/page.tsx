import Link from "next/link";
import { redirect } from "next/navigation";
import { sessaoAtual } from "@/lib/supabase/server";
import { PRODUTO } from "@/lib/marca";

export default async function Home() {
  const { user } = await sessaoAtual();
  if (user) redirect("/inicio");

  const recursos = [
    ["Fichas de treino", "Monte treinos A/B/C com biblioteca de exercícios, vídeos e modelos reutilizáveis."],
    ["App do aluno", "O aluno vê o treino no celular, registra cargas e acompanha a evolução."],
    ["Avaliação física", "Peso, medidas, dobras, % de gordura e fotos de evolução com gráficos."],
    ["Pagamentos", "Pix com confirmação automática no seu Mercado Pago e controle de quem está em dia."]
  ];
  return (
    <main>
      <section className="hero pilha">
        <div className="marca" style={{ justifyContent: "center" }}><span className="marca-icone">▮▮</span>{PRODUTO.nome}</div>
        <h1>Sua consultoria inteira em um app.</h1>
        <p>{PRODUTO.descricao}</p>
        <div className="linha" style={{ justifyContent: "center", marginTop: 12 }}>
          <Link href="/cadastro" className="botao">Começar grátis</Link>
          <Link href="/entrar" className="botao botao-sec">Entrar</Link>
        </div>
      </section>
      <section className="conteudo grade">
        {recursos.map(([t, d]) => (
          <div key={t} className="cartao pilha"><h3>{t}</h3><p className="suave">{d}</p></div>
        ))}
      </section>
    </main>
  );
}
