-- Ultrafrio — histórico de entradas e saídas
-- Rode no SQL Editor do Supabase (após create_ultrafrio_enderecamento.sql).

create table if not exists public.ultrafrio_movimentos (
  id text primary key,
  tipo text not null check (tipo in ('entrada', 'saida', 'movimentacao')),
  nf_id text not null references public.ultrafrio_notas_fiscais (id) on delete cascade,
  nf_numero text not null,
  emitente text not null default '',
  created_at timestamptz not null default now(),
  payload jsonb not null default '{"itens":[]}'::jsonb
);

create index if not exists idx_ultrafrio_mov_nf on public.ultrafrio_movimentos (nf_id);
create index if not exists idx_ultrafrio_mov_tipo on public.ultrafrio_movimentos (tipo);

alter table public.ultrafrio_movimentos enable row level security;

drop policy if exists ultrafrio_mov_all on public.ultrafrio_movimentos;
create policy ultrafrio_mov_all on public.ultrafrio_movimentos
  for all using (true) with check (true);
