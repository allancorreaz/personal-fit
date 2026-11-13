"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirPersonal } from "@/lib/supabase/server";
import { clienteServico } from "@/lib/supabase/servico";
import { garantirPix, gerarCobrancasProximas, sincronizarPendentes } from "@/lib/cobrancas";
import { ErroPagamento } from "@/lib/pagamentos/tipos";
import { testarTokenMP } from "@/lib/pagamentos/mercadopago";
import { hojeSP, normalizarWhatsapp, reaisParaCentavos } from "@/lib/formato";

/*
 * Todas as ações do painel:
 *  1) exigem personal logado (exigirPersonal)
 *  2) usam o cliente com a sessão dele → o RLS só deixa mexer nos próprios dados
 *  3) quando precisam do cliente de serviço (campos travados), PRIMEIRO
 *     conferem com o cliente do usuário que o registro é dele.
 */

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const UUID = /^[0-9a-f-]{36}$/;

function texto(f: FormData, campo: string, max = 300) {
  const v = String(f.get(campo) ?? "").trim();
  return v ? v.slice(0, max) : null;
}

function ir(caminho: string, tipo: "ok" | "erro", msg: string): never {
  const sep = caminho.includes("?") ? "&" : "?";
  redirect(`${caminho}${sep}${tipo}=${encodeURIComponent(msg)}`);
}

function uuid(v: FormDataEntryValue | null) {
  const s = String(v ?? "");
  return UUID.test(s) ? s : null;
}

/* ---------------------------------------------------------------- */
/* Alunos                                                            */
/* ---------------------------------------------------------------- */

function dadosAluno(f: FormData) {
  const email = texto(f, "email", 254)?.toLowerCase() ?? null;
  const dia = Number(f.get("dia_vencimento") ?? 10);
  const sexo = texto(f, "sexo", 1);
  return {
    nome: texto(f, "nome", 120) ?? "",
    email,
    whatsapp: normalizarWhatsapp(texto(f, "whatsapp", 20)),
    data_nascimento: texto(f, "data_nascimento", 10),
    sexo: sexo && ["F", "M", "O"].includes(sexo) ? sexo : null,
    objetivo: texto(f, "objetivo", 300),
    observacoes: texto(f, "observacoes", 2000),
    plano_id: uuid(f.get("plano_id")),
    dia_vencimento: Number.isInteger(dia) && dia >= 1 && dia <= 28 ? dia : 10
  };
}

export async function criarAluno(f: FormData) {
  const { supabase, personal } = await exigirPersonal();
  const d = dadosAluno(f);
  if (d.nome.length < 2) ir("/painel/alunos/novo", "erro", "Informe o nome do aluno.");
  if (d.email && !EMAIL.test(d.email)) ir("/painel/alunos/novo", "erro", "E-mail inválido.");

  const { data, error } = await supabase
    .from("alunos")
    .insert({ ...d, personal_id: personal.id })
    .select("id")
    .single();
  if (error) {
    ir("/painel/alunos/novo", "erro", error.code === "23505" ? "Já existe um aluno com esse e-mail." : "Não foi possível salvar.");
  }
  revalidatePath("/painel/alunos");
  ir(`/painel/alunos/${data.id}`, "ok", "Aluno cadastrado. Envie o convite para ele acessar o app.");
}

export async function atualizarAluno(f: FormData) {
  const { supabase } = await exigirPersonal();
  const id = uuid(f.get("id"));
  if (!id) ir("/painel/alunos", "erro", "Aluno inválido.");
  const d = dadosAluno(f);
  const volta = `/painel/alunos/${id}`;
  if (d.nome.length < 2) ir(volta, "erro", "Informe o nome.");
  if (d.email && !EMAIL.test(d.email)) ir(volta, "erro", "E-mail inválido.");

  const { error } = await supabase.from("alunos").update(d).eq("id", id);
  if (error) ir(volta, "erro", error.code === "23505" ? "Já existe um aluno com esse e-mail." : "Não foi possível salvar.");
  revalidatePath(volta);
  ir(volta, "ok", "Dados salvos.");
}

export async function alternarAtivo(f: FormData) {
  const { supabase } = await exigirPersonal();
  const id = uuid(f.get("id"));
  const ativo = f.get("ativo") === "true";
  if (!id) return;
  await supabase.from("alunos").update({ ativo }).eq("id", id);
  revalidatePath(`/painel/alunos/${id}`);
  ir(`/painel/alunos/${id}`, "ok", ativo ? "Aluno reativado." : "Aluno inativado. Cobranças futuras não serão geradas.");
}

