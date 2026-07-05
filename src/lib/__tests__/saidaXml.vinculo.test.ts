import { describe, expect, it } from 'vitest'
import type { NotaFiscal, SaidaXmlDocumento } from '../../types'
import { vincularSaidaXmlOrigem } from '../saidaXml'
import { proximoItemSaidaPendente } from '../saidaParcial'

const nfOrigem = (): NotaFiscal => ({
  id: 'nf1',
  numero: '100',
  serie: '1',
  chave: '1',
  emitente: 'Cliente',
  dataEmissao: '2026-07-01',
  status: 'concluida',
  createdAt: '2026-07-01',
  items: [
    {
      index: 0,
      codigo: 'SKU-A',
      descricao: 'Produto A',
      quantidade: 100,
      unidade: 'CX',
      allocatedAddresses: ['A1', 'A2'],
    },
    {
      index: 1,
      codigo: 'SKU-B',
      descricao: 'Produto B',
      quantidade: 50,
      unidade: 'CX',
      allocatedAddresses: ['B1'],
    },
  ],
})

const xmlDoisItens = (): SaidaXmlDocumento => ({
  numero: '200',
  serie: '1',
  chave: '2',
  emitente: 'Cliente',
  dataEmissao: '2026-07-05',
  items: [
    {
      index: 0,
      codigo: 'SKU-A',
      descricao: 'Produto A',
      quantidade: 40,
      unidade: 'CX',
      allocatedAddresses: [],
    },
    {
      index: 1,
      codigo: 'SKU-B',
      descricao: 'Produto B',
      quantidade: 20,
      unidade: 'CX',
      allocatedAddresses: [],
    },
  ],
})

describe('vincularSaidaXmlOrigem', () => {
  it('vincula dois itens distintos do XML às linhas de estoque corretas', () => {
    const v = vincularSaidaXmlOrigem(nfOrigem(), xmlDoisItens())

    expect(v.itensExibicao).toHaveLength(2)
    expect(v.itensExibicao.map((i) => i.index)).toEqual([0, 1])
    expect(v.limitesPorItem[0]).toBe(40)
    expect(v.limitesPorItem[1]).toBe(20)
    expect(v.avisos).toHaveLength(0)
  })

  it('distribui duas linhas do mesmo código entre itens de origem com o mesmo SKU', () => {
    const origem = nfOrigem()
    origem.items = [
      {
        index: 0,
        codigo: 'SKU-A',
        descricao: 'Lote 1',
        quantidade: 30,
        unidade: 'CX',
        allocatedAddresses: ['A1'],
      },
      {
        index: 1,
        codigo: 'SKU-A',
        descricao: 'Lote 2',
        quantidade: 40,
        unidade: 'CX',
        allocatedAddresses: ['A2'],
      },
    ]
    const doc: SaidaXmlDocumento = {
      ...xmlDoisItens(),
      items: [
        {
          index: 0,
          codigo: 'SKU-A',
          descricao: 'Devolução lote 1',
          quantidade: 30,
          unidade: 'CX',
          allocatedAddresses: [],
        },
        {
          index: 1,
          codigo: 'SKU-A',
          descricao: 'Devolução lote 2',
          quantidade: 25,
          unidade: 'CX',
          allocatedAddresses: [],
        },
      ],
    }

    const v = vincularSaidaXmlOrigem(origem, doc)

    expect(v.itensExibicao).toHaveLength(2)
    expect(v.limitesPorItem[0]).toBe(30)
    expect(v.limitesPorItem[1]).toBe(25)
  })
})

describe('proximoItemSaidaPendente', () => {
  it('avança para o segundo item após concluir o primeiro', () => {
    const nf = nfOrigem()
    const itens = nf.items
    const confirmados = [{ addressId: 'A1', itemIndex: 0, quantidadeCaixas: 40 }]
    const limites = { 0: 40, 1: 20 }

    const proximo = proximoItemSaidaPendente(itens, 0, confirmados, limites)

    expect(proximo?.index).toBe(1)
  })
})
