import type { NfeItem, NotaFiscal } from '../types'

function textOf(el: Element | null, tag: string): string {
  if (!el) return ''
  const node = el.getElementsByTagName(tag)[0]
  return node?.textContent?.trim() ?? ''
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

  const detNodes = Array.from(inf.getElementsByTagName('det'))
  const items: NfeItem[] = detNodes.map((det, index) => {
    const prod = det.getElementsByTagName('prod')[0]
    return {
      index,
      codigo: textOf(prod, 'cProd'),
      descricao: textOf(prod, 'xProd'),
      quantidade: Number(textOf(prod, 'qCom').replace(',', '.')) || 0,
      unidade: textOf(prod, 'uCom'),
      allocatedAddresses: [],
    }
  })

  if (items.length === 0) {
    throw new Error('Nenhum item encontrado na nota fiscal.')
  }

  const id = chave || `nf-${numero}-${serie}-${Date.now()}`

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
  }
}
