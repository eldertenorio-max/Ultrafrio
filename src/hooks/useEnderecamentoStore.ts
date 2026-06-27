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
const REMOTE_RELOAD_DEBOUNCE_MS = 300
const IGNORE_REMOTE_AFTER_SAVE_MS = 5000
const POLL_INTERVAL_MS = 3000
const PERSIST_RETRY_MS = 600

function formatPersistErrorMessage(e: unknown, supabaseMode: boolean): string {
  if (!supabaseMode) {
    return e instanceof Error ? e.message : 'Erro ao salvar dados.'
  }
  const raw = e instanceof Error ? e.message : ''
  if (raw.includes('ultrafrio_movimentos_tipo_check')) {
    return (
      'Erro ao salvar movimentação na nuvem: o Supabase ainda não aceita o tipo "movimentacao". ' +
      'No SQL Editor, rode o arquivo supabase/sql/apply_pending_columns.sql (ou movimentos_tipo_movimentacao.sql) e tente de novo.'
    )
  }
  return raw
    ? `Erro ao salvar na nuvem: ${raw}`
    : 'Erro ao salvar na nuvem. Verifique a conexão com o Supabase.'
}
const PERSIST_MAX_ATTEMPTS = 3

function pickRepository(): EnderecamentoRepository {
  return isSupabaseConfigured() ? getRepository() : localRepository
}

function preserveUi(prev: AppState, data: PersistedData): AppState {
  let notas = data.notas
  let activeNfId = prev.activeNfId

  if (activeNfId) {
    const inMerged = notas.some((n) => n.id === activeNfId)
    const prevNf = prev.notas.find((n) => n.id === activeNfId)
    if (!inMerged && prevNf?.status === 'em_andamento') {
      notas = [prevNf, ...notas.filter((n) => n.id !== activeNfId)]
    } else if (!inMerged) {
      activeNfId = null
    }
  }

  const activeItemIndex = activeNfId ? prev.activeItemIndex : null
  return { ...data, notas, activeNfId, activeItemIndex }
}

function isDirtyComparedToBase(current: PersistedData, base: PersistedData | null): boolean {
  if (!base) return false
  return !persistedEquals(current, base)
}

