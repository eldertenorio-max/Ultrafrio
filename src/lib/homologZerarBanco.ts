import { isHomologacao, isProducao } from './appAmbiente'
import { getSupabase, isSupabaseConfigured } from './supabaseClient'

/** Só homologação — nunca produção (wms.docalivre.com.br). */
export function podeZerarBancoHomologacao(): boolean {
  return isHomologacao() && !isProducao()
}

const TABELAS_ZERAR: { table: string; filterCol: string }[] = [
  { table: 'ultrafrio_movimentos', filterCol: 'id' },
  { table: 'ultrafrio_notas_canceladas', filterCol: 'id' },
  { table: 'ultrafrio_enderecamentos', filterCol: 'nf_id' },
  { table: 'ultrafrio_nf_itens', filterCol: 'nf_id' },
  { table: 'ultrafrio_notas_fiscais', filterCol: 'id' },
  { table: 'ultrafrio_fin_contratos', filterCol: 'id' },
  { table: 'ultrafrio_fin_clientes', filterCol: 'cnpj' },
]

/** Apaga estoque, histórico e clientes financeiros (mesma ordem de supabase/sql/reset_tudo.sql). */
export async function zerarBancoHomologacaoSupabase(): Promise<void> {
  if (!podeZerarBancoHomologacao()) {
    throw new Error('Zerar banco só é permitido no ambiente de homologação.')
  }
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase não configurado.')
  }

  const sb = getSupabase()

  for (const { table, filterCol } of TABELAS_ZERAR) {
    const { error } = await sb.from(table).delete().not(filterCol, 'is', null)
    if (error) {
      if (error.message.includes('does not exist') || error.code === 'PGRST205') continue
      throw new Error(`${table}: ${error.message}`)
    }
  }
}
