import { nfTemEnderecos } from './movimentos'
import { nfTemEstoqueStage } from './stageEstoque'
import { itemNoStage } from '../layout/stage'
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

/** Extrai o número da NF (nNF) da chave de acesso de 44 dígitos. */
export function numeroFromChave(chave: string): string {
  const digits = chave.replace(/\D/g, '')
  if (digits.length < 34) return ''
  const nNF = digits.slice(25, 34).replace(/^0+/, '')
  return nNF || digits.slice(25, 34)
}

export type SaidaReferencia = {
  chave: string
  numero: string
  /** NF de entrada correspondente com estoque no sistema, ou null se indisponível. */
  nf: NotaFiscal | null
}

/**
 * Resolve as NFs de entrada referenciadas (NFref) pelo XML de saída,
 * indicando quais estão com estoque disponível para dar saída.
 */
export function resolverReferenciasSaida(
  notas: NotaFiscal[],
  refChaves: string[],
): SaidaReferencia[] {
  const comEstoque = notasDisponiveisParaSaida(notas)
  const vistos = new Set<string>()
  const referencias: SaidaReferencia[] = []

  for (const ch of refChaves) {
    const chNorm = ch.replace(/^NFe/, '').replace(/\D/g, '')
    if (!chNorm || vistos.has(chNorm)) continue
    vistos.add(chNorm)
    const nf =
      comEstoque.find(
        (n) => n.chave === chNorm || (chNorm.length >= 8 && n.chave.endsWith(chNorm)),
      ) ?? null
    referencias.push({ chave: chNorm, numero: numeroFromChave(chNorm), nf })
  }

  return referencias
}

/**
 * Verifica se a NF possui estoque (físico OU stage) com código correspondente
 * a algum item do XML de saída. Usado para liberar o fluxo de saída também
 * quando a mercadoria referenciada está no stage.
 */
export function saidaXmlCorrespondeNf(nf: NotaFiscal, doc: SaidaXmlDocumento): boolean {
  const xmlCods = quantidadesXmlPorCodigo(doc)
  if (xmlCods.size === 0) return false
  return nf.items.some((it) => {
    const cod = normCodigo(it.codigo)
    if (!cod || !xmlCods.has(cod)) return false
    return it.allocatedAddresses.length > 0 || itemNoStage(it)
  })
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
  const usadoPorItem = new Map<number, number>()

  const estoqueOrigem = origem.items.filter((it) => it.allocatedAddresses.length > 0)

  for (const xmlItem of doc.items) {
    const cod = normCodigo(xmlItem.codigo)
    const qtdXml = quantidadeEstoqueItem(xmlItem)
    if (!cod || qtdXml <= 1e-9) continue

    const origItem = estoqueOrigem.find((it) => {
      if (normCodigo(it.codigo) !== cod) return false
      const qtdEstoque = quantidadeEstoqueItem(it)
      const jaUsado = usadoPorItem.get(it.index) ?? 0
      return jaUsado < qtdEstoque - 1e-9
    })

    if (!origItem) {
      avisos.push(
        `Código ${xmlItem.codigo} do XML de saída não encontrado com estoque disponível na NF ${origem.numero}.`,
      )
      continue
    }

    const qtdEstoque = quantidadeEstoqueItem(origItem)
    const jaUsado = usadoPorItem.get(origItem.index) ?? 0
    const disponivel = qtdEstoque - jaUsado
    const limite = Math.min(qtdXml, disponivel)

    if (qtdXml > disponivel + 1e-9) {
      avisos.push(
        `${origItem.codigo}: XML pede ${qtdXml} ${unidadeEstoqueItem(origItem)}, mas há ${disponivel} disponível nesta linha de estoque.`,
      )
    }

    limitesPorItem[origItem.index] = (limitesPorItem[origItem.index] ?? 0) + limite
    usadoPorItem.set(origItem.index, jaUsado + limite)

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
