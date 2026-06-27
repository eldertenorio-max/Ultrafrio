import { useMemo } from 'react'
import {
  PAINEL_SECOES,
  filtrarMovimentos,
  resumoPeriodo,
  type PainelFiltros,
} from '../lib/painelAnalytics'
import type { MovimentoRegistro, NotaFiscal } from '../types'
import { PainelGraficoCard } from './PainelGraficoCard'
import { PainelKpiCards } from './PainelKpiCards'

type Props = {
  filtros: PainelFiltros
  movimentos: MovimentoRegistro[]
  notas: NotaFiscal[]
  onFiltrosChange: (patch: Partial<PainelFiltros>) => void
}

export function PainelPanel({ filtros, movimentos, notas, onFiltrosChange }: Props) {
  const filtrados = useMemo(() => filtrarMovimentos(movimentos, filtros), [movimentos, filtros])
  const resumo = resumoPeriodo(filtros, filtrados.length)

  return (
    <>
      <div className="sidebar-block painel-header-block">
        <header className="painel-page-head">
          <h3 className="painel-page-title">Painel analítico</h3>
          <p className="muted painel-intro">
            Visão consolidada do estoque e da movimentação. Ajuste o período para refinar os gráficos
            históricos.
          </p>
        </header>

        <fieldset className="painel-filtros">
          <legend className="painel-filtros-title">Período de análise</legend>
          <div className="painel-filtros-grid">
            <label className="painel-filtro-campo">
              <span>Data início</span>
              <input
                type="date"
                className="input-nf"
                value={filtros.dataInicio}
                onChange={(e) => onFiltrosChange({ dataInicio: e.target.value })}
              />
            </label>
            <label className="painel-filtro-campo">
              <span>Hora início</span>
              <input
                type="time"
                className="input-nf"
                value={filtros.horaInicio}
                onChange={(e) => onFiltrosChange({ horaInicio: e.target.value })}
              />
            </label>
            <label className="painel-filtro-campo">
              <span>Data fim</span>
              <input
                type="date"
                className="input-nf"
                value={filtros.dataFim}
                onChange={(e) => onFiltrosChange({ dataFim: e.target.value })}
              />
            </label>
            <label className="painel-filtro-campo">
              <span>Hora fim</span>
              <input
                type="time"
                className="input-nf"
                value={filtros.horaFim}
                onChange={(e) => onFiltrosChange({ horaFim: e.target.value })}
              />
            </label>
          </div>
        </fieldset>

        <p className="painel-resumo-badge">{resumo}</p>
      </div>

      <PainelKpiCards notas={notas} />

      {PAINEL_SECOES.map((secao) => (
        <section key={secao.id} className="sidebar-block painel-secao">
          <header className={`painel-secao-head painel-secao-head--${secao.id}`}>
            <span className="painel-secao-accent" aria-hidden />
            <div>
              <h3 className="painel-secao-title">{secao.titulo}</h3>
              <p className="muted painel-secao-sub">{secao.subtitulo}</p>
            </div>
          </header>
          <div className="painel-secao-graficos">
            {secao.graficos.map((id) => (
              <PainelGraficoCard
                key={id}
                id={id}
                filtros={filtros}
                movimentos={movimentos}
                notas={notas}
                featured={id === 'estoque-ocupacao'}
              />
            ))}
          </div>
        </section>
      ))}
    </>
  )
}
