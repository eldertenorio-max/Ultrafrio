/**
 * Zera estoque (posições/NFs) e histórico de movimentação no Supabase.
 * Uso: node scripts/reset-tudo.mjs --confirm
 *
 * Feche todas as abas do painel antes de rodar, ou recarregue (F5) logo após.
 */
import { existsSync, readFileSync } from 'node:fs'

function loadEnvFile() {
  if (!existsSync('.env')) return
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = value
  }
}

loadEnvFile()

const config = JSON.parse(readFileSync('public/supabase-config.json', 'utf8'))
const url = process.env.VITE_SUPABASE_URL?.trim() || config.url
const key = process.env.VITE_SUPABASE_ANON_KEY?.trim() || config.anonKey

const confirm = process.argv.includes('--confirm')
const dryRun = !confirm

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  'Content-Type': 'application/json',
  Prefer: 'return=minimal',
}

async function contar(table) {
  const res = await fetch(`${url}/rest/v1/${table}?select=id`, {
    headers: { ...headers, Prefer: 'count=exact' },
  })
  if (!res.ok) throw new Error(`${table}: ${await res.text()}`)
  const range = res.headers.get('content-range')
  if (range) {
    const m = range.match(/\/(\d+|\*)/)
    if (m && m[1] !== '*') return Number(m[1])
  }
  const rows = await res.json()
  return rows.length
}

async function listar(table, select = 'id') {
  const res = await fetch(`${url}/rest/v1/${table}?select=${select}`, { headers })
  if (!res.ok) throw new Error(`${table}: ${await res.text()}`)
  return res.json()
}

/** Apaga todas as linhas (sem depender de listagem paginada). */
async function apagarTudo(table, idColumn = 'id') {
  const res = await fetch(
    `${url}/rest/v1/${table}?${idColumn}=not.is.null`,
    { method: 'DELETE', headers },
  )
  if (!res.ok) throw new Error(`${table} delete all: ${await res.text()}`)
}

async function contarOpcional(table) {
  try {
    return await contar(table)
  } catch {
    return 0
  }
}

const TABELAS_ESTOQUE = [
  ['ultrafrio_movimentos', 'id'],
  ['ultrafrio_notas_canceladas', 'id'],
  ['ultrafrio_enderecamentos', 'nf_id'],
  ['ultrafrio_nf_itens', 'nf_id'],
  ['ultrafrio_notas_fiscais', 'id'],
]

/** Financeiro (clientes/contratos gerados pelas NFs). */
const TABELAS_FINANCEIRO = [
  ['ultrafrio_fin_contratos', 'id'],
  ['ultrafrio_fin_clientes', 'cnpj'],
  ['ultrafrio_fin_tabelas', 'id'],
]

async function main() {
  const contagensAntes = {}
  for (const [table] of [...TABELAS_ESTOQUE, ...TABELAS_FINANCEIRO]) {
    contagensAntes[table] = await contarOpcional(table)
  }

  const nfs = contagensAntes['ultrafrio_notas_fiscais']
  const nfsDetalhe =
    nfs > 0
      ? (await listar('ultrafrio_notas_fiscais', 'numero').catch(() => [])).map((n) => n.numero)
      : []

  console.log('=== Reset completo (homolog + produção — mesmo Supabase) ===')
  console.log(`URL: ${url}`)
  console.log(`Movimentos (histórico): ${contagensAntes['ultrafrio_movimentos']}`)
  console.log(`NFs no estoque: ${nfs}`)
  if (nfsDetalhe.length) console.log('  NFs:', nfsDetalhe.join(', '))
  console.log(`Itens de NF: ${contagensAntes['ultrafrio_nf_itens']}`)
  console.log(`Endereços alocados: ${contagensAntes['ultrafrio_enderecamentos']}`)
  console.log(`NFs canceladas: ${contagensAntes['ultrafrio_notas_canceladas']}`)
  console.log(`Fin. clientes: ${contagensAntes['ultrafrio_fin_clientes']}`)
  console.log(`Fin. contratos: ${contagensAntes['ultrafrio_fin_contratos']}`)
  console.log(`Fin. tabelas: ${contagensAntes['ultrafrio_fin_tabelas']}`)
  console.log('Cadastro de remetentes: mantido')

  if (dryRun) {
    console.log('\n(dry-run — nada alterado. Use --confirm para executar.)')
    console.log('\nIMPORTANTE: feche TODAS as abas de homologação E produção antes do --confirm,')
    console.log('  senão o navegador regrava o estoque antigo na nuvem.')
    return
  }

  console.log('\nApagando…')
  for (const [table, col] of TABELAS_ESTOQUE) {
    await apagarTudo(table, col).catch((e) => {
      if (!String(e.message).includes('does not exist')) throw e
    })
  }
  for (const [table, col] of TABELAS_FINANCEIRO) {
    await apagarTudo(table, col).catch((e) => {
      if (!String(e.message).includes('does not exist')) throw e
    })
  }

  const contagensDepois = {}
  for (const [table] of [...TABELAS_ESTOQUE, ...TABELAS_FINANCEIRO]) {
    contagensDepois[table] = await contarOpcional(table)
  }

  console.log('\n=== Após reset ===')
  console.log(`Movimentos: ${contagensDepois['ultrafrio_movimentos']}`)
  console.log(`NFs: ${contagensDepois['ultrafrio_notas_fiscais']}`)
  console.log(`Itens: ${contagensDepois['ultrafrio_nf_itens']}`)
  console.log(`Endereços: ${contagensDepois['ultrafrio_enderecamentos']}`)
  console.log(`Canceladas: ${contagensDepois['ultrafrio_notas_canceladas']}`)
  console.log(`Fin. clientes: ${contagensDepois['ultrafrio_fin_clientes']}`)
  console.log(`Fin. contratos: ${contagensDepois['ultrafrio_fin_contratos']}`)

  const restante = Object.values(contagensDepois).reduce((s, n) => s + n, 0)
  if (restante > 0) {
    console.error('\nERRO: ainda há registros. Verifique RLS ou use o SQL em supabase/sql/reset_tudo.sql')
    process.exit(1)
  }

  console.log('\nPronto. Homologação e produção compartilham este banco — os dois ficam vazios.')
  console.log('1. Feche TODAS as abas do WMS (homolog e produção).')
  console.log('2. Abra de novo e use Ctrl+Shift+R (limpa cache do site).')
  console.log('   Homolog: https://ultrafrio-homologacao.onrender.com')
  console.log('   Produção: https://wms.docalivre.com.br')
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
