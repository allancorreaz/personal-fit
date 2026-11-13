import Link from "next/link";
import { Aviso, type ParamsAviso } from "@/components/aviso";
import { exigirPersonal } from "@/lib/supabase/server";
import { um } from "@/lib/formato";

export const metadata = { title: "Treinos" };

export default async function TreinosPage({ searchParams }: { searchParams: ParamsAviso }) {
  const { ok, erro } = await searchParams;
  const { supabase } = await exigirPersonal();
  const { data: fichas } = await supabase
    .from("fichas")
    .select("id, nome, ativa, aluno_id, alunos ( nome ), ficha_treinos ( id )")
    .order("criado_em", { ascending: false })
    .limit(200);

  const modelos = (fichas ?? []).filter((f) => !f.aluno_id);
  const ativas = (fichas ?? []).filter((f) => f.aluno_id && f.ativa);

  return (
    <div className="pilha">
      <div className="linha entre">
        <h1>Treinos</h1>
        <div className="linha">
          <Link href="/painel/treinos/exercicios" className="botao botao-sec">Exercícios</Link>
          <Link href="/painel/treinos/nova" className="botao">+ Modelo</Link>
        </div>
      </div>
      <Aviso ok={ok} erro={erro} />

      <section className="cartao pilha">
        <h2>Modelos</h2>
        <p className="suave pequeno">Fichas sem aluno, para copiar e ganhar tempo.</p>
        {modelos.length === 0 ? <p className="suave">Nenhum modelo ainda.</p> : (
          <div className="lista">
            {modelos.map((f) => (
              <Link key={f.id} href={`/painel/treinos/${f.id}`} className="linha entre">
                <span>{f.nome}</span><span className="suave pequeno">{f.ficha_treinos?.length ?? 0} divisões</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="cartao pilha">
        <h2>Fichas ativas dos alunos</h2>
        {ativas.length === 0 ? <p className="suave">Crie a ficha pela página do aluno.</p> : (
          <div className="lista">
            {ativas.map((f) => (
              <Link key={f.id} href={`/painel/treinos/${f.id}`} className="linha entre">
                <span><strong>{um(f.alunos)?.nome}</strong> <span className="suave">· {f.nome}</span></span>
                <span className="suave pequeno">{f.ficha_treinos?.length ?? 0} divisões</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
