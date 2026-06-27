import { useMemo, type CSSProperties } from 'react'
import { formatValorNfe } from '../lib/formatNfeItem'
import { calcularResumoEstoqueArmazem } from '../lib/painelEstoqueArmazem'
import type { NotaFiscal } from '../types'

type Props = {
  notas: NotaFiscal[]
}

export function PainelKpiCards({ notas }: Props) {
  const total = useMemo(() => calcularResumoEstoqueArmazem(notas).total, [notas])

  return (
    <div className="sidebar-block painel-kpi-block">
      <header className="painel-kpi-head">
        <h3>Resumo rápido</h3>
        <p className="muted">Indicadores consolidados do armazém</p>
      </header>
      <div className="painel-kpi-grid">
        <article className="painel-kpi painel-kpi--ocupacao">
          <div
            className="painel-kpi-ring"
            style={{ '--pct': `${Math.min(100, Math.max(0, total.ocupacaoPct))}` } as CSSProperties}
            aria-hidden
          >
            <span className="painel-kpi-ring-val">{total.ocupacaoPct.toFixed(1)}%</span>
          </div>
          <div className="painel-kpi-text">
            <strong>Ocupação</strong>
            <span>
              {total.posicoesOcupadas} / {total.posicoesTotal} posições
            </span>
          </div>
        </article>

        <article className="painel-kpi painel-kpi--valor">
          <span className="painel-kpi-icon" aria-hidden>
            R$
          </span>
          <div className="painel-kpi-text">
            <strong>Valor armazenado</strong>
            <span className="painel-kpi-metric">{formatValorNfe(total.valorTotalArmazenado)}</span>
          </div>
        </article>

        <article className="painel-kpi painel-kpi--paletes">
          <span className="painel-kpi-icon" aria-hidden>
            #
          </span>
          <div className="painel-kpi-text">
            <strong>Paletes no armazém</strong>
            <span className="painel-kpi-metric">{total.paletesArmazenados}</span>
          </div>
        </article>

        <article className="painel-kpi painel-kpi--livres">
          <span className="painel-kpi-icon" aria-hidden>
            ○
          </span>
          <div className="painel-kpi-text">
            <strong>Posições livres</strong>
            <span className="painel-kpi-metric">{total.posicoesLivres}</span>
          </div>
        </article>
      </div>
    </div>
  )
}
