import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ErroPagamento } from "@/lib/pagamentos/tipos";
import { consultarPixMP, criarPixMP } from "@/lib/pagamentos/mercadopago";
import { credenciaisMP } from "@/lib/pagamentos/credenciais";
import { MESES, hojeSP, somarDias, um } from "@/lib/formato";

/**
 * Regras de cobrança usadas pelo painel, pela página de pagamento, pelo
 * webhook e pela rotina diária. Toda baixa automática passa por
 * confirmarPagamento(), que faz a DUPLA VERIFICAÇÃO.
 *
 * `db` aqui é sempre o cliente de SERVIÇO: quem chama já validou o acesso
 * (sessão do personal, token secreto da página ou assinatura do webhook).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cliente = SupabaseClient<any>;

const EMAIL_VALIDO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

async function tokenDoPersonal(personalId: string) {
  const { accessToken } = await credenciaisMP(personalId);
  if (!accessToken)
    throw new ErroPagamento("O personal ainda não conectou a conta do Mercado Pago (Configurações).");
  return accessToken;
}

/* ------------------------------------------------------------------ */
/* Confirmação (dupla verificação)                                      */
/* ------------------------------------------------------------------ */

export type ResultadoConfirmacao = "paga" | "pendente" | "ignorada";

/**
 * Só marca como paga se TODAS passarem:
 *  1. a cobrança existe, está pendente e tem Pix gerado;
 *  2. o Mercado Pago, consultado AGORA com o token do personal dono da
 *     cobrança, diz que o pagamento foi creditado;
 *  3. a referência no MP é o id desta cobrança;
 *  4. o valor pago é >= valor cobrado.
 * O update exige status = pendente (evita baixa dupla).
 */
export async function confirmarPagamento(db: Cliente, cobrancaId: string): Promise<ResultadoConfirmacao> {
  const { data: c } = await db
    .from("cobrancas")
    .select("id, personal_id, status, valor_centavos, provedor, provedor_pagamento_id")
    .eq("id", cobrancaId)
    .maybeSingle();

  if (!c || c.status !== "pendente" || c.provedor !== "mercadopago" || !c.provedor_pagamento_id)
    return "ignorada";

  const situacao = await consultarPixMP(await tokenDoPersonal(c.personal_id), c.provedor_pagamento_id);
  if (!situacao.pago) return "pendente";

  if (situacao.referencia && situacao.referencia !== c.id) {
    console.error("[confirmarPagamento] referência diferente", { cobranca: c.id });
    return "ignorada";
  }
  if (situacao.valorCentavos < c.valor_centavos) {
    console.error("[confirmarPagamento] valor menor que o cobrado", { cobranca: c.id });
    return "ignorada";
  }

  const { data: atualizada } = await db
    .from("cobrancas")
    .update({ status: "paga", pago_em: situacao.pagoEm, forma_pagamento: "pix" })
    .eq("id", c.id)
    .eq("status", "pendente")
    .select("id")
    .maybeSingle();

  return atualizada ? "paga" : "ignorada";
}

/** Confere pendentes com Pix gerado (de um personal, de um aluno ou de todos). */
export async function sincronizarPendentes(db: Cliente, filtro: { personalId?: string; alunoId?: string } = {}) {
  let q = db.from("cobrancas").select("id").eq("status", "pendente").not("provedor_pagamento_id", "is", null);
  if (filtro.personalId) q = q.eq("personal_id", filtro.personalId);
  if (filtro.alunoId) q = q.eq("aluno_id", filtro.alunoId);
  const { data: pendentes } = await q.limit(300);

  let pagas = 0;
  let falhas = 0;
  for (const p of pendentes ?? []) {
    try {
      if ((await confirmarPagamento(db, p.id)) === "paga") pagas++;
    } catch (e) {
      falhas++;
      console.error("[sincronizarPendentes]", p.id, e instanceof Error ? e.message : e);
    }
  }
  return { verificadas: pendentes?.length ?? 0, pagas, falhas };
}

