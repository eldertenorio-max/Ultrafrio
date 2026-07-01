/**
 * Importa backup JSON (exportado do navegador) para o Supabase.
 *
 * Uso: node scripts/importar-backup-supabase.mjs caminho/backup.json
 */
import { createClient } from '@supabase/supabase-js'
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
const file = process.argv[2]

if (!file) {
  console.error('Uso: node scripts/importar-backup-supabase.mjs backup.json')
  process.exit(1)
}

const raw = readFileSync(file, 'utf8')
const backup = JSON.parse(raw)
const notas = backup.notas ?? []
const movimentos = backup.movimentos ?? []
const notasCanceladas = backup.notasCanceladas ?? []

function contarEnderecos(nfs) {
  return nfs.reduce(
    (s, nf) => s + nf.items.reduce((a, it) => a + (it.allocatedAddresses?.length ?? 0), 0),
    0,
  )
}

console.log(`Backup: ${notas.length} NF(s), ${contarEnderecos(notas)} posição(ões), ${movimentos.length} movimento(s)`)

if (notas.length === 0 && movimentos.length === 0) {
  console.error('Arquivo de backup vazio — nada para importar.')
  process.exit(1)
}

const sb = createClient(url, key)

async function upsertNf(nf) {
  const row = {
    id: nf.id,
    numero: nf.numero,
    serie: nf.serie ?? '',
    chave: nf.chave ?? '',
    emitente: nf.emitente ?? '',
    data_emissao: nf.dataEmissao ?? '',
    status: nf.status ?? 'em_andamento',
    ...(nf.createdAt ? { created_at: nf.createdAt } : {}),
    ...(nf.pesoBruto != null ? { peso_bruto: nf.pesoBruto } : {}),
    ...(nf.pesoLiquido != null ? { peso_liquido: nf.pesoLiquido } : {}),
    ...(nf.valorTotalNota != null ? { valor_total_nota: nf.valorTotalNota } : {}),
    ...(nf.quantidadeVolume ? { quantidade_volume: nf.quantidadeVolume } : {}),
  }
  const { error } = await sb.from('ultrafrio_notas_fiscais').upsert(row)
  if (error) throw new Error(`NF ${nf.numero}: ${error.message}`)
}

async function upsertItem(nfId, it) {
  const row = {
    nf_id: nfId,
    item_index: it.index,
    codigo: it.codigo ?? '',
    descricao: it.descricao ?? '',
    quantidade: it.quantidade ?? 0,
    unidade: it.unidade ?? '',
    ...(it.pesoBruto != null ? { peso_bruto: it.pesoBruto } : {}),
    ...(it.valorUnitario != null ? { valor_unitario: it.valorUnitario } : {}),
    ...(it.valorTotal != null ? { valor_total: it.valorTotal } : {}),
    ...(it.up ? { up: it.up } : {}),
    ...(it.lote ? { lote: it.lote } : {}),
    ...(it.dataFabricacao ? { data_fabricacao: it.dataFabricacao } : {}),
    ...(it.dataValidade ? { data_validade: it.dataValidade } : {}),
    ...(it.paletes != null ? { paletes: it.paletes } : {}),
    ...(it.localizacao === 'stage' ? { localizacao: 'stage' } : { localizacao: 'armazem' }),
  }
  const { error } = await sb
    .from('ultrafrio_nf_itens')
    .upsert(row, { onConflict: 'nf_id,item_index' })
  if (error) throw new Error(`Item ${it.index} NF ${nfId}: ${error.message}`)
}

async function upsertEndereco(nfId, itemIndex, addressId) {
  const { error } = await sb.from('ultrafrio_enderecamentos').insert({
    nf_id: nfId,
    item_index: itemIndex,
    address_id: addressId,
  })
  if (error && !error.message.includes('duplicate') && error.code !== '23505') {
    throw new Error(`Endereço ${addressId}: ${error.message}`)
  }
}

async function upsertMovimento(mov, notaIds) {
  const nfInDb = notaIds.has(mov.nfId)
  const row = {
    id: mov.id,
    tipo: mov.tipo,
    nf_id: nfInDb ? mov.nfId : null,
    nf_numero: mov.nfNumero,
    emitente: mov.emitente,
    created_at: mov.createdAt,
    payload: {
      itens: mov.itens ?? [],
      ...(nfInDb ? {} : { nfIdHistorico: mov.nfId }),
      ...(mov.justificativaSaida ? { justificativaSaida: mov.justificativaSaida } : {}),
      ...(mov.motivoRemocaoEstoque ? { motivoRemocaoEstoque: mov.motivoRemocaoEstoque } : {}),
      ...(mov.nfSaida ? { nfSaida: mov.nfSaida } : {}),
      ...(mov.excluido ? { excluido: true, excluidoEm: mov.excluidoEm ?? null } : {}),
    },
  }
  const { error } = await sb.from('ultrafrio_movimentos').upsert(row)
  if (error) throw new Error(`Movimento ${mov.id}: ${error.message}`)
}

async function main() {
  const notaIds = new Set(notas.map((n) => n.id))

  for (const nf of notas) {
    await upsertNf(nf)
    for (const it of nf.items ?? []) {
      await upsertItem(nf.id, it)
      for (const addr of it.allocatedAddresses ?? []) {
        await upsertEndereco(nf.id, it.index, addr)
      }
    }
    console.log(`  NF ${nf.numero}: ${nf.items?.length ?? 0} item(ns), ${contarEnderecos([nf])} posição(ões)`)
  }

  for (const mov of movimentos) {
    await upsertMovimento(mov, notaIds)
  }
  console.log(`  ${movimentos.length} movimento(s) importado(s)`)

  for (const c of notasCanceladas) {
    const { error } = await sb.from('ultrafrio_notas_canceladas').upsert({
      id: c.id,
      numero: c.numero,
      serie: c.serie ?? '',
      chave: c.chave ?? '',
      emitente: c.emitente ?? '',
      data_emissao: c.dataEmissao ?? '',
      created_at: c.createdAt,
      vinculo_nf_nova_id: c.vinculoNfNovaId ?? null,
      vinculo_nf_nova_numero: c.vinculoNfNovaNumero ?? null,
      payload: { items: c.items ?? [] },
    })
    if (error && !error.message.includes('does not exist')) {
      console.warn(`Cancelada ${c.numero}: ${error.message}`)
    }
  }

  const { count: nfCount } = await sb
    .from('ultrafrio_notas_fiscais')
    .select('*', { count: 'exact', head: true })
  const { count: endCount } = await sb
    .from('ultrafrio_enderecamentos')
    .select('*', { count: 'exact', head: true })

  console.log('\nImportação concluída.')
  console.log(`Supabase agora: ${nfCount ?? 0} NF(s), ${endCount ?? 0} endereço(s).`)
  console.log('Recarregue o painel (F5).')
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
