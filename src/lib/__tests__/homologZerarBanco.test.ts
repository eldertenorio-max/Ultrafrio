import { describe, expect, it, vi, afterEach } from 'vitest'
import * as ambiente from '../appAmbiente'
import { podeZerarBancoHomologacao } from '../homologZerarBanco'

describe('podeZerarBancoHomologacao', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('permite somente em homologação', () => {
    vi.spyOn(ambiente, 'isHomologacao').mockReturnValue(true)
    vi.spyOn(ambiente, 'isProducao').mockReturnValue(false)
    expect(podeZerarBancoHomologacao()).toBe(true)
  })

  it('bloqueia em produção', () => {
    vi.spyOn(ambiente, 'isHomologacao').mockReturnValue(false)
    vi.spyOn(ambiente, 'isProducao').mockReturnValue(true)
    expect(podeZerarBancoHomologacao()).toBe(false)
  })

  it('bloqueia quando ambiente não é homolog', () => {
    vi.spyOn(ambiente, 'isHomologacao').mockReturnValue(false)
    vi.spyOn(ambiente, 'isProducao').mockReturnValue(false)
    expect(podeZerarBancoHomologacao()).toBe(false)
  })
})
