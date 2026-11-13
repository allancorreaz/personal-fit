-- =====================================================================
-- Treinos, registro de execução, avaliação física e anamnese
-- =====================================================================

-- ---------------------------------------------------------------------
-- BIBLIOTECA DE EXERCÍCIOS
-- personal_id NULL = exercício da biblioteca padrão (todos leem, ninguém edita)
-- ---------------------------------------------------------------------
create table public.exercicios (
  id              uuid primary key default gen_random_uuid(),
  personal_id     uuid references public.personais (id) on delete cascade,
  nome            text not null check (length(trim(nome)) between 2 and 120),
  grupo_muscular  text not null check (grupo_muscular in (
                    'peito','costas','ombros','biceps','triceps','antebraco','abdomen',
                    'quadriceps','posterior','gluteos','panturrilha','corpo_inteiro','cardio','mobilidade')),
  equipamento     text check (equipamento is null or length(equipamento) <= 60),
  instrucoes      text check (instrucoes is null or length(instrucoes) <= 2000),
  video_url       text check (video_url is null or video_url ~ '^https://'),
  midia_path      text check (midia_path is null or length(midia_path) <= 300),
  criado_em       timestamptz not null default now()
);
create index exercicios_personal_idx on public.exercicios (personal_id, grupo_muscular);

alter table public.exercicios enable row level security;
create policy exercicios_select on public.exercicios for select to authenticated
  using (personal_id is null
         or personal_id = (select private.meu_personal_id())
         or personal_id in (select private.personais_do_aluno()));
create policy exercicios_insert on public.exercicios for insert to authenticated
  with check (personal_id = (select private.meu_personal_id()));
create policy exercicios_update on public.exercicios for update to authenticated
  using (personal_id = (select private.meu_personal_id()))
  with check (personal_id = (select private.meu_personal_id()));
create policy exercicios_delete on public.exercicios for delete to authenticated
  using (personal_id = (select private.meu_personal_id()));

-- ---------------------------------------------------------------------
-- FICHAS (programa de treino). aluno_id NULL = modelo reutilizável
-- ---------------------------------------------------------------------
create table public.fichas (
  id           uuid primary key default gen_random_uuid(),
  personal_id  uuid not null references public.personais (id) on delete restrict,
  aluno_id     uuid,
  nome         text not null check (length(trim(nome)) between 2 and 120),
  objetivo     text check (objetivo is null or length(objetivo) <= 300),
  observacoes  text check (observacoes is null or length(observacoes) <= 2000),
  inicio       date,
  fim          date check (fim is null or inicio is null or fim >= inicio),
  ativa        boolean not null default true,
  criado_em    timestamptz not null default now(),
  unique (personal_id, id),
  foreign key (personal_id, aluno_id) references public.alunos (personal_id, id) on delete restrict
);
create index fichas_aluno_idx on public.fichas (aluno_id, ativa);
create index fichas_personal_idx on public.fichas (personal_id);

-- divisões: Treino A, B, C...
create table public.ficha_treinos (
  id           uuid primary key default gen_random_uuid(),
  personal_id  uuid not null,
  ficha_id     uuid not null,
  nome         text not null check (length(trim(nome)) between 1 and 80),
  ordem        smallint not null default 0,
  observacoes  text check (observacoes is null or length(observacoes) <= 1000),
  unique (personal_id, id),
  foreign key (personal_id, ficha_id) references public.fichas (personal_id, id) on delete cascade
);
create index ficha_treinos_ficha_idx on public.ficha_treinos (ficha_id, ordem);

create table public.ficha_exercicios (
  id             uuid primary key default gen_random_uuid(),
  personal_id    uuid not null,
  treino_id      uuid not null,
  exercicio_id   uuid not null references public.exercicios (id) on delete restrict,
  ordem          smallint not null default 0,
  series         smallint not null default 3 check (series between 1 and 20),
  repeticoes     text not null default '10' check (length(repeticoes) between 1 and 20),
  carga          text check (carga is null or length(carga) <= 30),
  descanso_seg   smallint check (descanso_seg is null or descanso_seg between 0 and 900),
  metodo         text check (metodo is null or length(metodo) <= 60),
  observacoes    text check (observacoes is null or length(observacoes) <= 500),
  unique (personal_id, id),
  foreign key (personal_id, treino_id) references public.ficha_treinos (personal_id, id) on delete cascade
);
create index ficha_exercicios_treino_idx on public.ficha_exercicios (treino_id, ordem);
create index ficha_exercicios_exercicio_idx on public.ficha_exercicios (exercicio_id);

