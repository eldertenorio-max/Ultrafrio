import type { LocalizacaoEstoque, MovimentoItemSnapshot, NfeItem, NotaFiscal } from '../types'
import { itemNoStage } from '../layout/stage'
import { itemEnderecamentoCompleto } from './paletes'
import { quantidadeEstoqueItem, unidadeEstoqueItem } from './nfeUnidades'
import { patchNfeItemQuantidade } from './desmembrarItem'
import type { SaidaItemDraft } from './saidaParcial'
import { pesoBrutoTotalItem, pesoLiquidoTotalItem } from './saidaParcial'

export function aplicarLocalizacaoItem(
  item: NfeItem,
  localizacao: LocalizacaoEstoque,
): NfeItem {
  if (localizacao === 'stage') {
    return {
      ...item,
      localizacao: 'stage',
      allocatedAddresses: [],
      paletes: undefined,
    }
  }
  return {
    ...item,
    localizacao: 'armazem',
  }
}

export function aplicarLocalizacaoNf(nf: NotaFiscal, localizacao: LocalizacaoEstoque): NotaFiscal {
  return {
    ...nf,
    items: nf.items.map((it) => aplicarLocalizacaoItem(it, localizacao)),
  }
}

export function todosItensEntradaProntos(nf: NotaFiscal): boolean {
  return nf.items.every((it) => itemEnderecamentoCompleto(it))
}

export function moverItemStageParaArmazem(
  nf: NotaFiscal,
  itemIndex: number,
  addresses: string[],
): NotaFiscal {
  return {
    ...nf,
    items: nf.items.map((it) =>
      it.index === itemIndex
        ? {
            ...it,
            localizacao: 'armazem' as const,
            allocatedAddresses: addresses,
            paletes: addresses.length > 0 ? addresses.length : it.paletes,
          }
        : it,
    ),
  }
}

export function itensStageDaNf(nf: NotaFiscal): NfeItem[] {
  return nf.items.filter(itemNoStage)
}

export function itensArmazemDaNf(nf: NotaFiscal): NfeItem[] {
  return nf.items.filter((it) => !itemNoStage(it))
}

export function nfTemEstoqueArmazem(nf: NotaFiscal): boolean {
  return nf.items.some((it) => !itemNoStage(it) && it.allocatedAddresses.length > 0)
}

export function nfTemEstoqueStage(nf: NotaFiscal): boolean {
  return nf.items.some(itemNoStage)
}

export function aplicarSaidaStage(nf: NotaFiscal, saidas: SaidaItemDraft[]): NotaFiscal {
  const saidaMap = new Map(saidas.map((s) => [s.itemIndex, s.quantidadeSaida]))

  const items = nf.items
    .map((it) => {
      const qSaida = saidaMap.get(it.index) ?? 0
      if (qSaida <= 0 || !itemNoStage(it)) return it

      const qtdItem = quantidadeEstoqueItem(it)
      const sobraQtd = qtdItem - qSaida

      if (sobraQtd <= 0) return null

      return patchNfeItemQuantidade({ ...it, localizacao: 'stage' as const }, sobraQtd)
    })
    .filter((it): it is NfeItem => it != null && (it.quantidade > 0 || it.allocatedAddresses.length > 0))

  return { ...nf, items }
}

export function snapshotSaidaStage(
  nf: NotaFiscal,
  saidas: SaidaItemDraft[],
): MovimentoItemSnapshot[] {
  const snapshots: MovimentoItemSnapshot[] = []

  for (const s of saidas) {
    const item = nf.items.find((it) => it.index === s.itemIndex)
    if (!item || !itemNoStage(item)) continue

    const qtdItem = quantidadeEstoqueItem(item)
    const sobra = qtdItem - s.quantidadeSaida

    snapshots.push({
      itemIndex: item.index,
      codigo: item.codigo,
      descricao: item.descricao,
      quantidade: s.quantidadeSaida,
      unidade: unidadeEstoqueItem(item),
      addressIds: [],
      quantidadeSaida: s.quantidadeSaida,
      quantidadeSobra: sobra > 0 ? sobra : 0,
      ...(item.up ? { up: item.up } : {}),
      ...(item.lote ? { lote: item.lote } : {}),
      ...(item.dataFabricacao ? { dataFabricacao: item.dataFabricacao } : {}),
      ...(item.dataValidade ? { dataValidade: item.dataValidade } : {}),
      ...(pesoBrutoTotalItem(nf, item) != null
        ? { pesoBruto: (pesoBrutoTotalItem(nf, item)! * s.quantidadeSaida) / qtdItem }
        : {}),
      ...(pesoLiquidoTotalItem(nf, item) != null
        ? { pesoLiquido: (pesoLiquidoTotalItem(nf, item)! * s.quantidadeSaida) / qtdItem }
        : {}),
    })
  }

  return snapshots
}
