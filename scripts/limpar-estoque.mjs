import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const config = JSON.parse(readFileSync(join(__dirname, '../public/supabase-config.json'), 'utf8'))

const MANTER_NUMEROS = new Set(['236477', '201078'])

function normNumero(numero) {
  return String(numero ?? '').trim().replace(/^0+/, '') || '0'
}

function numeroMantido(numero) {
  const n = normNumero(numero)
  return MANTER_NUMEROS.has(n) || MANTER_NUMEROS.has(String(numero).trim())
}

const sb = createClient(config.url, config.anonKey)

async function listar(table, select = '*') {
  const { data, error } = await sb.from(table).select(select)
  if (error) throw new Error(`${table}: ${error.message}`)
  return data ?? []
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')

  const nfs = await listar('ultrafrio_notas_fiscais', 'id,numero,status')
  const movs = await listar('ultrafrio_movimentos', 'id,nf_id,nf_numero,tipo')
  const canceladas = await listar('ultrafrio_notas_canceladas', 'id,numero').catch(() => [])

  const manter = nfs.filter((nf) => numeroMantido(nf.numero))
  const removerNfs = nfs.filter((nf) => !numeroMantido(nf.numero))
  const manterIds = new Set(manter.map((nf) => nf.id))
  const manterNumeros = new Set(manter.map((nf) => String(nf.numero).trim()))

  const removerMovs = movs.filter((m) => {
    if (m.nf_id && manterIds.has(m.nf_id)) return false
    if (numeroMantido(m.nf_numero)) return false
    if (manterNumeros.has(String(m.nf_numero).trim())) return false
    return true
  })

  console.log('=== Resumo ===')
  console.log(`NFs no estoque: ${nfs.length} → manter ${manter.length}, remover ${removerNfs.length}`)
  console.log('Manter:', manter.map((n) => n.numero).join(', ') || '(nenhuma encontrada)')
  console.log('Remover NFs:', removerNfs.map((n) => n.numero).join(', ') || '(nenhuma)')
  console.log(`Movimentos: ${movs.length} → remover ${removerMovs.length}`)
  console.log(`NF canceladas: ${canceladas.length} → remover todas`)

  if (manter.length === 0) {
    console.error('\nNenhuma NF 236477 ou 201078 encontrada. Abortando.')
    process.exit(1)
  }

  if (dryRun) {
    console.log('\n(dry-run — nada foi alterado)')
    return
  }

  if (removerMovs.length) {
    const { error } = await sb
      .from('ultrafrio_movimentos')
      .delete()
      .in(
        'id',
        removerMovs.map((m) => m.id),
      )
    if (error) throw new Error(`movimentos: ${error.message}`)
    console.log(`Removidos ${removerMovs.length} movimento(s).`)
  }

  if (canceladas.length) {
    const { error } = await sb
      .from('ultrafrio_notas_canceladas')
      .delete()
      .in(
        'id',
        canceladas.map((c) => c.id),
      )
    if (error && !error.message.includes('does not exist')) {
      throw new Error(`canceladas: ${error.message}`)
    } else if (!error) {
      console.log(`Removidas ${canceladas.length} NF cancelada(s).`)
    }
  }

  if (removerNfs.length) {
    const { error } = await sb
      .from('ultrafrio_notas_fiscais')
      .delete()
      .in(
        'id',
        removerNfs.map((n) => n.id),
      )
    if (error) throw new Error(`notas: ${error.message}`)
    console.log(`Removidas ${removerNfs.length} NF(s) do estoque (itens e endereços em cascata).`)
  }

  const nfsFinal = await listar('ultrafrio_notas_fiscais', 'numero,status')
  const movsFinal = await listar('ultrafrio_movimentos', 'nf_numero,tipo')
  console.log('\n=== Após limpeza ===')
  console.log('NFs:', nfsFinal.map((n) => `${n.numero} (${n.status})`).join(', '))
  console.log('Movimentos:', movsFinal.length)
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