-- o exercício precisa ser da biblioteca padrão ou do mesmo personal
create or replace function private.ficha_exercicio_valida()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.exercicios e
    where e.id = new.exercicio_id and (e.personal_id is null or e.personal_id = new.personal_id)
  ) then
    raise exception 'Exercício não pertence a este personal.';
  end if;
  return new;
end;
$$;
revoke all on function private.ficha_exercicio_valida() from public, anon, authenticated;
create trigger ficha_exercicio_valida before insert or update on public.ficha_exercicios
  for each row execute function private.ficha_exercicio_valida();

alter table public.fichas           enable row level security;
alter table public.ficha_treinos    enable row level security;
alter table public.ficha_exercicios enable row level security;

create policy fichas_personal on public.fichas for all to authenticated
  using (personal_id = (select private.meu_personal_id()))
  with check (personal_id = (select private.meu_personal_id()));
create policy fichas_aluno_select on public.fichas for select to authenticated
  using (aluno_id in (select private.meus_alunos()) and ativa);

create policy ficha_treinos_personal on public.ficha_treinos for all to authenticated
  using (personal_id = (select private.meu_personal_id()))
  with check (personal_id = (select private.meu_personal_id()));
create policy ficha_treinos_aluno_select on public.ficha_treinos for select to authenticated
  using (ficha_id in (select f.id from public.fichas f where f.aluno_id in (select private.meus_alunos()) and f.ativa));

create policy ficha_exercicios_personal on public.ficha_exercicios for all to authenticated
  using (personal_id = (select private.meu_personal_id()))
  with check (personal_id = (select private.meu_personal_id()));
create policy ficha_exercicios_aluno_select on public.ficha_exercicios for select to authenticated
  using (treino_id in (
    select t.id from public.ficha_treinos t join public.fichas f on f.id = t.ficha_id
    where f.aluno_id in (select private.meus_alunos()) and f.ativa));

-- ---------------------------------------------------------------------
-- REGISTRO DE TREINO (o aluno marca o que fez)
-- ---------------------------------------------------------------------
create table public.sessoes_treino (
  id                  uuid primary key default gen_random_uuid(),
  personal_id         uuid not null,
  aluno_id            uuid not null,
  ficha_id            uuid,
  treino_id           uuid,
  nome_treino         text not null check (length(nome_treino) between 1 and 120),
  iniciado_em         timestamptz not null default now(),
  concluido_em        timestamptz,
  percepcao_esforco   smallint check (percepcao_esforco is null or percepcao_esforco between 1 and 10),
  observacoes         text check (observacoes is null or length(observacoes) <= 1000),
  unique (aluno_id, id),
  foreign key (personal_id, aluno_id) references public.alunos (personal_id, id) on delete restrict,
  foreign key (personal_id, ficha_id) references public.fichas (personal_id, id) on delete set null (ficha_id),
  foreign key (personal_id, treino_id) references public.ficha_treinos (personal_id, id) on delete set null (treino_id)
);
create index sessoes_aluno_idx on public.sessoes_treino (aluno_id, iniciado_em desc);
create index sessoes_personal_idx on public.sessoes_treino (personal_id, iniciado_em desc);
create index sessoes_ficha_idx on public.sessoes_treino (ficha_id);
create index sessoes_treino_idx on public.sessoes_treino (treino_id);

