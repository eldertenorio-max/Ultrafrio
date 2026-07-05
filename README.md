# Ultrafrio — Endereçamento NF

Painel clicável das câmaras refrigeradas com alocação de itens de NF-e por endereço (Cam · Rua · Col · Nív).

## Desenvolvimento local

```bash
npm install
npm run dev
```

Opcional: copie `.env.example` para `.env` e preencha o Supabase. Sem `.env`, os dados ficam no **localStorage** do navegador.

## Por que os dados não aparecem em outro navegador?

Sem **Supabase** configurado, tudo fica no **localStorage** do navegador — cada máquina/celular tem sua cópia separada.

### Solução recomendada (nuvem)

1. Crie um projeto em [supabase.com](https://supabase.com) (ou use o projeto `rmcsubgerhbaeyitegvt`)
2. No **SQL Editor**, execute **nesta ordem**:
   - `supabase/sql/create_ultrafrio_enderecamento.sql`
   - `supabase/sql/create_ultrafrio_movimentos.sql`
   - `supabase/sql/create_ultrafrio_notas_canceladas.sql`
3. Em **Project Settings → API**, copie URL e `anon` key
4. No **Render** (ou `.env` local), defina e **faça um novo deploy**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

As variáveis do Vite entram no **build** — após alterar no Render, clique em **Manual Deploy**.

### Alternativa rápida (backup manual)

No menu do app: **Exportar** o backup na máquina antiga e **Importar** na nova.

## Supabase (detalhes)

1. Crie um projeto em [supabase.com](https://supabase.com)
2. No **SQL Editor**, execute `supabase/sql/create_ultrafrio_enderecamento.sql`
3. Em **Project Settings → API**, copie URL e `anon` key para as variáveis:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

Com Supabase configurado, notas e endereços são salvos na nuvem. Preferências de tela (NF/item ativo) continuam no navegador.

## GitHub

```bash
git init
git add .
git commit -m "Painel Ultrafrio endereçamento NF"
git remote add origin https://github.com/SEU_USUARIO/ultrafrio.git
git push -u origin main
```

## Render (site estático)

### Homologação e produção

| Ambiente | URL | Deploy |
|----------|-----|--------|
| **Homologação** | [ultrafrio-homologacao.onrender.com](https://ultrafrio-homologacao.onrender.com/) | **Automático** a cada push no `main` |
| **Produção (WMS)** | [wms.docalivre.com.br](https://wms.docalivre.com.br/) | **Manual** — só quando você pedir |

> **Regra:** push no `main` atualiza **só a homologação**. A produção **não** recebe ao mesmo tempo — só quando você disser **“publicar no WMS”** (ou equivalente).

#### Desligar deploy automático na produção (Render — uma vez)

1. Acesse [dashboard.render.com](https://dashboard.render.com)
2. Abra o serviço **Ultrafrio** (`wms.docalivre.com.br`)
3. **Settings** → **Build & Deploy** → **Auto-Deploy**
4. Selecione **Off** e salve

No serviço **Ultrafrio-homologacao**, mantenha **Auto-Deploy → On Commit**.

No Render, configure **dois Static Sites** com o **mesmo build** nos dois:

| Campo | Valor (homologação e produção) |
|-------|--------------------------------|
| **Build command** | `npm ci --no-audit --no-fund && node scripts/write-supabase-config.mjs && npm run build` |
| **Publish directory** | `dist` |
| **NODE_VERSION** | `20.19.0` |
| **VITE_SUPABASE_URL** | URL do Supabase (mesma nos dois) |
| **VITE_SUPABASE_ANON_KEY** | Chave anon/publishable (mesma nos dois) |

Não use `VITE_APP_AMBIENTE` — o banner “Homologação” é detectado pelo hostname em runtime.

#### Fluxo

1. Alteração → **push no `main`** → homologação atualiza sozinha  
2. Teste em [ultrafrio-homologacao.onrender.com](https://ultrafrio-homologacao.onrender.com/)  
3. Quando estiver ok, peça **“publicar no WMS”**  
4. Render → **Ultrafrio (WMS)** → **Manual Deploy → Clear build cache & deploy**  
5. Confirme: `npm run check:deploy` → **AMBIENTES IGUAIS**

**Única diferença intencional:** na homologação aparece o banner/selo “Homologação”. No WMS real isso não aparece.

### Configuração básica

1. **New → Blueprint** ou **Static Site** apontando para este repositório
2. Use o `render.yaml` incluído ou copie a tabela acima
3. Variáveis `VITE_SUPABASE_*` no Render **sobrescrevem** o `public/supabase-config.json` no build (opcional se o arquivo já estiver no repositório)

O arquivo `public/_redirects` garante que rotas do SPA funcionem no Render.

## Scripts

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Servidor local |
| `npm run build` | Typecheck + build produção |
| `npm run build:web` | Build rápido (só Vite) |
| `npm run preview` | Preview do `dist` |