/** Gera um link de convite novo (o antigo deixa de funcionar). */
export async function renovarConvite(f: FormData) {
  const { supabase } = await exigirPersonal();
  const id = uuid(f.get("id"));
  if (!id) return;
  // 1º confere com a sessão do personal que o aluno é dele (RLS)
  const { data: aluno } = await supabase.from("alunos").select("id, user_id").eq("id", id).maybeSingle();
  if (!aluno) ir("/painel/alunos", "erro", "Aluno não encontrado.");
  if (aluno.user_id) ir(`/painel/alunos/${id}`, "erro", "Este aluno já tem acesso ao app.");

  const novo = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
  await clienteServico().from("alunos").update({ convite_token: novo }).eq("id", id).is("user_id", null);
  revalidatePath(`/painel/alunos/${id}`);
  ir(`/painel/alunos/${id}`, "ok", "Novo link de convite gerado.");
}

/* ---------------------------------------------------------------- */
/* Planos                                                            */
/* ---------------------------------------------------------------- */

export async function salvarPlano(f: FormData) {
  const { supabase, personal } = await exigirPersonal();
  const id = uuid(f.get("id"));
  const valor = reaisParaCentavos(f.get("valor"));
  const meses = Number(f.get("meses") ?? 1);
  const tipo = f.get("tipo") === "avulso" ? "avulso" : "recorrente";
  const nome = texto(f, "nome", 80);
  const volta = "/painel/financeiro/planos";

  if (!nome || nome.length < 2) ir(volta, "erro", "Informe o nome do plano.");
  if (!Number.isFinite(valor) || valor <= 0) ir(volta, "erro", "Valor inválido.");
  if (![1, 2, 3, 6, 12].includes(meses)) ir(volta, "erro", "Periodicidade inválida.");

  const dados = { nome, descricao: texto(f, "descricao", 500), valor_centavos: valor, meses, tipo, ativo: f.get("ativo") !== "false" };
  const { error } = id
    ? await supabase.from("planos").update(dados).eq("id", id)
    : await supabase.from("planos").insert({ ...dados, personal_id: personal.id });
  if (error) ir(volta, "erro", "Não foi possível salvar o plano.");
  revalidatePath(volta);
  ir(volta, "ok", "Plano salvo.");
}

/* ---------------------------------------------------------------- */
/* Cobranças                                                         */
/* ---------------------------------------------------------------- */

