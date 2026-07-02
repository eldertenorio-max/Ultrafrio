import { sanitizarNotasEntrada } from './excluirItemNf'
import {
  contarEnderecosPersistidos,
  limparMovimentosEntradaOrfaos,
  migrarRuasNosDados,
  recuperarEnderecosPerdidos,
  recuperarItensPerdidos,
  sanitizarEnderecosInvalidos,
  sincronizarMovimentosEntrada,
} from './movimentos'
import { syncVinculosNotas } from './nfCanceladas'
import { emitentesFromPersisted } from './emitentesRegistry'
import type { NotaFiscal, PersistedData } from '../types'

function normalizarStatusNotas(notas: NotaFiscal[]): NotaFiscal[] {
  // Não concluir entradas automaticamente: a conclusão deve ocorrer só por ação
  // explícita (confirmar item / finalizar entrada). Assim, escolher "stage" no
  // destino do item não some com o painel da entrada em andamento.
  return sanitizarNotasEntrada(notas)
}

export function normalizePersistedData(data: PersistedData): PersistedData {
  const base = limparMovimentosEntradaOrfaos(
    syncVinculosNotas(
      recuperarEnderecosPerdidos(
        recuperarItensPerdidos(
          sincronizarMovimentosEntrada(sanitizarEnderecosInvalidos(migrarRuasNosDados(data))),
        ),
      ),
    ),
  )
  return {
    ...base,
    notas: normalizarStatusNotas(base.notas),
    emitentes: base.emitentes?.length ? base.emitentes : emitentesFromPersisted(base),
  }
}

/** Dados vindos da nuvem — sem mesclar com localStorage do navegador. */
export function prepareLoadedData(remote: PersistedData): PersistedData {
  return normalizePersistedData(remote)
}

export function prepareLoadedDataWithRepair(remote: PersistedData): {
  data: PersistedData
  enderecosRecuperados: number
  dadosReparados: boolean
} {
  const antesEnd = contarEnderecosPersistidos(remote)
  const antesItens = remote.notas.reduce((s, nf) => s + nf.items.length, 0)
  const data = normalizePersistedData(remote)
  const depoisEnd = contarEnderecosPersistidos(data)
  const depoisItens = data.notas.reduce((s, nf) => s + nf.items.length, 0)
  return {
    data,
    enderecosRecuperados: Math.max(0, depoisEnd - antesEnd),
    dadosReparados: depoisEnd > antesEnd || depoisItens > antesItens,
  }
}
