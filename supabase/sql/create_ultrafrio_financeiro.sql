-- Módulo Financeiro: tabelas de cobrança, contratos por cliente e clientes cadastrados.
-- Ferramenta interna: RLS aberta (sem autenticação), igual às demais tabelas do projeto.

-- Tabelas de cobrança (preços de armazenagem).
create table if not exists public.ultrafrio_fin_tabelas (
  id text primary key,
  nome text not null,
  custo_posicao_palete numeric not null default 0,
  custo_por_kilo numeric not null default 0,
  custo_por_palete numeric not null default 0,
  custo_entrada numeric not null default 0,
  custo_saida numeric not null default 0,
  created_at timestamptz not null default now()
);

-- Clientes cadastrados (auto ao dar entrada de NF, ou manual). Nunca duplica CNPJ.
create table if not exists public.ultrafrio_fin_clientes (
  cnpj text primary key,
  razao_social text not null default '',
  origem text not null default 'auto',
  created_at timestamptz not null default now()
);

-- Contrato de armazenagem por cliente (regras do que cobrar).
create table if not exists public.ultrafrio_fin_contratos (
  id text primary key,
  cnpj text not null,
  razao_social text not null default '',
  tabela_id text,
  ciclo text not null default 'mensal',
  regra_tempo text not null default 'proporcional',
  cobrar_posicao_palete boolean not null default false,
  cobrar_kilo boolean not null default false,
  cobrar_palete boolean not null default false,
  cobrar_entrada boolean not null default false,
  cobrar_saida boolean not null default false,
  kilo_por_dia boolean not null default false,
  ativo boolean not null default true,
  observacao text,
  created_at timestamptz not null default now()
);

create index if not exists ultrafrio_fin_contratos_cnpj_idx
  on public.ultrafrio_fin_contratos (cnpj);

alter table public.ultrafrio_fin_tabelas enable row level security;
alter table public.ultrafrio_fin_clientes enable row level security;
alter table public.ultrafrio_fin_contratos enable row level security;

drop policy if exists ultrafrio_fin_tabelas_all on public.ultrafrio_fin_tabelas;
create policy ultrafrio_fin_tabelas_all on public.ultrafrio_fin_tabelas
  for all using (true) with check (true);

drop policy if exists ultrafrio_fin_clientes_all on public.ultrafrio_fin_clientes;
create policy ultrafrio_fin_clientes_all on public.ultrafrio_fin_clientes
  for all using (true) with check (true);

drop policy if exists ultrafrio_fin_contratos_all on public.ultrafrio_fin_contratos;
create policy ultrafrio_fin_contratos_all on public.ultrafrio_fin_contratos
  for all using (true) with check (true);

-- Realtime
alter table public.ultrafrio_fin_tabelas replica identity full;
alter table public.ultrafrio_fin_clientes replica identity full;
alter table public.ultrafrio_fin_contratos replica identity full;

do $$
begin
  begin
    alter publication supabase_realtime add table public.ultrafrio_fin_tabelas;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.ultrafrio_fin_clientes;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.ultrafrio_fin_contratos;
  exception when duplicate_object then null;
  end;
end $$;
