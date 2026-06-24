import type { NfeItem, NotaFiscal } from '../types'

/** Duplica um item da NF para nova linha (lote/data), reabrindo entrada se concluída. */
export function adicionarItemNotaFiscal(
  nf: NotaFiscal,
  sourceItemIndex: number,
): { nota: NotaFiscal; newItemIndex: number } | null {
  const pos = nf.items.findIndex((it) => it.index === sourceItemIndex)
  if (pos < 0) return null

  const source = nf.items[pos]
  const maxIndex = nf.items.reduce((max, it) => Math.max(max, it.index), -1)

  const newItem: NfeItem = {
    index: maxIndex + 1,
    codigo: source.codigo,
    descricao: source.descricao,
    quantidade: 0,
    unidade: source.unidade,
    allocatedAddresses: [],
    ...(source.valorUnitario != null ? { valorUnitario: source.valorUnitario, valorTotal: 0 } : {}),
  }

  const items = [...nf.items]
  items.splice(pos + 1, 0, newItem)

  return {
    nota: {
      ...nf,
      status: 'em_andamento',
      items,
    },
    newItemIndex: newItem.index,
  }
}
