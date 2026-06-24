import type { NfeItem, NotaFiscal } from '../types'

function textOf(el: Element | null, tag: string): string {
  if (!el) return ''
  const node = el.getElementsByTagName(tag)[0]
  return node?.textContent?.trim() ?? ''
}

function numOf(el: Element | null, tag: string): number {
  const raw = textOf(el, tag).replace(',', '.')
  const n = Number(raw)
  return Number.isFinite(n) ? n : 0
}

function isUnidadePeso(unidade: string): boolean {
  const u = unidade.trim().toUpperCase()
  return u === 'KG' || u === 'KGM' || u === 'QUILO' || u === 'QUILOGRAMA'
}

function parsePesoBrutoItem(prod: Element): number | undefined {
  const qCom = numOf(prod, 'qCom')
  const uCom = textOf(prod, 'uCom')
  const qTrib = numOf(prod, 'qTrib')
  const uTrib = textOf(prod, 'uTrib')
  if (isUnidadePeso(uTrib) && qTrib > 0) return qTrib
  if (isUnidadePeso(uCom) && qCom > 0) return qCom
  return undefined
}

type VolumeInfo = { quantidade: number; unidade: string }

function parseVolumesFromTransport(transp: Element | undefined): VolumeInfo[] {
  if (!transp) return []
  return Array.from(transp.getElementsByTagName('vol'))
    .map((vol) => ({
      quantidade: numOf(vol, 'qVol'),
      unidade: textOf(vol, 'esp') || 'VOL',
    }))
    .filter((v) => v.quantidade > 0)
}

function parseItemQuantidadeUnidade(prod: Element): { quantidade: number; unidade: string } {
  const qCom = numOf(prod, 'qCom')
  const uCom = textOf(prod, 'uCom') || 'UN'
  const qTrib = numOf(prod, 'qTrib')
  const uTrib = textOf(prod, 'uTrib')

  if (isUnidadePeso(uCom) && uTrib && !isUnidadePeso(uTrib) && qTrib > 0) {
    return { quantidade: qTrib, unidade: uTrib }
  }
  return { quantidade: qCom, unidade: uCom }
}

function applyTransportVolumeToItems(items: NfeItem[], volumes: VolumeInfo[]): void {
  if (volumes.length === 0 || items.length !== 1) return
  const item = items[0]
  if (!isUnidadePeso(item.unidade)) return
  item.quantidade = volumes[0].quantidade
  item.unidade = volumes[0].unidade
}

function parseQuantidadeVolume(volumes: VolumeInfo[]): string | undefined {
  if (volumes.length === 0) return undefined
  const parts = volumes.map(
    (v) =>
      `${v.quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 4 })} ${v.unidade}`,
  )
  return parts.join(' · ')
}

function parseTotaisTransporte(transp: Element | undefined): {
  pesoBruto?: number
  pesoLiquido?: number
} {
  if (!transp) return {}
  const volNodes = Array.from(transp.getElementsByTagName('vol'))
  let pesoBruto = 0
  let pesoLiquido = 0
  for (const vol of volNodes) {
    pesoBruto += numOf(vol, 'pesoB')
    pesoLiquido += numOf(vol, 'pesoL')
  }
  return {
    ...(pesoBruto > 0 ? { pesoBruto } : {}),
    ...(pesoLiquido > 0 ? { pesoLiquido } : {}),
  }
}

function findInfNFe(doc: Document): Element | null {
  return (
    doc.querySelector('infNFe') ??
    doc.getElementsByTagName('infNFe')[0] ??
    null
  )
}

export function parseNfeXml(xmlText: string): NotaFiscal {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlText, 'application/xml')
  const parseError = doc.querySelector('parsererror')
  if (parseError) {
    throw new Error('XML inválido ou corrompido.')
  }

  const inf = findInfNFe(doc)
  if (!inf) {
    throw new Error('Arquivo não parece ser uma NF-e (infNFe não encontrado).')
  }

  const ide = inf.getElementsByTagName('ide')[0]
  const emit = inf.getElementsByTagName('emit')[0]
  const numero = textOf(ide, 'nNF')
  const serie = textOf(ide, 'serie')
  const chave = inf.getAttribute('Id')?.replace(/^NFe/, '') ?? ''
  const emitente = textOf(emit, 'xNome') || textOf(emit, 'xFant')
  const dataEmissao = textOf(ide, 'dhEmi') || textOf(ide, 'dEmi')

  const transp = inf.getElementsByTagName('transp')[0]
  const volumes = parseVolumesFromTransport(transp)

  const detNodes = Array.from(inf.getElementsByTagName('det'))
  const items: NfeItem[] = detNodes.map((det, index) => {
    const prod = det.getElementsByTagName('prod')[0]
    const { quantidade, unidade } = parseItemQuantidadeUnidade(prod)
    const valorUnitario = numOf(prod, 'vUnCom')
    const valorTotal = numOf(prod, 'vProd')
    const pesoBruto = parsePesoBrutoItem(prod)
    return {
      index,
      codigo: textOf(prod, 'cProd'),
      descricao: textOf(prod, 'xProd'),
      quantidade,
      unidade,
      allocatedAddresses: [],
      ...(pesoBruto != null ? { pesoBruto } : {}),
      ...(valorUnitario > 0 ? { valorUnitario } : {}),
      ...(valorTotal > 0 ? { valorTotal } : {}),
    }
  })

  applyTransportVolumeToItems(items, volumes)

  if (items.length === 0) {
    throw new Error('Nenhum item encontrado na nota fiscal.')
  }

  const id = chave || `nf-${numero}-${serie}-${Date.now()}`

  const total = inf.getElementsByTagName('total')[0]
  const valorTotalNota = numOf(total, 'vNF')
  const totaisTransp = parseTotaisTransporte(transp)
  const quantidadeVolume = parseQuantidadeVolume(volumes)

  return {
    id,
    numero,
    serie,
    chave,
    emitente,
    dataEmissao,
    items,
    status: 'em_andamento',
    createdAt: new Date().toISOString(),
    ...totaisTransp,
    ...(valorTotalNota > 0 ? { valorTotalNota } : {}),
    ...(quantidadeVolume ? { quantidadeVolume } : {}),
  }
}
