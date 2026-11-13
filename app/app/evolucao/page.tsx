import { AvaliacaoDetalhe } from "@/components/avaliacao-detalhe";
import { GraficoLinha } from "@/components/grafico";
import { exigirAluno } from "@/lib/supabase/server";
import { urlsAssinadas } from "@/lib/midia";
import { formatData, um } from "@/lib/formato";

export const metadata = { title: "Evolução" };

export default async function EvolucaoPage() {
  const { supabase, aluno } = await exigirAluno();
  const [{ data: avaliacoes }, { data: series }] = await Promise.all([
    supabase.from("avaliacoes").select("*, avaliacao_fotos ( posicao, path )").eq("aluno_id", aluno.id).order("data").limit(40),
    supabase.from("sessao_series").select("exercicio_id, carga_kg, criado_em, exercicios ( nome )").eq("aluno_id", aluno.id).not("carga_kg", "is", null).order("criado_em").limit(2000)
  ]);

  const avs = avaliacoes ?? [];
  const atual = avs[avs.length - 1];
  const anterior = avs.length > 1 ? avs[avs.length - 2] : null;
  const peso = avs.filter((a) => a.peso_kg !== null).map((a) => ({ data: a.data, valor: Number(a.peso_kg) }));
  const gordura = avs.filter((a) => a.percentual_gordura !== null).map((a) => ({ data: a.data, valor: Number(a.percentual_gordura) }));
  const fotos = (atual?.avaliacao_fotos ?? []) as { posicao: string; path: string }[];
  const urls = await urlsAssinadas(supabase, "avaliacoes", fotos.map((f) => f.path));

  // carga máxima por dia em cada exercício; mostra os 4 mais treinados
  const porEx = new Map<string, { nome: string; dias: Map<string, number> }>();
  for (const s of series ?? []) {
    const dia = s.criado_em.slice(0, 10);
    const e = porEx.get(s.exercicio_id) ?? { nome: um(s.exercicios)?.nome ?? "?", dias: new Map() };
    e.dias.set(dia, Math.max(e.dias.get(dia) ?? 0, Number(s.carga_kg)));
    porEx.set(s.exercicio_id, e);
  }
  const top = [...porEx.values()].sort((a, b) => b.dias.size - a.dias.size).slice(0, 4);

  return (
    <div className="pilha">
      <h1>Evolução</h1>
      {avs.length === 0 && top.length === 0 && <p className="suave">Suas avaliações e cargas aparecem aqui conforme você evolui.</p>}

      {(peso.length > 1 || gordura.length > 1) && (
        <div className="grade-2">
          {peso.length > 1 && <section className="cartao pilha"><h2>Peso</h2><GraficoLinha pontos={peso} unidade="kg" /></section>}
          {gordura.length > 1 && <section className="cartao pilha"><h2>% de gordura</h2><GraficoLinha pontos={gordura} unidade="%" /></section>}
        </div>
      )}

      {atual && (
        <section className="pilha">
          <h2>Última avaliação · {formatData(atual.data)}</h2>
          <AvaliacaoDetalhe atual={atual} anterior={anterior} />
          {fotos.length > 0 && (
            <div className="grade">
              {fotos.map((f) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={f.path} src={urls.get(f.path)} alt={f.posicao} className="midia" style={{ maxHeight: 320 }} />
              ))}
            </div>
          )}
        </section>
      )}

      {top.length > 0 && (
        <section className="pilha">
          <h2>Evolução de carga</h2>
          <div className="grade-2">
            {top.map((e) => (
              <div key={e.nome} className="cartao pilha">
                <h3>{e.nome}</h3>
                <GraficoLinha pontos={[...e.dias.entries()].map(([data, valor]) => ({ data, valor }))} unidade="kg" />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
