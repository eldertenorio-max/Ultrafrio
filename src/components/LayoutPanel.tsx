import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  CAMARAS,
  NIVEIS,
  cellKind,
  formatAddressLabel,
  isClickable,
  makeAddressId,
  portaCellBackgroundStyle,
  portaCellEdgeClasses,
  type CamaraConfig,
  type CellKind,
  type RuaConfig,
} from '../layout/camaras'
import { portaCamaraUrl } from '../lib/portaCamaraAsset'
import { codigoProdutoExibicao } from '../lib/codigoProduto'
import type { AddressId, AddressOccupancy, NotaFiscal } from '../types'
import { useIsMobile } from '../hooks/useIsMobile'
import { calcularResumoEstoqueArmazem } from '../lib/painelEstoqueArmazem'
import { CamaraStatsCards } from './CamaraStatsCards'
import { StageSection } from './StageSection'

const CELL_GAP = 0
const MIN_CELL = 28
const MAX_CELL = 58
const MOBILE_MIN_CELL = 14
const MOBILE_MAX_CELL = 22

type Props = {
  occupancy: Map<AddressId, AddressOccupancy>
  pendingSelection: Set<AddressId>
  activeNfNumero: string | null
  activeNfId?: string | null
  allocateMode: boolean
  editMode?: boolean
  /** Item selecionado na movimentação (reposicionar / stage). */
  editItemAtivo?: boolean
  editAddresses?: Set<AddressId>
  editMoveOrigens?: Set<AddressId>
  editMoveDestinos?: Set<AddressId>
  editMarcandoStage?: boolean
  /** Modo de marcar posições novas no armazém (adicionar paletes ao item). */
  editAdicionandoPosicoes?: boolean
  saidaAddresses?: Set<AddressId>
  saidaItemDestaqueAddresses?: Set<AddressId>
  saidaFlaggedAddresses?: Set<AddressId>
  consultaAddresses?: Set<AddressId>
  paintMode?: boolean
  onCellClick: (addressId: AddressId, clickable: boolean) => void
  onCellPaint: (addressId: AddressId, mode: 'add' | 'remove', canInteract: boolean) => void
  paletesRestantes?: number | null
  paletesTotal?: number | null
  saidaMode?: boolean
  notas?: NotaFiscal[]
  stageHighlighted?: boolean
  onStageOpen?: () => void
  editStagePending?: Set<AddressId>
  stageDropEnabled?: boolean
  onStageDrop?: () => void
  /** Endereço selecionado na lista (ex.: origem por voz) — destaca e rola até o quadrado no mapa. */
  focusAddressId?: AddressId | null
  /** Rola até o stage (consulta / busca de NF). */
  focusStage?: boolean
  /** Incrementa para repetir scroll ao mesmo endereço. */
  focusScrollToken?: number
  /** Pulsa o quadrado focado após busca. */
  pulseAddressId?: AddressId | null
}

function rowLabelWidth(cellSize: number, mobile: boolean): number {
  return Math.max(mobile ? 18 : 22, Math.round(cellSize * 0.82))
}

function gridContentWidth(cellSize: number, colunas: number, mobile: boolean): number {
  const labelW = rowLabelWidth(cellSize, mobile)
  return labelW + 6 + colunas * cellSize + (colunas - 1) * CELL_GAP
}

