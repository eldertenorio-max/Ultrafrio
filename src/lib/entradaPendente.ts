import type { NotaFiscal } from '../types'
import { itemEnderecamentoCompleto } from './paletes'
import { allItemsAllocated } from './repository'

export function contarItensSemEndereco(nf: NotaFiscal): number {
  return nf.items.filter((it) => !itemEnderecamentoCompleto(it)).length
}

export function nfEntradaIncompleta(nf: NotaFiscal | null | undefined): boolean {
  return !!nf && nf.status === 'em_andamento' && !allItemsAllocated(nf)
}
