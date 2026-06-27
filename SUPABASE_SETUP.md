# Configurar Supabase — dados iguais em todo lugar

Siga estes passos **uma vez**. Depois disso, qualquer PC ou navegador que abrir o app verá os **mesmos dados atualizados** (entrada, saída, histórico, canceladas).

Projeto Supabase do Ultrafrio: `rmcsubgerhbaeyitegvt`  
URL: https://supabase.com/dashboard/project/rmcsubgerhbaeyitegvt

---

## 1. Criar tabelas no Supabase

No **SQL Editor** do Supabase, execute **nesta ordem** (copie e cole cada arquivo):

1. `supabase/sql/create_ultrafrio_enderecamento.sql`
2. `supabase/sql/create_ultrafrio_movimentos.sql`
3. `supabase/sql/create_ultrafrio_notas_canceladas.sql`
4. `supabase/sql/create_ultrafrio_cadastro_remetentes.sql` ← cadastro de remetentes no NF manual
5. `supabase/sql/movimentos_historico_soft_delete.sql` (se ainda não rodou)
6. `supabase/sql/movimentos_tipo_movimentacao.sql` (reposicionamento — incluído também em `apply_pending_columns.sql`)
7. `supabase/sql/add_nf_itens_campos_entrada.sql` (UP, lote, datas — se ainda não rodou)
8. `supabase/sql/add_nf_itens_comercial.sql` (peso, valores — se ainda não rodou)
9. `supabase/sql/add_nf_totais.sql` (totais da nota — se ainda não rodou)
   - **Atalho:** em vez de 6–9, pode rodar só `supabase/sql/apply_pending_columns.sql`
10. `supabase/sql/enable_realtime.sql` ← necessário para atualizar sem recarregar a página

---

## 2. Copiar chaves da API

No Supabase: **Project Settings → API**

| Campo no Render / `.env` | Onde pegar no Supabase |
|--------------------------|-------------------------|
| `VITE_SUPABASE_URL` | **Project URL** (ex.: `https://rmcsubgerhbaeyitegvt.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | **anon public** ou **publishable** key |

---

## 3. Configurar no Render (produção)

1. Abra https://dashboard.render.com → serviço **ultrafrio-enderecamento**
2. **Environment** → adicione:
   - `VITE_SUPABASE_URL` = URL do passo 2
   - `VITE_SUPABASE_ANON_KEY` = chave anon do passo 2
3. Clique em **Manual Deploy → Deploy latest commit**  
   (obrigatório: variáveis `VITE_*` entram no **build**)

---

## 4. Desenvolvimento local (opcional)

Na pasta do projeto:

```bash
cp .env.example .env
```

Edite `.env` com as mesmas duas variáveis e rode:

```bash
npm run dev
```

---

## 5. Conferir se funcionou

- O aviso amarelo **“só neste navegador”** deve sumir.
- Aparece o banner verde: **“Dados sincronizados na nuvem — iguais em todos os navegadores.”**
- Abra o app em outro PC/navegador: os mesmos dados devem aparecer.
- Alterações em um lugar atualizam os outros em poucos segundos (tempo real + verificação a cada 3 s).

---

## Importante: só nuvem

Com Supabase configurado, **NFs e movimentos não ficam mais no navegador** — tudo vem e vai direto para o Supabase. Cada PC mostra a mesma lista. Ao abrir o app, dados antigos do `localStorage` são **descartados** (não são mais migrados automaticamente).

Se aparecer NF que ninguém criou nesta sessão, ela já está na nuvem (outro PC ou teste anterior). Use **Cancelar entrada** ou **Excluir** na movimentação para remover.

---

## Problemas comuns

| Sintoma | Solução |
|---------|---------|
| Ainda mostra “só neste navegador” | Variáveis não estão no build do Render → confira env vars e faça **novo deploy** |
| Erro ao salvar na nuvem: coluna `peso_bruto` (ou similar) não encontrada | Rode `supabase/sql/apply_pending_columns.sql` no SQL Editor (ou os arquivos 6–8 da lista acima) |
| Erro `ultrafrio_movimentos_tipo_check` ao confirmar movimentação | Rode `supabase/sql/apply_pending_columns.sql` ou `supabase/sql/movimentos_tipo_movimentacao.sql` no SQL Editor |
| Erro ao salvar / nuvem indisponível | Rode os SQLs no Supabase; confira URL e chave |
| Sugestões de remetente vazias | Rode `create_ultrafrio_cadastro_remetentes.sql` |
| Outro PC não atualiza na hora | Rode `enable_realtime.sql`; recarregue a página |
| Dados diferentes em dois PCs | Confira `VITE_SUPABASE_*` no Render; rode `enable_realtime.sql`; recarregue os dois navegadores |

---

## Backup manual

Use **Exportar backup** na barra lateral para guardar um JSON. **Importar backup** restaura em qualquer instalação.
