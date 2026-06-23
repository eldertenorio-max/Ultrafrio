-- Ultrafrio — endereçamento de NF-e no painel de câmaras
-- Rode no SQL Editor do Supabase (uma vez).

create table if not exists public.ultrafrio_notas_fiscais (
  id text primary key,
  numero text not null,
  serie text not null default '',
  chave text not null default '',
  emitente text not null default '',
  data_emissao text not null default '',
  status text not null default 'em_andamento'
    check (status in ('em_andamento', 'concluida')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ultrafrio_nf_itens (
  id uuid primary key default gen_random_uuid(),
  nf_id text not null references public.ultrafrio_notas_fiscais (id) on delete cascade,
  item_index integer not null,
  codigo text not null default '',
  descricao text not null default '',
  quantidade numeric not null default 0,
  unidade text not null default '',
  unique (nf_id, item_index)
);

create table if not exists public.ultrafrio_enderecamentos (
  id uuid primary key default gen_random_uuid(),
  nf_id text not null references public.ultrafrio_notas_fiscais (id) on delete cascade,
  item_index integer not null,
  address_id text not null,
  created_at timestamptz not null default now(),
  unique (address_id)
);

create index if not exists idx_ultrafrio_nf_itens_nf on public.ultrafrio_nf_itens (nf_id);
create index if not exists idx_ultrafrio_end_nf on public.ultrafrio_enderecamentos (nf_id);
create index if not exists idx_ultrafrio_end_addr on public.ultrafrio_enderecamentos (address_id);

create or replace function public.ultrafrio_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_ultrafrio_nf_updated on public.ultrafrio_notas_fiscais;
create trigger trg_ultrafrio_nf_updated
  before update on public.ultrafrio_notas_fiscais
  for each row execute function public.ultrafrio_touch_updated_at();

alter table public.ultrafrio_notas_fiscais enable row level security;
alter table public.ultrafrio_nf_itens enable row level security;
alter table public.ultrafrio_enderecamentos enable row level security;

-- Políticas abertas (ferramenta interna). Restrinja depois com auth, se necessário.
drop policy if exists ultrafrio_nf_all on public.ultrafrio_notas_fiscais;
create policy ultrafrio_nf_all on public.ultrafrio_notas_fiscais
  for all using (true) with check (true);

drop policy if exists ultrafrio_itens_all on public.ultrafrio_nf_itens;
create policy ultrafrio_itens_all on public.ultrafrio_nf_itens
  for all using (true) with check (true);

drop policy if exists ultrafrio_end_all on public.ultrafrio_enderecamentos;
create policy ultrafrio_end_all on public.ultrafrio_enderecamentos
  for all using (true) with check (true);
