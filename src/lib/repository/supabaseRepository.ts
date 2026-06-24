import type { AppState, MovimentoRegistro, NotaFiscal, NotaFiscalCancelada } from '../../types'
import { emitenteKey, normalizarEmitente } from '../emitentesRegistry'
import { limparMovimentosEntradaOrfaos } from '../movimentos'
import { getSupabase, type CanceladaRow, type EmitenteRow, type EndRow, type ItemRow, type MovRow, type NfRow } from '../supabaseClient'
import type { EnderecamentoRepository } from './types'

/** Preferências de UI ficam só na sessão (não no localStorage). */
const uiPrefsMemory: Pick<AppState, 'activeNfId' | 'activeItemIndex'> = {
  activeNfId: null,
  activeItemIndex: null,
}

/** Quando o Supabase ainda não tem as colunas comerciais/entrada, salva só o básico. */
let omitNfCommercialFields = false
let omitItemExtendedFields = false

function missingColumnError(message: string): boolean {
  return message.includes('schema cache') || /Could not find the '[^']+' column/.test(message)
}

function nfUpsertRow(nf: NotaFiscal) {
  const row = {
    id: nf.id,
    numero: nf.numero,
    serie: nf.serie,
    chave: nf.chave,
    emitente: nf.emitente,
    data_emissao: nf.dataEmissao,
    status: nf.status,
  }
  if (omitNfCommercialFields) return row
  return {
    ...row,
    peso_bruto: nf.pesoBruto ?? null,
    peso_liquido: nf.pesoLiquido ?? null,
    valor_total_nota: nf.valorTotalNota ?? null,
    quantidade_volume: nf.quantidadeVolume ?? null,
  }
}

function itemInsertRow(nfId: string, it: NotaFiscal['items'][number]) {
  const row = {
    nf_id: nfId,
    item_index: it.index,
    codigo: it.codigo,
    descricao: it.descricao,
    quantidade: it.quantidade,
    unidade: it.unidade,
  }
  if (omitItemExtendedFields) return row
  return {
    ...row,
    peso_bruto: it.pesoBruto ?? null,
    valor_unitario: it.valorUnitario ?? null,
    valor_total: it.valorTotal ?? null,
    up: it.up || null,
    lote: it.lote || null,
    data_fabricacao: it.dataFabricacao || null,
    data_validade: it.dataValidade || null,
    paletes: it.paletes ?? null,
  }
}

async function upsertNf(
  sb: ReturnType<typeof getSupabase>,
  nf: NotaFiscal,
): Promise<{ error: { message: string } | null }> {
  let result = await sb.from('ultrafrio_notas_fiscais').upsert(nfUpsertRow(nf))
  if (result.error && missingColumnError(result.error.message) && !omitNfCommercialFields) {
    omitNfCommercialFields = true
    result = await sb.from('ultrafrio_notas_fiscais').upsert(nfUpsertRow(nf))
  }
  return result
}

async function insertItens(
  sb: ReturnType<typeof getSupabase>,
  nfId: string,
  items: NotaFiscal['items'],
): Promise<{ error: { message: string } | null }> {
  if (!items.length) return { error: null }
  let result = await sb.from('ultrafrio_nf_itens').insert(items.map((it) => itemInsertRow(nfId, it)))
  if (result.error && missingColumnError(result.error.message) && !omitItemExtendedFields) {
    omitItemExtendedFields = true
    result = await sb.from('ultrafrio_nf_itens').insert(items.map((it) => itemInsertRow(nfId, it)))
  }
  return result
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
    ...(nf.peso_bruto != null ? { pesoBruto: Number(nf.peso_bruto) } : {}),
    ...(nf.peso_liquido != null ? { pesoLiquido: Number(nf.peso_liquido) } : {}),
    ...(nf.valor_total_nota != null ? { valorTotalNota: Number(nf.valor_total_nota) } : {}),
    ...(nf.quantidade_volume ? { quantidadeVolume: nf.quantidade_volume } : {}),
    items: (itensByNf.get(nf.id) ?? []).map((it) => ({
      index: it.item_index,
      codigo: it.codigo,
      descricao: it.descricao,
      quantidade: Number(it.quantidade),
      unidade: it.unidade,
      allocatedAddresses: endByItem.get(`${nf.id}:${it.item_index}`) ?? [],
      ...(it.peso_bruto != null ? { pesoBruto: Number(it.peso_bruto) } : {}),
      ...(it.valor_unitario != null ? { valorUnitario: Number(it.valor_unitario) } : {}),
      ...(it.valor_total != null ? { valorTotal: Number(it.valor_total) } : {}),
      ...(it.up ? { up: it.up } : {}),
      ...(it.lote ? { lote: it.lote } : {}),
      ...(it.data_fabricacao ? { dataFabricacao: it.data_fabricacao } : {}),
      ...(it.data_validade ? { dataValidade: it.data_validade } : {}),
      ...(it.paletes != null ? { paletes: Number(it.paletes) } : {}),
    })),
  }))
}

