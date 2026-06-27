import {
  categoriaGrafico,
  dadosGrafico,
  descricaoGrafico,
  graficoEstoqueAtual,
  tituloGrafico,
  tipoVisualGrafico,
  type PainelFiltros,
  type PainelGraficoId,
  type PainelSerie,
} from '../lib/painelAnalytics'
import type { MovimentoRegistro, NotaFiscal } from '../types'

const CATEGORIA_LABEL: Record<string, string> = {
  estoque: 'Estoque',
  movimentacao: 'Movimentação',
  operacao: 'Operação',
}

type Props = {
  id: PainelGraficoId
  filtros: PainelFiltros
  movimentos: MovimentoRegistro[]
  notas: NotaFiscal[]
  featured?: boolean
  onRemover?: () => void
}

export function PainelGraficoCard({
  id,
  filtros,
  movimentos,
  notas,
  featured,
  onRemover,
}: Props) {
  const series = dadosGrafico(id, movimentos, notas, filtros)
  const tipo = tipoVisualGrafico(id)
  const estoqueAtual = graficoEstoqueAtual(id)
  const categoria = categoriaGrafico(id)
  const total = series.reduce((s, x) => s + x.value, 0)
  const vazio = !estoqueAtual && total === 0
  const barMax = id === 'estoque-ocupacao' ? 100 : undefined

  return (
    <article
      className={`painel-grafico-card painel-grafico-card--${tipo}${featured ? ' painel-grafico-card--featured' : ''}`}
    >
      <header className="painel-grafico-head">
        <div className="painel-grafico-head-text">
          <span className={`painel-grafico-tag painel-grafico-tag--${categoria}`}>
            {CATEGORIA_LABEL[categoria]}
          </span>
          <h3>{tituloGrafico(id)}</h3>
          <p className="muted painel-grafico-desc">{descricaoGrafico(id)}</p>
        </div>
        {onRemover && (
          <button type="button" className="btn btn-ghost btn-sm painel-grafico-remove" onClick={onRemover}>
            Remover
          </button>
        )}
      </header>

      <div className="painel-grafico-body">
        {estoqueAtual && (
          <p className="painel-grafico-snapshot">
            <span className="painel-grafico-snapshot-dot" aria-hidden />
            Tempo real — não depende do período
          </p>
        )}
        {vazio ? (
          <div className="painel-grafico-vazio">
            <span className="painel-grafico-vazio-icon" aria-hidden>
              ∅
            </span>
            <p className="muted">
              {estoqueAtual ? 'Sem estoque registrado.' : 'Sem dados no período selecionado.'}
            </p>
          </div>
        ) : tipo === 'donut' ? (
          <DonutChart series={series} />
        ) : tipo === 'line' ? (
          <LineChart series={series} />
        ) : tipo === 'grouped-bar' ? (
          <GroupedBarChart series={series} />
        ) : (
          <BarChart series={series} horizontal maxScale={barMax} />
        )}
      </div>
    </article>
  )
}

function barGradient(color: string): string {
  return `linear-gradient(90deg, color-mix(in srgb, ${color} 85%, #fff), ${color})`
}

function BarChart({
  series,
  horizontal = false,
  maxScale,
}: {
  series: PainelSerie[]
  horizontal?: boolean
  maxScale?: number
}) {
  const max = maxScale ?? Math.max(...series.map((s) => s.value), 1)
  return (
    <ul className={`painel-bar-chart${horizontal ? ' painel-bar-chart--horizontal' : ''}`}>
      {series.map((s) => {
        const color = s.cor ?? '#6366f1'
        const isTotal = s.label === 'Total'
        return (
          <li key={s.label} className={isTotal ? 'painel-bar-row--total' : undefined}>
            <span className="painel-bar-label" title={s.label}>
              {s.label}
            </span>
            <div className="painel-bar-track">
              <div
                className="painel-bar-fill"
                style={{
                  width: `${(s.value / max) * 100}%`,
                  background: barGradient(color),
                  boxShadow: `0 0 12px color-mix(in srgb, ${color} 35%, transparent)`,
                }}
              />
            </div>
            <span className="painel-bar-val">{s.displayValue ?? s.value}</span>
          </li>
        )
      })}
    </ul>
  )
}

