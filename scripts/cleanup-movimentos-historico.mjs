/**
 * Marca movimentos do histórico como excluídos, mantendo visíveis só as NFs informadas.
 * Uso: node scripts/cleanup-movimentos-historico.mjs 236477 201078
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

const url =
  process.env.VITE_SUPABASE_URL?.trim() ||
  JSON.parse(readFileSync('public/supabase-config.json', 'utf8')).url
const key =
  process.env.VITE_SUPABASE_ANON_KEY?.trim() ||
  JSON.parse(readFileSync('public/supabase-config.json', 'utf8')).anonKey

const keepNumeros = new Set(
  (process.argv.slice(2).length ? process.argv.slice(2) : ['236477', '201078']).map((n) =>
    n.trim(),
  ),
)

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  'Content-Type': 'application/json',
  Prefer: 'return=minimal',
}

function scoreMovimento(mov) {
  const itens = mov.payload?.itens ?? []
  const enderecos = itens.reduce((s, it) => s + (it.addressIds?.length ?? 0), 0)
  return enderecos * 1000 + itens.length
}

async function main() {
  const res = await fetch(`${url}/rest/v1/ultrafrio_movimentos?select=*`, { headers })
  if (!res.ok) throw new Error(await res.text())
  const movimentos = await res.json()
  console.log(`Movimentos no banco: ${movimentos.length}`)
  console.log(`Manter visíveis: ${[...keepNumeros].join(', ')}`)

  const melhorPorNf = new Map()
  for (const mov of movimentos) {
    if (!keepNumeros.has(mov.nf_numero)) continue
    if (mov.tipo !== 'entrada') continue
    const score = scoreMovimento(mov)
    const prev = melhorPorNf.get(mov.nf_numero)
    if (!prev || score > prev.score) melhorPorNf.set(mov.nf_numero, { id: mov.id, score })
  }

  const manterIds = new Set([...melhorPorNf.values()].map((v) => v.id))
  let atualizados = 0

  for (const mov of movimentos) {
    const manter =
      keepNumeros.has(mov.nf_numero) && mov.tipo === 'entrada' && manterIds.has(mov.id)
    const deveExcluir = !manter
    const jaExcluido = !!mov.payload?.excluido

    if (!deveExcluir && !jaExcluido) continue
    if (deveExcluir && jaExcluido) continue

    const payload = {
      ...(mov.payload ?? { itens: [] }),
      ...(deveExcluir
        ? { excluido: true, excluidoEm: mov.payload?.excluidoEm ?? new Date().toISOString() }
        : { excluido: false, excluidoEm: null }),
    }

    const patch = await fetch(`${url}/rest/v1/ultrafrio_movimentos?id=eq.${mov.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ payload }),
    })
    if (!patch.ok) throw new Error(`PATCH ${mov.id}: ${await patch.text()}`)
    atualizados++
    console.log(
      `${deveExcluir ? 'excluído' : 'reativado'}: NF ${mov.nf_numero} (${mov.tipo}) id=${mov.id}`,
    )
  }

  console.log(`Concluído. ${atualizados} registro(s) atualizado(s).`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
