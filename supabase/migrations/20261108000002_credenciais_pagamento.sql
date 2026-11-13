-- =====================================================================
-- Credenciais do Mercado Pago de CADA personal
--
-- Num SaaS, o dinheiro de cada personal cai na conta dele. Então cada um
-- tem o próprio Access Token e a própria assinatura do webhook.
-- Esses segredos ficam no Supabase Vault (criptografados em repouso) e
-- só funções liberadas para service_role (o servidor) conseguem ler.
-- O navegador só enxerga "configurado: sim/não".
-- =====================================================================

create table private.credenciais_mp (
  personal_id        uuid primary key references public.personais (id) on delete cascade,
  access_token_id    uuid not null,  -- id do segredo no vault
  webhook_secret_id  uuid,
  atualizado_em      timestamptz not null default now()
);
revoke all on private.credenciais_mp from public, anon, authenticated;

-- visão pública e segura: só o status
create table public.config_pagamento (
  personal_id     uuid primary key references public.personais (id) on delete cascade,
  mp_configurado  boolean not null default false,
  webhook_configurado boolean not null default false,
  atualizado_em   timestamptz not null default now()
);
alter table public.config_pagamento enable row level security;
create policy config_pagamento_select on public.config_pagamento for select to authenticated
  using (personal_id = (select private.meu_personal_id()));
revoke insert, update, delete on public.config_pagamento from authenticated, anon;

-- Grava/atualiza as credenciais. Só o servidor chama (service_role),
-- DEPOIS de conferir que o usuário logado é o dono deste personal.
create or replace function public.salvar_credenciais_mp(
  p_personal_id uuid, p_access_token text, p_webhook_secret text
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_atual private.credenciais_mp%rowtype;
  v_token_id uuid;
  v_secret_id uuid;
begin
  if p_access_token is null or length(p_access_token) < 20 then
    raise exception 'Access Token inválido.';
  end if;

  select * into v_atual from private.credenciais_mp where personal_id = p_personal_id;

  if found then
    perform vault.update_secret(v_atual.access_token_id, p_access_token);
    v_token_id := v_atual.access_token_id;
    v_secret_id := v_atual.webhook_secret_id;
    if p_webhook_secret is not null and length(p_webhook_secret) > 0 then
      if v_secret_id is null then
        v_secret_id := vault.create_secret(p_webhook_secret, 'mp_webhook_' || p_personal_id::text);
      else
        perform vault.update_secret(v_secret_id, p_webhook_secret);
      end if;
    end if;
    update private.credenciais_mp
       set webhook_secret_id = v_secret_id, atualizado_em = now()
     where personal_id = p_personal_id;
  else
    v_token_id := vault.create_secret(p_access_token, 'mp_token_' || p_personal_id::text);
    if p_webhook_secret is not null and length(p_webhook_secret) > 0 then
      v_secret_id := vault.create_secret(p_webhook_secret, 'mp_webhook_' || p_personal_id::text);
    end if;
    insert into private.credenciais_mp (personal_id, access_token_id, webhook_secret_id)
    values (p_personal_id, v_token_id, v_secret_id);
  end if;

  insert into public.config_pagamento (personal_id, mp_configurado, webhook_configurado, atualizado_em)
  values (p_personal_id, true, v_secret_id is not null, now())
  on conflict (personal_id) do update
    set mp_configurado = true, webhook_configurado = excluded.webhook_configurado, atualizado_em = now();
end;
$$;

create or replace function public.obter_credenciais_mp(p_personal_id uuid)
returns table (access_token text, webhook_secret text)
language sql stable security definer set search_path = ''
as $$
  select
    (select s.decrypted_secret from vault.decrypted_secrets s where s.id = c.access_token_id),
    (select s.decrypted_secret from vault.decrypted_secrets s where s.id = c.webhook_secret_id)
  from private.credenciais_mp c
  where c.personal_id = p_personal_id
$$;

revoke all on function public.salvar_credenciais_mp(uuid, text, text) from public, anon, authenticated;
revoke all on function public.obter_credenciais_mp(uuid) from public, anon, authenticated;
grant execute on function public.salvar_credenciais_mp(uuid, text, text) to service_role;
grant execute on function public.obter_credenciais_mp(uuid) to service_role;