export async function criarCobranca(f: FormData) {
  const { supabase, personal } = await exigirPersonal();
  const alunoId = uuid(f.get("aluno_id"));
  const volta = `/painel/alunos/${alunoId}`;
  if (!alunoId) ir("/painel/alunos", "erro", "Aluno inválido.");

  const valor = reaisParaCentavos(f.get("valor"));
  const vencimento = texto(f, "vencimento", 10) ?? hojeSP();
  const descricao = texto(f, "descricao", 160) ?? "Consultoria";
  if (!Number.isFinite(valor) || valor <= 0) ir(volta, "erro", "Valor inválido.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(vencimento)) ir(volta, "erro", "Vencimento inválido.");

  const { error } = await supabase.from("cobrancas").insert({
    personal_id: personal.id,
    aluno_id: alunoId,
    descricao,
    recorrente: false,
    competencia: `${vencimento.slice(0, 7)}-01`,
    vencimento,
    valor_centavos: valor
  });
  if (error) ir(volta, "erro", "Não foi possível criar a cobrança.");
  revalidatePath(volta);
  ir(volta, "ok", "Cobrança criada.");
}

export async function marcarPaga(f: FormData) {
  const { supabase } = await exigirPersonal();
  const id = uuid(f.get("id"));
  const volta = String(f.get("volta") ?? "/painel/financeiro");
  const forma = String(f.get("forma") ?? "dinheiro");
  if (!id || !["pix", "dinheiro", "transferencia", "cartao", "outro"].includes(forma)) ir(volta, "erro", "Dados inválidos.");

  const { data, error } = await supabase
    .from("cobrancas")
    .update({ status: "paga", pago_em: new Date().toISOString(), forma_pagamento: forma })
    .eq("id", id)
    .eq("status", "pendente")
    .select("id")
    .maybeSingle();
  if (error || !data) ir(volta, "erro", "Não foi possível registrar (talvez já esteja paga).");
  revalidatePath(volta);
  ir(volta, "ok", "Pagamento registrado.");
}

export async function desfazerPagamento(f: FormData) {
  const { supabase } = await exigirPersonal();
  const id = uuid(f.get("id"));
  const volta = String(f.get("volta") ?? "/painel/financeiro");
  if (!id) return;
  // o banco só aceita desfazer baixa MANUAL (Pix confirmado pelo MP é definitivo)
  const { error } = await supabase
    .from("cobrancas")
    .update({ status: "pendente", pago_em: null, forma_pagamento: null })
    .eq("id", id);
  if (error) ir(volta, "erro", "Só pagamentos registrados manualmente podem ser desfeitos.");
  revalidatePath(volta);
  ir(volta, "ok", "Pagamento desfeito.");
}

export async function cancelarCobranca(f: FormData) {
  const { supabase } = await exigirPersonal();
  const id = uuid(f.get("id"));
  const volta = String(f.get("volta") ?? "/painel/financeiro");
  if (!id) return;
  const { error } = await supabase.from("cobrancas").update({ status: "cancelada" }).eq("id", id).eq("status", "pendente");
  if (error) ir(volta, "erro", "Não foi possível cancelar.");
  revalidatePath(volta);
  ir(volta, "ok", "Cobrança cancelada.");
}

export async function gerarPix(f: FormData) {
  const { supabase } = await exigirPersonal();
  const id = uuid(f.get("id"));
  const volta = String(f.get("volta") ?? "/painel/financeiro");
  if (!id) return;
  // confere posse com a sessão do personal ANTES de usar o cliente de serviço
  const { data: c } = await supabase.from("cobrancas").select("id").eq("id", id).maybeSingle();
  if (!c) ir(volta, "erro", "Cobrança não encontrada.");
  try {
    await garantirPix(clienteServico(), id);
  } catch (e) {
    ir(volta, "erro", e instanceof ErroPagamento ? e.message : "Não foi possível gerar o Pix agora.");
  }
  revalidatePath(volta);
  ir(volta, "ok", "Pix gerado. Envie o link de pagamento ao aluno.");
}

export async function verificarPagamentos(f: FormData) {
  const { personal } = await exigirPersonal();
  const volta = String(f.get("volta") ?? "/painel/financeiro");
  const r = await sincronizarPendentes(clienteServico(), { personalId: personal.id });
  revalidatePath(volta);
  ir(volta, "ok", `${r.verificadas} Pix conferidos, ${r.pagas} confirmados agora.`);
}

export async function gerarCobrancasAgora() {
  const { personal } = await exigirPersonal();
  const r = await gerarCobrancasProximas(clienteServico(), { personalId: personal.id }, 5);
  revalidatePath("/painel/financeiro");
  ir("/painel/financeiro", "ok", r.criadas ? `${r.criadas} cobrança(s) criada(s).` : "Nenhuma cobrança nova para os próximos 5 dias.");
}

/* ---------------------------------------------------------------- */
/* Configurações                                                     */
/* ---------------------------------------------------------------- */

export async function salvarPerfil(f: FormData) {
  const { supabase, personal } = await exigirPersonal();
  const nome = texto(f, "nome", 120);
  const email = texto(f, "email", 254)?.toLowerCase() ?? "";
  if (!nome || nome.length < 2 || !EMAIL.test(email)) ir("/painel/configuracoes", "erro", "Nome e e-mail são obrigatórios.");
  const { error } = await supabase
    .from("personais")
    .update({
      nome,
      email,
      nome_marca: texto(f, "nome_marca", 120),
      whatsapp: normalizarWhatsapp(texto(f, "whatsapp", 20)),
      cref: texto(f, "cref", 30)
    })
    .eq("id", personal.id);
  if (error) ir("/painel/configuracoes", "erro", "Não foi possível salvar.");
  revalidatePath("/painel", "layout");
  ir("/painel/configuracoes", "ok", "Perfil salvo.");
}

/**
 * Salva o Access Token e a assinatura do webhook do Mercado Pago DO PERSONAL.
 * O token é testado na API do MP antes de ir para o Vault e nunca volta para a tela.
 */
export async function salvarMercadoPago(f: FormData) {
  const { personal } = await exigirPersonal();
  const token = String(f.get("access_token") ?? "").trim();
  const secret = String(f.get("webhook_secret") ?? "").trim();
  const volta = "/painel/configuracoes";

  if (!/^APP_USR-[A-Za-z0-9-]{20,}$/.test(token)) ir(volta, "erro", "Cole o Access Token de PRODUÇÃO (começa com APP_USR-).");
  if (secret && !/^[A-Za-z0-9]{16,128}$/.test(secret)) ir(volta, "erro", "Assinatura secreta inválida.");
  if (!(await testarTokenMP(token))) ir(volta, "erro", "O Mercado Pago recusou esse token. Confira e tente de novo.");

  const { error } = await clienteServico().rpc("salvar_credenciais_mp", {
    p_personal_id: personal.id,
    p_access_token: token,
    p_webhook_secret: secret || null
  });
  if (error) ir(volta, "erro", "Não foi possível salvar as credenciais.");
  revalidatePath(volta);
  ir(volta, "ok", "Mercado Pago conectado.");
}
