-- =====================================================================
-- Personal Fit — base multi-personal (SaaS)
--
-- Conceito central: cada PERSONAL é um "inquilino" (tenant). Toda linha
-- de dado de negócio carrega personal_id, e o RLS só deixa cada usuário
-- ver as linhas do seu próprio personal. Chaves estrangeiras COMPOSTAS
-- (personal_id, id) impedem que um registro aponte para um aluno de outro
-- personal, mesmo que alguém tente forçar pelo código.
-- =====================================================================

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------
-- PERSONAIS (o cliente do SaaS)
-- ---------------------------------------------------------------------
create table public.personais (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null unique references auth.users (id) on delete cascade,
  nome          text not null check (length(trim(nome)) between 2 and 120),
  nome_marca    text check (nome_marca is null or length(nome_marca) <= 120),
  email         text not null check (length(email) <= 254),
  whatsapp      text check (whatsapp is null or whatsapp ~ '^[0-9]{10,13}$'),
  cref          text check (cref is null or length(cref) <= 30),
  -- assinatura do próprio SaaS (o personal paga você)
  plano_plataforma text not null default 'teste'
                 check (plano_plataforma in ('teste', 'ativo', 'suspenso')),
  teste_ate     date not null default ((now() at time zone 'America/Sao_Paulo')::date + 30),
  criado_em     timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- PLANOS DE CONSULTORIA (o que o personal vende)
-- ---------------------------------------------------------------------
create table public.planos (
  id             uuid primary key default gen_random_uuid(),
  personal_id    uuid not null references public.personais (id) on delete restrict,
  nome           text not null check (length(trim(nome)) between 2 and 80),
  descricao      text check (descricao is null or length(descricao) <= 500),
  valor_centavos integer not null check (valor_centavos > 0 and valor_centavos <= 100000000),
  meses          smallint not null default 1 check (meses in (1, 2, 3, 6, 12)),
  tipo           text not null default 'recorrente' check (tipo in ('recorrente', 'avulso')),
  ativo          boolean not null default true,
  criado_em      timestamptz not null default now(),
  unique (personal_id, id)
);

-- ---------------------------------------------------------------------
-- ALUNOS
-- ---------------------------------------------------------------------
create table public.alunos (
  id               uuid primary key default gen_random_uuid(),
  personal_id      uuid not null references public.personais (id) on delete restrict,
  user_id          uuid references auth.users (id) on delete set null,
  nome             text not null check (length(trim(nome)) between 2 and 120),
  email            text check (email is null or length(email) <= 254),
  whatsapp         text check (whatsapp is null or whatsapp ~ '^[0-9]{10,13}$'),
  data_nascimento  date,
  sexo             text check (sexo is null or sexo in ('F', 'M', 'O')),
  objetivo         text check (objetivo is null or length(objetivo) <= 300),
  observacoes      text check (observacoes is null or length(observacoes) <= 2000),
  plano_id         uuid,
  dia_vencimento   smallint not null default 10 check (dia_vencimento between 1 and 28),
  ativo            boolean not null default true,
  -- convite para o aluno criar o login no app (token secreto, uso único)
  convite_token    text unique default encode(extensions.gen_random_bytes(16), 'hex'),
  convite_aceito_em timestamptz,
  criado_em        timestamptz not null default now(),
  unique (personal_id, id),
  foreign key (personal_id, plano_id) references public.planos (personal_id, id) on delete restrict
);
create unique index alunos_email_por_personal
  on public.alunos (personal_id, lower(email)) where email is not null;
create unique index alunos_user_por_personal
  on public.alunos (personal_id, user_id) where user_id is not null;
create index alunos_user_id_idx on public.alunos (user_id);
create index alunos_plano_idx on public.alunos (plano_id);

-- ---------------------------------------------------------------------
-- FUNÇÕES DE APOIO AO RLS (schema private: não é exposto pela API)
-- security definer para não entrar em recursão de RLS; search_path vazio
-- para ninguém sequestrar nomes de tabela.
-- ---------------------------------------------------------------------
create or replace function private.meu_personal_id()
returns uuid language sql stable security definer set search_path = ''
as $$ select p.id from public.personais p where p.user_id = auth.uid() $$;

create or replace function private.meus_alunos()
returns setof uuid language sql stable security definer set search_path = ''
as $$ select a.id from public.alunos a where a.user_id = auth.uid() and a.ativo $$;

create or replace function private.personais_do_aluno()
returns setof uuid language sql stable security definer set search_path = ''
as $$ select a.personal_id from public.alunos a where a.user_id = auth.uid() and a.ativo $$;

revoke all on function private.meu_personal_id() from public, anon;
revoke all on function private.meus_alunos() from public, anon;
revoke all on function private.personais_do_aluno() from public, anon;
grant execute on function private.meu_personal_id() to authenticated;
grant execute on function private.meus_alunos() to authenticated;
grant execute on function private.personais_do_aluno() to authenticated;

-- ---------------------------------------------------------------------
-- RLS: personais / planos / alunos
-- ---------------------------------------------------------------------
alter table public.personais enable row level security;
alter table public.planos    enable row level security;
alter table public.alunos    enable row level security;

-- personal vê e edita só o próprio cadastro; aluno vê o nome do seu personal
create policy personais_select on public.personais for select to authenticated
  using (user_id = (select auth.uid()) or id in (select private.personais_do_aluno()));
create policy personais_insert on public.personais for insert to authenticated
  with check (user_id = (select auth.uid()) and plano_plataforma = 'teste');
create policy personais_update on public.personais for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Privilégio por COLUNA: revogar no nível da tabela e liberar só o que pode.
-- (revogar uma coluna não adianta se a tabela inteira estiver liberada)
-- Assim ninguém se dá plano 'ativo' nem estende o período de teste pela API.
revoke insert, update on public.personais from authenticated;
grant insert (user_id, nome, nome_marca, email, whatsapp, cref) on public.personais to authenticated;
grant update (nome, nome_marca, email, whatsapp, cref) on public.personais to authenticated;

create policy planos_personal on public.planos for all to authenticated
  using (personal_id = (select private.meu_personal_id()))
  with check (personal_id = (select private.meu_personal_id()));
create policy planos_aluno_select on public.planos for select to authenticated
  using (personal_id in (select private.personais_do_aluno()));

create policy alunos_personal_select on public.alunos for select to authenticated
  using (personal_id = (select private.meu_personal_id()));
create policy alunos_personal_insert on public.alunos for insert to authenticated
  with check (personal_id = (select private.meu_personal_id()) and user_id is null);
create policy alunos_personal_update on public.alunos for update to authenticated
  using (personal_id = (select private.meu_personal_id()))
  with check (personal_id = (select private.meu_personal_id()));
create policy alunos_proprio_select on public.alunos for select to authenticated
  using (user_id = (select auth.uid()));
-- sem DELETE: aluno é inativado, nunca apagado (preserva histórico financeiro)

-- vincular o login do aluno só acontece no servidor (convite validado)
revoke insert, update on public.alunos from authenticated;
grant insert (personal_id, nome, email, whatsapp, data_nascimento, sexo, objetivo,
              observacoes, plano_id, dia_vencimento) on public.alunos to authenticated;
grant update (nome, email, whatsapp, data_nascimento, sexo, objetivo,
              observacoes, plano_id, dia_vencimento, ativo) on public.alunos to authenticated;

-- ---------------------------------------------------------------------
-- COBRANÇAS
-- ---------------------------------------------------------------------
create table public.cobrancas (
  id                    uuid primary key default gen_random_uuid(),
  personal_id           uuid not null references public.personais (id) on delete restrict,
  aluno_id              uuid not null,
  plano_id              uuid,
  descricao             text not null check (length(descricao) between 2 and 160),
  recorrente            boolean not null default true,
  competencia           date not null check (extract(day from competencia) = 1),
  vencimento            date not null,
  valor_centavos        integer not null check (valor_centavos > 0 and valor_centavos <= 100000000),
  status                text not null default 'pendente' check (status in ('pendente', 'paga', 'cancelada')),
  pago_em               timestamptz,
  forma_pagamento       text check (forma_pagamento in ('pix', 'cartao', 'dinheiro', 'transferencia', 'outro')),
  origem_baixa          text check (origem_baixa in ('manual', 'automatica')),
  registrado_por        uuid references auth.users (id) on delete set null,
  link_token            text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  provedor              text,
  provedor_pagamento_id text,
  pix_copia_cola        text,
  pix_expira_em         timestamptz,
  ultima_verificacao_em timestamptz,
  criado_em             timestamptz not null default now(),
  check ((status = 'paga') = (pago_em is not null and forma_pagamento is not null)),
  unique (personal_id, id),
  foreign key (personal_id, aluno_id) references public.alunos (personal_id, id) on delete restrict,
  foreign key (personal_id, plano_id) references public.planos (personal_id, id) on delete restrict
);
create unique index cobrancas_recorrente_unica
  on public.cobrancas (aluno_id, competencia) where recorrente and status <> 'cancelada';
create unique index cobrancas_provedor_unico
  on public.cobrancas (provedor, provedor_pagamento_id) where provedor_pagamento_id is not null;
create index cobrancas_personal_status_idx on public.cobrancas (personal_id, status, vencimento);
create index cobrancas_aluno_idx on public.cobrancas (aluno_id);
create index cobrancas_plano_idx on public.cobrancas (plano_id);
create index cobrancas_registrado_por_idx on public.cobrancas (registrado_por);

alter table public.cobrancas enable row level security;

create policy cobrancas_personal_select on public.cobrancas for select to authenticated
  using (personal_id = (select private.meu_personal_id()));
create policy cobrancas_personal_insert on public.cobrancas for insert to authenticated
  with check (personal_id = (select private.meu_personal_id()));
create policy cobrancas_personal_update on public.cobrancas for update to authenticated
  using (personal_id = (select private.meu_personal_id()))
  with check (personal_id = (select private.meu_personal_id()));
create policy cobrancas_aluno_select on public.cobrancas for select to authenticated
  using (aluno_id in (select private.meus_alunos()));
-- sem DELETE: cobrança se cancela, não se apaga

-- campos do Pix / webhook / auditoria só o servidor (chave secreta) preenche
revoke insert, update on public.cobrancas from authenticated;
grant insert (personal_id, aluno_id, plano_id, descricao, recorrente, competencia,
              vencimento, valor_centavos) on public.cobrancas to authenticated;
grant update (descricao, vencimento, valor_centavos, status, pago_em, forma_pagamento)
  on public.cobrancas to authenticated;

-- ---------------------------------------------------------------------
-- HISTÓRICO IMUTÁVEL DAS COBRANÇAS
-- ---------------------------------------------------------------------
create table public.eventos_cobranca (
  id           bigint generated always as identity primary key,
  personal_id  uuid not null references public.personais (id) on delete restrict,
  cobranca_id  uuid not null references public.cobrancas (id) on delete restrict,
  aluno_id     uuid not null references public.alunos (id) on delete restrict,
  tipo         text not null,
  detalhes     jsonb not null default '{}',
  usuario_id   uuid references auth.users (id) on delete set null,
  criado_em    timestamptz not null default now()
);
create index eventos_cobranca_cobranca_idx on public.eventos_cobranca (cobranca_id);
create index eventos_cobranca_aluno_idx on public.eventos_cobranca (aluno_id);
create index eventos_cobranca_personal_idx on public.eventos_cobranca (personal_id, criado_em desc);
create index eventos_cobranca_usuario_idx on public.eventos_cobranca (usuario_id);

alter table public.eventos_cobranca enable row level security;
create policy eventos_cobranca_select on public.eventos_cobranca for select to authenticated
  using (personal_id = (select private.meu_personal_id()));
-- ninguém insere/edita/apaga pela API: só o trigger abaixo escreve aqui

-- Regras de negócio (BEFORE): cobrança paga fica travada; define a origem da baixa
create or replace function private.cobranca_regras()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old.status = 'paga' then
    -- única mudança aceita numa cobrança paga: desfazer a baixa manual
    if new.status = 'pendente' and old.origem_baixa = 'manual' and auth.uid() is not null then
      new.pago_em := null; new.forma_pagamento := null;
      new.origem_baixa := null; new.registrado_por := null;
      return new;
    end if;
    if new is distinct from old then
      raise exception 'Cobrança paga não pode ser alterada.';
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' and new.status = 'paga' and auth.uid() is not null then
    raise exception 'Crie a cobrança como pendente e registre o pagamento depois.';
  end if;

  if new.status = 'paga' then
    if auth.uid() is not null then
      new.origem_baixa := 'manual';
      new.registrado_por := auth.uid();
    else
      new.origem_baixa := 'automatica';
      new.registrado_por := null;
    end if;
  end if;
  return new;
end;
$$;

create trigger cobranca_regras before insert or update on public.cobrancas
  for each row execute function private.cobranca_regras();

-- Auditoria (AFTER): grava o que aconteceu, por quem
create or replace function private.cobranca_auditoria()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_tipo text;
  v_det jsonb := '{}';
begin
  if tg_op = 'INSERT' then
    v_tipo := case when new.status = 'paga' then 'paga' else 'criada' end;
    v_det := jsonb_build_object('valor_centavos', new.valor_centavos, 'vencimento', new.vencimento);
  elsif new.status is distinct from old.status then
    v_tipo := case
      when new.status = 'paga' then 'paga'
      when new.status = 'cancelada' then 'cancelada'
      when old.status = 'paga' then 'pagamento_desfeito'
      else 'reaberta' end;
    v_det := jsonb_build_object('de', old.status, 'para', new.status,
                                'forma', coalesce(new.forma_pagamento, old.forma_pagamento),
                                'origem', coalesce(new.origem_baixa, old.origem_baixa));
  elsif new.pix_copia_cola is distinct from old.pix_copia_cola and new.pix_copia_cola is not null then
    v_tipo := 'pix_gerado';
  elsif new.valor_centavos <> old.valor_centavos or new.vencimento <> old.vencimento then
    v_tipo := 'valor_alterado';
    v_det := jsonb_build_object('valor_de', old.valor_centavos, 'valor_para', new.valor_centavos,
                                'venc_de', old.vencimento, 'venc_para', new.vencimento);
  else
    return null;
  end if;

  insert into public.eventos_cobranca (personal_id, cobranca_id, aluno_id, tipo, detalhes, usuario_id)
  values (new.personal_id, new.id, new.aluno_id, v_tipo, v_det, auth.uid());
  return null;
end;
$$;
revoke all on function private.cobranca_auditoria() from public, anon, authenticated;
revoke all on function private.cobranca_regras() from public, anon;

create trigger cobranca_auditoria after insert or update on public.cobrancas
  for each row execute function private.cobranca_auditoria();

-- ---------------------------------------------------------------------
-- SITUAÇÃO FINANCEIRA DE CADA ALUNO (calculada, nunca armazenada)
-- ---------------------------------------------------------------------
create view public.vw_situacao_alunos with (security_invoker = true) as
with hoje as (select (now() at time zone 'America/Sao_Paulo')::date as d)
select
  a.id as aluno_id,
  a.personal_id,
  a.nome,
  a.whatsapp,
  a.email,
  a.ativo,
  a.plano_id,
  a.user_id is not null as tem_app,
  coalesce(sum(c.valor_centavos) filter (where c.status = 'pendente' and c.vencimento < h.d), 0)::int as valor_atrasado,
  coalesce(sum(c.valor_centavos) filter (where c.status = 'pendente'), 0)::int as valor_aberto,
  coalesce(max(h.d - c.vencimento) filter (where c.status = 'pendente' and c.vencimento < h.d), 0)::int as dias_atraso,
  min(c.vencimento) filter (where c.status = 'pendente') as proximo_vencimento,
  max(c.pago_em) as ultimo_pagamento_em,
  case
    when count(*) filter (where c.status = 'pendente' and c.vencimento < h.d) > 0 then 'atrasado'
    when count(*) filter (where c.status = 'pendente' and c.vencimento <= h.d + 5) > 0 then 'vence_em_breve'
    when count(*) filter (where c.status in ('pendente', 'paga')) > 0 then 'em_dia'
    else 'sem_cobranca'
  end as situacao
from public.alunos a
cross join hoje h
left join public.cobrancas c on c.aluno_id = a.id
group by a.id, h.d;
