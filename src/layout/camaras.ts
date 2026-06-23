export type CellKind = 'disponivel' | 'porta' | 'sem-nivel5'

export type RuaConfig = {
  rua: number
  colunas: number
  porta?: { cols: [number, number]; niveis: [number, number] }
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
      { rua: 2, colunas: 13 },
    ],
  },
  {
    id: 7,
    tipo: 'Refrigerado',
    ruas: [
      { rua: 3, colunas: 15, porta: { cols: [2, 3], niveis: [1, 2] } },
      { rua: 4, colunas: 15, porta: { cols: [2, 3], niveis: [1, 2] } },
    ],
  },
  {
    id: 8,
    tipo: 'Refrigerado',
    ruas: [
      { rua: 5, colunas: 15, porta: { cols: [2, 3], niveis: [1, 3] }, semNivel5Inexistente: false },
      { rua: 6, colunas: 15, porta: { cols: [2, 3], niveis: [1, 3] }, semNivel5Inexistente: false },
    ],
  },
  {
    id: 10,
    tipo: 'Refrigerado',
    ruas: [
      { rua: 7, colunas: 15 },
      { rua: 8, colunas: 15 },
    ],
  },
]

export const NIVEIS = [5, 4, 3, 2, 1] as const

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
): CellKind {
  if (porta) {
    const [c0, c1] = porta.cols
    const [n0, n1] = porta.niveis
    if (col >= c0 && col <= c1 && nivel >= n0 && nivel <= n1) return 'porta'
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
          const kind = cellKind(col, nivel, rua.colunas, rua.porta, rua.semNivel5Inexistente !== false)
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

export function portaOverlayStyle(
  porta: NonNullable<RuaConfig['porta']>,
  cell: number,
  gap: number,
): { left: number; top: number; width: number; height: number } {
  const [c0, c1] = porta.cols
  const [n0, n1] = porta.niveis
  const colCount = c1 - c0 + 1
  const rowCount = n1 - n0 + 1
  const topRow = NIVEIS.indexOf(n1 as (typeof NIVEIS)[number])
  return {
    left: (c0 - 1) * (cell + gap),
    top: topRow * (cell + gap),
    width: colCount * cell + (colCount - 1) * gap,
    height: rowCount * cell + (rowCount - 1) * gap,
  }
}