function hasPendingLocalChanges(
  stateRef: AppState,
  lastPersisted: PersistedData | null,
  pendingSave: AppState | null,
  saveTimer: ReturnType<typeof setTimeout> | null,
): boolean {
  if (pendingSave || saveTimer) return true
  if (!lastPersisted) return false
  return isDirtyComparedToBase(pickPersisted(stateRef), lastPersisted)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function useEnderecamentoStore() {
  const repoRef = useRef<EnderecamentoRepository>(pickRepository())
  const [state, setState] = useState<AppState>(emptyState)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [storageMode, setStorageMode] = useState<StorageMode>(getStorageMode())
  const skipSave = useRef(true)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ignoreRemoteUntil = useRef(0)
  const savingRef = useRef(false)
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingSaveRef = useRef<AppState | null>(null)
  const persistChainRef = useRef<Promise<void>>(Promise.resolve())
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

  const persistInner = useCallback(async (next: AppState) => {
    const repo = repoRef.current
    savingRef.current = true
    setSaving(true)
    ignoreRemoteUntil.current = Date.now() + IGNORE_REMOTE_AFTER_SAVE_MS

    const runLocalSave = async () => {
      if (repo.mode !== 'supabase') {
        const dataToSave = pickPersisted(next)
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
        return dataToSave
      }

      let dataToSave = pickPersisted(next)

      if (lastPersistedRef.current) {
        const remote = pickPersisted(await repo.loadData())
        dataToSave = mergePersistedData(lastPersistedRef.current, dataToSave, remote)
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

      if (!persistedEquals(dataToSave, pickPersisted(next))) {
        applyPersistedToState(dataToSave, next)
      }

      return dataToSave
    }

    try {
      let lastError: unknown = null
      for (let attempt = 0; attempt < PERSIST_MAX_ATTEMPTS; attempt++) {
        try {
          const dataToSave = await runLocalSave()
          lastPersistedRef.current = dataToSave
          pendingSaveRef.current = null
          ignoreRemoteUntil.current = Date.now() + IGNORE_REMOTE_AFTER_SAVE_MS
          setError(null)
          lastError = null
          break
        } catch (e) {
          lastError = e
          if (attempt < PERSIST_MAX_ATTEMPTS - 1) {
            await sleep(PERSIST_RETRY_MS * (attempt + 1))
          }
        }
      }

      if (lastError) {
        throw lastError
      }
    } catch (e) {
      setError(formatPersistErrorMessage(e, repo.mode === 'supabase'))
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }, [applyPersistedToState])

  const persist = useCallback(
    (next: AppState): Promise<void> => {
      const job = persistChainRef.current
        .catch(() => {})
        .then(() => persistInner(next))
      persistChainRef.current = job.catch(() => {})
      return job
    },
    [persistInner],
  )

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
    if (savingRef.current) return
    if (Date.now() < ignoreRemoteUntil.current) return
    if (
      hasPendingLocalChanges(
        stateRef.current,
        lastPersistedRef.current,
        pendingSaveRef.current,
        saveTimer.current,
      )
    ) {
      return
    }

    skipSave.current = true
    try {
      const remote = await repoRef.current.loadData()
      const data = prepareLoadedData(remote)
      const base = lastPersistedRef.current

      setState((prev) => {
        const local = pickPersisted(prev)
        const merged = base ? mergePersistedData(base, local, data) : data
        lastPersistedRef.current = merged
        const next = preserveUi(prev, merged)
        if (persistedEquals(pickPersisted(prev), pickPersisted(next))) return prev
        return next
      })
      setError(null)
    } catch (e) {
      setError(
        e instanceof Error
          ? `Erro ao sincronizar: ${e.message}`
          : 'Erro ao sincronizar com a nuvem.',
      )
    } finally {
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

      if (isSupabaseConfigured()) {
        clearLocalPersistedData()
      }

      const repo = pickRepository()
      repoRef.current = repo
      setStorageMode(repo.mode)

      try {
        const remote = await repo.loadData()
        const data = prepareLoadedData(remote)
        const ui = repo.mode === 'supabase' ? { activeNfId: null, activeItemIndex: null } : repo.loadUiPrefs()

        if (!cancelled) {
          lastPersistedRef.current = data
          setState({ ...data, ...ui })
          setError(null)
        }
      } catch (e) {
        if (!cancelled) {
          if (repo.mode === 'supabase') {
            setError(
              e instanceof Error
                ? `Não foi possível carregar da nuvem: ${e.message}`
                : 'Não foi possível carregar da nuvem. Confira o Supabase.',
            )
          } else {
            setError(e instanceof Error ? e.message : 'Erro ao carregar dados.')
          }
        }
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

    const unsubscribe = subscribeEnderecamentoChanges(() => {
      if (Date.now() < ignoreRemoteUntil.current) return
      scheduleRemoteReload()
    })
    const poll = window.setInterval(scheduleRemoteReload, POLL_INTERVAL_MS)

    const onVisible = () => {
      if (document.visibilityState === 'visible') scheduleRemoteReload()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      unsubscribe()
      window.clearInterval(poll)
      document.removeEventListener('visibilitychange', onVisible)
      if (reloadTimer.current) clearTimeout(reloadTimer.current)
    }
  }, [loading, scheduleRemoteReload, storageMode])

  useEffect(() => {
    if (skipSave.current || loading) return

    const persisted = pickPersisted(state)
    if (lastPersistedRef.current && persistedEquals(persisted, lastPersistedRef.current)) {
      return
    }

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
      if (skipSave.current || savingRef.current) return
      const pending = pendingSaveRef.current ?? stateRef.current
      if (saveTimer.current) {
        clearTimeout(saveTimer.current)
        saveTimer.current = null
      }
      pendingSaveRef.current = null
      ignoreRemoteUntil.current = Date.now() + IGNORE_REMOTE_AFTER_SAVE_MS
      void persist(pending)
    }

    window.addEventListener('pagehide', flushPendingSave)
    window.addEventListener('beforeunload', flushPendingSave)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushPendingSave()
    })

    return () => {
      window.removeEventListener('pagehide', flushPendingSave)
      window.removeEventListener('beforeunload', flushPendingSave)
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
    error,
    clearError: () => setError(null),
  }
}