function GroupedBarChart({ series }: { series: PainelSerie[] }) {
  const dias = [...new Set(series.map((s) => s.label.split(' · ')[0]))]
  const max = Math.max(...series.map((s) => s.value), 1)

  return (
    <div className="painel-grouped-chart">
      <ul className="painel-grouped-legend">
        <li>
          <span className="painel-legend-swatch painel-legend-swatch--ent" /> Entrada
        </li>
        <li>
          <span className="painel-legend-swatch painel-legend-swatch--sai" /> Saída
        </li>
      </ul>
      <div className="painel-grouped-bars">
        {dias.map((dia) => {
          const ent = series.find((s) => s.label.startsWith(`${dia} · Ent`))?.value ?? 0
          const sai = series.find((s) => s.label.startsWith(`${dia} · Sai`))?.value ?? 0
          return (
            <div key={dia} className="painel-grouped-col" title={`${dia}: ${ent} entradas, ${sai} saídas`}>
              <div className="painel-grouped-pair">
                <div
                  className="painel-grouped-bar painel-grouped-bar--ent"
                  style={{ height: `${(ent / max) * 100}%` }}
                />
                <div
                  className="painel-grouped-bar painel-grouped-bar--sai"
                  style={{ height: `${(sai / max) * 100}%` }}
                />
              </div>
              <span className="painel-grouped-label">{dia}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function LineChart({ series }: { series: PainelSerie[] }) {
  if (series.length === 0) return null

  const max = Math.max(...series.map((s) => s.value), 1)
  const color = series[0]?.cor ?? '#6366f1'
  const w = 320
  const h = 100
  const padX = 8
  const padY = 12
  const innerW = w - padX * 2
  const innerH = h - padY * 2
  const step = series.length > 1 ? innerW / (series.length - 1) : 0

  const coords = series.map((s, i) => {
    const x = padX + (series.length === 1 ? innerW / 2 : i * step)
    const y = padY + innerH - (s.value / max) * innerH
    return { x, y, label: s.label, value: s.value }
  })

  const linePoints = coords.map((c) => `${c.x},${c.y}`).join(' ')
  const areaPoints = [
    `${padX},${padY + innerH}`,
    ...coords.map((c) => `${c.x},${c.y}`),
    `${padX + innerW},${padY + innerH}`,
  ].join(' ')

  const gridLines = [0.25, 0.5, 0.75].map((pct) => padY + innerH * (1 - pct))

  const labelStep = Math.max(1, Math.ceil(series.length / 5))

  return (
    <div className="painel-line-chart">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="painel-line-svg" aria-hidden>
        <defs>
          <linearGradient id="painelLineFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {gridLines.map((y, i) => (
          <line
            key={i}
            x1={padX}
            y1={y}
            x2={padX + innerW}
            y2={y}
            className="painel-line-grid"
          />
        ))}
        <polygon points={areaPoints} fill="url(#painelLineFill)" />
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          points={linePoints}
        />
        {coords.map((c) => (
          <circle
            key={c.label}
            cx={c.x}
            cy={c.y}
            r="3.5"
            fill="var(--bg-elevated)"
            stroke={color}
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      <ul className="painel-line-labels">
        {series.filter((_, i) => i % labelStep === 0 || i === series.length - 1).map((s) => (
          <li key={s.label}>{s.label}</li>
        ))}
      </ul>
    </div>
  )
}

function DonutChart({ series }: { series: PainelSerie[] }) {
  const total = series.reduce((s, x) => s + x.value, 0) || 1
  let acc = 0
  const stops = series.map((s) => {
    const start = (acc / total) * 100
    acc += s.value
    const end = (acc / total) * 100
    return `${s.cor ?? '#888'} ${start}% ${end}%`
  })

  return (
    <div className="painel-donut-wrap">
      <div
        className="painel-donut"
        style={{ background: `conic-gradient(${stops.join(', ')})` }}
        aria-hidden
      >
        <div className="painel-donut-hole">
          <strong>{total}</strong>
          <span>total</span>
        </div>
      </div>
      <ul className="painel-donut-legend">
        {series.map((s) => (
          <li key={s.label}>
            <span className="painel-legend-swatch" style={{ background: s.cor }} />
            <span className="painel-donut-legend-label">{s.label}</span>
            <strong className="painel-donut-legend-val">{s.value}</strong>
          </li>
        ))}
      </ul>
    </div>
  )
}
