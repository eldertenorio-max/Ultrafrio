/**
 * Valida paridade homolog ↔ produção (sites live + branches Git).
 *
 * Uso: node scripts/check-deploy-parity.mjs
 * Exit 0 = iguais | Exit 1 = divergentes
 */

import { execSync } from 'node:child_process'

const HOMOLOG = 'https://ultrafrio-homologacao.onrender.com'
const PROD = 'https://wms.docalivre.com.br'

async function fetchText(url) {
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`)
  return res.text()
}

function extractAssets(html) {
  const js = html.match(/assets\/index-[^"]+\.js/)?.[0] ?? null
  const css = html.match(/assets\/index-[^"]+\.css/)?.[0] ?? null
  return { js, css }
}

function extractSwVersion(sw) {
  return sw.match(/ultrafrio-shell-v\d+/)?.[0] ?? null
}

function normalizeJson(text) {
  return JSON.stringify(JSON.parse(text))
}

function checkGitBranches() {
  try {
    execSync('git fetch origin', { stdio: 'ignore' })
    const main = execSync('git rev-parse origin/main', { encoding: 'utf8' }).trim()
    const homolog = execSync('git rev-parse origin/homolog', { encoding: 'utf8' }).trim()
    return {
      ok: main === homolog,
      main: main.slice(0, 8),
      homolog: homolog.slice(0, 8),
    }
  } catch {
    return { ok: false, main: null, homolog: null, missing: true }
  }
}

async function main() {
  console.log('Validando paridade homologação ↔ produção...\n')

  const git = checkGitBranches()
  if (git.missing) {
    console.log('[AVISO] Branch origin/homolog ainda não existe no remoto.\n')
  } else {
    const status = git.ok ? 'OK' : 'DIFERENTE'
    console.log(`[${status}] Branches Git (origin/main vs origin/homolog)`)
    console.log(`  main:    ${git.main}`)
    console.log(`  homolog: ${git.homolog}`)
    console.log()
  }

  const [homologHtml, prodHtml, homologConfig, prodConfig, homologSw, prodSw] =
    await Promise.all([
      fetchText(`${HOMOLOG}/`),
      fetchText(`${PROD}/`),
      fetchText(`${HOMOLOG}/supabase-config.json`),
      fetchText(`${PROD}/supabase-config.json`),
      fetchText(`${HOMOLOG}/sw.js`),
      fetchText(`${PROD}/sw.js`),
    ])

  const homologAssets = extractAssets(homologHtml)
  const prodAssets = extractAssets(prodHtml)
  const homologSwVer = extractSwVersion(homologSw)
  const prodSwVer = extractSwVersion(prodSw)
  const configIgual = normalizeJson(homologConfig) === normalizeJson(prodConfig)

  const checks = [
    {
      label: 'JavaScript (index-*.js)',
      homolog: homologAssets.js,
      prod: prodAssets.js,
      ok: homologAssets.js && homologAssets.js === prodAssets.js,
    },
    {
      label: 'CSS (index-*.css)',
      homolog: homologAssets.css,
      prod: prodAssets.css,
      ok: homologAssets.css && homologAssets.css === prodAssets.css,
    },
    {
      label: 'Service worker (cache)',
      homolog: homologSwVer,
      prod: prodSwVer,
      ok: homologSwVer && homologSwVer === prodSwVer,
    },
    {
      label: 'supabase-config.json',
      homolog: 'ok',
      prod: 'ok',
      ok: configIgual,
    },
  ]

  let allOk = git.missing ? false : git.ok
  for (const c of checks) {
    const status = c.ok ? 'OK' : 'DIFERENTE'
    console.log(`[${status}] ${c.label}`)
    console.log(`  Homolog: ${c.homolog ?? '(ausente)'}`)
    console.log(`  Prod:    ${c.prod ?? '(ausente)'}`)
    console.log()
    if (!c.ok) allOk = false
  }

  if (allOk) {
    console.log('Resultado: AMBIENTES IGUAIS — WMS alinhado com homolog.')
    process.exit(0)
  }

  console.log('Resultado: DIVERGENTE — normal antes de publicar no WMS.')
  console.log('\nPróximos passos:')
  console.log('  1. Desenvolva na branch homolog → push (homolog sobe sozinha).')
  console.log('  2. Teste em ultrafrio-homologacao.onrender.com')
  console.log('  3. npm run publish:wms (merge homolog → main)')
  console.log('  4. Render → Ultrafrio (WMS) → Manual Deploy → Clear build cache & deploy')
  console.log('  5. npm run check:deploy')
  process.exit(1)
}

main().catch((err) => {
  console.error('Erro ao validar:', err.message)
  process.exit(1)
})
