import { Enviar } from "@/components/ui";
import { exigirAluno } from "@/lib/supabase/server";
import { formatDataHora } from "@/lib/formato";
import { salvarAnamnese } from "../actions";

export const metadata = { title: "Perfil" };

const PERGUNTAS: { q: string; tipo: "simnao" | "texto" }[] = [
  { q: "Algum médico já disse que você tem problema cardíaco e só deve fazer atividade física recomendada por ele?", tipo: "simnao" },
  { q: "Sente dor no peito ao praticar atividade física?", tipo: "simnao" },
  { q: "No último mês, sentiu dor no peito sem estar em atividade física?", tipo: "simnao" },
  { q: "Já perdeu o equilíbrio por tontura ou perdeu a consciência?", tipo: "simnao" },
  { q: "Tem problema ósseo ou articular que pode piorar com exercício?", tipo: "simnao" },
  { q: "Toma remédio para pressão ou coração?", tipo: "simnao" },
  { q: "Sabe de alguma outra razão para não praticar atividade física?", tipo: "simnao" },
  { q: "Lesões, cirurgias ou dores atuais", tipo: "texto" },
  { q: "Medicamentos de uso contínuo", tipo: "texto" },
  { q: "Quantos dias por semana pode treinar e quanto tempo por dia?", tipo: "texto" },
  { q: "Onde treina (academia, casa, ao ar livre) e quais equipamentos tem?", tipo: "texto" },
  { q: "Qual o seu principal objetivo?", tipo: "texto" }
];

export default async function PerfilPage({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const { ok, erro } = await searchParams;
  const { supabase, aluno, user } = await exigirAluno();
  const { data: ultima } = await supabase.from("anamneses").select("respostas, preenchida_em").eq("aluno_id", aluno.id).order("preenchida_em", { ascending: false }).limit(1).maybeSingle();
  const r = (ultima?.respostas ?? {}) as Record<string, string>;

  return (
    <div className="pilha" style={{ maxWidth: 680 }}>
      <h1>Perfil</h1>
      <div className="cartao pilha">
        <p><strong>{aluno.nome}</strong></p>
        <p className="suave">{user.email}</p>
        <p className="suave pequeno">Personal: {aluno.personais?.nome_marca || aluno.personais?.nome}</p>
        <form action="/sair" method="post"><button className="botao botao-sec botao-peq">Sair</button></form>
      </div>

      <section className="cartao pilha">
        <h2>Anamnese (PAR-Q)</h2>
        <p className="suave pequeno">
          Só o seu personal vê estas respostas. Se responder &quot;sim&quot; a alguma das 7 primeiras, procure um médico antes de aumentar a intensidade.
          {ultima && ` Última atualização: ${formatDataHora(ultima.preenchida_em)}.`}
        </p>
        {ok && <div className="aviso aviso-ok">Respostas enviadas ao seu personal.</div>}
        {erro && <div className="aviso aviso-erro">Não foi possível salvar.</div>}
        <form action={salvarAnamnese} className="pilha">
          {PERGUNTAS.map(({ q, tipo }) => (
            <label key={q} className="campo">
              {q}
              {tipo === "simnao" ? (
                <select name={`q:${q}`} defaultValue={r[q] ?? ""} required>
                  <option value="" disabled>Escolha…</option><option>Não</option><option>Sim</option>
                </select>
              ) : (
                <textarea name={`q:${q}`} maxLength={1000} defaultValue={r[q] ?? ""} style={{ minHeight: 60 }} />
              )}
            </label>
          ))}
          <Enviar>Enviar anamnese</Enviar>
        </form>
      </section>
    </div>
  );
}
