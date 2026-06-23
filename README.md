# Ultrafrio — Endereçamento NF

Painel clicável das câmaras refrigeradas com alocação de itens de NF-e por endereço (Cam · Rua · Col · Nív).

## Desenvolvimento local

```bash
npm install
npm run dev
```

Opcional: copie `.env.example` para `.env` e preencha o Supabase. Sem `.env`, os dados ficam no **localStorage** do navegador.

## Supabase

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

1. **New → Blueprint** ou **Static Site** apontando para este repositório
2. Use o `render.yaml` incluído ou configure:
   - **Build command:** `npm ci && npm run build`
   - **Publish directory:** `dist`
   - **Node:** 20.19+
3. Adicione as variáveis de ambiente `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (necessárias no **build** do Vite)

O arquivo `public/_redirects` garante que rotas do SPA funcionem no Render.

## Scripts

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Servidor local |
| `npm run build` | Typecheck + build produção |
| `npm run build:web` | Build rápido (só Vite) |
| `npm run preview` | Preview do `dist` |
