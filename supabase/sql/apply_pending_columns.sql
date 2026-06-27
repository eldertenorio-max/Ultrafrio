-- Colunas pendentes para sincronização (peso, valores, campos de entrada)
-- Rode UMA VEZ no SQL Editor do Supabase se aparecer erro de coluna inexistente
-- (ex.: "Could not find the 'peso_bruto' column").

-- Totais da NF
alter table public.ultrafrio_notas_fiscais
  add column if not exists peso_bruto numeric,
  add column if not exists peso_liquido numeric,
  add column if not exists valor_total_nota numeric,
  add column if not exists quantidade_volume text;

-- Valores comerciais e peso por item
alter table public.ultrafrio_nf_itens
  add column if not exists peso_bruto numeric,
  add column if not exists valor_unitario numeric,
  add column if not exists valor_total numeric;

-- Campos opcionais de entrada por item
alter table public.ultrafrio_nf_itens
  add column if not exists up text,
  add column if not exists lote text,
  add column if not exists data_fabricacao text,
  add column if not exists data_validade text,
  add column if not exists paletes integer;

-- Histórico de movimentos sem FK obrigatória para NF (ex.: exclusão do estoque)
alter table public.ultrafrio_movimentos
  drop constraint if exists ultrafrio_movimentos_nf_id_fkey;

alter table public.ultrafrio_movimentos
  alter column nf_id drop not null;

-- Reposicionamento de paletes (tipo movimentacao no historico)
alter table public.ultrafrio_movimentos
  drop constraint if exists ultrafrio_movimentos_tipo_check;

alter table public.ultrafrio_movimentos
  add constraint ultrafrio_movimentos_tipo_check
  check (tipo in ('entrada', 'saida', 'movimentacao'));
