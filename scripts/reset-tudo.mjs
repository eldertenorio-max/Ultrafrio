/**
 * Zera estoque (posições/NFs) e histórico de movimentação no Supabase.
 * Uso: node scripts/reset-tudo.mjs --confirm
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

async function listar(table, select = 'id') {
  const res = await fetch(`${url}/rest/v1/${table}?select=${select}`, { headers })
  if (!res.ok) throw new Error(`${table}: ${await res.text()}`)
  return res.json()
}

async function apagar(table, ids) {
  if (!ids.length) return 0
  const chunkSize = 100
  let removidos = 0
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize)
    const q = chunk.map((id) => `id.eq.${encodeURIComponent(id)}`).join(',')
    const res = await fetch(`${url}/rest/v1/${table}?or=(${q})`, {
      method: 'DELETE',
      headers,
    })
    if (!res.ok) throw new Error(`${table} delete: ${await res.text()}`)
    removidos += chunk.length
  }
  return removidos
}

async function main() {
  const [movs, canceladas, nfs, enderecos] = await Promise.all([
    listar('ultrafrio_movimentos'),
    listar('ultrafrio_notas_canceladas').catch(() => []),
    listar('ultrafrio_notas_fiscais', 'id,numero,status'),
    listar('ultrafrio_enderecamentos', 'id').catch(() => []),
  ])

  console.log('=== Reset completo ===')
  console.log(`Movimentos (histórico): ${movs.length}`)
  console.log(`NFs no estoque: ${nfs.length}`)
  if (nfs.length) {
    console.log('  NFs:', nfs.map((n) => n.numero).join(', '))
  }
  console.log(`Endereços alocados: ${enderecos.length}`)
  console.log(`NFs canceladas: ${canceladas.length}`)
  console.log('Cadastro de remetentes: mantido')

  if (dryRun) {
    console.log('\n(dry-run — nada alterado. Use --confirm para executar.)')
    return
  }

  const movIds = movs.map((m) => m.id)
  const canIds = canceladas.map((c) => c.id)
  const nfIds = nfs.map((n) => n.id)

  const remMov = await apagar('ultrafrio_movimentos', movIds)
  console.log(`\nRemovidos ${remMov} movimento(s).`)

  const remCan = await apagar('ultrafrio_notas_canceladas', canIds)
  if (remCan) console.log(`Removidas ${remCan} NF cancelada(s).`)

  const remNf = await apagar('ultrafrio_notas_fiscais', nfIds)
  console.log(`Removidas ${remNf} NF(s) — itens e endereços em cascata.`)

  const [movsFinal, nfsFinal, endFinal] = await Promise.all([
    listar('ultrafrio_movimentos'),
    listar('ultrafrio_notas_fiscais', 'id'),
    listar('ultrafrio_enderecamentos', 'id').catch(() => []),
  ])

  console.log('\n=== Após reset ===')
  console.log(`Movimentos: ${movsFinal.length}`)
  console.log(`NFs: ${nfsFinal.length}`)
  console.log(`Endereços: ${endFinal.length}`)
  console.log('\nPronto. Recarregue o painel no navegador.')
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
