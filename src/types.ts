export type AddressId = string

export type NfeItem = {
  index: number
  codigo: string
  descricao: string
  quantidade: number
  unidade: string
  allocatedAddresses: AddressId[]
  pesoBruto?: number
  valorUnitario?: number
  valorTotal?: number
  up?: string
  lote?: string
  dataFabricacao?: string
  dataValidade?: string
}

export type NotaFiscal = {
  id: string
  numero: string
  serie: string
  chave: string
  emitente: string
  dataEmissao: string
  items: NfeItem[]
  status: 'em_andamento' | 'concluida'
  createdAt: string
  /** Totais do documento (XML transp/total). */
  pesoBruto?: number
  pesoLiquido?: number
  valorTotalNota?: number
  quantidadeVolume?: string
  /** NF cancelada vinculada a esta nota (substituição). */
  nfCanceladaOrigemId?: string | null
  nfCanceladaOrigemNumero?: string | null
}

export type NfeItemCancelado = {
  index: number
  codigo: string
  descricao: string
  quantidade: number
  unidade: string
}

export type NotaFiscalCancelada = {
  id: string
  numero: string
  serie: string
  chave: string
  emitente: string
  dataEmissao: string
  items: NfeItemCancelado[]
  vinculoNfNovaId: string | null
  vinculoNfNovaNumero: string | null
  createdAt: string
  /** Registro mantido no histórico após exclusão na aba NF cancelada. */
  excluido?: boolean
  excluidoEm?: string
}

export type MovimentoTipo = 'entrada' | 'saida'

export type JustificativaSaidaId =
  | 'venda'
  | 'transferencia'
  | 'descarte'
  | 'devolucao_remessa'
  | 'acerto_estoque'
  | 'revenda'

export type MovimentoItemSnapshot = {
  itemIndex: number
  codigo: string
  descricao: string
  quantidade: number
  unidade: string
  addressIds: AddressId[]
  up?: string
  lote?: string
  dataFabricacao?: string
  dataValidade?: string
}

export type MovimentoRegistro = {
  id: string
  tipo: MovimentoTipo
  nfId: string
  nfNumero: string
  emitente: string
  createdAt: string
  itens: MovimentoItemSnapshot[]
  /** Motivo da saída (venda, transferência, etc.). */
  justificativaSaida?: JustificativaSaidaId
  /** Registro mantido no histórico após exclusão na aba Movimentação. */
  excluido?: boolean
  excluidoEm?: string
}

export type AddressOccupancy = {
  nfId: string
  nfNumero: string
  itemIndex: number
  codigo: string
  descricao: string
  quantidade: number
  unidade: string
}

export type AppState = {
  notas: NotaFiscal[]
  notasCanceladas: NotaFiscalCancelada[]
  movimentos: MovimentoRegistro[]
  emitentes: string[]
  activeNfId: string | null
  activeItemIndex: number | null
}

export type PersistedData = {
  notas: NotaFiscal[]
  notasCanceladas: NotaFiscalCancelada[]
  movimentos: MovimentoRegistro[]
  emitentes: string[]
}
