import { useCallback, useEffect, useRef, useState } from 'react'
import { getRepository, getStorageMode, type EnderecamentoRepository } from '../lib/repository'
import { clearLocalPersistedData, localRepository } from '../lib/repository/localRepository'
import { ensureSupabaseConfig } from '../lib/supabaseConfig'
import { isSupabaseConfigured } from '../lib/supabaseClient'
import { subscribeEnderecamentoChanges } from '../lib/supabaseRealtime'
import { prepareLoadedData } from '../lib/persistence'
import { mesclarEmitentesSugeridos, normalizarEmitente } from '../lib/emitentesRegistry'
import {
  mergePersistedData,
  persistedEquals,
  pickPersisted,
} from '../lib/syncMerge'
import type { AppState, PersistedData } from '../types'
import type { StorageMode } from '../lib/repository/types'

const emptyState: AppState = {
  notas: [],
  notasCanceladas: [],
  movimentos: [],
  emitentes: [],
  activeNfId: null,
  activeItemIndex: null,
}

const SAVE_DEBOUNCE_MS = 400
const REMOTE_RELOAD_DEBOUNCE_MS = 350
const IGNORE_REMOTE_AFTER_SAVE_MS = 2500
const POLL_INTERVAL_MS = 5000

function pickRepository(): EnderecamentoRepository {
  return isSupabaseConfigured() ? getRepository() : localRepository
}

function preserveUi(prev: AppState, data: PersistedData): AppState {
  const activeNfId =
    prev.activeNfId && data.notas.some((n) => n.id === prev.activeNfId) ? prev.activeNfId : null
  const activeItemIndex = activeNfId ? prev.activeItemIndex : null
  return { ...data, activeNfId, activeItemIndex }
}

