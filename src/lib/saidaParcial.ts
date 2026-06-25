import { patchNfeItemQuantidade } from './desmembrarItem'
import type { AddressId, MovimentoItemSnapshot, NfeItem, NotaFiscal } from '../types'

export type SaidaItemDraft = {
  itemIndex: number
  quantidadeSaida: number
}

export type SaidaPaleteDraft = {
  addressId: AddressId
  itemIndex: number
  quantidadeCaixas: number
}

export type SaidaPaleteCalculo = {
  addressId: AddressId
  itemIndex: number
  quantidadeCaixas: number
  quantidadeEstoque: number
  quantidadeSobra: number
  unidade: string
  pesoBrutoSaida?: number
  pesoLiquidoSaida?: number
  valorTotalSaida?: number
  liberaPalete: boolean
}

function ratio(qtd: number, total: number): number {
  if (total <= 0) return 0
  return qtd / total
}

export function parseQuantidadeSaida(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return 0
  const n = Number(trimmed.replace(',', '.'))
  if (!Number.isFinite(n) || n < 0) return null
  return n
}

/** Caixas atribuídas a cada palete do item (média quando há vários paletes). */
export function caixasPorPalete(item: NfeItem): number {
  const n = item.allocatedAddresses.length
  if (n <= 0) return item.quantidade
  return item.quantidade / n
}

export function pesoLiquidoItem(nf: NotaFiscal, item: NfeItem): number | undefined {
  if (nf.pesoLiquido == null) return undefined
  const pesoItens = nf.items.reduce((s, it) => s + (it.pesoBruto ?? 0), 0)
  if (pesoItens > 0 && item.pesoBruto != null) {
    return nf.pesoLiquido * (item.pesoBruto / pesoItens)
  }
  const qtdItens = nf.items.reduce((s, it) => s + it.quantidade, 0)
  if (qtdItens > 0) return nf.pesoLiquido * (item.quantidade / qtdItens)
  return undefined
}

export function caixasJaSaidasItem(
  itemIndex: number,
  paletes: SaidaPaleteDraft[],
  excetoAddressId?: AddressId,
): number {
  return paletes
    .filter((p) => p.itemIndex === itemIndex && p.addressId !== excetoAddressId)
    .reduce((s, p) => s + p.quantidadeCaixas, 0)
}

export function calcularSaidaPalete(
  nf: NotaFiscal,
  item: NfeItem,
  addressId: AddressId,
  quantidadeCaixas: number,
  paletesConfirmados: SaidaPaleteDraft[],
): SaidaPaleteCalculo | null {
  if (!item.allocatedAddresses.includes(addressId)) return null
  if (quantidadeCaixas <= 0) return null

  const jaSaido = caixasJaSaidasItem(item.index, paletesConfirmados)
  const disponivel = item.quantidade - jaSaido
  if (quantidadeCaixas > disponivel + 1e-9) return null

  const quantidadeSobra = item.quantidade - jaSaido - quantidadeCaixas
  const r = ratio(quantidadeCaixas, item.quantidade)
  const pesoLiq = pesoLiquidoItem(nf, item)
  const capPalete = caixasPorPalete(item)
  const liberaPalete =
    quantidadeSobra <= 1e-9 || quantidadeCaixas >= capPalete - 1e-6

  return {
    addressId,
    itemIndex: item.index,
    quantidadeCaixas,
    quantidadeEstoque: item.quantidade,
    quantidadeSobra,
    unidade: item.unidade,
    ...(item.pesoBruto != null ? { pesoBrutoSaida: item.pesoBruto * r } : {}),
    ...(pesoLiq != null ? { pesoLiquidoSaida: pesoLiq * r } : {}),
    ...(item.valorTotal != null
      ? { valorTotalSaida: item.valorTotal * r }
      : item.valorUnitario != null
        ? { valorTotalSaida: item.valorUnitario * quantidadeCaixas }
        : {}),
    liberaPalete,
  }
}

export function consolidarDraftsPorItem(paletes: SaidaPaleteDraft[]): SaidaItemDraft[] {
  const map = new Map<number, number>()
  for (const p of paletes) {
    map.set(p.itemIndex, (map.get(p.itemIndex) ?? 0) + p.quantidadeCaixas)
  }
  return [...map.entries()].map(([itemIndex, quantidadeSaida]) => ({
    itemIndex,
    quantidadeSaida,
  }))
}

export function enderecosALiberar(
  nf: NotaFiscal,
  paletes: SaidaPaleteDraft[],
): AddressId[] {
  const liberar: AddressId[] = []
  for (const p of paletes) {
    const item = nf.items.find((it) => it.index === p.itemIndex)
    if (!item) continue
    const jaSaido = caixasJaSaidasItem(item.index, paletes, p.addressId)
    const disponivel = item.quantidade - jaSaido
    const cap = Math.min(disponivel, caixasPorPalete(item))
    if (p.quantidadeCaixas >= cap - 1e-6) liberar.push(p.addressId)
  }
  return liberar
}

