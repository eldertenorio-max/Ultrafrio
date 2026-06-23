import { useCallback, useEffect, useRef, useState } from 'react'
import { getRepository, getStorageMode, type StorageMode } from '../lib/repository'
import type { AppState, NotaFiscal } from '../types'

const emptyState: AppState = {
  notas: [],
  activeNfId: null,
  activeItemIndex: null,
}

export function useEnderecamentoStore() {
  const repoRef = useRef(getRepository())
  const [state, setState] = useState<AppState>(emptyState)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [storageMode, setStorageMode] = useState<StorageMode>(() => getStorageMode())
  const skipSave = useRef(true)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false
    const repo = getRepository()
    repoRef.current = repo
    setStorageMode(repo.mode)

    ;(async () => {
      try {
        const notas = await repo.loadNotas()
        const ui = repo.loadUiPrefs()
        if (!cancelled) {
          setState({ notas, ...ui })
          setError(null)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Erro ao carregar dados.')
        }
      } finally {
        if (!cancelled) {
          skipSave.current = false
          setLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const persist = useCallback(async (next: AppState) => {
    const repo = repoRef.current
    setSaving(true)
    try {
      await repo.saveNotas(next.notas)
      repo.saveUiPrefs({
        activeNfId: next.activeNfId,
        activeItemIndex: next.activeItemIndex,
      })
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar dados.')
    } finally {
      setSaving(false)
    }
  }, [])

  useEffect(() => {
    if (skipSave.current || loading) return

    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      void persist(state)
    }, 400)

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [state, loading, persist])

  const updateState = useCallback((updater: AppState | ((prev: AppState) => AppState)) => {
    setState((prev) => (typeof updater === 'function' ? updater(prev) : updater))
  }, [])

  return {
    state,
    setState: updateState,
    loading,
    saving,
    error,
    storageMode,
    clearError: () => setError(null),
  }
}

export type { NotaFiscal }