function mapMovimentos(rows: MovRow[]): MovimentoRegistro[] {
  return rows.map((m) => ({
    id: m.id,
    tipo: m.tipo,
    nfId: m.nf_id ?? m.payload?.nfIdHistorico ?? '',
    nfNumero: m.nf_numero,
    emitente: m.emitente,
    createdAt: m.created_at,
    itens: m.payload?.itens ?? [],
    ...(m.payload?.justificativaSaida ? { justificativaSaida: m.payload.justificativaSaida } : {}),
    ...(m.payload?.excluido ? { excluido: true } : {}),
    ...(m.payload?.excluidoEm ? { excluidoEm: m.payload.excluidoEm } : {}),
  }))
}

function movimentoUpsertRow(mov: MovimentoRegistro, notaIds: Set<string>) {
  const nfInDb = notaIds.has(mov.nfId)
  return {
    id: mov.id,
    tipo: mov.tipo,
    nf_id: nfInDb ? mov.nfId : null,
    nf_numero: mov.nfNumero,
    emitente: mov.emitente,
    created_at: mov.createdAt,
    payload: {
      itens: mov.itens,
      ...(nfInDb ? {} : { nfIdHistorico: mov.nfId }),
      ...(mov.justificativaSaida ? { justificativaSaida: mov.justificativaSaida } : {}),
      ...(mov.excluido ? { excluido: true, excluidoEm: mov.excluidoEm ?? null } : {}),
    },
  }
}

async function upsertMovimento(
  sb: ReturnType<typeof getSupabase>,
  mov: MovimentoRegistro,
  notaIds: Set<string>,
): Promise<{ error: { message: string } | null }> {
  const row = movimentoUpsertRow(mov, notaIds)
  let result = await sb.from('ultrafrio_movimentos').upsert(row)
  if (
    result.error &&
    row.nf_id &&
    (result.error.message.includes('foreign key') ||
      result.error.message.includes('nf_id_fkey'))
  ) {
    result = await sb.from('ultrafrio_movimentos').upsert(
      movimentoUpsertRow({ ...mov }, new Set()),
    )
  }
  return result
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

async function loadEmitentes(sb: ReturnType<typeof getSupabase>): Promise<string[]> {
  const { data, error } = await sb
    .from('ultrafrio_cadastro_remetentes')
    .select('nome')
    .order('updated_at', { ascending: false })
  if (error) {
    if (error.message.includes('does not exist') || error.code === 'PGRST205') return []
    throw new Error(error.message)
  }
  return ((data ?? []) as Pick<EmitenteRow, 'nome'>[])
    .map((row) => normalizarEmitente(row.nome))
    .filter((nome): nome is string => nome !== null)
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
    const emitentes = await loadEmitentes(sb)

    return {
      notas: mapNotas(rows, itemRows, endRows),
      movimentos: mapMovimentos((movs ?? []) as MovRow[]),
      notasCanceladas,
      emitentes,
    }
  },

  async saveData({ notas, movimentos, notasCanceladas }) {
    omitNfCommercialFields = false
    omitItemExtendedFields = false

    const cleaned = limparMovimentosEntradaOrfaos({
      notas,
      movimentos,
      notasCanceladas,
      emitentes: [],
    })
    notas = cleaned.notas
    movimentos = cleaned.movimentos

    const sb = getSupabase()
    const notaIds = new Set(notas.map((n) => n.id))
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
      const { error: upErr } = await upsertNf(sb, nf)
      if (upErr) throw new Error(upErr.message)

      const { error: delIt } = await sb.from('ultrafrio_nf_itens').delete().eq('nf_id', nf.id)
      if (delIt) throw new Error(delIt.message)

      const { error: insIt } = await insertItens(sb, nf.id, nf.items)
      if (insIt) throw new Error(insIt.message)

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
      const { error } = await upsertMovimento(sb, mov, notaIds)
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

  async registrarEmitente(nome: string) {
    const n = normalizarEmitente(nome)
    const key = emitenteKey(nome)
    if (!n || !key) return

    const sb = getSupabase()
    const { error } = await sb.from('ultrafrio_cadastro_remetentes').upsert(
      {
        nome_key: key,
        nome: n,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'nome_key' },
    )
    if (error) {
      if (error.message.includes('does not exist') || error.code === 'PGRST205') return
      throw new Error(error.message)
    }
  },

  loadUiPrefs() {
    return { ...uiPrefsMemory }
  },

  saveUiPrefs(prefs) {
    uiPrefsMemory.activeNfId = prefs.activeNfId
    uiPrefsMemory.activeItemIndex = prefs.activeItemIndex
  },
}
