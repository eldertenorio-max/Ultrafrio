import type { NotaFiscal, NotaFiscalCancelada } from '../types'

type NfRef = Pick<NotaFiscal, 'id' | 'chave' | 'numero' | 'serie'>

function normNumero(numero: string): string {
  return numero.trim().replace(/^0+/, '') || '0'
}

function mesmaNf(a: NfRef, b: NfRef): boolean {
  if (a.id && b.id && a.id === b.id) return true
  if (a.chave && b.chave && a.chave === b.chave) return true
  if (
    normNumero(a.numero) === normNumero(b.numero) &&
    a.serie.trim() === b.serie.trim()
  ) {
    return true
  }
  return false
}

export function mensagemNfDuplicada(
  nf: NfRef,
  notas: NotaFiscal[],
  notasCanceladas: NotaFiscalCancelada[] = [],
): string | null {
  const dupNota = notas.find((n) => mesmaNf(n, nf))
  if (dupNota) {
    return `Esta NF já foi importada (NF ${dupNota.numero}).`
  }

  const dupCancelada = notasCanceladas.find((c) => mesmaNf(c, nf))
  if (dupCancelada) {
    return `Esta NF já está registrada como cancelada (NF ${dupCancelada.numero}).`
  }

  return null
}
