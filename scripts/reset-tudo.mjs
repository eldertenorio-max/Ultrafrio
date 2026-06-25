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

async function main() {
  const [movs, canceladas, nfs, enderecos, itens] = await Promise.all([
    contar('ultrafrio_movimentos').catch(() => listar('ultrafrio_movimentos').then((r) => r.length)),
    contar('ultrafrio_notas_canceladas').catch(() => 0),
    contar('ultrafrio_notas_fiscais').catch(() => listar('ultrafrio_notas_fiscais').then((r) => r.length)),
    contar('ultrafrio_enderecamentos').catch(() => 0),
    contar('ultrafrio_nf_itens').catch(() => 0),
  ])

  const nfsDetalhe =
    nfs > 0 ? (await listar('ultrafrio_notas_fiscais', 'numero')).map((n) => n.numero) : []

  console.log('=== Reset completo ===')
  console.log(`Movimentos (histórico): ${movs}`)
  console.log(`NFs no estoque: ${nfs}`)
  if (nfsDetalhe.length) console.log('  NFs:', nfsDetalhe.join(', '))
  console.log(`Itens de NF: ${itens}`)
  console.log(`Endereços alocados: ${enderecos}`)
  console.log(`NFs canceladas: ${canceladas}`)
  console.log('Cadastro de remetentes: mantido')

  if (dryRun) {
    console.log('\n(dry-run — nada alterado. Use --confirm para executar.)')
    return
  }

  console.log('\nApagando…')
  await apagarTudo('ultrafrio_movimentos')
  await apagarTudo('ultrafrio_notas_canceladas').catch(() => {})
  await apagarTudo('ultrafrio_enderecamentos').catch(() => {})
  await apagarTudo('ultrafrio_nf_itens', 'nf_id').catch(() => {})
  await apagarTudo('ultrafrio_notas_fiscais')

  const [movsFinal, nfsFinal, endFinal, itensFinal, canFinal] = await Promise.all([
    contar('ultrafrio_movimentos').catch(() => 0),
    contar('ultrafrio_notas_fiscais').catch(() => 0),
    contar('ultrafrio_enderecamentos').catch(() => 0),
    contar('ultrafrio_nf_itens').catch(() => 0),
    contar('ultrafrio_notas_canceladas').catch(() => 0),
  ])

  console.log('\n=== Após reset ===')
  console.log(`Movimentos: ${movsFinal}`)
  console.log(`NFs: ${nfsFinal}`)
  console.log(`Itens: ${itensFinal}`)
  console.log(`Endereços: ${endFinal}`)
  console.log(`Canceladas: ${canFinal}`)

  if (movsFinal + nfsFinal + endFinal + itensFinal + canFinal > 0) {
    console.error('\nERRO: ainda há registros. Verifique RLS ou use o SQL em supabase/sql/reset_tudo.sql')
    process.exit(1)
  }

  console.log('\nPronto. Recarregue TODAS as abas do painel (F5).')
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
