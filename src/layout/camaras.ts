export type CellKind = 'disponivel' | 'porta' | 'sem-nivel5' | 'bloqueado'

export type RuaConfig = {
  rua: number
  colunas: number
  porta?: { cols: [number, number]; niveis: [number, number] }
  /** Colunas indisponíveis (intervalo inclusivo), em todos os níveis */
  colunasBloqueadas?: [number, number]
  /** Posições específicas indisponíveis */
  celulasBloqueadas?: { col: number; nivel: number }[]
  /** false = nível 5 existe em todas as colunas (ex.: Câmara 8) */
  semNivel5Inexistente?: boolean
}

export type CamaraConfig = {
  id: number
  tipo: string
  ruas: RuaConfig[]
}

export const CAMARAS: CamaraConfig[] = [
  {
    id: 6,
    tipo: 'Refrigerado',
    ruas: [
      { rua: 1, colunas: 15 },
      {
        rua: 2,
        colunas: 13,
        colunasBloqueadas: [1, 3],
        porta: { cols: [2, 3], niveis: [1, 2] },
      },
    ],
  },
  {
    id: 7,
    tipo: 'Congelado -20°',
    ruas: [
      { rua: 1, colunas: 15, porta: { cols: [2, 3], niveis: [1, 2] } },
      { rua: 2, colunas: 15, porta: { cols: [2, 3], niveis: [1, 2] } },
    ],
  },
  {
    id: 8,
    tipo: 'Refrigerado',
    ruas: [
      { rua: 1, colunas: 15, porta: { cols: [2, 3], niveis: [1, 3] } },
      { rua: 2, colunas: 15 },
    ],
  },
  {
    id: 9,
    tipo: 'Refrigerado',
    ruas: [
      { rua: 1, colunas: 15, celulasBloqueadas: [{ col: 1, nivel: 4 }] },
      { rua: 2, colunas: 15, celulasBloqueadas: [{ col: 1, nivel: 4 }] },
    ],
  },
  {
    id: 10,
    tipo: 'Refrigerado',
    ruas: [
      { rua: 1, colunas: 15 },
      { rua: 2, colunas: 15 },
    ],
  },
]

export const NIVEIS = [5, 4, 3, 2, 1] as const

/** Mapeamento de ruas antigas → novas (câmaras 7–10 passaram a usar Rua 1 e 2). */
const LEGACY_RUA_REMAP: Record<number, Record<number, number>> = {
  7: { 3: 1, 4: 2 },
  8: { 5: 1, 6: 2 },
  9: { 9: 1, 10: 2 },
  10: { 7: 1, 8: 2 },
}

export function remapLegacyAddressId(id: string): string {
  const p = parseAddressId(id)
  if (!p) return id
  const newRua = LEGACY_RUA_REMAP[p.camara]?.[p.rua]
  if (!newRua) return id
  return makeAddressId(p.camara, newRua, p.nivel, p.col)
}

export function makeAddressId(camara: number, rua: number, nivel: number, col: number): string {
  return `C${camara}-R${rua}-N${nivel}-P${col}`
}

export function parseAddressId(id: string): { camara: number; rua: number; nivel: number; col: number } | null {
  const m = id.match(/^C(\d+)-R(\d+)-N(\d+)-P(\d+)$/)
  if (!m) return null
  return {
    camara: Number(m[1]),
    rua: Number(m[2]),
    nivel: Number(m[3]),
    col: Number(m[4]),
  }
}

export function formatAddressLabel(id: string): string {
  const p = parseAddressId(id)
  if (!p) return id
  return `Cam. ${p.camara} · Rua ${p.rua} · Col ${p.col} · Nív ${p.nivel}`
}

export function cellKind(
  col: number,
  nivel: number,
  totalCols: number,
  porta?: RuaConfig['porta'],
  semNivel5Inexistente = true,
  colunasBloqueadas?: RuaConfig['colunasBloqueadas'],
  celulasBloqueadas?: RuaConfig['celulasBloqueadas'],
): CellKind {
  if (porta) {
    const [c0, c1] = porta.cols
    const [n0, n1] = porta.niveis
    if (col >= c0 && col <= c1 && nivel >= n0 && nivel <= n1) return 'porta'
  }
  if (celulasBloqueadas?.some((c) => c.col === col && c.nivel === nivel)) return 'bloqueado'
  if (colunasBloqueadas) {
    const [c0, c1] = colunasBloqueadas
    if (col >= c0 && col <= c1) return 'bloqueado'
  }
  if (semNivel5Inexistente && nivel === 5 && col >= totalCols - 1) return 'sem-nivel5'
  return 'disponivel'
}