create table public.sessao_series (
  id                  uuid primary key default gen_random_uuid(),
  personal_id         uuid not null,
  aluno_id            uuid not null,
  sessao_id           uuid not null,
  exercicio_id        uuid not null references public.exercicios (id) on delete restrict,
  ficha_exercicio_id  uuid references public.ficha_exercicios (id) on delete set null,
  serie               smallint not null check (serie between 1 and 20),
  repeticoes          smallint check (repeticoes is null or repeticoes between 0 and 500),
  carga_kg            numeric(6,2) check (carga_kg is null or carga_kg between 0 and 1000),
  concluida           boolean not null default true,
  criado_em           timestamptz not null default now(),
  unique (sessao_id, exercicio_id, serie),
  foreign key (aluno_id, sessao_id) references public.sessoes_treino (aluno_id, id) on delete cascade,
  foreign key (personal_id, aluno_id) references public.alunos (personal_id, id) on delete restrict
);
create index sessao_series_aluno_exercicio_idx on public.sessao_series (aluno_id, exercicio_id, criado_em desc);
create index sessao_series_exercicio_idx on public.sessao_series (exercicio_id);
create index sessao_series_ficha_ex_idx on public.sessao_series (ficha_exercicio_id);
create index sessao_series_personal_idx on public.sessao_series (personal_id);

alter table public.sessoes_treino enable row level security;
alter table public.sessao_series  enable row level security;

create policy sessoes_personal_select on public.sessoes_treino for select to authenticated
  using (personal_id = (select private.meu_personal_id()));
create policy sessoes_aluno_all on public.sessoes_treino for all to authenticated
  using (aluno_id in (select private.meus_alunos()))
  with check (aluno_id in (select private.meus_alunos()));

create policy series_personal_select on public.sessao_series for select to authenticated
  using (personal_id = (select private.meu_personal_id()));
create policy series_aluno_all on public.sessao_series for all to authenticated
  using (aluno_id in (select private.meus_alunos()))
  with check (aluno_id in (select private.meus_alunos()));

-- ---------------------------------------------------------------------
-- AVALIAÇÃO FÍSICA
-- ---------------------------------------------------------------------
create table public.avaliacoes (
  id                  uuid primary key default gen_random_uuid(),
  personal_id         uuid not null,
  aluno_id            uuid not null,
  data                date not null default ((now() at time zone 'America/Sao_Paulo')::date),
  peso_kg             numeric(5,2) check (peso_kg is null or peso_kg between 20 and 400),
  altura_cm           numeric(5,1) check (altura_cm is null or altura_cm between 100 and 250),
  percentual_gordura  numeric(4,1) check (percentual_gordura is null or percentual_gordura between 2 and 70),
  protocolo           text check (protocolo is null or protocolo in ('pollock3', 'pollock7', 'bioimpedancia', 'manual')),
  -- circunferências (cm)
  pescoco numeric(5,1), ombro numeric(5,1), peito numeric(5,1), cintura numeric(5,1),
  abdomen numeric(5,1), quadril numeric(5,1),
  braco_d numeric(5,1), braco_e numeric(5,1), antebraco_d numeric(5,1), antebraco_e numeric(5,1),
  coxa_d numeric(5,1), coxa_e numeric(5,1), panturrilha_d numeric(5,1), panturrilha_e numeric(5,1),
  -- dobras cutâneas (mm)
  dobra_peitoral numeric(4,1), dobra_axilar numeric(4,1), dobra_triceps numeric(4,1),
  dobra_subescapular numeric(4,1), dobra_abdominal numeric(4,1), dobra_suprailiaca numeric(4,1),
  dobra_coxa numeric(4,1),
  observacoes         text check (observacoes is null or length(observacoes) <= 2000),
  criado_em           timestamptz not null default now(),
  unique (personal_id, id),
  foreign key (personal_id, aluno_id) references public.alunos (personal_id, id) on delete restrict
);
create index avaliacoes_aluno_idx on public.avaliacoes (aluno_id, data desc);
create index avaliacoes_personal_idx on public.avaliacoes (personal_id);

create table public.avaliacao_fotos (
  id             uuid primary key default gen_random_uuid(),
  personal_id    uuid not null,
  avaliacao_id   uuid not null,
  aluno_id       uuid not null,
  posicao        text not null check (posicao in ('frente', 'lado', 'costas', 'outra')),
  path           text not null check (length(path) <= 300),
  criado_em      timestamptz not null default now(),
  foreign key (personal_id, avaliacao_id) references public.avaliacoes (personal_id, id) on delete cascade,
  foreign key (personal_id, aluno_id) references public.alunos (personal_id, id) on delete restrict
);
create index avaliacao_fotos_avaliacao_idx on public.avaliacao_fotos (avaliacao_id);
create index avaliacao_fotos_aluno_idx on public.avaliacao_fotos (aluno_id);
create index avaliacao_fotos_personal_idx on public.avaliacao_fotos (personal_id);

