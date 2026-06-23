import type { NotaFiscal } from '../../types'
import { getSupabase, type EndRow, type ItemRow, type NfRow } from '../supabaseClient'
import type { EnderecamentoRepository } from './types'

const UI_KEY = 'ultrafrio-ui-prefs-v1'

function loadUiPrefsLocal(): { activeNfId: string | null; activeItemIndex: number | null } {
  try {
    const raw = localStorage.getItem(UI_KEY)
    if (!raw) return { activeNfId: null, activeItemIndex: null }
    return JSON.parse(raw)
  } catch {
    return { activeNfId: null, activeItemIndex: null }
  }
}

export const supabaseRepository: EnderecamentoRepository = {
  mode: 'supabase',

  async loadNotas() {
    const sb = getSupabase()

    const { data: nfs, error: nfErr } = await sb
      .from('ultrafrio_notas_fiscais')
      .select('*')
      .order('created_at', { ascending: false })

    if (nfErr) throw new Error(nfErr.message)

    const rows = (nfs ?? []) as NfRow[]
    if (!rows.length) return []

    const ids = rows.map((n) => n.id)

    const { data: itens, error: itErr } = await sb
      .from('ultrafrio_nf_itens')
      .select('*')
      .in('nf_id', ids)
      .order('item_index')

    if (itErr) throw new Error(itErr.message)

    const { data: ends, error: endErr } = await sb
      .from('ultrafrio_enderecamentos')
      .select('*')
      .in('nf_id', ids)

    if (endErr) throw new Error(endErr.message)

    const itemRows = (itens ?? []) as ItemRow[]
    const endRows = (ends ?? []) as EndRow[]

    const endByItem = new Map<string, string[]>()
    for (const e of endRows) {
      const key = `${e.nf_id}:${e.item_index}`
      const list = endByItem.get(key) ?? []
      list.push(e.address_id)
      endByItem.set(key, list)
    }

    const itensByNf = new Map<string, ItemRow[]>()
    for (const it of itemRows) {
      const list = itensByNf.get(it.nf_id) ?? []
      list.push(it)
      itensByNf.set(it.nf_id, list)
    }

    return rows.map((nf): NotaFiscal => ({
      id: nf.id,
      numero: nf.numero,
      serie: nf.serie,
      chave: nf.chave,
      emitente: nf.emitente,
      dataEmissao: nf.data_emissao,
      status: nf.status,
      createdAt: nf.created_at,
      items: (itensByNf.get(nf.id) ?? []).map((it) => ({
        index: it.item_index,
        codigo: it.codigo,
        descricao: it.descricao,
        quantidade: Number(it.quantidade),
        unidade: it.unidade,
        allocatedAddresses: endByItem.get(`${nf.id}:${it.item_index}`) ?? [],
      })),
    }))
  },

  async saveNotas(notas) {
    const sb = getSupabase()
    const keepIds = notas.map((n) => n.id)

    if (keepIds.length === 0) {
      const { data: existing } = await sb.from('ultrafrio_notas_fiscais').select('id')
      const allIds = ((existing ?? []) as { id: string }[]).map((r) => r.id)
      if (allIds.length) {
        const { error } = await sb.from('ultrafrio_notas_fiscais').delete().in('id', allIds)
        if (error) throw new Error(error.message)
      }
      return
    }

    const { data: existing } = await sb.from('ultrafrio_notas_fiscais').select('id')
    const toDelete = ((existing ?? []) as { id: string }[])
      .map((r) => r.id)
      .filter((id) => !keepIds.includes(id))
    if (toDelete.length) {
      const { error } = await sb.from('ultrafrio_notas_fiscais').delete().in('id', toDelete)
      if (error) throw new Error(error.message)
    }

    for (const nf of notas) {
      const { error: upErr } = await sb.from('ultrafrio_notas_fiscais').upsert({
        id: nf.id,
        numero: nf.numero,
        serie: nf.serie,
        chave: nf.chave,
        emitente: nf.emitente,
        data_emissao: nf.dataEmissao,
        status: nf.status,
      })
      if (upErr) throw new Error(upErr.message)

      const { error: delIt } = await sb.from('ultrafrio_nf_itens').delete().eq('nf_id', nf.id)
      if (delIt) throw new Error(delIt.message)

      if (nf.items.length) {
        const { error: insIt } = await sb.from('ultrafrio_nf_itens').insert(
          nf.items.map((it) => ({
            nf_id: nf.id,
            item_index: it.index,
            codigo: it.codigo,
            descricao: it.descricao,
            quantidade: it.quantidade,
            unidade: it.unidade,
          })),
        )
        if (insIt) throw new Error(insIt.message)
      }

      const { error: delEnd } = await sb.from('ultrafrio_enderecamentos').delete().eq('nf_id', nf.id)
      if (delEnd) throw new Error(delEnd.message)

      const rows = nf.items.flatMap((it) =>
        it.allocatedAddresses.map((address_id) => ({
          nf_id: nf.id,
          item_index: it.index,
          address_id,
        })),
      )

      if (rows.length) {
        const { error: insEnd } = await sb.from('ultrafrio_enderecamentos').insert(rows)
        if (insEnd) throw new Error(insEnd.message)
      }
    }
  },

  loadUiPrefs() {
    return loadUiPrefsLocal()
  },

  saveUiPrefs(prefs) {
    localStorage.setItem(UI_KEY, JSON.stringify(prefs))
  },
}
