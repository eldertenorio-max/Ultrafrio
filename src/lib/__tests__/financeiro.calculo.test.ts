import { describe, expect, it } from 'vitest'
import {
  calcularCobrancaDetalhada,
  dataNoPeriodoCobranca,
  debitosSaidaPeriodo,
  saidasNoPeriodoCobranca,
  valorAcumuladoArmazenagem,
  valorCobrancaPeriodo,
  valorDiariaPorKilo,
  type ResumoNfArmazenada,
} from '../financeiro/calculo'
import type { ContratoCliente, TabelaCobranca } from '../financeiro/types'

const tabelaBase = (): TabelaCobranca => ({
  id: 't1',
  nome: 'Padrão',
  custoPosicaoPalete: 10,
  custoPorKilo: 0.05,
  custoPorPalete: 15,
  custoEntrada: 50,
  custoSaida: 30,
  criadoEm: '2026-01-01T00:00:00.000Z',
})

const contratoBase = (overrides: Partial<ContratoCliente> = {}): ContratoCliente => ({
  id: 'c1',
  cnpj: '12345678000199',
  razaoSocial: 'Cliente Teste',
  tabelaId: 't1',
  ciclo: 'mensal',
  regraTempo: 'proporcional',
  cobrarPosicaoPalete: false,
  cobrarKilo: false,
  cobrarPalete: true,
  cobrarEntrada: true,
  cobrarSaida: false,
  kiloPorDia: false,
  ativo: true,
  criadoEm: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

const resumoNf = (overrides: Partial<ResumoNfArmazenada> = {}): ResumoNfArmazenada => ({
  nfId: 'nf1',
  nfNumero: '206658',
  emitente: 'ASTRAPLUS',
  dataEntrada: '2026-07-05',
  dataSaida: null,
  diasArmazenados: 1,
  pesoBruto: 27500,
  pesoBrutoRestante: 27500,
  pesoLiquido: 23500,
  pesoEntrada: 23500,
  pesoRestante: 23500,
  pesoSaido: 0,
  saidas: [],
  totalItens: 1,
  totalCaixas: 0,
  totalPaletes: 20,
  valorMercadoria: 0,
  status: 'armazenada',
  ...overrides,
})

describe('valorDiariaPorKilo', () => {
  it('exemplo ASTRAPLUS: 27794,92 kg × R$0,18 ÷ 30 = R$166,76/dia', () => {
    expect(valorDiariaPorKilo(27_794.92, 0.18, 'mensal')).toBe(166.76)
  })

  it('usa divisor 15 no ciclo quinzenal', () => {
    expect(valorDiariaPorKilo(3000, 0.3, 'quinzenal')).toBe(60)
  })
})

describe('valorAcumuladoArmazenagem e valorCobrancaPeriodo', () => {
  it('125 dias × R$166,76 = R$20.845,00', () => {
    expect(valorAcumuladoArmazenagem(125, 166.76)).toBe(20_845)
  })

  it('6 dias do período × R$166,76 = R$1.000,56', () => {
    expect(valorCobrancaPeriodo(6, 166.76)).toBe(1000.56)
  })
})

describe('calcularCobrancaDetalhada', () => {
  it('cobra palete proporcional ao ciclo mensal (1 dia = 1/30)', () => {
    const cobranca = calcularCobrancaDetalhada(resumoNf(), contratoBase(), tabelaBase(), {
      posicoes: 20,
      pesoBase: 23500,
      paletes: 20,
    })

    expect(cobranca.totalRecorrente).toBeCloseTo(20 * 15 * (1 / 30), 4)
    expect(cobranca.valorDiaria).toBeCloseTo(cobranca.totalRecorrente, 4)
    expect(cobranca.valorVigente).toBeCloseTo(cobranca.valorDiaria, 4)
    expect(cobranca.total).toBeCloseTo(cobranca.totalRecorrente + 50, 4)
  })

  it('kilo: diaria por peso bruto e acumulado = dias × diaria (exemplo NF 211264)', () => {
    const pesoBruto = 27_794.92
    const dias = 125
    const diaria = valorDiariaPorKilo(pesoBruto, 0.18, 'mensal')

    const cobranca = calcularCobrancaDetalhada(
      resumoNf({
        diasArmazenados: dias,
        pesoEntrada: 26_897.32,
        pesoBruto,
        pesoBrutoRestante: pesoBruto,
        pesoLiquido: 26_897.32,
        pesoRestante: 26_897.32,
      }),
      contratoBase({ cobrarPalete: false, cobrarKilo: true, cobrarEntrada: false, kiloPorDia: true }),
      { ...tabelaBase(), custoPorKilo: 0.18 },
      { posicoes: 0, pesoBase: 26_897.32, paletes: 0 },
    )

    expect(diaria).toBe(166.76)
    expect(cobranca.valorDiaria).toBe(166.76)
    expect(cobranca.valorVigente).toBe(20_845)
    expect(cobranca.detalhes[0]?.valor).toBe(20_845)
    expect(cobranca.total).toBe(20_845)
    expect(valorCobrancaPeriodo(6, diaria)).toBe(1000.56)
  })

  it('kilo após saída parcial: diária sobre peso bruto restante (bruto − saída)', () => {
    const pesoBrutoEntrada = 27_794.92
    const pesoBrutoRestante = 13_897.46
    const diaria = valorDiariaPorKilo(pesoBrutoRestante, 0.18, 'mensal')

    const cobranca = calcularCobrancaDetalhada(
      resumoNf({
        pesoBruto: pesoBrutoEntrada,
        pesoBrutoRestante,
        pesoEntrada: 13_448.66,
        pesoLiquido: 13_448.66,
        pesoRestante: 13_448.66,
        pesoSaido: 13_448.66,
      }),
      contratoBase({ cobrarPalete: false, cobrarKilo: true, cobrarEntrada: false, kiloPorDia: true }),
      { ...tabelaBase(), custoPorKilo: 0.18 },
      { posicoes: 0, pesoBase: 13_448.66, paletes: 0 },
    )

    expect(diaria).toBe(83.38)
    expect(cobranca.valorDiaria).toBe(83.38)
    expect(valorCobrancaPeriodo(6, diaria)).toBe(500.28)
  })

  it('cobra posição de palete quando habilitado no contrato', () => {
    const cobranca = calcularCobrancaDetalhada(
      resumoNf(),
      contratoBase({ cobrarPalete: false, cobrarPosicaoPalete: true, cobrarEntrada: false }),
      tabelaBase(),
      { posicoes: 25, pesoBase: 0, paletes: 0 },
    )

    expect(cobranca.totalRecorrente).toBeCloseTo(25 * 10 * (1 / 30), 4)
    expect(cobranca.valorDiaria).toBeGreaterThan(0)
  })

  it('retorna zero sem contrato ou tabela', () => {
    const cobranca = calcularCobrancaDetalhada(resumoNf(), null, null, {
      posicoes: 20,
      pesoBase: 23500,
      paletes: 20,
    })

    expect(cobranca.valorDiaria).toBe(0)
    expect(cobranca.valorVigente).toBe(0)
  })
})

describe('debitosSaidaPeriodo', () => {
  const saidas = [
    { id: 's1', data: '2026-07-03T10:00:00.000Z', nfSaidaNumero: '100', pesoSaida: 1000, caixasSaida: 10, paletesSaida: 1 },
    { id: 's2', data: '2026-07-15T10:00:00.000Z', nfSaidaNumero: '101', pesoSaida: 500, caixasSaida: 5, paletesSaida: 1 },
  ]

  it('cobra custo de saída por registro dentro do período', () => {
    const contrato = contratoBase({ cobrarSaida: true })
    const tabela = { ...tabelaBase(), custoSaida: 30 }
    expect(debitosSaidaPeriodo(saidas, '2026-07-01', '2026-07-06', contrato, tabela)).toBe(30)
    expect(saidasNoPeriodoCobranca(saidas, '2026-07-01', '2026-07-31')).toHaveLength(2)
  })

  it('retorna zero sem cobrança de saída no contrato', () => {
    expect(debitosSaidaPeriodo(saidas, '2026-07-01', '2026-07-31', contratoBase(), tabelaBase())).toBe(0)
  })

  it('dataNoPeriodoCobranca respeita intervalo inclusivo', () => {
    expect(dataNoPeriodoCobranca('2026-07-06T23:59:00.000Z', '2026-07-01', '2026-07-06')).toBe(true)
    expect(dataNoPeriodoCobranca('2026-06-30', '2026-07-01', '2026-07-06')).toBe(false)
  })
})
