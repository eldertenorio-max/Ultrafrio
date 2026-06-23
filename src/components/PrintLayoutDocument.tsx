import {
  CAMARAS,
  NIVEIS,
  cellKind,
  makeAddressId,
  type CamaraConfig,
  type RuaConfig,
} from '../layout/camaras'

const CELL_GAP = 0

/** A4 paisagem com margem 5mm — área útil para o grid no corpo da folha. */
const PRINT_BODY_WIDTH_MM = 287
const PRINT_BODY_HEIGHT_MM = 186

type PrintCellDims = {
  cellW: number
  cellH: number
  labelW: number
  headerH: number
  gridW: number
  gridH: number
}

function printGridMetrics(colunas: number, cellW: number, cellH: number): PrintCellDims {
  const labelW = Math.max(10, Math.round(cellW * 0.55))
  const headerH = Math.max(7, Math.round(cellW * 0.45))
  const gapsW = (colunas - 1) * CELL_GAP
  const gapsH = (NIVEIS.length - 1) * CELL_GAP
  const gridW = labelW + 3 + colunas * cellW + gapsW
  const gridH = headerH + NIVEIS.length * cellH + gapsH
  return { cellW, cellH, labelW, headerH, gridW, gridH }
}

/** Largura máxima por coluna; altura estica para preencher a folha (retângulo vertical). */
function computePrintCellDimensions(colunas: number): PrintCellDims {
  const gapsW = (colunas - 1) * CELL_GAP
  const gapsH = (NIVEIS.length - 1) * CELL_GAP
  const overheadW = 12

  const cellW = Math.round(((PRINT_BODY_WIDTH_MM - overheadW - gapsW) / colunas) * 10) / 10
  const { headerH } = printGridMetrics(colunas, cellW, cellW)
  const cellH = Math.round(((PRINT_BODY_HEIGHT_MM - headerH - gapsH) / NIVEIS.length) * 10) / 10

  let dims = printGridMetrics(colunas, cellW, cellH)

  while (dims.gridW > PRINT_BODY_WIDTH_MM && dims.cellW > 8) {
    const nextW = Math.round((dims.cellW - 0.1) * 10) / 10
    const nextH = Math.round(((PRINT_BODY_HEIGHT_MM - dims.headerH - gapsH) / NIVEIS.length) * 10) / 10
    dims = printGridMetrics(colunas, nextW, nextH)
  }

  return dims
}

function printColAxisFont(cellW: number): number {
  return Math.max(14, Math.min(22, Math.round(cellW * 0.82)))
}

function printRowAxisFont(cellH: number): number {
  return Math.max(14, Math.min(28, Math.round(cellH * 0.36)))
}

function printPortaOverlayStyleMm(
  porta: NonNullable<RuaConfig['porta']>,
  cellW: number,
  cellH: number,
  gapMm: number,
): { left: string; top: string; width: string; height: string } {
  const [c0, c1] = porta.cols
  const [n0, n1] = porta.niveis
  const colCount = c1 - c0 + 1
  const rowCount = n1 - n0 + 1
  const topRow = NIVEIS.indexOf(n1 as (typeof NIVEIS)[number])

  return {
    left: `${(c0 - 1) * (cellW + gapMm)}mm`,
    top: `${topRow * (cellH + gapMm)}mm`,
    width: `${colCount * cellW + (colCount - 1) * gapMm}mm`,
    height: `${rowCount * cellH + (rowCount - 1) * gapMm}mm`,
  }
}

type Props = {
  camaraIds: number[]
}

