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

### Homologação e produção (2 branches)

Modelo igual ao **Controle de Carregamento** — detalhes em [`HOMOLOGACAO_RENDER.md`](HOMOLOGACAO_RENDER.md).

| Ambiente | Branch | URL | Deploy |
|----------|--------|-----|--------|
| **Homologação** | `homolog` | [ultrafrio-homologacao.onrender.com](https://ultrafrio-homologacao.onrender.com/) | **Automático** a cada push |
| **Produção (WMS)** | `main` | [wms.docalivre.com.br](https://wms.docalivre.com.br/) | **Manual** — só quando pedir |

| Push | O que atualiza |
|------|----------------|
| `homolog` | Só homologação |
| `main` | Produção (Manual Deploy no Render) |

#### Configurar no Render (uma vez)

| Serviço | Branch | Auto-Deploy |
|---------|--------|-------------|
| **Ultrafrio-homologacao** | `homolog` | **On Commit** |
| **Ultrafrio** (WMS) | `main` | **Off** |

Build idêntico nos dois:

| Campo | Valor |
|-------|--------|
| **Build command** | `npm ci --no-audit --no-fund && node scripts/write-supabase-config.mjs && npm run build` |
| **Publish directory** | `dist` |
| **NODE_VERSION** | `20.19.0` |
| **VITE_SUPABASE_URL** / **VITE_SUPABASE_ANON_KEY** | Mesmos nos dois |

Não use `VITE_APP_AMBIENTE` — banner “Homologação” detectado pelo hostname.

#### Fluxo

```powershell
# 1. Desenvolver (sobe homolog sozinha)
git checkout homolog
git push origin homolog

# 2. Testar na homologação

# 3. Publicar no WMS
npm run publish:wms
# Render → Ultrafrio → Manual Deploy → Clear build cache & deploy

# 4. Validar
npm run check:deploy
```

**Única diferença visual:** banner/selo “Homologação” só na homologação.

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
| `npm run check:deploy` | Valida paridade homolog ↔ produção (sites + branches) |
| `npm run publish:wms` | Merge `homolog` → `main` e alinha branches |
