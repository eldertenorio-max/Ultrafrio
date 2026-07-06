import type { NfeItem } from '../types'

/** Unidades de medida de peso na NF-e. */
export function isUnidadePeso(unidade: string): boolean {
  const u = unidade.trim().toUpperCase()
  return u === 'KG' || u === 'KGM' || u === 'QUILO' || u === 'QUILOGRAMA'
}

/** Descrição indica produto vendido em caixas. */
export function descricaoIndicaCaixas(descricao: string): boolean {
  return /\bCX\b/i.test(descricao)
}

/** Resolve quantidade/unidade comercial a partir dos campos do XML (prod). */
export function resolverQuantidadeComercialNfe(input: {
  qCom: number
  uCom: string
  qTrib: number
  uTrib: string
  descricao: string
}): { quantidade: number; unidade: string } {
  const { qCom, uCom, qTrib, uTrib, descricao } = input
  const comPeso = isUnidadePeso(uCom)
  const tribPeso = isUnidadePeso(uTrib)

  if (comPeso && qCom > 0) {
    const kgCx = kgPorCaixaFromDescricao(descricao)
    if (kgCx != null) {
      const caixas = qCom / kgCx
      if (caixas >= 1 && Math.abs(caixas - Math.round(caixas)) < 0.02) {
        return { quantidade: Math.round(caixas), unidade: 'CX' }
      }
    }
  }

  if (comPeso && qCom > 0 && qTrib > 0 && qTrib < qCom * 0.15) {
    const caixas = Math.round(qTrib)
    if (caixas >= 1 && Math.abs(qTrib - caixas) < 0.02) {
      if (descricaoIndicaCaixas(descricao) || (uTrib && !isUnidadePeso(uTrib))) {
        return {
          quantidade: caixas,
          unidade: uTrib && !isUnidadePeso(uTrib) ? uTrib : 'CX',
        }
      }
    }
  }

  if (comPeso && uTrib && !tribPeso && qTrib > 0) {
    return { quantidade: qTrib, unidade: uTrib }
  }

  if (!comPeso && tribPeso && qCom > 0) {
    return { quantidade: qCom, unidade: uCom }
  }

  if (comPeso && qTrib > 0 && !tribPeso && qTrib !== qCom) {
    return { quantidade: qTrib, unidade: uTrib || 'UN' }
  }

  return { quantidade: qCom, unidade: uCom || 'UN' }
}

/** Peso por caixa indicado na descrição (ex.: "CX 20KG", "CX20KG"). */
export function kgPorCaixaFromDescricao(descricao: string): number | null {
  const m =
    descricao.match(/\bCX\s*(\d+(?:[.,]\d+)?)\s*KG\b/i) ??
    descricao.match(/\bCX(\d+(?:[.,]\d+)?)\s*KG\b/i)
  if (!m) return null
  const n = Number(m[1].replace(',', '.'))
  return n > 0 ? n : null
}

/** Peso em kg do item quando a NF informa qCom/uCom em KG. */
export function pesoKgItem(item: NfeItem): number | undefined {
  if (item.pesoLiquido != null) return item.pesoLiquido
  if (item.pesoBruto != null) return item.pesoBruto
  if (isUnidadePeso(item.unidade) && item.quantidade > 0) return item.quantidade
  return undefined
}

function caixasFromPesoKg(item: NfeItem): number | null {
  const kgCx = kgPorCaixaFromDescricao(item.descricao)
  if (!kgCx) return null
  const peso = pesoKgItem(item)
  if (peso == null || peso <= 0) return null
  const caixas = peso / kgCx
  if (caixas < 1 || Math.abs(caixas - Math.round(caixas)) > 0.02) return null
  return Math.round(caixas)
}

/** Quantidade comercial para estoque/saída (caixas quando a NF traz peso em KG). */
export function quantidadeEstoqueItem(item: NfeItem): number {
  if (!isUnidadePeso(item.unidade)) return item.quantidade

  const caixas = caixasFromPesoKg(item)
  if (caixas != null) return caixas

  if (item.valorUnitario != null && item.valorUnitario > 0 && item.valorTotal != null && item.valorTotal > 0) {
    const porValor = item.valorTotal / item.valorUnitario
    if (porValor > 0 && porValor < item.quantidade * 0.95) {
      const diffRel = (item.quantidade - porValor) / item.quantidade
      if (diffRel > 0.05) return porValor
    }
  }

  return item.quantidade
}

/** Unidade exibida na saída/estoque (CX quando convertido a partir de KG). */
export function unidadeEstoqueItem(item: NfeItem): string {
  if (!isUnidadePeso(item.unidade)) return item.unidade
  if (caixasFromPesoKg(item) != null) return 'CX'
  return item.unidade
}
