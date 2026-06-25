-- Permite registrar movimentações internas (reposicionamento de paletes).
-- Rode no SQL Editor do Supabase se a aba Movimentação do histórico não salvar registros.

alter table public.ultrafrio_movimentos
  drop constraint if exists ultrafrio_movimentos_tipo_check;

alter table public.ultrafrio_movimentos
  add constraint ultrafrio_movimentos_tipo_check
  check (tipo in ('entrada', 'saida', 'movimentacao'));
