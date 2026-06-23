import type { AddressId, MovimentoItemSnapshot, MovimentoRegistro, NotaFiscal, PersistedData } from '../types'

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
    }))
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

export function upsertMovimentoEntrada(
  movimentos: MovimentoRegistro[],
  nf: NotaFiscal,
): MovimentoRegistro[] {
  const existing = movimentos.find((m) => m.tipo === 'entrada' && m.nfId === nf.id)
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
    const existing = movimentos.find((m) => m.tipo === 'entrada' && m.nfId === nf.id)
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

export function criarMovimentoSaida(nf: NotaFiscal, itemIndexes: number[]): MovimentoRegistro {
  return {
    id: `mov-saida-${nf.id}-${Date.now()}`,
    tipo: 'saida',
    nfId: nf.id,
    nfNumero: nf.numero,
    emitente: nf.emitente,
    createdAt: new Date().toISOString(),
    itens: snapshotItensNf(nf, itemIndexes),
  }
}

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

export function restaurarSaidaNoNf(nf: NotaFiscal, mov: MovimentoRegistro): NotaFiscal {
  if (mov.tipo !== 'saida') return nf
  const byItem = new Map(mov.itens.map((it) => [it.itemIndex, it.addressIds]))
  return {
    ...nf,
    items: nf.items.map((it) => {
      const addrs = byItem.get(it.index)
      if (!addrs?.length) return it
      const merged = [...new Set([...it.allocatedAddresses, ...addrs])]
      return { ...it, allocatedAddresses: merged }
    }),
  }
}

export function excluirMovimento(data: PersistedData, movId: string): PersistedData {
  const mov = data.movimentos.find((m) => m.id === movId)
  if (!mov) return data

  const movimentos = data.movimentos.filter((m) => m.id !== movId)

  if (mov.tipo === 'entrada') {
    return {
      movimentos,
      notas: data.notas.filter((n) => n.id !== mov.nfId),
    }
  }

  const notas = data.notas.map((n) => (n.id === mov.nfId ? restaurarSaidaNoNf(n, mov) : n))
  return { movimentos, notas }
}

export function buscarNfPorNumero(notas: NotaFiscal[], numero: string): NotaFiscal | null {
  const q = numero.trim()
  if (!q) return null
  const found = notas.filter((n) => n.numero === q || n.numero.replace(/^0+/, '') === q.replace(/^0+/, ''))
  return found.find((n) => nfTemEnderecos(n)) ?? found[0] ?? null
}
