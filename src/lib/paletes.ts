import type { NfeItem } from '../types'

export function parsePaletesInput(value: string): number | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const n = Number(trimmed.replace(',', '.'))
  if (!Number.isFinite(n) || n < 0) return undefined
  return Math.floor(n)
}

export function paletesLimiteItem(item: NfeItem | null | undefined): number {
  const n = item?.paletes
  if (n == null || n <= 0) return 0
  return n
}

export function paletesRestantes(limite: number, selecionados: number): number {
  if (limite <= 0) return 0
  return Math.max(0, limite - selecionados)
}

export function podeAdicionarEndereco(limite: number, selecionados: number): boolean {
  if (limite <= 0) return false
  return selecionados < limite
}

/** Item endereçado: stage conta como completo; armazém exige endereços/paletes. */
export function itemEnderecamentoCompleto(item: NfeItem): boolean {
  if (item.localizacao === 'stage') return true
  const count = item.allocatedAddresses.length
  if (count === 0) return false
  const limite = paletesLimiteItem(item)
  if (limite > 0) return count >= limite
  return true
}
