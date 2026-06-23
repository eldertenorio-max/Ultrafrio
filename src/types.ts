export type AddressId = string

export type NfeItem = {
  index: number
  codigo: string
  descricao: string
  quantidade: number
  unidade: string
  allocatedAddresses: AddressId[]
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
  activeNfId: string | null
  activeItemIndex: number | null
}
