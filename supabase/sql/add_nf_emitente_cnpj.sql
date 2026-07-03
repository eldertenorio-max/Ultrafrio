-- Adiciona o CNPJ/CPF do emitente na NF (usado para vincular ao cliente no Financeiro).
alter table if exists public.ultrafrio_notas_fiscais
  add column if not exists emitente_cnpj text;
