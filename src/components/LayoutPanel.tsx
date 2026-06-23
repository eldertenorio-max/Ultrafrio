import { useEffect, useRef, useState } from 'react'
import {
  CAMARAS,
  NIVEIS,
  cellKind,
  formatAddressLabel,
  isClickable,
  makeAddressId,
  portaOverlayStyle,
  type CamaraConfig,
  type CellKind,
  type RuaConfig,
} from '../layout/camaras'
import type { AddressId, AddressOccupancy } from '../types'

const CELL_GAP = 2
const MIN_CELL = 28
const MAX_CELL = 58

type Props = {
  occupancy: Map<AddressId, AddressOccupancy>
  pendingSelection: Set<AddressId>
  activeNfNumero: string | null
  allocateMode: boolean
  editMode?: boolean
  editAddresses?: Set<AddressId>
  saidaAddresses?: Set<AddressId>
  saidaFlaggedAddresses?: Set<AddressId>
  onCellClick: (addressId: AddressId, clickable: boolean) => void
}

function computeCellSize(containerWidth: number, ruas: RuaConfig[]): number {
  if (containerWidth <= 0) return MIN_CELL

  const pad = 24
  const ruasGap = 16
  const labelArea = 30
  const maxCols = Math.max(...ruas.map((r) => r.colunas))
  const perRua = (containerWidth - pad - ruasGap * (ruas.length - 1)) / ruas.length - labelArea
  const size = Math.floor((perRua - (maxCols - 1) * CELL_GAP) / maxCols)

  return Math.min(MAX_CELL, Math.max(MIN_CELL, size))
}

