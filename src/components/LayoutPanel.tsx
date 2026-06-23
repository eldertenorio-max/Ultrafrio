import {
  CAMARAS,
  NIVEIS,
  cellKind,
  isClickable,
  makeAddressId,
  portaOverlayStyle,
  type RuaConfig,
} from '../layout/camaras'
import type { AddressId, AddressOccupancy } from '../types'

type Props = {
  occupancy: Map<AddressId, AddressOccupancy>
  pendingSelection: Set<AddressId>
  activeNfNumero: string | null
  allocateMode: boolean
  onCellClick: (addressId: AddressId, clickable: boolean) => void
}

function RuaGrid({
  camaraId,
  config,
  occupancy,
  pendingSelection,
  allocateMode,
  onCellClick,
}: {
  camaraId: number
  config: RuaConfig
} & Props) {
  const cell = 28
  const gap = 2
  const labelW = 24
  const headerH = 20
  const leftPad = 6

  return (
    <div className="rua-block">
      <div className="rua-title">Rua {config.rua}</div>
      <div className="rua-grid-wrap" style={{ paddingTop: headerH + 4 }}>
        <div className="col-headers" style={{ marginLeft: labelW + leftPad }}>
          {Array.from({ length: config.colunas }, (_, i) => (
            <span key={i} className="axis-label">
              {i + 1}
            </span>
          ))}
        </div>

        <div className="rua-body">
          <div className="row-labels">
            {NIVEIS.map((nivel) => (
              <span key={nivel} className="axis-label row-axis">
                {nivel}
              </span>
            ))}
          </div>

          <div className="cells-area" style={{ position: 'relative' }}>
            <div className="cells-stack">
              {NIVEIS.map((nivel) => (
                <div
                  key={nivel}
                  className="cells-row"
                  style={{ gridTemplateColumns: `repeat(${config.colunas}, ${cell}px)` }}
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
                    if (allocateMode && clickable && !occ) className += ' cell--alocavel'

                    return (
                      <button
                        key={addressId}
                        type="button"
                        className={className}
                        style={{ width: cell, height: cell }}
                        disabled={!clickable && !occ}
                        title={occ ? `NF ${occ.nfNumero}` : formatTitle(kind)}
                        onClick={() => onCellClick(addressId, clickable || !!occ)}
                      >
                        {occ && <span className="cell-nf">{occ.nfNumero}</span>}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>

            {config.porta && (
              <div
                className="porta-label"
                style={{
                  ...portaOverlayStyle(config.porta, cell, gap),
                  position: 'absolute',
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

function formatTitle(kind: string): string {
  if (kind === 'porta') return 'Porta'
  if (kind === 'sem-nivel5') return 'Nível 5 inexistente'
  return 'Disponível — clique para alocar'
}

export function LayoutPanel(props: Props) {
  return (
    <div className="layout-panel">
      <div className="layout-legend">
        <span><i className="swatch swatch--disp" /> Disponível</span>
        <span><i className="swatch swatch--sel" /> Selecionando</span>
        <span><i className="swatch swatch--ocup" /> Ocupado (NF)</span>
        <span><i className="swatch swatch--porta" /> Porta</span>
        <span><i className="swatch swatch--nv5" /> Nível 5 inexistente</span>
      </div>

      {CAMARAS.map((cam) => (
        <section key={cam.id} className="camara-section">
          <header className="camara-header">
            <h2>Câmara {cam.id}</h2>
            <span>{cam.tipo}</span>
          </header>
          <div className="ruas-row">
            {cam.ruas.map((rua) => (
              <RuaGrid key={rua.rua} camaraId={cam.id} config={rua} {...props} />
            ))}
          </div>
        </section>
      ))}

      {props.allocateMode && props.activeNfNumero && (
        <p className="layout-hint">
          Modo alocação: clique nos quadrados azuis para marcar endereços do item selecionado.
        </p>
      )}
    </div>
  )
}
