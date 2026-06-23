import { createClient, type SupabaseClient } from '@supabase/supabase-js'

function cleanEnv(value: string | undefined): string {
  if (!value) return ''
  return value.trim().replace(/^['"]|['"]$/g, '')
}

function isValidHttpUrl(value: string): boolean {
  if (!value) return false
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export const supabaseUrl = cleanEnv(import.meta.env.VITE_SUPABASE_URL)
export const supabaseAnonKey = cleanEnv(import.meta.env.VITE_SUPABASE_ANON_KEY)

export function isSupabaseConfigured(): boolean {
  return isValidHttpUrl(supabaseUrl) && supabaseAnonKey.length > 0
}

const missingEnvError = new Error(
  'Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no Render ou no arquivo .env local.',
)

let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured()) throw missingEnvError
  if (!client) client = createClient(supabaseUrl, supabaseAnonKey)
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
