import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
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
import { useIsMobile } from '../hooks/useIsMobile'

const CELL_GAP = 0
const MIN_CELL = 28
const MAX_CELL = 58
const MOBILE_MIN_CELL = 20
const MOBILE_MAX_CELL = 34

type Props = {
  occupancy: Map<AddressId, AddressOccupancy>
  pendingSelection: Set<AddressId>
  activeNfNumero: string | null
  activeNfId?: string | null
  allocateMode: boolean
  editMode?: boolean
  editAddresses?: Set<AddressId>
  saidaAddresses?: Set<AddressId>
  saidaFlaggedAddresses?: Set<AddressId>
  paintMode?: boolean
  onCellClick: (addressId: AddressId, clickable: boolean) => void
  onCellPaint: (addressId: AddressId, mode: 'add' | 'remove', canInteract: boolean) => void
}

function computeCellSize(containerWidth: number, ruas: RuaConfig[], mobile: boolean): number {
  if (containerWidth <= 0) return mobile ? MOBILE_MIN_CELL : MIN_CELL

  const pad = mobile ? 8 : 24
  const labelArea = mobile ? 26 : 30
  const maxCols = Math.max(...ruas.map((r) => r.colunas))
  /** Largura total para uma rua — a outra fica na rolagem horizontal. */
  const perRua = containerWidth - pad - labelArea
  const size = Math.floor((perRua - (maxCols - 1) * CELL_GAP) / maxCols)
  const min = mobile ? MOBILE_MIN_CELL : MIN_CELL
  const max = mobile ? MOBILE_MAX_CELL : MAX_CELL

  return Math.min(max, Math.max(min, size))
}

type PaintController = {
  handlePointerDown: (
    addressId: AddressId,
    canInteract: boolean,
    pending: boolean,
    e: ReactPointerEvent<HTMLButtonElement>,
  ) => void
  handlePointerEnter: (addressId: AddressId, canInteract: boolean) => void
}

function useCellPaint(
  paintMode: boolean,
  onCellPaint: Props['onCellPaint'],
  onCellClick: Props['onCellClick'],
): PaintController {
  const paintDragRef = useRef<{ active: boolean; mode: 'add' | 'remove' | null }>({
    active: false,
    mode: null,
  })
  const paintedRef = useRef(new Set<AddressId>())

  useEffect(() => {
    if (!paintMode) return

    function stopPaint() {
      paintDragRef.current = { active: false, mode: null }
      paintedRef.current.clear()
    }

    window.addEventListener('pointerup', stopPaint)
    window.addEventListener('pointercancel', stopPaint)
    return () => {
      window.removeEventListener('pointerup', stopPaint)
      window.removeEventListener('pointercancel', stopPaint)
    }
  }, [paintMode])

  const applyPaint = useCallback(
    (addressId: AddressId, mode: 'add' | 'remove', canInteract: boolean) => {
      if (!canInteract || paintedRef.current.has(addressId)) return
      paintedRef.current.add(addressId)
      onCellPaint(addressId, mode, canInteract)
    },
    [onCellPaint],
  )

  const handlePointerDown = useCallback(
    (
      addressId: AddressId,
      canInteract: boolean,
      pending: boolean,
      e: ReactPointerEvent<HTMLButtonElement>,
    ) => {
      if (!paintMode) {
        onCellClick(addressId, canInteract)
        return
      }
      if (!canInteract) return

      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)

      const mode: 'add' | 'remove' = pending ? 'remove' : 'add'
      paintDragRef.current = { active: true, mode }
      paintedRef.current.clear()
      applyPaint(addressId, mode, canInteract)
    },
    [applyPaint, onCellClick, paintMode],
  )

  const handlePointerEnter = useCallback(
    (addressId: AddressId, canInteract: boolean) => {
      if (!paintMode || !paintDragRef.current.active || !paintDragRef.current.mode) return
      applyPaint(addressId, paintDragRef.current.mode, canInteract)
    },
    [applyPaint, paintMode],
  )

  return { handlePointerDown, handlePointerEnter }
}

function RuaGrid({
  camaraId,
  config,
  cellSize,
  mobile,
  occupancy,
  pendingSelection,
  allocateMode,
  editMode,
  editAddresses,
  saidaAddresses,
  saidaFlaggedAddresses,
  activeNfId,
  paintMode,
  paint,
}: {
  camaraId: number
  config: RuaConfig
  cellSize: number
  mobile: boolean
  paint: PaintController
} & Props) {
  const labelW = Math.max(mobile ? 20 : 22, Math.round(cellSize * 0.82))
  const headerH = Math.max(14, Math.round(cellSize * 0.72))
  const axisFont = cellSize >= 36 ? 11 : 9
  const gridWidth = labelW + 6 + config.colunas * cellSize + (config.colunas - 1) * CELL_GAP

  return (
    <div className="rua-block">
      <div className="rua-title">Rua {config.rua}</div>
      <div className="rua-grid-scroll">
        <div className="rua-grid-inner" style={{ minWidth: gridWidth }}>
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
                      config.colunasBloqueadas,
                      config.celulasBloqueadas,
                    )
                    const addressId = makeAddressId(camaraId, config.rua, nivel, col)
                    const occ = occupancy.get(addressId)
                    const pending = pendingSelection.has(addressId)
                    const clickable = isClickable(kind)

                    let className = `cell cell--${kind}`
                    const confirmed =
                      !!occ &&
                      !pending &&
                      allocateMode &&
                      !editMode &&
                      !!activeNfId &&
                      occ.nfId === activeNfId
                    if (occ) className += ' cell--ocupado'
                    if (pending) className += ' cell--selecionado'
                    else if (confirmed) className += ' cell--confirmado'
                    if (editAddresses?.has(addressId) && !pending) className += ' cell--editar'
                    else if (saidaFlaggedAddresses?.has(addressId)) className += ' cell--saida-flag'
                    else if (saidaAddresses?.has(addressId)) className += ' cell--saida'
                    if (allocateMode && (clickable || pending)) className += ' cell--alocavel'
                    if (paintMode && (clickable || pending)) className += ' cell--pintavel'

                    const title = cellTooltip(addressId, kind, allocateMode, occ, pending)
                    const canInteract = !!occ || pending || (allocateMode && clickable)

                    return (
                      <button
                        key={addressId}
                        type="button"
                        className={className}
                        style={{ width: cellSize, height: cellSize }}
                        disabled={!canInteract}
                        title={title}
                        aria-label={title}
                        onPointerDown={(e) => paint.handlePointerDown(addressId, canInteract, pending, e)}
                        onPointerEnter={() => paint.handlePointerEnter(addressId, canInteract)}
                      >
                        {occ && (
                          <span
                            className="cell-nf"
                            style={{ fontSize: cellNfFontSize(cellSize) }}
                          >
                            {cellNfLabel(occ.nfNumero, cellSize)}
                          </span>
                        )}
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
      </div>
    </div>
  )
}

