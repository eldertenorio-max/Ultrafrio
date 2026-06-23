import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export function isSupabaseConfigured(): boolean {
  return Boolean(url && anonKey)
}

const missingEnvError = new Error(
  'Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no Render ou no arquivo .env local.',
)

let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured()) throw missingEnvError
  if (!client) client = createClient(url!, anonKey!)
  return client
}

type NfRow = {
  id: string
  numero: string
  serie: string
  chave: string
  emitente: string
  data_emissao: string
  status: 'em_andamento' | 'concluida'
  created_at: string
}

type ItemRow = {
  nf_id: string
  item_index: number
  codigo: string
  descricao: string
  quantidade: number
  unidade: string
}

type EndRow = {
  nf_id: string
  item_index: number
  address_id: string
}

export type { NfRow, ItemRow, EndRow }