/* ------------------------------------------------------------------ */
/* Pix                                                                  */
/* ------------------------------------------------------------------ */

function diasDeValidade(vencimento: string) {
  const hoje = new Date(`${hojeSP()}T12:00:00`);
  const venc = new Date(`${vencimento}T12:00:00`);
  const dias = Math.round((venc.getTime() - hoje.getTime()) / 86_400_000) + 10;
  return Math.min(30, Math.max(1, dias));
}

export function pixValido(c: { pix_copia_cola: string | null; pix_expira_em: string | null }) {
  return Boolean(c.pix_copia_cola && c.pix_expira_em && new Date(c.pix_expira_em) > new Date());
}

/** Gera (ou reaproveita, se ainda válido) o Pix de uma cobrança pendente. */
export async function garantirPix(db: Cliente, cobrancaId: string) {
  const { data: c } = await db
    .from("cobrancas")
    .select("id, personal_id, valor_centavos, vencimento, status, pix_copia_cola, pix_expira_em, alunos ( email )")
    .eq("id", cobrancaId)
    .maybeSingle();

  if (!c) throw new ErroPagamento("Cobrança não encontrada.");
  if (c.status !== "pendente") throw new ErroPagamento("Essa cobrança não está pendente.");
  if (pixValido(c)) return { copiaECola: c.pix_copia_cola as string, expiraEm: c.pix_expira_em as string };

  const email = String(um(c.alunos)?.email ?? "").trim().toLowerCase();
  if (!EMAIL_VALIDO.test(email))
    throw new ErroPagamento("O aluno precisa ter um e-mail cadastrado para gerar o Pix.");

  const pix = await criarPixMP(await tokenDoPersonal(c.personal_id), {
    referencia: c.id,
    valorCentavos: c.valor_centavos,
    emailPagador: email,
    expiraEmDias: diasDeValidade(c.vencimento)
  });

  const { error } = await db
    .from("cobrancas")
    .update({
      provedor: pix.provedor,
      provedor_pagamento_id: pix.idPagamento,
      pix_copia_cola: pix.copiaECola,
      pix_expira_em: pix.expiraEm
    })
    .eq("id", c.id)
    .eq("status", "pendente");
  if (error) throw new ErroPagamento("Pix gerado, mas não foi possível salvar. Tente novamente.");

  // devolve direto: reler na mesma renderização pode trazer a leitura antiga (memoização do Next)
  return { copiaECola: pix.copiaECola, expiraEm: pix.expiraEm };
}

/* ------------------------------------------------------------------ */
/* Mensalidades / consultorias recorrentes                              */
/* ------------------------------------------------------------------ */

type AlunoComPlano = {
  id: string;
  personal_id: string;
  dia_vencimento: number;
  planos: { id: string; nome: string; valor_centavos: number; meses: number; tipo: string; ativo: boolean } | null;
};

/**
 * Cria as cobranças recorrentes que vencem entre hoje e hoje + `dias`.
 * Plano de N meses gera cobrança a cada N meses, contando da última cobrança.
 * Nunca duplica: índice único (aluno, competência) + ignoreDuplicates.
 */