function PrintRuaGrid({ camaraId, config, dims }: { camaraId: number; config: RuaConfig; dims: PrintCellDims }) {
  const { cellW, cellH, labelW, headerH } = dims
  const colFont = printColAxisFont(cellW)
  const rowFont = printRowAxisFont(cellH)
  const portaFont = Math.max(11, Math.round(Math.min(cellW, cellH) * 0.5))

  return (
    <div className="print-rua-grid">
      <div
        className="print-col-headers"
        style={{
          marginLeft: labelW + 3,
          gridTemplateColumns: `repeat(${config.colunas}, ${cellW}mm)`,
          gap: `${CELL_GAP}mm`,
        }}
      >
        {Array.from({ length: config.colunas }, (_, i) => (
          <span key={i} className="print-axis" style={{ width: `${cellW}mm`, fontSize: colFont }}>
            {i + 1}
          </span>
        ))}
      </div>

      <div className="print-rua-body" style={{ paddingTop: headerH }}>
        <div className="print-row-labels" style={{ width: labelW, gap: `${CELL_GAP}mm` }}>
          {NIVEIS.map((nivel) => (
            <span
              key={nivel}
              className="print-axis print-axis--row"
              style={{ height: `${cellH}mm`, lineHeight: `${cellH}mm`, fontSize: rowFont }}
            >
              {nivel}
            </span>
          ))}
        </div>

        <div className="print-cells-area">
          <div className="print-cells-stack" style={{ gap: `${CELL_GAP}mm` }}>
            {NIVEIS.map((nivel) => (
              <div
                key={nivel}
                className="print-cells-row"
                style={{
                  gridTemplateColumns: `repeat(${config.colunas}, ${cellW}mm)`,
                  gap: `${CELL_GAP}mm`,
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
                  return (
                    <div
                      key={makeAddressId(camaraId, config.rua, nivel, col)}
                      className={`print-cell print-cell--${kind}`}
                      style={{ width: `${cellW}mm`, height: `${cellH}mm` }}
                    />
                  )
                })}
              </div>
            ))}
          </div>

          {config.porta && (
            <div
              className="print-porta-label"
              style={{
                ...printPortaOverlayStyleMm(config.porta, cellW, cellH, CELL_GAP),
                fontSize: portaFont,
              }}
            >
              PORTA
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PrintPage({ cam, rua, pageIndex, totalPages }: { cam: CamaraConfig; rua: RuaConfig; pageIndex: number; totalPages: number }) {
  const dims = computePrintCellDimensions(rua.colunas)
  const isRua1 = rua.rua === cam.ruas[0]?.rua
  const versoRua = cam.ruas.find((r) => r.rua !== rua.rua)

  return (
    <section className="print-page">
      <header className="print-page-header">
        <div>
          <h1>Câmara {cam.id}</h1>
          <p className="print-page-sub">{cam.tipo} · Rua {rua.rua}</p>
        </div>
        <div className="print-page-meta">
          <span>Ultrafrio — Layout de endereçamento</span>
          <span>
            Folha {pageIndex + 1} de {totalPages}
          </span>
        </div>
      </header>

      <div className="print-page-body">
        <PrintRuaGrid camaraId={cam.id} config={rua} dims={dims} />
      </div>

      <footer className="print-page-footer">
        <div className="print-legend">
          <span><i className="print-swatch print-swatch--disp" /> Posição</span>
          <span><i className="print-swatch print-swatch--porta" /> Porta</span>
          <span><i className="print-swatch print-swatch--nv5" /> Nív. 5 inexistente</span>
        </div>
        {isRua1 && versoRua && (
          <p className="print-duplex-hint">
            Impressão frente e verso: esta folha = <strong>Rua {rua.rua}</strong> (frente) · verso ={' '}
            <strong>Rua {versoRua.rua}</strong>
          </p>
        )}
        {!isRua1 && (
          <p className="print-duplex-hint">
            Verso da folha anterior — <strong>Rua {rua.rua}</strong>
          </p>
        )}
      </footer>
    </section>
  )
}

export function PrintLayoutDocument({ camaraIds }: Props) {
  const pages: { cam: CamaraConfig; rua: RuaConfig }[] = []

  for (const cam of CAMARAS) {
    if (!camaraIds.includes(cam.id)) continue
    for (const rua of cam.ruas) {
      pages.push({ cam, rua })
    }
  }

  if (pages.length === 0) return null

  return (
    <div className="print-document" aria-hidden>
      {pages.map(({ cam, rua }, i) => (
        <PrintPage key={`${cam.id}-r${rua.rua}`} cam={cam} rua={rua} pageIndex={i} totalPages={pages.length} />
      ))}
    </div>
  )
}