export function sobrasPorItem(
  items: NfeItem[],
  paletes: SaidaPaleteDraft[],
): Record<number, number> {
  const saido = new Map<number, number>()
  for (const p of paletes) {
    saido.set(p.itemIndex, (saido.get(p.itemIndex) ?? 0) + p.quantidadeCaixas)
  }
  const sobras: Record<number, number> = {}
  for (const item of items) {
    sobras[item.index] = Math.max(0, item.quantidade - (saido.get(item.index) ?? 0))
  }
  return sobras
}

export function aplicarSaidaPaletes(nf: NotaFiscal, paletes: SaidaPaleteDraft[]): NotaFiscal {
  const itemDrafts = consolidarDraftsPorItem(paletes)
  const liberar = new Set(enderecosALiberar(nf, paletes))
  return aplicarSaidaParcial(nf, itemDrafts, [...liberar])
}

export function aplicarSaidaParcial(
  nf: NotaFiscal,
  saidas: SaidaItemDraft[],
  addressIds: AddressId[],
): NotaFiscal {
  const saidaMap = new Map(saidas.map((s) => [s.itemIndex, s.quantidadeSaida]))
  const pickAddr = new Set(addressIds)

  const items = nf.items
    .map((it) => {
      const qSaida = saidaMap.get(it.index) ?? 0
      if (qSaida <= 0) return it

      const sobraQtd = it.quantidade - qSaida
      const addresses = it.allocatedAddresses.filter((a) => !pickAddr.has(a))

      if (sobraQtd <= 0) {
        return {
          ...it,
          quantidade: 0,
          allocatedAddresses: addresses,
          ...(it.valorTotal != null ? { valorTotal: 0 } : {}),
          ...(it.pesoBruto != null ? { pesoBruto: 0 } : {}),
        }
      }

      return patchNfeItemQuantidade({ ...it, allocatedAddresses: addresses }, sobraQtd)
    })
    .filter((it) => it.quantidade > 0 || it.allocatedAddresses.length > 0)

  return { ...nf, items }
}

export function snapshotSaidaPaletes(
  nf: NotaFiscal,
  paletes: SaidaPaleteDraft[],
): MovimentoItemSnapshot[] {
  const liberar = new Set(enderecosALiberar(nf, paletes))
  const snapshots: MovimentoItemSnapshot[] = []

  for (const p of paletes) {
    const item = nf.items.find((it) => it.index === p.itemIndex)
    if (!item) continue
    const calc = calcularSaidaPalete(nf, item, p.addressId, p.quantidadeCaixas, [])
    if (!calc) continue

    snapshots.push({
      itemIndex: item.index,
      codigo: item.codigo,
      descricao: item.descricao,
      quantidade: p.quantidadeCaixas,
      unidade: item.unidade,
      addressIds: liberar.has(p.addressId) ? [p.addressId] : [],
      paletes: liberar.has(p.addressId) ? 1 : 0,
      quantidadeSaida: p.quantidadeCaixas,
      quantidadeSobra: calc.quantidadeSobra,
      ...(item.up ? { up: item.up } : {}),
      ...(item.lote ? { lote: item.lote } : {}),
      ...(item.dataFabricacao ? { dataFabricacao: item.dataFabricacao } : {}),
      ...(item.dataValidade ? { dataValidade: item.dataValidade } : {}),
    })
  }

  return snapshots
}

export function snapshotSaidaItens(
  nf: NotaFiscal,
  saidas: SaidaItemDraft[],
  addressIds: AddressId[],
): MovimentoItemSnapshot[] {
  const pick = new Set(addressIds)
  const saidaMap = new Map(saidas.map((s) => [s.itemIndex, s.quantidadeSaida]))
  const snapshots: MovimentoItemSnapshot[] = []

  for (const it of nf.items) {
    const qSaida = saidaMap.get(it.index) ?? 0
    if (qSaida <= 0) continue
    const ids = it.allocatedAddresses.filter((a) => pick.has(a))
    snapshots.push({
      itemIndex: it.index,
      codigo: it.codigo,
      descricao: it.descricao,
      quantidade: qSaida,
      unidade: it.unidade,
      addressIds: ids,
      paletes: ids.length,
      quantidadeSaida: qSaida,
      quantidadeSobra: it.quantidade - qSaida,
      ...(it.up ? { up: it.up } : {}),
      ...(it.lote ? { lote: it.lote } : {}),
      ...(it.dataFabricacao ? { dataFabricacao: it.dataFabricacao } : {}),
      ...(it.dataValidade ? { dataValidade: it.dataValidade } : {}),
    })
  }

  return snapshots
}
