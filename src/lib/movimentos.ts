import type {
  AddressId,
  JustificativaSaidaId,
  MovimentoItemSnapshot,
  MovimentoRegistro,
  NotaFiscal,
  PersistedData,
} from '../types'
import { remapLegacyAddressId } from '../layout/camaras'
import { syncVinculosNotas } from './nfCanceladas'

/** Atualiza IDs de endereço salvos antes da troca de numeração das ruas. */
export function migrarRuasNosDados(data: PersistedData): PersistedData {
  let changed = false

  const notas = data.notas.map((nf) => ({
    ...nf,
    items: nf.items.map((it) => {
      const allocatedAddresses = it.allocatedAddresses.map(remapLegacyAddressId)
      if (allocatedAddresses.some((a, i) => a !== it.allocatedAddresses[i])) changed = true
      return { ...it, allocatedAddresses }
    }),
  }))

  const movimentos = data.movimentos.map((mov) => ({
    ...mov,
    itens: mov.itens.map((it) => {
      const addressIds = it.addressIds.map(remapLegacyAddressId)
      if (addressIds.some((a, i) => a !== it.addressIds[i])) changed = true
      return { ...it, addressIds }
    }),
  }))

  return changed ? { ...data, notas, movimentos } : data
}

export function nfTemEnderecos(nf: NotaFiscal): boolean {
  return nf.items.some((it) => it.allocatedAddresses.length > 0)
}

export function snapshotItensNf(nf: NotaFiscal, itemIndexes?: number[]): MovimentoItemSnapshot[] {
  const items = itemIndexes
    ? nf.items.filter((it) => itemIndexes.includes(it.index))
    : nf.items
  return items
    .filter((it) => it.allocatedAddresses.length > 0)
    .map((it) => ({
      itemIndex: it.index,
      codigo: it.codigo,
      descricao: it.descricao,
      quantidade: it.quantidade,
      unidade: it.unidade,
      addressIds: [...it.allocatedAddresses],
      ...(it.up ? { up: it.up } : {}),
      ...(it.lote ? { lote: it.lote } : {}),
      ...(it.dataFabricacao ? { dataFabricacao: it.dataFabricacao } : {}),
      ...(it.dataValidade ? { dataValidade: it.dataValidade } : {}),
      ...(it.paletes != null ? { paletes: it.paletes } : {}),
    }))
}

export function snapshotItensNfPorEnderecos(
  nf: NotaFiscal,
  addressIds: AddressId[],
): MovimentoItemSnapshot[] {
  const pick = new Set(addressIds)
  const snapshots: MovimentoItemSnapshot[] = []
  for (const it of nf.items) {
    const ids = it.allocatedAddresses.filter((a) => pick.has(a))
    if (ids.length === 0) continue
    snapshots.push({
      itemIndex: it.index,
      codigo: it.codigo,
      descricao: it.descricao,
      quantidade: it.quantidade,
      unidade: it.unidade,
      addressIds: ids,
      paletes: ids.length,
      ...(it.up ? { up: it.up } : {}),
      ...(it.lote ? { lote: it.lote } : {}),
      ...(it.dataFabricacao ? { dataFabricacao: it.dataFabricacao } : {}),
      ...(it.dataValidade ? { dataValidade: it.dataValidade } : {}),
    })
  }
  return snapshots
}

export function criarMovimentoEntrada(nf: NotaFiscal): MovimentoRegistro {
  return {
    id: `mov-entrada-${nf.id}-${Date.now()}`,
    tipo: 'entrada',
    nfId: nf.id,
    nfNumero: nf.numero,
    emitente: nf.emitente,
    createdAt: nf.createdAt || new Date().toISOString(),
    itens: snapshotItensNf(nf),
  }
}

export function atualizarMovimentoEntrada(mov: MovimentoRegistro, nf: NotaFiscal): MovimentoRegistro {
  return {
    ...mov,
    nfNumero: nf.numero,
    emitente: nf.emitente,
    itens: snapshotItensNf(nf),
  }
}

export function findMovimentoEntradaAtivo(
  movimentos: MovimentoRegistro[],
  nfId: string,
): MovimentoRegistro | undefined {
  return movimentos.find((m) => m.tipo === 'entrada' && m.nfId === nfId && !m.excluido)
}

export function removerMovimentoEntradaAtivo(
  movimentos: MovimentoRegistro[],
  nfId: string,
): MovimentoRegistro[] {
  return movimentos.filter((m) => !(m.tipo === 'entrada' && m.nfId === nfId && !m.excluido))
}

/** Remove entradas ativas cujo nfId não existe mais no estoque (evita FK no Supabase). */
export function limparMovimentosEntradaOrfaos(data: PersistedData): PersistedData {
  const notaIds = new Set(data.notas.map((n) => n.id))
  let changed = false
  const movimentos = data.movimentos.filter((m) => {
    if (m.tipo !== 'entrada' || m.excluido) return true
    if (notaIds.has(m.nfId)) return true
    changed = true
    return false
  })
  return changed ? { ...data, movimentos } : data
}

