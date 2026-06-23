import type { NotaFiscal, NotaFiscalCancelada, PersistedData } from '../types'

export function notaFiscalToCancelada(nf: NotaFiscal): NotaFiscalCancelada {
  return {
    id: nf.id,
    numero: nf.numero,
    serie: nf.serie,
    chave: nf.chave,
    emitente: nf.emitente,
    dataEmissao: nf.dataEmissao,
    items: nf.items.map((it) => ({
      index: it.index,
      codigo: it.codigo,
      descricao: it.descricao,
      quantidade: it.quantidade,
      unidade: it.unidade,
    })),
    vinculoNfNovaId: null,
    vinculoNfNovaNumero: null,
    createdAt: new Date().toISOString(),
  }
}

/** Sincroniza campos de vínculo nas notas ativas a partir das canceladas. */
export function syncVinculosNotas(data: PersistedData): PersistedData {
  const byNovaId = new Map(
    data.notasCanceladas
      .filter((c) => c.vinculoNfNovaId && !c.excluido)
      .map((c) => [c.vinculoNfNovaId!, c]),
  )

  const notas = data.notas.map((n) => {
    const cancelada = byNovaId.get(n.id)
    if (!cancelada) {
      return { ...n, nfCanceladaOrigemId: null, nfCanceladaOrigemNumero: null }
    }
    return {
      ...n,
      nfCanceladaOrigemId: cancelada.id,
      nfCanceladaOrigemNumero: cancelada.numero,
    }
  })

  return { ...data, notas }
}

export function vincularNotaCancelada(
  data: PersistedData,
  canceladaId: string,
  novaNfId: string,
): PersistedData {
  const nova = data.notas.find((n) => n.id === novaNfId)
  if (!nova) return data

  const notasCanceladas = data.notasCanceladas.map((c) => {
    if (c.id === canceladaId) {
      return {
        ...c,
        vinculoNfNovaId: nova.id,
        vinculoNfNovaNumero: nova.numero,
      }
    }
    if (c.vinculoNfNovaId === novaNfId) {
      return { ...c, vinculoNfNovaId: null, vinculoNfNovaNumero: null }
    }
    return c
  })

  return syncVinculosNotas({ ...data, notasCanceladas })
}

export function desvincularNotaCancelada(data: PersistedData, canceladaId: string): PersistedData {
  const notasCanceladas = data.notasCanceladas.map((c) =>
    c.id === canceladaId ? { ...c, vinculoNfNovaId: null, vinculoNfNovaNumero: null } : c,
  )
  return syncVinculosNotas({ ...data, notasCanceladas })
}

export function excluirNotaCancelada(data: PersistedData, canceladaId: string): PersistedData {
  const excluidoEm = new Date().toISOString()
  const notasCanceladas = data.notasCanceladas.map((c) =>
    c.id === canceladaId
      ? {
          ...c,
          excluido: true,
          excluidoEm,
          vinculoNfNovaId: null,
          vinculoNfNovaNumero: null,
        }
      : c,
  )
  return syncVinculosNotas({ ...data, notasCanceladas })
}

export function notasDisponiveisParaVinculo(
  notas: PersistedData['notas'],
  canceladas: NotaFiscalCancelada[],
  canceladaId: string,
): PersistedData['notas'] {
  const vinculadas = new Set(
    canceladas
      .filter((c) => c.vinculoNfNovaId && !c.excluido && c.id !== canceladaId)
      .map((c) => c.vinculoNfNovaId!),
  )
  return notas.filter((n) => !vinculadas.has(n.id))
}
