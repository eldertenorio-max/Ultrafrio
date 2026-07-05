# Homologação + Produção (2 branches)

Igual ao **Controle de Carregamento / Sistema WMS**: **mesmo Supabase**, **dois sites**, **branches separadas**.

| Ambiente | Branch | URL | Deploy |
|----------|--------|-----|--------|
| **Homologação** | `homolog` | https://ultrafrio-homologacao.onrender.com | Automático a cada push |
| **Produção (WMS)** | `main` | https://wms.docalivre.com.br | Manual — só quando pedir |

---

## Configurar no Render (uma vez)

### Ultrafrio-homologacao

- **Branch:** `homolog`
- **Auto-Deploy:** On Commit
- Build / env: igual à produção (ver README)

### Ultrafrio (WMS / wms.docalivre.com.br)

- **Branch:** `main`
- **Auto-Deploy:** **Off**
- Build / env: idêntico à homologação

---

## Fluxo do dia a dia

```
Editar código → commit + push na branch homolog
       ↓
Deploy automático em ultrafrio-homologacao.onrender.com
       ↓ ok
Merge homolog → main → Manual Deploy no WMS (produção)
```

| Push | O que atualiza |
|------|----------------|
| `homolog` | Só homologação (automático) |
| `main` | Produção (**Manual Deploy** no Render) |

### Comandos

```powershell
# Desenvolvimento (dispara homolog)
git checkout homolog
git add .
git commit -m "sua mensagem"
git push origin homolog

# Publicar no WMS (após testar homolog)
git checkout main
git merge homolog
git push origin main
git checkout homolog
git merge main
git push origin homolog

# Render → Ultrafrio (WMS) → Manual Deploy → Clear build cache & deploy

# Validar paridade
npm run check:deploy
```

Ou use: `npm run publish:wms` (merge + push; deploy manual no Render continua necessário).

---

## Como saber onde estou?

- **Homologação:** banner amarelo **Homologação** no topo + selo na barra
- **Produção:** sem banner (mesmo código, hostname `wms.docalivre.com.br`)

---

## Mesmo banco Supabase

Homolog e produção usam o **mesmo Supabase**. Alterações de dados na homolog **aparecem na produção**.  
Use homolog para testar **código e telas**; evite testes destrutivos em massa.

---

## Resumo

```
                    ┌── main (manual) ──────► wms.docalivre.com.br
Supabase (único) ◄──┤
                    └── homolog (auto) ───► ultrafrio-homologacao.onrender.com
```
