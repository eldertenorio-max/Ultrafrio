import { useMemo, useState } from 'react'
import {
  loadAllLocalBackupCandidates,
  persistedRichness,
  pickBestPersistedCandidate,
} from '../lib/localBackupRecovery'
import { contarEnderecosPersistidos } from '../lib/movimentos'

type Props = {
  notasCount: number
  enderecosCount: number
  onRecuperar: () => Promise<boolean>
  onExportarBackup: () => void
}

export function RecuperacaoEstoqueBanner({
  notasCount,
  enderecosCount,
  onRecuperar,
  onExportarBackup,
}: Props) {
  const [recuperando, setRecuperando] = useState(false)

  const backupLocal = useMemo(() => {
    const best = pickBestPersistedCandidate(loadAllLocalBackupCandidates())
    if (!best || persistedRichness(best) === 0) return null
    return {
      notas: best.notas.length,
      enderecos: contarEnderecosPersistidos(best),
    }
  }, [])

  if (notasCount > 0 && enderecosCount > 0) return null

  return (
    <div className="recuperacao-estoque-banner" role="alert">
      <h2>Estoque vazio — recuperação necessária</h2>
      <p>
        Os dados sumiram da nuvem por um bug já corrigido. Ainda dá para recuperar pelo backup
        deste navegador ou pelo painel do Supabase.
      </p>

      {backupLocal ? (
        <p className="recuperacao-estoque-banner__hint">
          Backup local encontrado: <strong>{backupLocal.notas} NF(s)</strong>,{' '}
          <strong>{backupLocal.enderecos} posição(ões)</strong>.
        </p>
      ) : (
        <p className="recuperacao-estoque-banner__hint">
          Nenhum backup local neste navegador. Tente no PC onde você usava o sistema, ou restaure
          pelo Supabase.
        </p>
      )}

      <div className="recuperacao-estoque-banner__actions">
        {backupLocal && (
          <button
            type="button"
            className="btn primary"
            disabled={recuperando}
            onClick={() => {
              setRecuperando(true)
              void onRecuperar().finally(() => setRecuperando(false))
            }}
          >
            {recuperando ? 'Recuperando…' : 'Recuperar do navegador'}
          </button>
        )}
        <button type="button" className="btn" onClick={onExportarBackup}>
          Exportar backup (.json)
        </button>
      </div>

      <details className="recuperacao-estoque-banner__details">
        <summary>Restaurar pelo Supabase (backup diário)</summary>
        <ol>
          <li>
            Abra{' '}
            <a
              href="https://supabase.com/dashboard/project/rmcsubgerhbaeyitegvt/database/backups/scheduled"
              target="_blank"
              rel="noreferrer"
            >
              Supabase → Database → Backups
            </a>
          </li>
          <li>Escolha um backup de <strong>antes de hoje</strong></li>
          <li>Clique em Restore e aguarde concluir</li>
          <li>Recarregue o painel (F5)</li>
        </ol>
      </details>
    </div>
  )
}

/** Exporta o melhor backup do localStorage para arquivo JSON. */
export function exportarBackupNavegador(): boolean {
  const best = pickBestPersistedCandidate(loadAllLocalBackupCandidates())
  if (!best || persistedRichness(best) === 0) {
    window.alert('Nenhum backup encontrado no localStorage deste navegador.')
    return false
  }
  const payload = {
    notas: best.notas,
    movimentos: best.movimentos,
    notasCanceladas: best.notasCanceladas,
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `ultrafrio-backup-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(a.href)
  return true
}
