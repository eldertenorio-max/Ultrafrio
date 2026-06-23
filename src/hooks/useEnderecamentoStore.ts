import { useCallback, useEffect, useRef, useState } from 'react'
import { getRepository, getStorageMode, type EnderecamentoRepository } from '../lib/repository'
import { clearLocalPersistedData, localRepository } from '../lib/repository/localRepository'
import { isSupabaseConfigured } from '../lib/supabaseClient'
import { subscribeEnderecamentoChanges } from '../lib/supabaseRealtime'
import { prepareLoadedData } from '../lib/persistence'
import type { AppState, PersistedData } from '../types'
import type { StorageMode } from '../lib/repository/types'

const emptyState: AppState = {
  notas: [],
  notasCanceladas: [],
  movimentos: [],
  activeNfId: null,
  activeItemIndex: null,
}

const SAVE_DEBOUNCE_MS = 400
const REMOTE_RELOAD_DEBOUNCE_MS = 700
const IGNORE_REMOTE_MS = 2500
const POLL_INTERVAL_MS = 20_000

function pickRepository(): EnderecamentoRepository {
  return isSupabaseConfigured() ? getRepository() : localRepository
}

function mergeRemoteState(prev: AppState, data: PersistedData): AppState {
  const activeNfId =
    prev.activeNfId && data.notas.some((n) => n.id === prev.activeNfId) ? prev.activeNfId : null
  const activeItemIndex = activeNfId ? prev.activeItemIndex : null
  return { ...data, activeNfId, activeItemIndex }
}

export function useEnderecamentoStore() {
  const repoRef = useRef<EnderecamentoRepository>(pickRepository())
  const [state, setState] = useState<AppState>(emptyState)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [storageMode, setStorageMode] = useState<StorageMode>(getStorageMode())
  const skipSave = useRef(true)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ignoreRemoteUntil = useRef(0)
  const savingRef = useRef(false)
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const reloadFromRemote = useCallback(async () => {
    if (repoRef.current.mode !== 'supabase') return
    if (savingRef.current || Date.now() < ignoreRemoteUntil.current) return

    setSyncing(true)
    skipSave.current = true
    try {
      const remote = await repoRef.current.loadData()
      const { data } = prepareLoadedData(remote)
      setState((prev) => mergeRemoteState(prev, data))
      setError(null)
    } catch {
      /* mantém estado atual se a nuvem falhar momentaneamente */
    } finally {
      setSyncing(false)
      setTimeout(() => {
        skipSave.current = false
      }, 200)
    }
  }, [])

  const scheduleRemoteReload = useCallback(() => {
    if (reloadTimer.current) clearTimeout(reloadTimer.current)
    reloadTimer.current = setTimeout(() => {
      void reloadFromRemote()
    }, REMOTE_RELOAD_DEBOUNCE_MS)
  }, [reloadFromRemote])

  useEffect(() => {
    let cancelled = false

    async function load() {
      let repo = pickRepository()
      repoRef.current = repo
      setStorageMode(repo.mode)

      try {
        const remote = await repo.loadData()
        const { data, migratedFromLocal: migrated } = prepareLoadedData(remote, {
          allowLocalMigration: repo.mode === 'supabase',
        })
        const ui = repo.loadUiPrefs()

        if (migrated && repo.mode === 'supabase') {
          await repo.saveData({
            notas: data.notas,
            movimentos: data.movimentos,
            notasCanceladas: data.notasCanceladas,
          })
          clearLocalPersistedData()
          ignoreRemoteUntil.current = Date.now() + IGNORE_REMOTE_MS
        }

        if (!cancelled) {
          setState({ ...data, ...ui })
          setError(null)
        }
        return
      } catch {
        if (repo.mode === 'supabase') {
          repo = localRepository
          repoRef.current = repo
          setStorageMode('local')
          try {
            const { data } = prepareLoadedData(await repo.loadData())
            const ui = repo.loadUiPrefs()
            if (!cancelled) {
              setState({ ...data, ...ui })
              setError('Nuvem indisponível — usando dados deste navegador.')
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

  useEffect(() => {
    if (loading || storageMode !== 'supabase' || !isSupabaseConfigured()) return

    const unsubscribe = subscribeEnderecamentoChanges(scheduleRemoteReload)
    const poll = window.setInterval(scheduleRemoteReload, POLL_INTERVAL_MS)

    return () => {
      unsubscribe()
      window.clearInterval(poll)
      if (reloadTimer.current) clearTimeout(reloadTimer.current)
    }
  }, [loading, scheduleRemoteReload, storageMode])

  const persist = useCallback(async (next: AppState) => {
    let repo = repoRef.current
    savingRef.current = true
    setSaving(true)
    try {
      await repo.saveData({
        notas: next.notas,
        movimentos: next.movimentos,
        notasCanceladas: next.notasCanceladas,
      })
      repo.saveUiPrefs({
        activeNfId: next.activeNfId,
        activeItemIndex: next.activeItemIndex,
      })
      ignoreRemoteUntil.current = Date.now() + IGNORE_REMOTE_MS
      setError(null)
    } catch {
      if (repo.mode === 'supabase') {
        repo = localRepository
        repoRef.current = repo
        setStorageMode('local')
        try {
          await repo.saveData({
            notas: next.notas,
            movimentos: next.movimentos,
            notasCanceladas: next.notasCanceladas,
          })
          repo.saveUiPrefs({
            activeNfId: next.activeNfId,
            activeItemIndex: next.activeItemIndex,
          })
          setError('Nuvem indisponível — dados salvos só neste navegador.')
          return
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Erro ao salvar dados.')
          return
        }
      }
      setError('Erro ao salvar dados.')
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }, [])

  useEffect(() => {
    if (skipSave.current || loading) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      void persist(state)
    }, SAVE_DEBOUNCE_MS)
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
    syncing,
    error,
    clearError: () => setError(null),
  }
}