function CamaraSection({
  cam,
  mobile,
  paint,
  ...props
}: { cam: CamaraConfig; mobile: boolean; paint: PaintController } & Props) {
  const ref = useRef<HTMLElement>(null)
  const [cellSize, setCellSize] = useState(mobile ? MOBILE_MIN_CELL : MIN_CELL)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const update = () => setCellSize(computeCellSize(el.clientWidth, cam.ruas, mobile))

    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [cam, mobile])

  return (
    <section ref={ref} className="camara-section">
      <header className="camara-header">
        <h2>Câmara {cam.id}</h2>
        <span>{cam.tipo}</span>
      </header>
      <div className={`ruas-row ${mobile ? 'ruas-row--stacked' : ''}`}>
        {cam.ruas.map((rua) => (
          <RuaGrid
            key={rua.rua}
            camaraId={cam.id}
            config={rua}
            cellSize={cellSize}
            mobile={mobile}
            paint={paint}
            {...props}
          />
        ))}
      </div>
    </section>
  )
}

function cellNfFontSize(cellSize: number): number {
  if (cellSize >= 48) return 13
  if (cellSize >= 36) return 12
  if (cellSize >= 28) return 10
  return 9
}

function cellNfLabel(numero: string, cellSize: number): string {
  if (cellSize >= 36) return numero
  if (cellSize >= 28) return numero.length > 6 ? numero.slice(-6) : numero
  return numero.length > 4 ? numero.slice(-4) : numero
}

function cellTooltip(
  addressId: AddressId,
  kind: CellKind,
  allocateMode: boolean,
  occ?: AddressOccupancy,
  pending?: boolean,
): string {
  const label = formatAddressLabel(addressId)
  if (pending) return `${label} — Selecionando (clique para remover)`
  if (occ) return `${label} — NF ${occ.nfNumero} (confirmado)`
  if (kind === 'porta') return `${label} — Porta`
  if (kind === 'bloqueado') return `${label} — Indisponível`
  if (kind === 'sem-nivel5') return `${label} — Nível 5 inexistente`
  if (allocateMode) return `${label} — Disponível (clique para selecionar)`
  return `${label} — Disponível`
}

export function LayoutPanel(props: Props) {
  const mobile = useIsMobile()
  const paintMode = props.paintMode ?? false
  const paint = useCellPaint(paintMode, props.onCellPaint, props.onCellClick)

  return (
    <div className={`layout-panel ${mobile ? 'layout-panel--mobile' : ''} ${paintMode ? 'layout-panel--paint' : ''}`}>
      <div className="layout-legend">
        <span><i className="swatch swatch--disp" /> Disponível</span>
        <span><i className="swatch swatch--sel" /> Selecionando</span>
        <span><i className="swatch swatch--confirm" /> Confirmado</span>
        <span><i className="swatch swatch--ocup" /> Ocupado (outras NF)</span>
        <span><i className="swatch swatch--saida" /> Saída (NF buscada)</span>
        <span><i className="swatch swatch--saida-flag" /> Item marcado p/ saída</span>
        <span><i className="swatch swatch--editar" /> Movimentação (NF buscada)</span>
        <span><i className="swatch swatch--porta" /> Porta</span>
        <span><i className="swatch swatch--nv5" /> Nível 5 inexistente</span>
      </div>

      <div className="camaras-stack">
        {CAMARAS.map((cam) => (
          <CamaraSection key={cam.id} cam={cam} mobile={mobile} paint={paint} {...props} />
        ))}
      </div>

      {props.editMode && props.activeNfNumero && (
        <p className="layout-hint">
          Edição: clique ou arraste no painel para marcar ou desmarcar posições — depois salve na barra lateral.
        </p>
      )}
      {props.editAddresses && props.editAddresses.size > 0 && !props.editMode && (
        <p className="layout-hint">
          Movimentação: endereços roxos indicam onde a NF buscada está armazenada. Selecione um item na barra lateral para editar.
        </p>
      )}
      {props.allocateMode && !props.editMode && props.activeNfNumero && (
        <p className="layout-hint">
          Modo alocação: clique ou arraste nos quadrados para marcar ou desmarcar endereços do item.
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
