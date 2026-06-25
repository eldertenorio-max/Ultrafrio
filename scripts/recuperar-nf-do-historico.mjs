/**
 * Recupera NF removida do estoque a partir do snapshot no histórico de movimentos.
 * Uso: node scripts/recuperar-nf-do-historico.mjs 13822
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

const numeros = process.argv.slice(2)
if (!numeros.length) {
  console.error('Informe o número da NF. Ex.: node scripts/recuperar-nf-do-historico.mjs 13822')
  process.exit(1)
}

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
}

function scoreMovimento(mov) {
  const itens = mov.payload?.itens ?? []
  const enderecos = itens.reduce((s, it) => s + (it.addressIds?.length ?? 0), 0)
  return enderecos * 1000 + itens.length
}

async function getJson(path) {
  const res = await fetch(`${url}/rest/v1/${path}`, { headers })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

async function postJson(path, body) {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await res.text())
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

async function patchJson(path, body) {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method: 'PATCH',
    headers: { ...headers, Prefer: 'return=minimal' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await res.text())
}

async function recuperarNumero(numero) {
  const movimentos = await getJson(
    `ultrafrio_movimentos?select=*&nf_numero=eq.${encodeURIComponent(numero)}&tipo=eq.entrada&order=created_at.desc`,
  )
  if (!movimentos.length) {
    console.log(`NF ${numero}: nenhum movimento de entrada encontrado.`)
    return
  }

  const candidatos = movimentos.filter((m) => (m.payload?.itens ?? []).some((it) => it.addressIds?.length))
  if (!candidatos.length) {
    console.log(`NF ${numero}: histórico sem endereços salvos — não é possível recuperar o estoque.`)
    return
  }

  const mov = candidatos.sort((a, b) => scoreMovimento(b) - scoreMovimento(a))[0]
  const nfId = mov.nf_id ?? mov.payload?.nfIdHistorico
  if (!nfId) {
    console.log(`NF ${numero}: movimento sem identificador da NF.`)
    return
  }

  const existente = await getJson(`ultrafrio_notas_fiscais?select=id,numero&id=eq.${encodeURIComponent(nfId)}`)
  if (existente.length) {
    console.log(`NF ${numero}: já existe no estoque (id ${nfId}).`)
    return
  }

  const itens = mov.payload.itens.filter((it) => it.addressIds?.length)
  const endRows = itens.flatMap((it) =>
    it.addressIds.map((address_id) => ({
      nf_id: nfId,
      item_index: it.itemIndex,
      address_id,
    })),
  )

  const ocupados = await Promise.all(
    [...new Set(endRows.map((r) => r.address_id))].map(async (address_id) => {
      const rows = await getJson(
        `ultrafrio_enderecamentos?select=nf_id&address_id=eq.${encodeURIComponent(address_id)}`,
      )
      return rows.length ? address_id : null
    }),
  )
  const conflitos = ocupados.filter(Boolean)
  if (conflitos.length) {
    console.log(`NF ${numero}: posições já ocupadas por outra NF: ${conflitos.join(', ')}`)
    return
  }

  await postJson('ultrafrio_notas_fiscais', {
    id: nfId,
    numero: mov.nf_numero,
    serie: '',
    chave: nfId,
    emitente: mov.emitente || '',
    data_emissao: mov.created_at?.slice(0, 10) ?? '',
    status: 'concluida',
    created_at: mov.created_at,
  })

  await postJson(
    'ultrafrio_nf_itens',
    itens.map((it) => ({
      nf_id: nfId,
      item_index: it.itemIndex,
      codigo: it.codigo ?? '',
      descricao: it.descricao ?? '',
      quantidade: it.quantidade ?? 0,
      unidade: it.unidade ?? 'UN',
      ...(it.paletes != null ? { paletes: it.paletes } : {}),
      ...(it.up ? { up: it.up } : {}),
      ...(it.lote ? { lote: it.lote } : {}),
      ...(it.dataFabricacao ? { data_fabricacao: it.dataFabricacao } : {}),
      ...(it.dataValidade ? { data_validade: it.dataValidade } : {}),
    })),
  )

  await postJson('ultrafrio_enderecamentos', endRows)

  await patchJson(`ultrafrio_movimentos?id=eq.${mov.id}`, {
    nf_id: nfId,
    payload: {
      ...mov.payload,
      excluido: false,
      excluidoEm: null,
    },
  })

  console.log(
    `NF ${numero} recuperada: ${itens.length} item(ns), ${endRows.length} posição(ões) restaurada(s).`,
  )
}

async function main() {
  for (const numero of numeros) {
    await recuperarNumero(numero.trim())
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
