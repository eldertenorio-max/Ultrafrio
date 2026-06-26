-- Coluna de localização do item: armazém físico ou stage (separação).
-- Execute no SQL Editor do Supabase se a coluna ainda não existir.

alter table ultrafrio_nf_itens
  add column if not exists localizacao text not null default 'armazem';

comment on column ultrafrio_nf_itens.localizacao is
  'armazem = endereçamento físico; stage = área de separação virtual';
