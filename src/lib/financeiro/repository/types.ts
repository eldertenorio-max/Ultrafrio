import type { FinanceiroData } from '../types'

export type FinanceiroRepository = {
  load: () => Promise<FinanceiroData>
  save: (data: FinanceiroData) => Promise<void>
}
