import Link from "next/link";
import { notFound } from "next/navigation";
import { Aviso } from "@/components/aviso";
import { Copiar, Enviar } from "@/components/ui";
import { exigirPersonal } from "@/lib/supabase/server";
import { urlBase } from "@/lib/url";
import { formatData, formatDataHora, formatWhatsapp, hojeSP, idade, linkWhatsapp } from "@/lib/formato";
import { alternarAtivo, atualizarAluno, criarCobranca, renovarConvite, verificarPagamentos } from "../../actions";
import { CobrancaItem, type CobrancaLinha } from "../../cobranca-item";
import { CamposAluno } from "../form-aluno";

export default async function AlunoPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  const { id } = await params;
  const { ok, erro } = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { supabase, personal } = await exigirPersonal();

  const { data: aluno } = await supabase.from("alunos").select("*").eq("id", id).maybeSingle();
  if (!aluno) notFound();

  const [{ data: planos }, { data: cobrancas }, { data: fichas }, { data: avaliacoes }, { data: sessoes }, { data: anamnese }] =
    await Promise.all([
      supabase.from("planos").select("id, nome, ativo").order("nome"),
      supabase.from("cobrancas").select("*").eq("aluno_id", id).order("vencimento", { ascending: false }).limit(24),
      supabase.from("fichas").select("id, nome, ativa, inicio, fim").eq("aluno_id", id).order("criado_em", { ascending: false }),
      supabase.from("avaliacoes").select("id, data, peso_kg, percentual_gordura").eq("aluno_id", id).order("data", { ascending: false }).limit(10),
      supabase.from("sessoes_treino").select("id, nome_treino, iniciado_em, concluido_em, percepcao_esforco").eq("aluno_id", id).order("iniciado_em", { ascending: false }).limit(10),
      supabase.from("anamneses").select("respostas, preenchida_em").eq("aluno_id", id).order("preenchida_em", { ascending: false }).limit(1).maybeSingle()
    ]);

  const base = await urlBase();
  const volta = `/painel/alunos/${id}`;
  const linkConvite = `${base}/convite/${aluno.convite_token}`;
  const nomeMarca = personal.nome_marca || personal.nome;
  const anos = idade(aluno.data_nascimento);

  return (
    <div className="pilha">
      <Link href="/painel/alunos" className="suave">← Alunos</Link>
      <div className="linha entre">
        <div>
          <h1>{aluno.nome}</h1>
          <p className="suave">
            {[anos !== null && `${anos} anos`, aluno.objetivo, formatWhatsapp(aluno.whatsapp)].filter(Boolean).join(" · ")}
          </p>
        </div>
        {!aluno.ativo && <span className="tag tag-cinza">Inativo</span>}
      </div>
      <Aviso ok={ok} erro={erro} />

      {/* Acesso ao app */}
      <section className="cartao pilha">
        <h2>Acesso ao app</h2>
        {aluno.user_id ? (
          <p className="suave">✓ Acesso ativo desde {formatDataHora(aluno.convite_aceito_em)}.</p>
        ) : !aluno.email ? (
          <p className="suave">Cadastre o e-mail do aluno para enviar o convite.</p>
        ) : (
          <>
            <p className="suave">Envie este link para o aluno criar a senha. Ele vale só para {aluno.email}.</p>
            <div className="linha">
              <Copiar texto={linkConvite} rotulo="Copiar convite" />
              {aluno.whatsapp && (
                <a
                  className="botao botao-peq"
                  target="_blank"
                  rel="noopener noreferrer"
                  href={linkWhatsapp(aluno.whatsapp, `Olá, ${aluno.nome.split(" ")[0]}! Aqui é ${nomeMarca}. Seu acesso ao app de treinos está pronto. Crie sua senha neste link:\n${linkConvite}`)}
                >
                  Enviar no WhatsApp
                </a>
              )}
              <form action={renovarConvite}><input type="hidden" name="id" value={id} /><Enviar className="botao botao-sec botao-peq" confirmar="O link atual deixará de funcionar. Continuar?">Novo link</Enviar></form>
            </div>
          </>
        )}
      </section>

      <div className="grade-2">
        {/* Treinos */}
        <section className="cartao pilha">
          <div className="linha entre">
            <h2>Fichas de treino</h2>
            <Link href={`/painel/treinos/nova?aluno=${id}`} className="botao botao-peq">+ Nova ficha</Link>
          </div>
          {(fichas ?? []).length === 0 ? <p className="suave">Nenhuma ficha ainda.</p> : (
            <div className="lista">
              {(fichas ?? []).map((f) => (
                <Link key={f.id} href={`/painel/treinos/${f.id}`} className="linha entre">
                  <span>{f.nome}</span>
                  <span className={`tag ${f.ativa ? "tag-verde" : "tag-cinza"}`}>{f.ativa ? "Ativa" : "Arquivada"}</span>
                </Link>
              ))}
            </div>
          )}
          <h3 style={{ marginTop: 6 }}>Últimos treinos feitos</h3>
          {(sessoes ?? []).length === 0 ? <p className="suave">O aluno ainda não registrou treinos.</p> : (
            <div className="lista">
              {(sessoes ?? []).map((s) => (
                <Link key={s.id} href={`/painel/alunos/${id}/sessoes/${s.id}`} className="linha entre">
                  <span>{s.nome_treino}{s.percepcao_esforco ? <span className="suave"> · esforço {s.percepcao_esforco}/10</span> : null}</span>
                  <span className="suave pequeno">{formatDataHora(s.iniciado_em)}{!s.concluido_em && " (incompleto)"}</span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Avaliações */}
        <section className="cartao pilha">
          <div className="linha entre">
            <h2>Avaliações físicas</h2>
            <Link href={`/painel/avaliacoes/nova?aluno=${id}`} className="botao botao-peq">+ Nova</Link>
          </div>
          {(avaliacoes ?? []).length === 0 ? <p className="suave">Nenhuma avaliação.</p> : (
            <div className="lista">
              {(avaliacoes ?? []).map((a) => (
                <Link key={a.id} href={`/painel/avaliacoes/${a.id}`} className="linha entre">
                  <span>{formatData(a.data)}</span>
                  <span className="suave">{a.peso_kg ? `${a.peso_kg} kg` : ""}{a.percentual_gordura ? ` · ${a.percentual_gordura}% gordura` : ""}</span>
                </Link>
              ))}
            </div>
          )}
          <h3 style={{ marginTop: 6 }}>Anamnese</h3>
          {anamnese ? (
            <details>
              <summary className="destaque">Preenchida em {formatDataHora(anamnese.preenchida_em)} — ver respostas</summary>
              <div className="lista" style={{ marginTop: 8 }}>
                {Object.entries(anamnese.respostas as Record<string, string>).map(([k, v]) => (
                  <div key={k}><div className="suave pequeno">{k}</div><div>{String(v) || "—"}</div></div>
                ))}
              </div>
            </details>
          ) : (
            <p className="suave">O aluno ainda não preencheu (ele preenche pelo app).</p>
          )}
        </section>
      </div>

      {/* Financeiro */}
      <section className="cartao pilha">
        <div className="linha entre">
          <h2>Pagamentos</h2>
          <form action={verificarPagamentos}><input type="hidden" name="volta" value={volta} /><Enviar className="botao botao-sec botao-peq">Verificar Pix</Enviar></form>
        </div>
        <details>
          <summary className="botao botao-sec botao-peq">+ Cobrança avulsa</summary>
          <form action={criarCobranca} className="grade-2" style={{ marginTop: 10 }}>
            <input type="hidden" name="aluno_id" value={id} />
            <label className="campo">Descrição<input name="descricao" defaultValue="Consultoria" maxLength={160} required /></label>
            <label className="campo">Valor (R$)<input name="valor" inputMode="decimal" placeholder="150,00" required /></label>
            <label className="campo">Vencimento<input name="vencimento" type="date" defaultValue={hojeSP()} required /></label>
            <div style={{ alignSelf: "end" }}><Enviar>Criar cobrança</Enviar></div>
          </form>
        </details>
        {(cobrancas ?? []).length === 0 ? <p className="suave">Nenhuma cobrança.</p> : (
          <div className="lista">
            {(cobrancas ?? []).map((c) => (
              <CobrancaItem key={c.id} c={{ ...(c as CobrancaLinha), alunos: { nome: aluno.nome, whatsapp: aluno.whatsapp } }} volta={volta} base={base} />
            ))}
          </div>
        )}
      </section>

      {/* Dados */}
      <section className="cartao pilha">
        <details>
          <summary><h2>Editar dados</h2></summary>
          <form action={atualizarAluno} className="pilha" style={{ marginTop: 12 }}>
            <CamposAluno aluno={aluno} planos={planos ?? []} />
            <Enviar>Salvar</Enviar>
          </form>
        </details>
        <form action={alternarAtivo}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="ativo" value={aluno.ativo ? "false" : "true"} />
          <Enviar className={aluno.ativo ? "botao botao-perigo botao-peq" : "botao botao-sec botao-peq"} confirmar={aluno.ativo ? "Inativar este aluno? Ele perde o acesso ao app." : undefined}>
            {aluno.ativo ? "Inativar aluno" : "Reativar aluno"}
          </Enviar>
        </form>
      </section>
    </div>
  );
}
