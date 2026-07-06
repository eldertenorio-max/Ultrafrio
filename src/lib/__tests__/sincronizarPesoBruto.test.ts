import { describe, expect, it } from 'vitest'
import { pesoBrutoReferenciaNf, resumirNfArmazenada } from '../financeiro/calculo'
import { sincronizarPesoBrutoNota } from '../parseNfeXml'
import { patchNfeItemQuantidade } from '../desmembrarItem'
import type { MovimentoRegistro, NotaFiscal } from '../../types'

const nfLegada = (): NotaFiscal => ({
  id: 'nf-211264',
  numero: '211264',
  serie: '2',
  chave: '35260308982321000302550020002112641002062945',
  emitente: 'ASTRAPLUS',
  dataEmissao: '2026-03-05',
  dataArmazenagem: '2026-03-03',
  status: 'concluida',
  createdAt: '2026-07-06T00:00:00.000Z',
  pesoLiquido: 26_897.32,
  quantidadeVolume: '1.320 CX',
  items: [
    {
      index: 0,
      codigo: '4152168',
      descricao: 'FRANGO CX VAR',
      quantidade: 660,
      unidade: 'CX',
      allocatedAddresses: ['a1'],
      pesoBruto: 13_697.32,
    },
    {
      index: 1,
      codigo: '5035900',
      descricao: 'COXA CX20KG',
      quantidade: 660,
      unidade: 'CX',
      allocatedAddresses: ['a2'],
      pesoBruto: 13_200,
    },
  ],
})

const movLiquido = (): MovimentoRegistro => ({
  id: 'mov-1',
  tipo: 'entrada',
  nfId: 'nf-211264',
  nfNumero: '211264',
  emitente: 'ASTRAPLUS',
  createdAt: '2026-07-06T00:00:00.000Z',
  pesoLiquido: 26_897.32,
  itens: [],
})

describe('sincronizarPesoBrutoNota', () => {
  it('repara NF legada sem pesoB no cabeçalho (itens CX + peso líquido)', () => {
    const nf = nfLegada()
    sincronizarPesoBrutoNota(nf)
    expect(nf.pesoBruto).toBeCloseTo(27_794.92, 2)
    const soma = nf.items.reduce((s, it) => s + (it.pesoBruto ?? 0), 0)
    expect(soma).toBeCloseTo(27_794.92, 2)
  })
})

describe('pesoBrutoReferenciaNf', () => {
  it('prioriza peso bruto da NF sobre peso líquido do movimento de entrada', () => {
    const nf = nfLegada()
    sincronizarPesoBrutoNota(nf)
    expect(pesoBrutoReferenciaNf(nf)).toBeCloseTo(27_794.92, 2)

    const agora = new Date(2026, 6, 6)
    const resumo = resumirNfArmazenada(nf, [movLiquido()], agora)
    expect(resumo.pesoBruto).toBeCloseTo(27_794.92, 2)
    expect(resumo.pesoBrutoRestante).toBeCloseTo(27_794.92, 2)
    expect(resumo.pesoEntrada).toBeCloseTo(26_897.32, 2)
    expect(resumo.pesoRestante).toBeCloseTo(26_897.32, 2)
    expect(resumo.diasArmazenados).toBe(125)
  })

  it('após saída parcial, peso bruto restante reflete estoque para cobrança', () => {
    const nf = nfLegada()
    sincronizarPesoBrutoNota(nf)
    nf.items = nf.items.map((it) => patchNfeItemQuantidade(it, it.quantidade / 2))

    const saida: MovimentoRegistro = {
      id: 'mov-saida-1',
      tipo: 'saida',
      nfId: nf.id,
      nfNumero: nf.numero,
      emitente: nf.emitente,
      createdAt: '2026-07-06T00:00:00.000Z',
      pesoLiquido: 13_448.66,
      itens: [
        { itemIndex: 0, codigo: '4152168', descricao: 'FRANGO', quantidade: 330, unidade: 'CX', addressIds: [], pesoBruto: 6848.66, pesoLiquido: 6848.66 },
        { itemIndex: 1, codigo: '5035900', descricao: 'COXA', quantidade: 330, unidade: 'CX', addressIds: [], pesoBruto: 6600, pesoLiquido: 6600 },
      ],
    }

    const resumo = resumirNfArmazenada(nf, [movLiquido(), saida])
    expect(resumo.pesoBruto).toBeCloseTo(27_794.92, 1)
    expect(resumo.pesoBrutoRestante).toBeCloseTo(13_897.46, 1)
    expect(resumo.pesoRestante).toBeCloseTo(13_448.66, 1)
  })
})
