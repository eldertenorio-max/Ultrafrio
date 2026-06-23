import type { MovimentoRegistro, NotaFiscal, NotaFiscalCancelada } from '../../types'
import { getSupabase, type CanceladaRow, type EndRow, type ItemRow, type MovRow, type NfRow } from '../supabaseClient'
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

function mapNotas(
  rows: NfRow[],
  itemRows: ItemRow[],
  endRows: EndRow[],
): NotaFiscal[] {
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

  return rows.map((nf) => ({
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
      ...(it.up ? { up: it.up } : {}),
      ...(it.lote ? { lote: it.lote } : {}),
      ...(it.data_fabricacao ? { dataFabricacao: it.data_fabricacao } : {}),
      ...(it.data_validade ? { dataValidade: it.data_validade } : {}),
    })),
  }))
}

function mapMovimentos(rows: MovRow[]): MovimentoRegistro[] {
  return rows.map((m) => ({
    id: m.id,
    tipo: m.tipo,
    nfId: m.nf_id,
    nfNumero: m.nf_numero,
    emitente: m.emitente,
    createdAt: m.created_at,
    itens: m.payload?.itens ?? [],
    ...(m.payload?.excluido ? { excluido: true } : {}),
    ...(m.payload?.excluidoEm ? { excluidoEm: m.payload.excluidoEm } : {}),
  }))
}

function mapCanceladas(rows: CanceladaRow[]): NotaFiscalCancelada[] {
  return rows.map((c) => ({
    id: c.id,
    numero: c.numero,
    serie: c.serie,
    chave: c.chave,
    emitente: c.emitente,
    dataEmissao: c.data_emissao,
    createdAt: c.created_at,
    vinculoNfNovaId: c.vinculo_nf_nova_id,
    vinculoNfNovaNumero: c.vinculo_nf_nova_numero,
    items: c.payload?.items ?? [],
    ...(c.payload?.excluido ? { excluido: true } : {}),
    ...(c.payload?.excluidoEm ? { excluidoEm: c.payload.excluidoEm } : {}),
  }))
}

async function loadCanceladas(sb: ReturnType<typeof getSupabase>): Promise<NotaFiscalCancelada[]> {
  const { data, error } = await sb
    .from('ultrafrio_notas_canceladas')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) {
    if (error.message.includes('does not exist') || error.code === 'PGRST205') return []
    throw new Error(error.message)
  }
  return mapCanceladas((data ?? []) as CanceladaRow[])
}

export const supabaseRepository: EnderecamentoRepository = {
  mode: 'supabase',

  async loadData() {
    const sb = getSupabase()

    const { data: nfs, error: nfErr } = await sb
      .from('ultrafrio_notas_fiscais')
      .select('*')
      .order('created_at', { ascending: false })
    if (nfErr) throw new Error(nfErr.message)

    const rows = (nfs ?? []) as NfRow[]
    const ids = rows.map((n) => n.id)

    let itemRows: ItemRow[] = []
    let endRows: EndRow[] = []
    if (ids.length) {
      const { data: itens, error: itErr } = await sb
        .from('ultrafrio_nf_itens')
        .select('*')
        .in('nf_id', ids)
        .order('item_index')
      if (itErr) throw new Error(itErr.message)
      itemRows = (itens ?? []) as ItemRow[]

      const { data: ends, error: endErr } = await sb
        .from('ultrafrio_enderecamentos')
        .select('*')
        .in('nf_id', ids)
      if (endErr) throw new Error(endErr.message)
      endRows = (ends ?? []) as EndRow[]
    }

    const { data: movs, error: movErr } = await sb
      .from('ultrafrio_movimentos')
      .select('*')
      .order('created_at', { ascending: false })
    if (movErr) throw new Error(movErr.message)

    const notasCanceladas = await loadCanceladas(sb)

    return {
      notas: mapNotas(rows, itemRows, endRows),
      movimentos: mapMovimentos((movs ?? []) as MovRow[]),
      notasCanceladas,
    }
  },

  async saveData({ notas, movimentos, notasCanceladas }) {
    const sb = getSupabase()
    const keepIds = notas.map((n) => n.id)

    if (keepIds.length === 0) {
      const { data: existing } = await sb.from('ultrafrio_notas_fiscais').select('id')
      const allIds = ((existing ?? []) as { id: string }[]).map((r) => r.id)
      if (allIds.length) {
        const { error } = await sb.from('ultrafrio_notas_fiscais').delete().in('id', allIds)
        if (error) throw new Error(error.message)
      }
    } else {
      const { data: existing } = await sb.from('ultrafrio_notas_fiscais').select('id')
      const toDelete = ((existing ?? []) as { id: string }[])
        .map((r) => r.id)
        .filter((id) => !keepIds.includes(id))
      if (toDelete.length) {
        const { error } = await sb.from('ultrafrio_notas_fiscais').delete().in('id', toDelete)
        if (error) throw new Error(error.message)
      }
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
            up: it.up || null,
            lote: it.lote || null,
            data_fabricacao: it.dataFabricacao || null,
            data_validade: it.dataValidade || null,
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

    const keepMov = movimentos.map((m) => m.id)
    const { data: existingMov } = await sb.from('ultrafrio_movimentos').select('id')
    const toDelMov = ((existingMov ?? []) as { id: string }[])
      .map((r) => r.id)
      .filter((id) => !keepMov.includes(id))
    if (toDelMov.length) {
      const { error } = await sb.from('ultrafrio_movimentos').delete().in('id', toDelMov)
      if (error) throw new Error(error.message)
    }

    for (const mov of movimentos) {
      const { error } = await sb.from('ultrafrio_movimentos').upsert({
        id: mov.id,
        tipo: mov.tipo,
        nf_id: mov.nfId,
        nf_numero: mov.nfNumero,
        emitente: mov.emitente,
        created_at: mov.createdAt,
        payload: {
          itens: mov.itens,
          ...(mov.excluido ? { excluido: true, excluidoEm: mov.excluidoEm ?? null } : {}),
        },
      })
      if (error) throw new Error(error.message)
    }

    const keepCan = notasCanceladas.map((c) => c.id)
    const { data: existingCan } = await sb.from('ultrafrio_notas_canceladas').select('id')
    const toDelCan = ((existingCan ?? []) as { id: string }[])
      .map((r) => r.id)
      .filter((id) => !keepCan.includes(id))
    if (toDelCan.length) {
      const { error } = await sb.from('ultrafrio_notas_canceladas').delete().in('id', toDelCan)
      if (error && !error.message.includes('does not exist')) throw new Error(error.message)
    }

    for (const c of notasCanceladas) {
      const { error } = await sb.from('ultrafrio_notas_canceladas').upsert({
        id: c.id,
        numero: c.numero,
        serie: c.serie,
        chave: c.chave,
        emitente: c.emitente,
        data_emissao: c.dataEmissao,
        created_at: c.createdAt,
        vinculo_nf_nova_id: c.vinculoNfNovaId,
        vinculo_nf_nova_numero: c.vinculoNfNovaNumero,
        payload: {
          items: c.items,
          ...(c.excluido ? { excluido: true, excluidoEm: c.excluidoEm ?? null } : {}),
        },
      })
      if (error && !error.message.includes('does not exist')) throw new Error(error.message)
    }
  },

  loadUiPrefs() {
    return loadUiPrefsLocal()
  },

  saveUiPrefs(prefs) {
    localStorage.setItem(UI_KEY, JSON.stringify(prefs))
  },
}
