import { describe, expect, it } from 'vitest'
import { resolverQuantidadeComercialNfe } from '../nfeUnidades'

describe('resolverQuantidadeComercialNfe', () => {
  it('converte peso KG + qTrib=660 (uTrib=KG) para 660 CX — frango CX VAR', () => {
    const r = resolverQuantidadeComercialNfe({
      qCom: 13697.32,
      uCom: 'KG',
      qTrib: 660,
      uTrib: 'KG',
      descricao: '9369 - FRANGO CONG PCT CX VAR STA CEC',
    })
    expect(r).toEqual({ quantidade: 660, unidade: 'CX' })
  })

  it('converte peso KG + CX20KG na descrição para 660 CX', () => {
    const r = resolverQuantidadeComercialNfe({
      qCom: 13200,
      uCom: 'KG',
      qTrib: 660,
      uTrib: 'KG',
      descricao: '9140 - COXA E SOBRECOXA CARNE FGO CON PCT CX20KG STA CEC',
    })
    expect(r).toEqual({ quantidade: 660, unidade: 'CX' })
  })
})
