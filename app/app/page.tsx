import Link from "next/link";
import { exigirAluno } from "@/lib/supabase/server";
import { formatBRL, formatData, formatDataHora, hojeSP } from "@/lib/formato";

export default async function AppHome() {
  const { supabase, aluno } = await exigirAluno();
  const [{ data: ficha }, { data: ultima }, { data: pendente }, { count: anamneses }] = await Promise.all([
    supabase
      .from("fichas")
      .select("id, nome, objetivo, observacoes, fim, ficha_treinos ( id, nome, ordem, ficha_exercicios ( id ) )")
      .eq("aluno_id", aluno.id)
      .eq("ativa", true)
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("sessoes_treino").select("treino_id, nome_treino, iniciado_em").eq("aluno_id", aluno.id).order("iniciado_em", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("cobrancas").select("valor_centavos, vencimento, link_token").eq("aluno_id", aluno.id).eq("status", "pendente").order("vencimento").limit(1).maybeSingle(),
    supabase.from("anamneses").select("id", { count: "exact", head: true }).eq("aluno_id", aluno.id)
  ]);

  const treinos = [...(ficha?.ficha_treinos ?? [])].sort((a, b) => a.ordem - b.ordem);
  // sugere o próximo da sequência (depois do último feito)
  const idxUltimo = treinos.findIndex((t) => t.id === ultima?.treino_id);
  const sugerido = treinos.length ? treinos[(idxUltimo + 1) % treinos.length] : null;

  return (
    <div className="pilha">
      <h1>Olá, {aluno.nome.split(" ")[0]} 💪</h1>

      {pendente && (
        <a href={`/pagar/${pendente.link_token}`} className={`aviso cartao-link ${pendente.vencimento < hojeSP() ? "aviso-erro" : ""}`}>
          {pendente.vencimento < hojeSP() ? "Pagamento em atraso" : "Próximo pagamento"}: {formatBRL(pendente.valor_centavos)} · vence {formatData(pendente.vencimento)} — pagar com Pix →
        </a>
      )}
      {!anamneses && <Link href="/app/perfil" className="aviso cartao-link">Preencha sua anamnese (questionário de saúde) para seu personal →</Link>}

      {!ficha ? (
        <div className="cartao"><p className="suave">Seu personal ainda está montando seu treino. Ele aparece aqui assim que ficar pronto.</p></div>
      ) : (
        <>
          <div className="cartao pilha">
            <div className="rotulo">Ficha atual</div>
            <h2>{ficha.nome}</h2>
            {ficha.objetivo && <p className="suave">{ficha.objetivo}</p>}
            {ficha.fim && <p className="suave pequeno">Válida até {formatData(ficha.fim)}</p>}
            {ficha.observacoes && <p className="pequeno">📝 {ficha.observacoes}</p>}
            {ultima && <p className="suave pequeno">Último treino: {ultima.nome_treino} em {formatDataHora(ultima.iniciado_em)}</p>}
          </div>
          <div className="pilha">
            {treinos.map((t) => (
              <Link key={t.id} href={`/app/treino/${t.id}`} className="cartao cartao-link linha entre" style={t.id === sugerido?.id ? { borderColor: "var(--accent)" } : undefined}>
                <span className="pilha" style={{ gap: 2 }}>
                  <strong>{t.nome}</strong>
                  <span className="suave pequeno">{t.ficha_exercicios?.length ?? 0} exercícios</span>
                </span>
                <span className={t.id === sugerido?.id ? "tag tag-verde" : "suave"}>{t.id === sugerido?.id ? "Hoje →" : "→"}</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