alter table public.avaliacoes      enable row level security;
alter table public.avaliacao_fotos enable row level security;

create policy avaliacoes_personal on public.avaliacoes for all to authenticated
  using (personal_id = (select private.meu_personal_id()))
  with check (personal_id = (select private.meu_personal_id()));
create policy avaliacoes_aluno_select on public.avaliacoes for select to authenticated
  using (aluno_id in (select private.meus_alunos()));

create policy avaliacao_fotos_personal on public.avaliacao_fotos for all to authenticated
  using (personal_id = (select private.meu_personal_id()))
  with check (personal_id = (select private.meu_personal_id()));
create policy avaliacao_fotos_aluno_select on public.avaliacao_fotos for select to authenticated
  using (aluno_id in (select private.meus_alunos()));

-- ---------------------------------------------------------------------
-- ANAMNESE (questionário de saúde / PAR-Q) — o aluno preenche
-- ---------------------------------------------------------------------
create table public.anamneses (
  id             uuid primary key default gen_random_uuid(),
  personal_id    uuid not null,
  aluno_id       uuid not null,
  respostas      jsonb not null check (jsonb_typeof(respostas) = 'object' and pg_column_size(respostas) < 20000),
  preenchida_em  timestamptz not null default now(),
  foreign key (personal_id, aluno_id) references public.alunos (personal_id, id) on delete restrict
);
create index anamneses_aluno_idx on public.anamneses (aluno_id, preenchida_em desc);
create index anamneses_personal_idx on public.anamneses (personal_id);

alter table public.anamneses enable row level security;
create policy anamneses_personal_select on public.anamneses for select to authenticated
  using (personal_id = (select private.meu_personal_id()));
create policy anamneses_aluno_select on public.anamneses for select to authenticated
  using (aluno_id in (select private.meus_alunos()));
create policy anamneses_aluno_insert on public.anamneses for insert to authenticated
  with check (aluno_id in (select private.meus_alunos()));
-- anamnese não se edita: cada preenchimento é um registro novo (histórico)

-- ---------------------------------------------------------------------
-- STORAGE: mídia de exercícios e fotos de avaliação (privados)
-- Caminho: {personal_id}/...  e  {personal_id}/{aluno_id}/...
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('exercicios', 'exercicios', false, 15728640,
   array['image/gif', 'image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm']),
  ('avaliacoes', 'avaliacoes', false, 8388608,
   array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

create policy exercicios_midia_personal on storage.objects for all to authenticated
  using (bucket_id = 'exercicios'
         and (storage.foldername(name))[1] = (select private.meu_personal_id())::text)
  with check (bucket_id = 'exercicios'
         and (storage.foldername(name))[1] = (select private.meu_personal_id())::text);
create policy exercicios_midia_aluno on storage.objects for select to authenticated
  using (bucket_id = 'exercicios'
         and (storage.foldername(name))[1] in (select p::text from private.personais_do_aluno() p));

create policy avaliacoes_fotos_personal on storage.objects for all to authenticated
  using (bucket_id = 'avaliacoes'
         and (storage.foldername(name))[1] = (select private.meu_personal_id())::text)
  with check (bucket_id = 'avaliacoes'
         and (storage.foldername(name))[1] = (select private.meu_personal_id())::text);
create policy avaliacoes_fotos_aluno on storage.objects for select to authenticated
  using (bucket_id = 'avaliacoes'
         and (storage.foldername(name))[2] in (select a::text from private.meus_alunos() a));

-- ---------------------------------------------------------------------
-- Defesa extra: visitante anônimo não tem permissão em nada do schema public
-- ---------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

create trigger sessao_serie_exercicio_valido before insert or update on public.sessao_series
  for each row execute function private.ficha_exercicio_valida();