function computeCellSize(containerWidth: number, ruas: RuaConfig[], mobile: boolean): number {
  if (containerWidth <= 0) return mobile ? MOBILE_MIN_CELL : MIN_CELL

  const maxCols = Math.max(...ruas.map((r) => r.colunas))

  if (mobile) {
    const sectionPad = 16
    const available = Math.min(containerWidth, window.innerWidth) - sectionPad
    for (let size = MOBILE_MAX_CELL; size >= MOBILE_MIN_CELL; size--) {
      if (gridContentWidth(size, maxCols, true) <= available) return size
    }
    return MOBILE_MIN_CELL
  }

  const pad = 24
  const labelArea = 30
  /** Largura total para uma rua — a outra fica na rolagem horizontal. */
  const perRua = containerWidth - pad - labelArea
  const size = Math.floor((perRua - (maxCols - 1) * CELL_GAP) / maxCols)

  return Math.min(MAX_CELL, Math.max(MIN_CELL, size))
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
  const moveCleanupRef = useRef<(() => void) | null>(null)

  const stopPaint = useCallback(() => {
    paintDragRef.current = { active: false, mode: null }
    paintedRef.current.clear()
    moveCleanupRef.current?.()
    moveCleanupRef.current = null
  }, [])

  useEffect(() => {
    if (!paintMode) return
    window.addEventListener('pointerup', stopPaint)
    window.addEventListener('pointercancel', stopPaint)
    return () => {
      window.removeEventListener('pointerup', stopPaint)
      window.removeEventListener('pointercancel', stopPaint)
      stopPaint()
    }
  }, [paintMode, stopPaint])

  const applyPaint = useCallback(
    (addressId: AddressId, mode: 'add' | 'remove', canInteract: boolean) => {
      if (!canInteract || paintedRef.current.has(addressId)) return
      paintedRef.current.add(addressId)
      onCellPaint(addressId, mode, canInteract)
    },
    [onCellPaint],
  )

  const paintCellUnderPointer = useCallback(
    (clientX: number, clientY: number, mode: 'add' | 'remove') => {
      const el = document.elementFromPoint(clientX, clientY)?.closest('[data-address-id]')
      if (!(el instanceof HTMLElement)) return
      const id = el.dataset.addressId as AddressId | undefined
      if (!id) return
      const canInteract = el.dataset.canInteract === 'true'
      applyPaint(id, mode, canInteract)
    },
    [applyPaint],
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

      const mode: 'add' | 'remove' = pending ? 'remove' : 'add'
      paintDragRef.current = { active: true, mode }
      paintedRef.current.clear()
      applyPaint(addressId, mode, canInteract)

      function onMove(ev: PointerEvent) {
        if (!paintDragRef.current.active || !paintDragRef.current.mode) return
        paintCellUnderPointer(ev.clientX, ev.clientY, paintDragRef.current.mode)
      }

      function onUp() {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('pointercancel', onUp)
        stopPaint()
      }

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onUp)
      moveCleanupRef.current = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('pointercancel', onUp)
      }
    },
    [applyPaint, onCellClick, paintCellUnderPointer, paintMode, stopPaint],
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
  editItemAtivo,
  editAddresses,
  editMoveOrigens,
  editMoveDestinos,
  editMarcandoStage = false,
  editAdicionandoPosicoes = false,
  saidaAddresses,
  saidaItemDestaqueAddresses,
  saidaFlaggedAddresses,
  consultaAddresses,
  activeNfId,
  paintMode,
  paint,
  editStagePending,
  focusAddressId,
  pulseAddressId,
}: {
  camaraId: number
  config: RuaConfig
  cellSize: number
  mobile: boolean
  paint: PaintController
} & Props) {
  const labelW = rowLabelWidth(cellSize, mobile)
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

          <div className="cells-area">
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
                    const stagePending = editStagePending?.has(addressId) ?? false
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
                    if (editMoveOrigens?.has(addressId)) className += ' cell--selecionado'
                    else if (editMoveDestinos?.has(addressId)) className += ' cell--destaque-verde'
                    else if (focusAddressId === addressId) className += ' cell--selecionado'
                    if (pulseAddressId === addressId) className += ' cell--busca-pulse'
                    else if (stagePending) className += ' cell--stage-pending'
                    else if (pending) className += editMode ? ' cell--destaque-verde' : ' cell--selecionado'
                    else if (confirmed) className += ' cell--confirmado'
                    if (editAddresses?.has(addressId) && !pending) className += ' cell--destaque-verde'
                    else if (consultaAddresses?.has(addressId) && !pending) className += ' cell--destaque-verde'
                    else if (saidaFlaggedAddresses?.has(addressId)) className += ' cell--saida-flag'
                    else if (saidaItemDestaqueAddresses?.has(addressId) && !pending)
                      className += ' cell--destaque-verde'
                    else if (saidaAddresses?.has(addressId)) className += ' cell--saida'
                    if (allocateMode && (clickable || pending)) className += ' cell--alocavel'
                    if (paintMode && (clickable || pending)) className += ' cell--pintavel'

                    const title = cellTooltip(
                      addressId,
                      kind,
                      allocateMode,
                      editItemAtivo,
                      occ,
                      pending,
                      editMoveOrigens,
                      editMoveDestinos,
                    )
                    const origensCount = editMoveOrigens?.size ?? 0
                    const adicionandoPosicoes = editAdicionandoPosicoes
                    const canInteract = Boolean(
                      (adicionandoPosicoes && clickable && !occ) ||
                        pending ||
                        editMoveOrigens?.has(addressId) ||
                        editMoveDestinos?.has(addressId) ||
                        stagePending ||
                        (editMode &&
                          editMarcandoStage &&
                          clickable &&
                          !occ) ||
                        (editMode &&
                          !editMarcandoStage &&
                          !adicionandoPosicoes &&
                          (occ ||
                            (origensCount > 0 && clickable && !occ))) ||
                        (!editItemAtivo &&
                          editAddresses &&
                          occ &&
                          activeNfId &&
                          occ.nfId === activeNfId) ||
                        (allocateMode && clickable && !editItemAtivo && !adicionandoPosicoes),
                    )
                    if (
                      adicionandoPosicoes ||
                      (editMode && !editMarcandoStage && !adicionandoPosicoes && (occ || origensCount > 0)) ||
                      (editMode && editMarcandoStage && (clickable || pending)) ||
                      (!editItemAtivo && editAddresses && occ)
                    ) {
                      className += ' cell--alocavel'
                    }

                    const portaBg =
                      kind === 'porta' && config.porta
                        ? portaCellBackgroundStyle(col, nivel, config.porta, portaCamaraUrl)
                        : null
                    if (kind === 'porta' && config.porta) {
                      const edge = portaCellEdgeClasses(col, nivel, config.porta)
                      if (edge) className += ` ${edge}`
                    }

                    return (
                      <button
                        key={addressId}
                        type="button"
                        data-address-id={addressId}
                        className={className}
                        style={{
                          width: cellSize,
                          height: cellSize,
                          ...(portaBg ?? {}),
                        }}
                        disabled={!canInteract}
                        data-can-interact={canInteract ? 'true' : 'false'}
                        data-pending={pending ? 'true' : 'false'}
                        title={title}
                        aria-label={title}
                        onPointerDown={(e) => paint.handlePointerDown(addressId, canInteract, pending, e)}
                        onPointerEnter={() => paint.handlePointerEnter(addressId, canInteract)}
                      >
                        {occ && (
                          <span
                            className="cell-ocup-labels"
                            style={{ fontSize: cellOcupFontSize(cellSize) }}
                          >
                            <span className="cell-nf">
                              {cellNfLabel(occ.nfNumero, cellSize)}
                            </span>
                            <span className="cell-codigo">
                              {cellCodigoLabel(
                                codigoProdutoExibicao(occ.codigo, occ.descricao),
                                cellSize,
                              )}
                            </span>
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
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
  resumoCamara,
  ...props
}: {
  cam: CamaraConfig
  mobile: boolean
  paint: PaintController
  resumoCamara: ReturnType<typeof calcularResumoEstoqueArmazem>['camaras'][number]
} & Props) {
  const ref = useRef<HTMLElement>(null)
  const [cellSize, setCellSize] = useState(mobile ? MOBILE_MIN_CELL : MIN_CELL)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const update = () => setCellSize(computeCellSize(el.clientWidth, cam.ruas, mobile))

    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    if (mobile) window.addEventListener('resize', update)
    return () => {
      ro.disconnect()
      if (mobile) window.removeEventListener('resize', update)
    }
  }, [cam, mobile])

  return (
    <section ref={ref} className="camara-section">
      <header className="camara-header">
        <h2>Câmara {cam.id}</h2>
        <span>{cam.tipo}</span>
      </header>
      <CamaraStatsCards resumo={resumoCamara} />
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

function cellOcupFontSize(cellSize: number): number {
  if (cellSize >= 48) return 12
  if (cellSize >= 36) return 11
  if (cellSize >= 28) return 9
  return 8
}

function cellNfLabel(numero: string, cellSize: number): string {
  if (cellSize >= 36) return numero
  if (cellSize >= 28) return numero.length > 6 ? numero.slice(-6) : numero
  return numero.length > 4 ? numero.slice(-4) : numero
}

function cellCodigoLabel(codigo: string, cellSize: number): string {
  if (cellSize >= 48) return codigo.length > 14 ? `${codigo.slice(0, 13)}…` : codigo
  if (cellSize >= 36) return codigo.length > 11 ? `${codigo.slice(0, 10)}…` : codigo
  if (cellSize >= 28) return codigo.length > 9 ? `${codigo.slice(0, 8)}…` : codigo
  return codigo.length > 7 ? `${codigo.slice(0, 6)}…` : codigo
}

function cellTooltip(
  addressId: AddressId,
  kind: CellKind,
  allocateMode: boolean,
  editMode?: boolean,
  occ?: AddressOccupancy,
  pending?: boolean,
  editMoveOrigens?: Set<AddressId>,
  editMoveDestinos?: Set<AddressId>,
): string {
  const label = formatAddressLabel(addressId)
  if (pending) return `${label} — Selecionando (clique para remover)`
  if (editMoveOrigens?.has(addressId)) return `${label} — Marcar para tirar (clique para desmarcar)`
  if (editMoveDestinos?.has(addressId)) return `${label} — Destino (onde colocar)`
  if (occ) return `${label} — NF ${occ.nfNumero}${editMode ? ' (clique para marcar origem)' : ' (confirmado)'}`
  if (kind === 'porta') return `${label} — Porta`
  if (kind === 'bloqueado') return `${label} — Indisponível`
  if (kind === 'sem-nivel5') return `${label} — Nível 5 inexistente`
  if (editMode && (editMoveOrigens?.size ?? 0) > 0)
    return `${label} — Disponível (clique para marcar destino)`
  if (editMode) return `${label} — Disponível (marque origens ocupadas primeiro)`
  if (allocateMode) return `${label} — Disponível (clique ou arraste para selecionar)`
  return `${label} — Disponível`
}

type LegendItem = { swatch: string; label: string; swatchStyle?: CSSProperties }

function buildLegendItems(props: Props): LegendItem[] {
  const items: LegendItem[] = [
    { swatch: 'swatch--disp', label: 'Disponível' },
    { swatch: 'swatch--ocup', label: 'Ocupado' },
  ]

  const entradaAtiva = props.allocateMode && !props.editMode && !!props.activeNfNumero
  if (entradaAtiva) {
    items.push({ swatch: 'swatch--sel', label: 'Selecionando' })
    items.push({ swatch: 'swatch--confirm', label: 'Confirmado' })
  }

  const consultaAtiva =
    props.consultaAddresses != null && props.consultaAddresses.size > 0
  const movimentacaoAtiva =
    props.editItemAtivo || (props.editAddresses != null && props.editAddresses.size > 0)

  if (consultaAtiva) {
    items.push({ swatch: 'swatch--consulta', label: 'Consulta' })
  }
  if (movimentacaoAtiva) {
    items.push({ swatch: 'swatch--destaque', label: 'Movimentação' })
  }

  if (props.saidaItemDestaqueAddresses != null && props.saidaItemDestaqueAddresses.size > 0) {
    items.push({ swatch: 'swatch--destaque', label: 'Onde retirar' })
  }
  if (props.saidaAddresses != null && props.saidaAddresses.size > 0) {
    items.push({ swatch: 'swatch--saida', label: 'NF na saída' })
  }
  if (props.saidaFlaggedAddresses != null && props.saidaFlaggedAddresses.size > 0) {
    items.push({ swatch: 'swatch--saida-flag', label: 'Item para retirar' })
  }

  items.push({
    swatch: 'swatch--porta',
    label: 'Porta',
    swatchStyle: {
      backgroundImage: `url("${portaCamaraUrl}")`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    },
  })
  items.push({ swatch: 'swatch--nv5', label: 'Sem nível 5' })

  return items
}

function useScrollToMapFocus(
  focusAddressId: AddressId | null | undefined,
  focusStage: boolean | undefined,
  focusScrollToken: number | undefined,
) {
  useEffect(() => {
    if (!focusScrollToken) return

    const frame = window.requestAnimationFrame(() => {
      if (focusStage) {
        document.querySelector<HTMLElement>('.stage-section')?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        })
        return
      }

      if (!focusAddressId) return
      const id = focusAddressId
      const el = document.querySelector<HTMLElement>(`button[data-address-id="${id}"]`)
      if (!el) return

      const scrollParent = el.closest<HTMLElement>('.rua-grid-scroll')
      if (scrollParent) {
        const targetLeft =
          el.offsetLeft - scrollParent.clientWidth / 2 + el.offsetWidth / 2
        scrollParent.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' })
      }

      const camaraSection = el.closest<HTMLElement>('.camara-section')
      camaraSection?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })

      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [focusAddressId, focusStage, focusScrollToken])
}

export function LayoutPanel(props: Props) {
  const mobile = useIsMobile()
  const paintMode = props.paintMode ?? false
  const paint = useCellPaint(paintMode, props.onCellPaint, props.onCellClick)
  useScrollToMapFocus(props.focusAddressId, props.focusStage, props.focusScrollToken)

  const resumoPorCamara = useMemo(() => {
    const map = new Map<number, ReturnType<typeof calcularResumoEstoqueArmazem>['camaras'][number]>()
    for (const c of calcularResumoEstoqueArmazem(props.notas ?? []).camaras) {
      map.set(c.camaraId, c)
    }
    return map
  }, [props.notas])

  return (
    <div className={`layout-panel ${mobile ? 'layout-panel--mobile' : ''} ${paintMode ? 'layout-panel--paint' : ''}`}>
      {props.paletesTotal != null &&
        props.paletesRestantes != null &&
        props.allocateMode &&
        (!props.editMode || props.editAdicionandoPosicoes) && (
        <div className="paletes-counter-float" aria-live="polite">
          <strong>{props.paletesRestantes}</strong>{' '}
          {props.editAdicionandoPosicoes
            ? props.paletesRestantes === 1
              ? 'posição a marcar'
              : 'posições a marcar'
            : props.saidaMode
              ? props.paletesRestantes === 1
                ? 'posição a marcar'
                : 'posições a marcar'
              : props.paletesRestantes === 1
                ? 'palete a endereçar'
                : 'paletes a endereçar'}
        </div>
      )}
      <div className="layout-legend" aria-label="Legenda do painel">
        {buildLegendItems(props).map((item) => (
          <span key={item.label}>
            <i className={`swatch ${item.swatch}`} style={item.swatchStyle} aria-hidden />
            {item.label}
          </span>
        ))}
      </div>

      <div className="camaras-stack">
        {CAMARAS.map((cam) => (
          <CamaraSection
            key={cam.id}
            cam={cam}
            mobile={mobile}
            paint={paint}
            resumoCamara={
              resumoPorCamara.get(cam.id) ?? {
                camaraId: cam.id,
                label: `Cam. ${cam.id}`,
                posicoesTotal: 0,
                posicoesOcupadas: 0,
                posicoesLivres: 0,
                valorArmazenado: 0,
                valorPaletes: 0,
                ocupacaoPct: 0,
                qtdItens: 0,
                qtdNotas: 0,
              }
            }
            {...props}
          />
        ))}
        {props.notas && props.onStageOpen && (
          <StageSection
            notas={props.notas}
            highlighted={props.stageHighlighted || props.stageDropEnabled}
            dropEnabled={props.stageDropEnabled}
            onOpen={props.onStageOpen}
            onDrop={props.onStageDrop}
          />
        )}
      </div>

      {props.editItemAtivo && props.activeNfNumero && (
        <p className="layout-hint">
          {props.editAdicionandoPosicoes
            ? 'Clique ou arraste nos quadrados brancos para marcar as novas posições do item.'
            : props.stageDropEnabled
              ? 'Clique na área STAGE abaixo para confirmar a movimentação dos paletes marcados.'
              : props.editMarcandoStage
                ? 'Modo STAGE: clique ou arraste nos endereços ocupados do item para marcar envio ao stage.'
                : (props.editMoveOrigens?.size ?? 0) === 0
                  ? 'Passo 1: clique ou arraste nos quadrados ocupados para marcar o que vai tirar.'
                  : (props.editMoveDestinos?.size ?? 0) < (props.editMoveOrigens?.size ?? 0)
                    ? `Passo 2: clique nos quadrados brancos — ${(props.editMoveOrigens?.size ?? 0) - (props.editMoveDestinos?.size ?? 0)} destino(s) restante(s) de ${props.editMoveOrigens?.size ?? 0}.`
                    : 'Distribuição completa — confirme na barra lateral.'}
        </p>
      )}
      {props.editAddresses && props.editAddresses.size > 0 && !props.editItemAtivo && (
        <p className="layout-hint">
          Selecione um item na barra lateral para editar as posições.
        </p>
      )}
      {props.allocateMode && !props.editMode && props.activeNfNumero && (
        <p className="layout-hint">
          Modo alocação: clique ou arraste nos quadrados para marcar ou desmarcar endereços do item.
        </p>
      )}
      {props.consultaAddresses && props.consultaAddresses.size > 0 && (
        <p className="layout-hint">Clique em um quadrado para ver os detalhes do endereço.</p>
      )}
      {props.saidaItemDestaqueAddresses && props.saidaItemDestaqueAddresses.size > 0 && (
        <p className="layout-hint">
          Saída: endereços em verde indicam onde retirar o item selecionado — como na consulta.
        </p>
      )}
      {props.saidaAddresses && props.saidaAddresses.size > 0 && (
        <p className="layout-hint">
          Saída: selecione um item na tabela para ver onde retirar no painel.
        </p>
      )}
    </div>
  )
}
