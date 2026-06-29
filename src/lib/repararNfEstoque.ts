import { contarEnderecosPersistidos, nfTemHistoricoEnderecos } from './movimentos'
import { normalizePersistedData } from './persistence'
import type { MovimentoRegistro, NotaFiscal, PersistedData } from '../types'

export function nfSemEnderecosNoMapa(nf: NotaFiscal): boolean {
  return !nf.items.some((it) => it.allocatedAddresses.length > 0)
}

export function nfPrecisaReparoEnderecos(
  nf: NotaFiscal,
  movimentos: MovimentoRegistro[],
): boolean {
  return nfSemEnderecosNoMapa(nf) && nfTemHistoricoEnderecos(nf, movimentos)
}

/** Tenta restaurar endereços/itens da NF a partir do histórico de movimentações. */
export function tentarRepararPersistido(data: PersistedData): {
  data: PersistedData
  reparado: boolean
  enderecosRecuperados: number
} {
  const antes = contarEnderecosPersistidos(data)
  const reparado = normalizePersistedData(data)
  const depois = contarEnderecosPersistidos(reparado)
  return {
    data: reparado,
    reparado: depois > antes,
    enderecosRecuperados: Math.max(0, depois - antes),
  }
}
