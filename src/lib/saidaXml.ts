import { nfTemEnderecos } from './movimentos'
import { nfTemEstoqueStage } from './stageEstoque'
import { quantidadeEstoqueItem, unidadeEstoqueItem } from './nfeUnidades'
import type { NfeItem, NotaFiscal, SaidaXmlDocumento } from '../types'

export type VinculoSaidaXmlResult = {
  limitesPorItem: Record<number, number>
  itensExibicao: NfeItem[]
  avisos: string[]
}

function normCodigo(codigo: string): string {
  const t = codigo.trim().toUpperCase()
  const semZeros = t.replace(/^0+/, '')
  return semZeros || t
}

function quantidadesXmlPorCodigo(doc: SaidaXmlDocumento): Map<string, number> {
  const map = new Map<string, number>()
  for (const item of doc.items) {
    const cod = normCodigo(item.codigo)
    if (!cod) continue
    map.set(cod, (map.get(cod) ?? 0) + quantidadeEstoqueItem(item))
  }
  return map
}

export function documentoSaidaFromNota(nf: NotaFiscal): SaidaXmlDocumento {
  return {
    numero: nf.numero,
    serie: nf.serie,
    chave: nf.chave,
    emitente: nf.emitente,
    dataEmissao: nf.dataEmissao,
    items: nf.items.map((it) => ({ ...it })),
    ...(nf.pesoBruto != null ? { pesoBruto: nf.pesoBruto } : {}),
    ...(nf.pesoLiquido != null ? { pesoLiquido: nf.pesoLiquido } : {}),
    ...(nf.valorTotalNota != null ? { valorTotalNota: nf.valorTotalNota } : {}),
  }
}

export function notasDisponiveisParaSaida(notas: NotaFiscal[]): NotaFiscal[] {
  return notas
    .filter((n) => nfTemEnderecos(n) || nfTemEstoqueStage(n))
    .sort((a, b) => b.numero.localeCompare(a.numero))
}

export function sugerirOrigemSaida(
  notas: NotaFiscal[],
  doc: SaidaXmlDocumento,
  refChaves: string[],
): NotaFiscal | null {
  const comEstoque = notasDisponiveisParaSaida(notas)

  for (const ch of refChaves) {
    const chNorm = ch.replace(/^NFe/, '')
    const found = comEstoque.find(
      (n) => n.chave === chNorm || (chNorm.length >= 8 && n.chave.endsWith(chNorm)),
    )
    if (found) return found
  }

  const xmlCodigos = [...quantidadesXmlPorCodigo(doc).keys()]
  if (xmlCodigos.length === 0) return null

  const candidatos = comEstoque.filter((nf) => {
    const origCodigos = new Set(
      nf.items
        .filter((it) => it.allocatedAddresses.length > 0)
        .map((it) => normCodigo(it.codigo)),
    )
    return xmlCodigos.every((c) => origCodigos.has(c))
  })

  return candidatos.length === 1 ? candidatos[0] : null
}

export function vincularSaidaXmlOrigem(
  origem: NotaFiscal,
  doc: SaidaXmlDocumento,
): VinculoSaidaXmlResult {
  const avisos: string[] = []
  const limitesPorItem: Record<number, number> = {}
  const itensExibicao: NfeItem[] = []

  const xmlByCodigo = quantidadesXmlPorCodigo(doc)
  const origemByCodigo = new Map<string, NfeItem>()
  for (const item of origem.items) {
    if (item.allocatedAddresses.length === 0) continue
    const cod = normCodigo(item.codigo)
    if (!cod || origemByCodigo.has(cod)) continue
    origemByCodigo.set(cod, item)
  }

  for (const [cod, qtdXml] of xmlByCodigo) {
    const origItem = origemByCodigo.get(cod)
    if (!origItem) {
      const xmlItem = doc.items.find((i) => normCodigo(i.codigo) === cod)
      avisos.push(
        `Código ${xmlItem?.codigo ?? cod} do XML de saída não encontrado com estoque na NF ${origem.numero}.`,
      )
      continue
    }

    const qtdEstoque = quantidadeEstoqueItem(origItem)
    if (qtdXml > qtdEstoque + 1e-9) {
      avisos.push(
        `${origItem.codigo}: XML pede ${qtdXml} ${unidadeEstoqueItem(origItem)}, mas há ${qtdEstoque} em estoque.`,
      )
    }

    limitesPorItem[origItem.index] = Math.min(qtdXml, qtdEstoque)
    if (!itensExibicao.some((i) => i.index === origItem.index)) {
      itensExibicao.push(origItem)
    }
  }

  if (itensExibicao.length === 0) {
    avisos.unshift('Nenhum item do XML foi encontrado com estoque na NF de origem.')
  }

  itensExibicao.sort((a, b) => a.index - b.index)
  return { limitesPorItem, itensExibicao, avisos }
}