function isDirtyComparedToBase(current: PersistedData, base: PersistedData | null): boolean {
  if (!base) return false
  return !persistedEquals(current, base)
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
  const pendingSaveRef = useRef<AppState | null>(null)
  const lastPersistedRef = useRef<PersistedData | null>(null)
  const stateRef = useRef(state)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  const applyPersistedToState = useCallback((data: PersistedData, base: AppState) => {
    const next = preserveUi(base, data)
    if (persistedEquals(pickPersisted(base), data)) return base
    skipSave.current = true
    setState(next)
    setTimeout(() => {
      skipSave.current = false
    }, 250)
    return next
  }, [])

  const persist = useCallback(async (next: AppState) => {
    const repo = repoRef.current
    savingRef.current = true
    setSaving(true)

    try {
      let dataToSave = pickPersisted(next)

      if (repo.mode === 'supabase' && lastPersistedRef.current) {
        try {
          const remote = pickPersisted(await repo.loadData())
          dataToSave = mergePersistedData(lastPersistedRef.current, dataToSave, remote)
        } catch {
          /* salva versão local se a leitura remota falhar */
        }
      }

      await repo.saveData({
        notas: dataToSave.notas,
        movimentos: dataToSave.movimentos,
        notasCanceladas: dataToSave.notasCanceladas,
      })
      repo.saveUiPrefs({
        activeNfId: next.activeNfId,
        activeItemIndex: next.activeItemIndex,
      })

      lastPersistedRef.current = dataToSave
      pendingSaveRef.current = null
      ignoreRemoteUntil.current = Date.now() + IGNORE_REMOTE_AFTER_SAVE_MS

      if (!persistedEquals(dataToSave, pickPersisted(next))) {
        applyPersistedToState(dataToSave, next)
      }

      setError(null)
    } catch {
      if (repo.mode === 'supabase') {
        repoRef.current = localRepository
        setStorageMode('local')
        try {
          const dataToSave = pickPersisted(next)
          await localRepository.saveData({
            notas: dataToSave.notas,
            movimentos: dataToSave.movimentos,
            notasCanceladas: dataToSave.notasCanceladas,
          })
          localRepository.saveUiPrefs({
            activeNfId: next.activeNfId,
            activeItemIndex: next.activeItemIndex,
          })
          lastPersistedRef.current = dataToSave
          pendingSaveRef.current = null
          setError(null)
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
  }, [applyPersistedToState])

  const saveNow = useCallback(
    async (next: AppState) => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current)
        saveTimer.current = null
      }
      pendingSaveRef.current = null
      await persist(next)
    },
    [persist],
  )

  const reloadFromRemote = useCallback(async () => {
    if (repoRef.current.mode !== 'supabase') return
    if (savingRef.current || pendingSaveRef.current) return
    if (Date.now() < ignoreRemoteUntil.current) return

    setSyncing(true)
    skipSave.current = true
    try {
      const remote = await repoRef.current.loadData()
      const { data } = prepareLoadedData(remote)
      const base = lastPersistedRef.current

      setState((prev) => {
        const local = pickPersisted(prev)
        let merged = data

        if (base && isDirtyComparedToBase(local, base)) {
          merged = mergePersistedData(base, local, data)
        } else {
          lastPersistedRef.current = data
        }

        return preserveUi(prev, merged)
      })
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
      await ensureSupabaseConfig()

      let repo = pickRepository()
      repoRef.current = repo
      setStorageMode(repo.mode)

      try {
        const remote = await repo.loadData()
        let { data, migratedFromLocal: migrated } = prepareLoadedData(remote, {
          allowLocalMigration: repo.mode === 'supabase',
        })
        const ui = repo.loadUiPrefs()

        if (migrated && repo.mode === 'supabase') {
          await repo.saveData({
            notas: data.notas,
            movimentos: data.movimentos,
            notasCanceladas: data.notasCanceladas,
          })
          for (const nf of data.notas) await repo.registrarEmitente(nf.emitente)
          for (const c of data.notasCanceladas) await repo.registrarEmitente(c.emitente)
          data = {
            ...data,
            emitentes: await repo.loadData().then((d) => d.emitentes).catch(() => data.emitentes),
          }
          clearLocalPersistedData()
          ignoreRemoteUntil.current = Date.now() + IGNORE_REMOTE_AFTER_SAVE_MS
        }

        if (!cancelled) {
          lastPersistedRef.current = data
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
              lastPersistedRef.current = data
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

  useEffect(() => {
    if (skipSave.current || loading) return
    pendingSaveRef.current = state
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      const pending = pendingSaveRef.current ?? stateRef.current
      pendingSaveRef.current = null
      void persist(pending)
    }, SAVE_DEBOUNCE_MS)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [state, loading, persist])

  useEffect(() => {
    const flushPendingSave = () => {
      const pending = pendingSaveRef.current ?? stateRef.current
      if (skipSave.current || savingRef.current) return
      if (saveTimer.current) {
        clearTimeout(saveTimer.current)
        saveTimer.current = null
      }
      pendingSaveRef.current = null
      void persist(pending)
    }

    window.addEventListener('pagehide', flushPendingSave)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushPendingSave()
    })

    return () => {
      window.removeEventListener('pagehide', flushPendingSave)
    }
  }, [persist])

  const updateState = useCallback((updater: AppState | ((prev: AppState) => AppState)) => {
    setState((prev) => (typeof updater === 'function' ? updater(prev) : updater))
  }, [])

  const registrarEmitente = useCallback(async (nome: string) => {
    const n = normalizarEmitente(nome)
    if (!n) return

    try {
      await repoRef.current.registrarEmitente(nome)
    } catch {
      /* mantém sugestão local se a nuvem falhar momentaneamente */
    }

    setState((prev) => ({
      ...prev,
      emitentes: mesclarEmitentesSugeridos([n], prev.emitentes),
    }))
  }, [])

  return {
    state,
    setState: updateState,
    saveNow,
    registrarEmitente,
    loading,
    saving,
    syncing,
    error,
    clearError: () => setError(null),
  }
}
