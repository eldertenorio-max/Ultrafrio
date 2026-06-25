-- Zera estoque e histórico (rode no SQL Editor do Supabase se o script Node falhar).
-- Mantém cadastro de remetentes.

delete from public.ultrafrio_movimentos;
delete from public.ultrafrio_notas_canceladas;
delete from public.ultrafrio_enderecamentos;
delete from public.ultrafrio_nf_itens;
delete from public.ultrafrio_notas_fiscais;
