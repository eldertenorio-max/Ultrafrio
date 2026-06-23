-- Permite manter movimentos no histórico após exclusão da NF no estoque.
-- Rode no SQL Editor do Supabase (após create_ultrafrio_movimentos.sql).

alter table public.ultrafrio_movimentos
  drop constraint if exists ultrafrio_movimentos_nf_id_fkey;

alter table public.ultrafrio_movimentos
  alter column nf_id drop not null;
