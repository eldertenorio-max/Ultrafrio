import { useCallback, useEffect, useRef, useState } from 'react'
import { getRepository, getStorageMode, type EnderecamentoRepository } from '../lib/repository'
import {
  loadLocalPersistedData,
  loadLocalSyncBase,
  localRepository,
  syncWriteLocalDraft,
  syncWriteLocalSyncBase,
} from '../lib/repository/localRepository'
import { ensureSupabaseConfig } from '../lib/supabaseConfig'
import { isSupabaseConfigured } from '../lib/supabaseClient'
import { subscribeEnderecamentoChanges } from '../lib/supabaseRealtime'
import { normalizePersistedData, prepareLoadedDataWithRepair } from '../lib/persistence'
import { contarEnderecosPersistidos } from '../lib/movimentos'
import { mesclarEmitentesSugeridos, normalizarEmitente } from '../lib/emitentesRegistry'
import {
  consolidarRemocoesLocais,
  mergePersistedData,
  nfIdsRemovidosDesde,
  persistedEquals,
  pickPersisted,
  protegerNotasContraRegressao,
  protegerPersistedContraRegressao,
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
const SAVE_DEBOUNCE_SUPABASE_MS = 50
const REMOTE_RELOAD_DEBOUNCE_MS = 200
/** Ignora eco do próprio save no Realtime; não bloqueia updates de outros navegadores por muito tempo. */
const IGNORE_REMOTE_AFTER_SAVE_MS = 1500
const POLL_INTERVAL_MS = 2000
const PERSIST_RETRY_MS = 600
const PERSIST_AUTO_RETRY_MS = 2500
const PERSIST_AUTO_RETRY_MAX = 5

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

function mergeLoadedWithLocalDraft(remote: PersistedData): PersistedData {
  const draft = loadLocalPersistedData()
  const base = loadLocalSyncBase() ?? remote
  const merged = mergePersistedData(base, draft, remote)
  const protegido = protegerPersistedContraRegressao(draft, merged)
  return consolidarRemocoesLocais(base, draft, protegido)
}

function preserveUi(
  prev: AppState,
  data: PersistedData,
  options?: { trustRemote?: boolean },
): AppState {
  let notas = options?.trustRemote
    ? data.notas
    : protegerNotasContraRegressao(prev.notas, data.notas)
  let activeNfId = prev.activeNfId

  if (activeNfId) {
    const inMerged = notas.some((n) => n.id === activeNfId)
    const prevNf = prev.notas.find((n) => n.id === activeNfId)
    if (
      !inMerged &&
      prevNf &&
      (prevNf.status === 'em_andamento' || prevNf.status === 'concluida')
    ) {
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
  const autoRetryCountRef = useRef(0)
  const autoRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const remoteReloadQueuedRef = useRef(false)
  const scheduleRemoteReloadRef = useRef<() => void>(() => {})

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
        syncWriteLocalDraft(dataToSave)
        syncWriteLocalSyncBase(dataToSave)
        lastPersistedRef.current = dataToSave
        pendingSaveRef.current = null
        return dataToSave
      }

      let dataToSave = pickPersisted(next)

      if (lastPersistedRef.current) {
        const remote = pickPersisted(await repo.loadData())
        const localPick = pickPersisted(next)
        dataToSave = mergePersistedData(lastPersistedRef.current, localPick, remote)
        dataToSave = protegerPersistedContraRegressao(localPick, dataToSave)
        dataToSave = consolidarRemocoesLocais(lastPersistedRef.current, localPick, dataToSave)
      }

      dataToSave = normalizePersistedData(dataToSave)

      await repo.saveData({
        notas: dataToSave.notas,
        movimentos: dataToSave.movimentos,
        notasCanceladas: dataToSave.notasCanceladas,
      })
      repo.saveUiPrefs({
        activeNfId: next.activeNfId,
        activeItemIndex: next.activeItemIndex,
      })
      syncWriteLocalDraft(dataToSave)
      syncWriteLocalSyncBase(dataToSave)

      if (!persistedEquals(dataToSave, pickPersisted(next))) {
        const localPick = pickPersisted(next)
        const removidas = lastPersistedRef.current
          ? nfIdsRemovidosDesde(lastPersistedRef.current, localPick)
          : new Set<string>()
        const restaurariaRemovidas =
          removidas.size > 0 && dataToSave.notas.some((n) => removidas.has(n.id))
        if (
          !restaurariaRemovidas &&
          contarEnderecosPersistidos(dataToSave) >= contarEnderecosPersistidos(localPick)
        ) {
          applyPersistedToState(dataToSave, next)
        }
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
          window.setTimeout(() => {
            if (remoteReloadQueuedRef.current) {
              remoteReloadQueuedRef.current = false
              scheduleRemoteReloadRef.current()
            }
          }, IGNORE_REMOTE_AFTER_SAVE_MS + 100)
          autoRetryCountRef.current = 0
          if (autoRetryTimerRef.current) {
            clearTimeout(autoRetryTimerRef.current)
            autoRetryTimerRef.current = null
          }
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
      if (
        repo.mode === 'supabase' &&
        autoRetryCountRef.current < PERSIST_AUTO_RETRY_MAX &&
        hasPendingLocalChanges(stateRef.current, lastPersistedRef.current, null, null) &&
        !autoRetryTimerRef.current
      ) {
        autoRetryCountRef.current += 1
        autoRetryTimerRef.current = setTimeout(() => {
          autoRetryTimerRef.current = null
          if (
            skipSave.current ||
            savingRef.current ||
            !hasPendingLocalChanges(stateRef.current, lastPersistedRef.current, null, null)
          ) {
            return
          }
          const job = persistChainRef.current
            .catch(() => {})
            .then(() => persistInner(stateRef.current))
          persistChainRef.current = job.catch(() => {})
        }, PERSIST_AUTO_RETRY_MS)
      }
    } finally {
      savingRef.current = false
      setSaving(false)
      if (remoteReloadQueuedRef.current) {
        remoteReloadQueuedRef.current = false
        scheduleRemoteReloadRef.current()
      }
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

  const requestRemoteReload = useCallback(() => {
    if (savingRef.current || Date.now() < ignoreRemoteUntil.current) {
      remoteReloadQueuedRef.current = true
      return
    }
    scheduleRemoteReloadRef.current()
  }, [])

  const reloadFromRemote = useCallback(async () => {
    if (repoRef.current.mode !== 'supabase') return
    if (savingRef.current) {
      remoteReloadQueuedRef.current = true
      return
    }
    if (Date.now() < ignoreRemoteUntil.current) {
      remoteReloadQueuedRef.current = true
      return
    }
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
      const { data, dadosReparados } = prepareLoadedDataWithRepair(remote)
      const base = lastPersistedRef.current
      const localNow = pickPersisted(stateRef.current)
      const trustRemote = base !== null && persistedEquals(localNow, base)

      setState((prev) => {
        const local = pickPersisted(prev)
        const merged = trustRemote
          ? data
          : base
            ? mergePersistedData(base, local, data)
            : data
        const protegido = trustRemote
          ? merged
          : protegerPersistedContraRegressao(local, merged)
        const consolidado = consolidarRemocoesLocais(base, local, protegido)
        const normalized = normalizePersistedData(consolidado)
        lastPersistedRef.current = normalized
        const next = preserveUi(prev, normalized, { trustRemote })
        if (persistedEquals(pickPersisted(prev), pickPersisted(next))) return prev
        return next
      })
      setError(null)

      const merged = lastPersistedRef.current
      const precisaSalvarReparo = dadosReparados || (merged && !persistedEquals(merged, data))

      if (precisaSalvarReparo && merged) {
        skipSave.current = true
        try {
          const reparado = normalizePersistedData(merged)
          await repoRef.current.saveData({
            notas: reparado.notas,
            movimentos: reparado.movimentos,
            notasCanceladas: reparado.notasCanceladas,
          })
          lastPersistedRef.current = reparado
          ignoreRemoteUntil.current = Date.now() + IGNORE_REMOTE_AFTER_SAVE_MS
        } catch (e) {
          setError(
            e instanceof Error
              ? `Dados recuperados do histórico, mas falhou ao salvar na nuvem: ${e.message}`
              : 'Dados recuperados do histórico, mas falhou ao salvar na nuvem.',
          )
        }
      }
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
    scheduleRemoteReloadRef.current = scheduleRemoteReload
  }, [scheduleRemoteReload])

  useEffect(() => {
    let cancelled = false

    async function load() {
      await ensureSupabaseConfig()

      const repo = pickRepository()
      repoRef.current = repo
      setStorageMode(repo.mode)

      try {
        const remoteRaw = await repo.loadData()
        const { data: remotePrepared, dadosReparados } = prepareLoadedDataWithRepair(remoteRaw)
        const data =
          repo.mode === 'supabase'
            ? normalizePersistedData(mergeLoadedWithLocalDraft(remotePrepared))
            : remotePrepared
        const ui = repo.loadUiPrefs()

        if (!cancelled) {
          lastPersistedRef.current = data
          syncWriteLocalDraft(data)
          syncWriteLocalSyncBase(data)
          setState({ ...data, ...ui })
          setError(null)

          if (repo.mode === 'supabase' && (dadosReparados || !persistedEquals(data, remotePrepared))) {
            skipSave.current = true
            try {
              await repo.saveData({
                notas: data.notas,
                movimentos: data.movimentos,
                notasCanceladas: data.notasCanceladas,
              })
              lastPersistedRef.current = data
              syncWriteLocalSyncBase(data)
              ignoreRemoteUntil.current = Date.now() + IGNORE_REMOTE_AFTER_SAVE_MS
            } catch (e) {
              setError(
                e instanceof Error
                  ? `Alterações locais recuperadas, mas falhou ao sincronizar na nuvem: ${e.message}`
                  : 'Alterações locais recuperadas, mas falhou ao sincronizar na nuvem.',
              )
            } finally {
              skipSave.current = false
            }
          }
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
      requestRemoteReload()
    })
    const poll = window.setInterval(() => requestRemoteReload(), POLL_INTERVAL_MS)

    const onVisible = () => {
      if (document.visibilityState === 'visible') requestRemoteReload()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      unsubscribe()
      window.clearInterval(poll)
      document.removeEventListener('visibilitychange', onVisible)
      if (reloadTimer.current) clearTimeout(reloadTimer.current)
    }
  }, [loading, requestRemoteReload, storageMode])

  useEffect(() => {
    if (skipSave.current || loading) return

    const persisted = pickPersisted(state)
    syncWriteLocalDraft(persisted)

    if (lastPersistedRef.current && persistedEquals(persisted, lastPersistedRef.current)) {
      return
    }

    pendingSaveRef.current = state
    if (saveTimer.current) clearTimeout(saveTimer.current)
    const debounceMs = storageMode === 'supabase' ? SAVE_DEBOUNCE_SUPABASE_MS : SAVE_DEBOUNCE_MS
    saveTimer.current = setTimeout(() => {
      const pending = pendingSaveRef.current ?? stateRef.current
      pendingSaveRef.current = null
      void persist(pending)
    }, debounceMs)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [state, loading, persist, storageMode])

  useEffect(() => {
    const flushPendingSave = () => {
      if (skipSave.current || savingRef.current) return
      const pending = pendingSaveRef.current ?? stateRef.current
      syncWriteLocalDraft(pickPersisted(pending))
      repoRef.current.saveUiPrefs({
        activeNfId: pending.activeNfId,
        activeItemIndex: pending.activeItemIndex,
      })
      if (saveTimer.current) {
        clearTimeout(saveTimer.current)
        saveTimer.current = null
      }
      pendingSaveRef.current = null
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