export function isClickable(kind: CellKind): boolean {
  return kind === 'disponivel'
}

export function listAllAddresses(): { id: string; camara: number; rua: number; nivel: number; col: number; kind: CellKind }[] {
  const out: { id: string; camara: number; rua: number; nivel: number; col: number; kind: CellKind }[] = []
  for (const cam of CAMARAS) {
    for (const rua of cam.ruas) {
      for (const nivel of NIVEIS) {
        for (let col = 1; col <= rua.colunas; col++) {
          const kind = cellKind(
            col,
            nivel,
            rua.colunas,
            rua.porta,
            rua.semNivel5Inexistente !== false,
            rua.colunasBloqueadas,
            rua.celulasBloqueadas,
          )
          out.push({
            id: makeAddressId(cam.id, rua.rua, nivel, col),
            camara: cam.id,
            rua: rua.rua,
            nivel,
            col,
            kind,
          })
        }
      }
    }
  }
  return out
}

/** Margem interna da arte da porta em relação à célula (mostra as linhas do rack). */
export function portaInsetPx(cellSize: number): number {
  return Math.max(4, Math.round(cellSize * 0.14))
}

export function portaOverlayStyle(
  porta: NonNullable<RuaConfig['porta']>,
  cellW: number,
  gap: number,
  cellH: number = cellW,
): { left: number; top: number; width: number; height: number } {
  const [c0, c1] = porta.cols
  const [n0, n1] = porta.niveis
  const colCount = c1 - c0 + 1
  const rowCount = n1 - n0 + 1
  const topRow = NIVEIS.indexOf(n1 as (typeof NIVEIS)[number])
  const inset = portaInsetPx(cellW)
  const left = (c0 - 1) * (cellW + gap) + inset
  const top = topRow * (cellH + gap) + inset
  const width = colCount * cellW + (colCount - 1) * gap - inset * 2
  const height = rowCount * cellH + (rowCount - 1) * gap - inset * 2
  return { left, top, width: Math.max(0, width), height: Math.max(0, height) }
}

/** Recorte da imagem da porta por célula, com margem interna (CSS vars para ::before). */
export function portaCellBackgroundStyle(
  col: number,
  nivel: number,
  porta: NonNullable<RuaConfig['porta']>,
  imageUrl: string,
  cellW: number,
  cellH: number = cellW,
  unit: 'px' | 'mm' = 'px',
): Record<string, string> | null {
  const [c0, c1] = porta.cols
  const [n0, n1] = porta.niveis
  if (col < c0 || col > c1 || nivel < n0 || nivel > n1) return null

  const colCount = c1 - c0 + 1
  const rowCount = n1 - n0 + 1
  const colIdx = col - c0
  const rowIdx = n1 - nivel
  const inset =
    unit === 'px'
      ? portaInsetPx(cellW)
      : Math.max(0.8, Math.round(cellW * 0.14 * 10) / 10)
  const insetH =
    unit === 'px'
      ? portaInsetPx(cellH)
      : Math.max(0.8, Math.round(cellH * 0.14 * 10) / 10)
  const bgW = colCount * cellW - inset * 2
  const bgH = rowCount * cellH - insetH * 2

  return {
    '--porta-inset': `${inset}${unit}`,
    '--porta-inset-block': `${insetH}${unit}`,
    '--porta-bg-image': `url("${imageUrl}")`,
    '--porta-bg-size': `${bgW}${unit} ${bgH}${unit}`,
    '--porta-bg-pos': `${-colIdx * cellW}${unit} ${-rowIdx * cellH}${unit}`,
  }
}

/** Dimensões da malha de linhas do rack (verticais por cima das horizontais). */
export function rackGridOverlaySize(
  colunas: number,
  rows: number,
  cellW: number,
  gap: number,
  cellH: number = cellW,
): { width: number; height: number; backgroundSize: string } {
  return {
    width: colunas * cellW + (colunas - 1) * gap,
    height: rows * cellH + (rows - 1) * gap,
    backgroundSize: `${cellW + gap}px ${cellH + gap}px`,
  }
}
