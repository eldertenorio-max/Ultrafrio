import { useCallback, useEffect, useRef, useState } from 'react'
import { getRepository, type EnderecamentoRepository } from '../lib/repository'
import { localRepository } from '../lib/repository/localRepository'
import { isSupabaseConfigured } from '../lib/supabaseClient'
import { sincronizarMovimentosEntrada } from '../lib/movimentos'
import type { AppState } from '../types'

const emptyState: AppState = {
  notas: [],
  movimentos: [],
  activeNfId: null,
  activeItemIndex: null,
}

function pickRepository(): EnderecamentoRepository {
  return isSupabaseConfigured() ? getRepository() : localRepository
}

export function useEnderecamentoStore() {
  const repoRef = useRef<EnderecamentoRepository>(pickRepository())
  const [state, setState] = useState<AppState>(emptyState)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const skipSave = useRef(true)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      let repo = pickRepository()
      repoRef.current = repo

      try {
        const data = sincronizarMovimentosEntrada(await repo.loadData())
        const ui = repo.loadUiPrefs()
        if (!cancelled) {
          setState({ ...data, ...ui })
          setError(null)
        }
        return
      } catch {
        if (repo.mode === 'supabase') {
          repo = localRepository
          repoRef.current = repo
          try {
            const data = sincronizarMovimentosEntrada(await repo.loadData())
            const ui = repo.loadUiPrefs()
            if (!cancelled) {
              setState({ ...data, ...ui })
              setError(null)
            }
            return
          } catch (e) {
            if (!cancelled) {
              setError(e instanceof Error ? e.message : 'Erro ao carregar dados.')
            }
            return
          }
        }
        if (!cancelled) setError('Erro ao carregar dados.')
      } finally {
        if (!cancelled) {
          skipSave.current = false
          setLoading(false)
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const persist = useCallback(async (next: AppState) => {
    let repo = repoRef.current
    setSaving(true)
    try {
      await repo.saveData({ notas: next.notas, movimentos: next.movimentos })
      repo.saveUiPrefs({
        activeNfId: next.activeNfId,
        activeItemIndex: next.activeItemIndex,
      })
      setError(null)
    } catch {
      if (repo.mode === 'supabase') {
        repo = localRepository
        repoRef.current = repo
        try {
          await repo.saveData({ notas: next.notas, movimentos: next.movimentos })
          repo.saveUiPrefs({
            activeNfId: next.activeNfId,
            activeItemIndex: next.activeItemIndex,
          })
          setError(null)
          return
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Erro ao salvar dados.')
          return
        }
      }
      setError('Erro ao salvar dados.')
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
    clearError: () => setError(null),
  }
}