function RuaGrid({
  camaraId,
  config,
  cellSize,
  occupancy,
  pendingSelection,
  allocateMode,
  editMode,
  editAddresses,
  saidaAddresses,
  saidaFlaggedAddresses,
  onCellClick,
}: {
  camaraId: number
  config: RuaConfig
  cellSize: number
} & Props) {
  const labelW = Math.max(22, Math.round(cellSize * 0.82))
  const headerH = Math.max(16, Math.round(cellSize * 0.72))
  const axisFont = cellSize >= 40 ? 11 : 10

  return (
    <div className="rua-block">
      <div className="rua-title">Rua {config.rua}</div>
      <div className="rua-grid-wrap" style={{ paddingTop: headerH + 4 }}>
        <div
          className="col-headers"
          style={{
            marginLeft: labelW + 6,
            gridTemplateColumns: `repeat(${config.colunas}, ${cellSize}px)`,
            gap: CELL_GAP,
          }}
        >
          {Array.from({ length: config.colunas }, (_, i) => (
            <span key={i} className="axis-label" style={{ width: cellSize, fontSize: axisFont }}>
              {i + 1}
            </span>
          ))}
        </div>

        <div className="rua-body">
          <div className="row-labels" style={{ width: labelW, gap: CELL_GAP }}>
            {NIVEIS.map((nivel) => (
              <span
                key={nivel}
                className="axis-label row-axis"
                style={{ height: cellSize, lineHeight: `${cellSize}px`, fontSize: axisFont }}
              >
                {nivel}
              </span>
            ))}
          </div>

          <div className="cells-area" style={{ position: 'relative' }}>
            <div className="cells-stack" style={{ gap: CELL_GAP }}>
              {NIVEIS.map((nivel) => (
                <div
                  key={nivel}
                  className="cells-row"
                  style={{
                    gridTemplateColumns: `repeat(${config.colunas}, ${cellSize}px)`,
                    gap: CELL_GAP,
                  }}
                >
                  {Array.from({ length: config.colunas }, (_, i) => {
                    const col = i + 1
                    const kind = cellKind(
                      col,
                      nivel,
                      config.colunas,
                      config.porta,
                      config.semNivel5Inexistente !== false,
                    )
                    const addressId = makeAddressId(camaraId, config.rua, nivel, col)
                    const occ = occupancy.get(addressId)
                    const pending = pendingSelection.has(addressId)
                    const clickable = isClickable(kind)

                    let className = `cell cell--${kind}`
                    if (occ) className += ' cell--ocupado'
                    if (pending) className += ' cell--selecionado'
                    if (editMode && editAddresses?.has(addressId) && !pending) className += ' cell--editar'
                    else if (saidaFlaggedAddresses?.has(addressId)) className += ' cell--saida-flag'
                    else if (saidaAddresses?.has(addressId)) className += ' cell--saida'
                    if (allocateMode && (clickable || pending)) className += ' cell--alocavel'

                    const title = cellTooltip(addressId, kind, occ, pending)

                    return (
                      <button
                        key={addressId}
                        type="button"
                        className={className}
                        style={{ width: cellSize, height: cellSize }}
                        disabled={!clickable && !occ && !pending}
                        title={title}
                        aria-label={title}
                        onClick={() => onCellClick(addressId, clickable || !!occ || pending)}
                      />
                    )
                  })}
                </div>
              ))}
            </div>

            {config.porta && (
              <div
                className="porta-label"
                style={{
                  ...portaOverlayStyle(config.porta, cellSize, CELL_GAP),
                  position: 'absolute',
                  fontSize: cellSize >= 36 ? 10 : 9,
                }}
              >
                PORTA
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function CamaraSection({ cam, ...props }: { cam: CamaraConfig } & Props) {
  const ref = useRef<HTMLElement>(null)
  const [cellSize, setCellSize] = useState(MIN_CELL)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const update = () => setCellSize(computeCellSize(el.clientWidth, cam.ruas))

    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [cam])

  return (
    <section ref={ref} className="camara-section">
      <header className="camara-header">
        <h2>Câmara {cam.id}</h2>
        <span>{cam.tipo}</span>
      </header>
      <div className="ruas-row">
        {cam.ruas.map((rua) => (
          <RuaGrid key={rua.rua} camaraId={cam.id} config={rua} cellSize={cellSize} {...props} />
        ))}
      </div>
    </section>
  )
}

function cellTooltip(
  addressId: AddressId,
  kind: CellKind,
  occ?: AddressOccupancy,
  pending?: boolean,
): string {
  const label = formatAddressLabel(addressId)
  if (occ) return `${label} — NF ${occ.nfNumero}`
  if (pending) return `${label} — Selecionado (clique para remover)`
  if (kind === 'porta') return `${label} — Porta`
  if (kind === 'sem-nivel5') return `${label} — Nível 5 inexistente`
  return `${label} — Disponível (clique para alocar)`
}

export function LayoutPanel(props: Props) {
  return (
    <div className="layout-panel">
      <div className="layout-legend">
        <span><i className="swatch swatch--disp" /> Disponível</span>
        <span><i className="swatch swatch--sel" /> Selecionando</span>
        <span><i className="swatch swatch--ocup" /> Ocupado</span>
        <span><i className="swatch swatch--saida" /> Saída (NF buscada)</span>
        <span><i className="swatch swatch--saida-flag" /> Item marcado p/ saída</span>
        <span><i className="swatch swatch--editar" /> NF em edição</span>
        <span><i className="swatch swatch--porta" /> Porta</span>
        <span><i className="swatch swatch--nv5" /> Nível 5 inexistente</span>
      </div>

      <div className="camaras-stack">
        {CAMARAS.map((cam) => (
          <CamaraSection key={cam.id} cam={cam} {...props} />
        ))}
      </div>

      {props.editMode && props.activeNfNumero && (
        <p className="layout-hint">
          Edição: clique nos quadrados para marcar ou desmarcar as novas posições do item — depois salve na barra lateral.
        </p>
      )}
      {props.allocateMode && !props.editMode && props.activeNfNumero && (
        <p className="layout-hint">
          Modo alocação: clique nos quadrados para marcar ou desmarcar endereços do item selecionado.
        </p>
      )}
      {props.saidaAddresses && props.saidaAddresses.size > 0 && (
        <p className="layout-hint">
          Saída: endereços laranja indicam onde retirar os itens da NF buscada.
        </p>
      )}
    </div>
  )
}
