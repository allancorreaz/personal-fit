import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { Aviso } from "@/components/aviso";
import { Enviar } from "@/components/ui";
import { exigirPersonal } from "@/lib/supabase/server";
import { GRUPOS_MUSCULARES, um } from "@/lib/formato";
import {
  adicionarDivisao, adicionarExercicio, alternarFichaAtiva, atualizarExercicio, atualizarFicha,
  duplicarFicha, moverExercicio, removerDivisao, removerExercicio, renomearDivisao
} from "../actions";

type Item = {
  id: string; ordem: number; series: number; repeticoes: string; carga: string | null;
  descanso_seg: number | null; metodo: string | null; observacoes: string | null;
  exercicios: { nome: string; grupo_muscular: string } | null;
};

export default async function EditorFicha({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  const { id } = await params;
  const { ok, erro } = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { supabase } = await exigirPersonal();

  const { data: ficha } = await supabase
    .from("fichas")
    .select(`id, nome, objetivo, observacoes, inicio, fim, ativa, aluno_id, alunos ( id, nome ),
             ficha_treinos ( id, nome, ordem, observacoes,
               ficha_exercicios ( id, ordem, series, repeticoes, carga, descanso_seg, metodo, observacoes, exercicios ( nome, grupo_muscular ) ) )`)
    .eq("id", id)
    .maybeSingle();
  if (!ficha) notFound();

  const [{ data: exercicios }, { data: alunos }] = await Promise.all([
    supabase.from("exercicios").select("id, nome, grupo_muscular, personal_id").order("nome"),
    supabase.from("alunos").select("id, nome").eq("ativo", true).order("nome")
  ]);

  const porGrupo = new Map<string, { id: string; nome: string; proprio: boolean }[]>();
  for (const e of exercicios ?? []) {
    const l = porGrupo.get(e.grupo_muscular) ?? [];
    l.push({ id: e.id, nome: e.nome, proprio: Boolean(e.personal_id) });
    porGrupo.set(e.grupo_muscular, l);
  }

  const alunoFicha = um(ficha.alunos);
  const treinos = [...(ficha.ficha_treinos ?? [])].sort((a, b) => a.ordem - b.ordem);
  const hidden = <input type="hidden" name="ficha_id" value={id} />;

  return (
    <div className="pilha">
      <Link href={alunoFicha ? `/painel/alunos/${alunoFicha.id}` : "/painel/treinos"} className="suave">
        ← {alunoFicha ? alunoFicha.nome : "Treinos"}
      </Link>
      <div className="linha entre">
        <div>
          <h1>{ficha.nome}</h1>
          <p className="suave">{alunoFicha ? `Ficha de ${alunoFicha.nome}` : "Modelo"}{ficha.objetivo ? ` · ${ficha.objetivo}` : ""}</p>
        </div>
        {ficha.aluno_id && <span className={`tag ${ficha.ativa ? "tag-verde" : "tag-cinza"}`}>{ficha.ativa ? "Ativa no app" : "Arquivada"}</span>}
      </div>
      <Aviso ok={ok} erro={erro} />

      {treinos.map((t) => {
        const itens = [...((t.ficha_exercicios ?? []) as Item[])].sort((a, b) => a.ordem - b.ordem);
        return (
          <section key={t.id} id={`t-${t.id}`} className="cartao pilha">
            <details>
              <summary className="linha entre">
                <h2>{t.nome}</h2>
                <span className="suave pequeno">{itens.length} exercícios · editar nome</span>
              </summary>
              <form action={renomearDivisao} className="pilha" style={{ marginTop: 10 }}>
                {hidden}<input type="hidden" name="id" value={t.id} />
                <label className="campo">Nome<input name="nome" defaultValue={t.nome} maxLength={80} required /></label>
                <label className="campo">Observações da divisão<input name="observacoes" defaultValue={t.observacoes ?? ""} maxLength={1000} /></label>
                <div className="linha">
                  <Enviar className="botao botao-peq">Salvar</Enviar>
                </div>
              </form>
              <form action={removerDivisao} style={{ marginTop: 8 }}>
                {hidden}<input type="hidden" name="id" value={t.id} />
                <Enviar className="botao botao-perigo botao-peq" confirmar={`Remover ${t.nome} e todos os exercícios dele?`}>Remover divisão</Enviar>
              </form>
            </details>
            {t.observacoes && <p className="suave pequeno">{t.observacoes}</p>}

            <div className="lista">
              {itens.map((e, i) => (
                <div key={e.id} className="pilha" style={{ gap: 6 }}>
                  <div className="linha entre">
                    <span>
                      <strong>{i + 1}. {e.exercicios?.nome}</strong>
                      <span className="suave pequeno"> · {GRUPOS_MUSCULARES[e.exercicios?.grupo_muscular ?? ""]}</span>
                    </span>
                    <span className="linha" style={{ gap: 4 }}>
                      <form action={moverExercicio}>{hidden}<input type="hidden" name="id" value={e.id} /><input type="hidden" name="direcao" value="cima" /><button className="botao botao-sec botao-peq" aria-label="Subir" disabled={i === 0}><ArrowUp size={14} /></button></form>
                      <form action={moverExercicio}>{hidden}<input type="hidden" name="id" value={e.id} /><input type="hidden" name="direcao" value="baixo" /><button className="botao botao-sec botao-peq" aria-label="Descer" disabled={i === itens.length - 1}><ArrowDown size={14} /></button></form>
                      <form action={removerExercicio}>{hidden}<input type="hidden" name="id" value={e.id} /><Enviar className="botao botao-perigo botao-peq" confirmar="Remover este exercício?"><Trash2 size={14} /></Enviar></form>
                    </span>
                  </div>
                  <details>
                    <summary className="suave pequeno">
                      {e.series} × {e.repeticoes}{e.carga ? ` · ${e.carga}` : ""}{e.descanso_seg ? ` · descanso ${e.descanso_seg}s` : ""}{e.metodo ? ` · ${e.metodo}` : ""} — <span className="destaque">editar</span>
                    </summary>
                    <form action={atualizarExercicio} className="pilha" style={{ marginTop: 8 }}>
                      {hidden}<input type="hidden" name="id" value={e.id} />
                      <CamposItem item={e} />
                      <Enviar className="botao botao-peq">Salvar</Enviar>
                    </form>
                  </details>
                  {e.observacoes && <p className="suave pequeno">📝 {e.observacoes}</p>}
                </div>
              ))}
            </div>

            <details>
              <summary className="botao botao-sec botao-peq">+ Exercício</summary>
              <form action={adicionarExercicio} className="pilha" style={{ marginTop: 10 }}>
                {hidden}<input type="hidden" name="treino_id" value={t.id} />
                <label className="campo">Exercício
                  <select name="exercicio_id" required defaultValue="">
                    <option value="" disabled>Escolha…</option>
                    {[...porGrupo.entries()].map(([g, lista]) => (
                      <optgroup key={g} label={GRUPOS_MUSCULARES[g] ?? g}>
                        {lista.map((x) => <option key={x.id} value={x.id}>{x.nome}{x.proprio ? " ★" : ""}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </label>
                <CamposItem />
                <Enviar className="botao botao-peq">Adicionar</Enviar>
              </form>
            </details>
          </section>
        );
      })}

      <form action={adicionarDivisao} className="linha">
        {hidden}
        <input name="nome" placeholder={`Treino ${String.fromCharCode(65 + treinos.length)}`} maxLength={80} style={{ flex: 1, minWidth: 160 }} />
        <Enviar className="botao botao-sec">+ Divisão</Enviar>
      </form>

      <section className="cartao pilha">
        <details>
          <summary><h2>Dados da ficha</h2></summary>
          <form action={atualizarFicha} className="pilha" style={{ marginTop: 10 }}>
            <input type="hidden" name="id" value={id} />
            <label className="campo">Nome<input name="nome" defaultValue={ficha.nome} required maxLength={120} /></label>
            <label className="campo">Objetivo<input name="objetivo" defaultValue={ficha.objetivo ?? ""} maxLength={300} /></label>
            <label className="campo">Orientações gerais (o aluno vê)<textarea name="observacoes" defaultValue={ficha.observacoes ?? ""} maxLength={2000} /></label>
            <div className="grade-2">
              <label className="campo">Início<input type="date" name="inicio" defaultValue={ficha.inicio ?? ""} /></label>
              <label className="campo">Fim<input type="date" name="fim" defaultValue={ficha.fim ?? ""} /></label>
            </div>
            <Enviar>Salvar</Enviar>
          </form>
        </details>

        <div className="linha">
          {ficha.aluno_id && (
            <form action={alternarFichaAtiva}>
              <input type="hidden" name="id" value={id} /><input type="hidden" name="ativa" value={ficha.ativa ? "false" : "true"} />
              <Enviar className="botao botao-sec botao-peq">{ficha.ativa ? "Arquivar" : "Ativar no app"}</Enviar>
            </form>
          )}
          <form action={duplicarFicha}><input type="hidden" name="id" value={id} /><Enviar className="botao botao-sec botao-peq">Salvar como modelo</Enviar></form>
        </div>
        <form action={duplicarFicha} className="linha">
          <input type="hidden" name="id" value={id} />
          <select name="aluno_id" required defaultValue="" style={{ flex: 1, minWidth: 180 }}>
            <option value="" disabled>Copiar para o aluno…</option>
            {(alunos ?? []).map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>
          <Enviar className="botao botao-sec botao-peq">Copiar</Enviar>
        </form>
      </section>
    </div>
  );
}

function CamposItem({ item }: { item?: Partial<Item> }) {
  return (
    <div className="grade-2">
      <label className="campo">Séries<input name="series" type="number" min={1} max={20} defaultValue={item?.series ?? 3} /></label>
      <label className="campo">Repetições<input name="repeticoes" maxLength={20} defaultValue={item?.repeticoes ?? "10"} placeholder="10 ou 8-12 ou 30s" /></label>
      <label className="campo">Carga<input name="carga" maxLength={30} defaultValue={item?.carga ?? ""} placeholder="20 kg / moderada" /></label>
      <label className="campo">Descanso (s)<input name="descanso_seg" type="number" min={0} max={900} defaultValue={item?.descanso_seg ?? 60} /></label>
      <label className="campo">Método<input name="metodo" maxLength={60} defaultValue={item?.metodo ?? ""} placeholder="Drop-set, bi-set…" /></label>
      <label className="campo">Observação<input name="observacoes" maxLength={500} defaultValue={item?.observacoes ?? ""} /></label>
    </div>
  );
}
