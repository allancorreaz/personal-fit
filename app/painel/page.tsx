import Link from "next/link";
import { exigirPersonal } from "@/lib/supabase/server";
import { SITUACOES, formatBRL, formatData, formatDataHora, hojeSP, somarDias, type Situacao, um } from "@/lib/formato";

export default async function PainelHome() {
  const { supabase, personal } = await exigirPersonal();
  const hoje = hojeSP();
  const inicioMes = `${hoje.slice(0, 7)}-01`;

  const [{ data: situacoes }, { data: sessoes }, { data: recebidas }, { data: config }] = await Promise.all([
    supabase.from("vw_situacao_alunos").select("*").eq("ativo", true),
    supabase
      .from("sessoes_treino")
      .select("id, nome_treino, iniciado_em, concluido_em, alunos ( nome )")
      .gte("iniciado_em", `${somarDias(hoje, -7)}T00:00:00-03:00`)
      .order("iniciado_em", { ascending: false })
      .limit(8),
    supabase.from("cobrancas").select("valor_centavos").eq("status", "paga").gte("pago_em", `${inicioMes}T00:00:00-03:00`),
    supabase.from("config_pagamento").select("mp_configurado").maybeSingle()
  ]);

  const lista = situacoes ?? [];
  const atrasados = lista.filter((s) => s.situacao === "atrasado");
  const totalAtrasado = atrasados.reduce((t, s) => t + s.valor_atrasado, 0);
  const recebidoMes = (recebidas ?? []).reduce((t, c) => t + c.valor_centavos, 0);
  const semApp = lista.filter((s) => !s.tem_app).length;

  return (
    <div className="pilha">
      <h1>Olá, {personal.nome.split(" ")[0]}</h1>

      {!config?.mp_configurado && (
        <Link href="/painel/configuracoes" className="aviso cartao-link">
          Conecte sua conta do Mercado Pago para receber por Pix com confirmação automática →
        </Link>
      )}

      <div className="grade">
        <Link href="/painel/alunos" className="cartao cartao-link">
          <div className="rotulo">Alunos ativos</div>
          <div className="numero">{lista.length}</div>
          {semApp > 0 && <p className="suave pequeno">{semApp} ainda sem acesso ao app</p>}
        </Link>
        <Link href="/painel/financeiro?filtro=atrasado" className="cartao cartao-link">
          <div className="rotulo">Em atraso</div>
          <div className="numero" style={{ color: atrasados.length ? "var(--red)" : undefined }}>{atrasados.length}</div>
          <p className="suave pequeno">{formatBRL(totalAtrasado)}</p>
        </Link>
        <Link href="/painel/financeiro" className="cartao cartao-link">
          <div className="rotulo">Recebido no mês</div>
          <div className="numero">{formatBRL(recebidoMes)}</div>
        </Link>
        <div className="cartao">
          <div className="rotulo">Treinos na semana</div>
          <div className="numero">{sessoes?.length ?? 0}{(sessoes?.length ?? 0) >= 8 ? "+" : ""}</div>
        </div>
      </div>

      <div className="grade-2">
        <section className="cartao pilha">
          <h2>Precisam de atenção</h2>
          {atrasados.length === 0 && lista.filter((s) => s.situacao === "vence_em_breve").length === 0 ? (
            <p className="suave">Ninguém em atraso. 🎉</p>
          ) : (
            <div className="lista">
              {lista
                .filter((s) => s.situacao === "atrasado" || s.situacao === "vence_em_breve")
                .sort((a, b) => b.dias_atraso - a.dias_atraso)
                .slice(0, 8)
                .map((s) => (
                  <Link key={s.aluno_id} href={`/painel/alunos/${s.aluno_id}`} className="linha entre">
                    <span>{s.nome}</span>
                    <span className={`tag ${SITUACOES[s.situacao as Situacao].classe}`}>
                      {s.situacao === "atrasado" ? `${s.dias_atraso}d · ${formatBRL(s.valor_atrasado)}` : `vence ${formatData(s.proximo_vencimento)}`}
                    </span>
                  </Link>
                ))}
            </div>
          )}
        </section>

        <section className="cartao pilha">
          <h2>Treinos recentes</h2>
          {(sessoes ?? []).length === 0 ? (
            <p className="suave">Nenhum treino registrado nos últimos 7 dias.</p>
          ) : (
            <div className="lista">
              {(sessoes ?? []).map((s) => (
                <div key={s.id} className="linha entre">
                  <span>
                    <strong>{um(s.alunos)?.nome}</strong> <span className="suave">· {s.nome_treino}</span>
                  </span>
                  <span className="suave pequeno">{formatDataHora(s.iniciado_em)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