export function upsertMovimentoEntrada(
  movimentos: MovimentoRegistro[],
  nf: NotaFiscal,
): MovimentoRegistro[] {
  const existing = movimentos.find((m) => m.tipo === 'entrada' && m.nfId === nf.id && !m.excluido)
  if (existing) {
    const updated = atualizarMovimentoEntrada(existing, nf)
    return movimentos.map((m) => (m.id === existing.id ? updated : m))
  }
  return [criarMovimentoEntrada(nf), ...movimentos]
}

/** Cria registros de entrada faltantes (ex.: NFs importadas antes do histórico). */
export function sincronizarMovimentosEntrada(data: PersistedData): PersistedData {
  let movimentos = data.movimentos
  let changed = false

  for (const nf of data.notas) {
    const existing = movimentos.find((m) => m.tipo === 'entrada' && m.nfId === nf.id && !m.excluido)
    if (!existing) {
      movimentos = upsertMovimentoEntrada(movimentos, nf)
      changed = true
      continue
    }
    if (nf.status === 'em_andamento') {
      const updated = atualizarMovimentoEntrada(existing, nf)
      if (JSON.stringify(updated.itens) !== JSON.stringify(existing.itens)) {
        movimentos = movimentos.map((m) => (m.id === existing.id ? updated : m))
        changed = true
      }
      continue
    }
    if (existing.itens.length === 0 && nfTemEnderecos(nf)) {
      const updated = atualizarMovimentoEntrada(existing, nf)
      movimentos = movimentos.map((m) => (m.id === existing.id ? updated : m))
      changed = true
    }
  }

  return changed ? { ...data, movimentos } : data
}

export function criarMovimentoSaida(
  nf: NotaFiscal,
  addressIds: AddressId[],
  justificativaSaida: JustificativaSaidaId,
): MovimentoRegistro {
  return {
    id: `mov-saida-${nf.id}-${Date.now()}`,
    tipo: 'saida',
    nfId: nf.id,
    nfNumero: nf.numero,
    emitente: nf.emitente,
    createdAt: new Date().toISOString(),
    justificativaSaida,
    itens: snapshotItensNfPorEnderecos(nf, addressIds),
  }
}

export function aplicarSaidaEnderecos(nf: NotaFiscal, addressIds: AddressId[]): NotaFiscal {
  const pick = new Set(addressIds)
  return {
    ...nf,
    items: nf.items.map((it) => ({
      ...it,
      allocatedAddresses: it.allocatedAddresses.filter((a) => !pick.has(a)),
    })),
  }
}

/** @deprecated Use aplicarSaidaEnderecos para saída parcial por posição. */
export function aplicarSaidaItens(nf: NotaFiscal, itemIndexes: number[]): NotaFiscal {
  const pick = new Set(itemIndexes)
  return {
    ...nf,
    items: nf.items.map((it) =>
      pick.has(it.index) ? { ...it, allocatedAddresses: [] } : it,
    ),
  }
}

export function enderecosDaNf(nf: NotaFiscal): AddressId[] {
  return nf.items.flatMap((it) => it.allocatedAddresses)
}

export function enderecosDosItens(nf: NotaFiscal, itemIndexes: number[]): AddressId[] {
  const pick = new Set(itemIndexes)
  return nf.items.filter((it) => pick.has(it.index)).flatMap((it) => it.allocatedAddresses)
}

export function excluirMovimento(data: PersistedData, movId: string): PersistedData {
  const mov = data.movimentos.find((m) => m.id === movId)
  if (!mov || mov.excluido) return data

  const excluidoEm = new Date().toISOString()
  const movimentos = data.movimentos.map((m) =>
    m.id === movId ? { ...m, excluido: true, excluidoEm } : m,
  )

  if (mov.tipo === 'entrada') {
    const notas = data.notas.filter((n) => n.id !== mov.nfId)
    const notasCanceladas = data.notasCanceladas.map((c) =>
      c.vinculoNfNovaId === mov.nfId
        ? { ...c, vinculoNfNovaId: null, vinculoNfNovaNumero: null }
        : c,
    )
    return syncVinculosNotas({ movimentos, notas, notasCanceladas, emitentes: data.emitentes })
  }

  return {
    movimentos,
    notas: data.notas,
    notasCanceladas: data.notasCanceladas,
    emitentes: data.emitentes,
  }
}

export function buscarNfPorNumero(notas: NotaFiscal[], numero: string): NotaFiscal | null {
  const q = numero.trim()
  if (!q) return null
  const found = notas.filter((n) => n.numero === q || n.numero.replace(/^0+/, '') === q.replace(/^0+/, ''))
  return found.find((n) => nfTemEnderecos(n)) ?? found[0] ?? null
}
