import { Aviso, type ParamsAviso } from "@/components/aviso";
import { Copiar, Enviar } from "@/components/ui";
import { exigirPersonal } from "@/lib/supabase/server";
import { urlBase } from "@/lib/url";
import { formatDataHora } from "@/lib/formato";
import { salvarMercadoPago, salvarPerfil } from "../actions";

export const metadata = { title: "Configurações" };

export default async function ConfigPage({ searchParams }: { searchParams: ParamsAviso }) {
  const { ok, erro } = await searchParams;
  const { supabase, personal } = await exigirPersonal();
  const { data: config } = await supabase.from("config_pagamento").select("*").maybeSingle();
  const webhook = `${await urlBase()}/api/webhooks/mercadopago/${personal.id}`;

  return (
    <div className="pilha" style={{ maxWidth: 760 }}>
      <h1>Configurações</h1>
      <Aviso ok={ok} erro={erro} />

      <section className="cartao pilha">
        <h2>Seu perfil</h2>
        <form action={salvarPerfil} className="pilha">
          <div className="grade-2">
            <label className="campo">Nome*<input name="nome" required defaultValue={personal.nome} maxLength={120} /></label>
            <label className="campo">Nome da consultoria (aparece para o aluno)<input name="nome_marca" defaultValue={personal.nome_marca ?? ""} maxLength={120} /></label>
            <label className="campo">E-mail*<input name="email" type="email" required defaultValue={personal.email} /></label>
            <label className="campo">WhatsApp<input name="whatsapp" inputMode="tel" defaultValue={personal.whatsapp?.replace(/^55/, "") ?? ""} /></label>
            <label className="campo">CREF<input name="cref" maxLength={30} defaultValue={personal.cref ?? ""} /></label>
          </div>
          <Enviar>Salvar perfil</Enviar>
        </form>
      </section>

      <section className="cartao pilha">
        <div className="linha entre">
          <h2>Mercado Pago (Pix automático)</h2>
          <span className={`tag ${config?.mp_configurado ? "tag-verde" : "tag-cinza"}`}>{config?.mp_configurado ? "Conectado" : "Não conectado"}</span>
        </div>
        <p className="suave">
          O dinheiro cai direto na <strong>sua</strong> conta do Mercado Pago. O token fica guardado criptografado e
          nunca aparece de novo na tela, nem para nós.
        </p>
        {config?.mp_configurado && <p className="suave pequeno">Atualizado em {formatDataHora(config.atualizado_em)}. Para trocar, cole um novo token.</p>}
        <ol className="suave pequeno" style={{ paddingLeft: 18, lineHeight: 1.7 }}>
          <li>mercadopago.com.br/developers → Suas integrações → Criar aplicação (Pagamentos online → Checkout Transparente).</li>
          <li>Credenciais de produção → copie o <strong>Access Token</strong> (APP_USR-…).</li>
          <li>Webhooks → Modo produtivo → cole a URL abaixo → marque <strong>Order (Mercado Pago)</strong> → Salvar → copie a <strong>assinatura secreta</strong>.</li>
        </ol>
        <div className="linha"><code className="pequeno" style={{ wordBreak: "break-all" }}>{webhook}</code><Copiar texto={webhook} rotulo="Copiar URL" /></div>
        <form action={salvarMercadoPago} className="pilha" autoComplete="off">
          <label className="campo">Access Token de produção<input name="access_token" type="password" required placeholder="APP_USR-…" autoComplete="off" /></label>
          <label className="campo">Assinatura secreta do webhook<input name="webhook_secret" type="password" placeholder={config?.webhook_configurado ? "(já configurada — deixe vazio para manter)" : ""} autoComplete="off" /></label>
          <Enviar>Salvar e testar</Enviar>
        </form>
      </section>
    </div>
  );
}