export async function gerarCobrancasProximas(db: Cliente, filtro: { personalId?: string } = {}, dias = 5) {
  const hoje = hojeSP();
  const limite = somarDias(hoje, dias);

  let q = db
    .from("alunos")
    .select("id, personal_id, dia_vencimento, planos ( id, nome, valor_centavos, meses, tipo, ativo )")
    .eq("ativo", true)
    .not("plano_id", "is", null);
  if (filtro.personalId) q = q.eq("personal_id", filtro.personalId);
  const { data } = await q;
  const alunos = (data ?? []) as unknown as AlunoComPlano[];
  if (alunos.length === 0) return { candidatas: 0, criadas: 0 };

  // última competência recorrente de cada aluno
  const { data: ultimas } = await db
    .from("cobrancas")
    .select("aluno_id, competencia")
    .in("aluno_id", alunos.map((a) => a.id))
    .eq("recorrente", true)
    .neq("status", "cancelada")
    .order("competencia", { ascending: false });
  const ultimaPorAluno = new Map<string, string>();
  for (const u of ultimas ?? []) if (!ultimaPorAluno.has(u.aluno_id)) ultimaPorAluno.set(u.aluno_id, u.competencia);

  const [ano, mes] = hoje.split("-").map(Number);
  const linhas = [];

  for (const a of alunos) {
    const plano = a.planos;
    if (!plano || plano.tipo !== "recorrente" || !plano.ativo) continue;

    for (const deslocamento of [0, 1]) {
      const m0 = mes - 1 + deslocamento;
      const y = ano + Math.floor(m0 / 12);
      const m = (m0 % 12) + 1;
      const mm = String(m).padStart(2, "0");
      const competencia = `${y}-${mm}-01`;
      const vencimento = `${y}-${mm}-${String(a.dia_vencimento).padStart(2, "0")}`;
      if (vencimento < hoje || vencimento > limite) continue;

      // plano trimestral/semestral/anual: respeita o intervalo desde a última cobrança
      const ultima = ultimaPorAluno.get(a.id);
      if (ultima && plano.meses > 1) {
        const [uy, um] = ultima.split("-").map(Number);
        const mesesDesde = (y - uy) * 12 + (m - um);
        if (mesesDesde < plano.meses) continue;
      }

      const periodo = plano.meses === 1 ? `${MESES[m - 1]}/${y}` : `${plano.meses} meses a partir de ${MESES[m - 1]}/${y}`;
      linhas.push({
        personal_id: a.personal_id,
        aluno_id: a.id,
        plano_id: plano.id,
        descricao: `${plano.nome} — ${periodo}`.slice(0, 160),
        recorrente: true,
        competencia,
        vencimento,
        valor_centavos: plano.valor_centavos
      });
    }
  }

  // Insere uma a uma: o índice único é parcial (ignora canceladas), e o
  // ON CONFLICT do PostgREST não aceita índice parcial. Duplicata = erro 23505 = já existe.
  let criadas = 0;
  for (const linha of linhas) {
    const { error } = await db.from("cobrancas").insert(linha);
    if (!error) criadas++;
    else if (error.code !== "23505") console.error("[gerarCobrancasProximas]", error.message);
  }
  return { candidatas: linhas.length, criadas };
}

/** Gera Pix para pendentes que vencem em até `dias` (ou já venceram), de personais com MP conectado. */
export async function gerarPixPendentes(db: Cliente, dias = 5, limite = 80) {
  const { data: configurados } = await db.from("config_pagamento").select("personal_id").eq("mp_configurado", true);
  const ids = (configurados ?? []).map((c) => c.personal_id);
  if (ids.length === 0) return { gerados: 0, semEmail: 0, falhas: 0 };

  const { data: pendentes } = await db
    .from("cobrancas")
    .select("id, pix_copia_cola, pix_expira_em, alunos ( email )")
    .eq("status", "pendente")
    .in("personal_id", ids)
    .lte("vencimento", somarDias(hojeSP(), dias))
    .order("vencimento")
    .limit(300);

  let gerados = 0, semEmail = 0, falhas = 0;
  for (const c of pendentes ?? []) {
    if (gerados >= limite) break;
    if (pixValido(c)) continue;
    if (!um(c.alunos)?.email) { semEmail++; continue; }
    try {
      await garantirPix(db, c.id);
      gerados++;
    } catch (e) {
      falhas++;
      console.error("[gerarPixPendentes]", c.id, e instanceof Error ? e.message : e);
    }
  }
  return { gerados, semEmail, falhas };
}
