import { useCallback, useEffect, useRef, useState } from 'react'
import type { NotaFiscal } from '../types'
import { getSupabase, isSupabaseConfigured } from '../lib/supabaseClient'
import { sincronizarClientesFromNotas } from '../lib/financeiro/clientes'
import { getFinanceiroRepository } from '../lib/financeiro/repository'
import type { FinanceiroData } from '../lib/financeiro/types'
import { financeiroVazio } from '../lib/financeiro/types'

const FIN_TABLES = [
  'ultrafrio_fin_tabelas',
  'ultrafrio_fin_clientes',
  'ultrafrio_fin_contratos',
] as const

export function useFinanceiro(notas: NotaFiscal[]) {
  const [data, setData] = useState<FinanceiroData>(financeiroVazio)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dataRef = useRef(data)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const persistChain = useRef<Promise<void>>(Promise.resolve())

  dataRef.current = data

  const load = useCallback(async () => {
    try {
      setError(null)
      const repo = getFinanceiroRepository()
      const loaded = await repo.load()
      const synced = sincronizarClientesFromNotas(loaded, notas)
      setData(synced)
      if (synced.clientes.length > loaded.clientes.length) {
        await repo.save(synced)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar financeiro.')
    } finally {
      setLoading(false)
    }
  }, [notas])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!isSupabaseConfigured()) return
    const sb = getSupabase()
    let channel = sb.channel('ultrafrio-fin-sync')
    for (const table of FIN_TABLES) {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        void load()
      })
    }
    channel.subscribe()
    return () => {
      void sb.removeChannel(channel)
    }
  }, [load])

  const persist = useCallback(async (next: FinanceiroData) => {
    persistChain.current = persistChain.current.then(async () => {
      setSaving(true)
      try {
        await getFinanceiroRepository().save(next)
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erro ao salvar financeiro.')
      } finally {
        setSaving(false)
      }
    })
    await persistChain.current
  }, [])

  const updateData = useCallback(
    (updater: (prev: FinanceiroData) => FinanceiroData) => {
      setData((prev) => {
        const next = updater(prev)
        if (saveTimer.current) clearTimeout(saveTimer.current)
        saveTimer.current = setTimeout(() => void persist(next), 300)
        return next
      })
    },
    [persist],
  )

  const saveNow = useCallback(async () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    await persist(dataRef.current)
  }, [persist])

  const registrarClienteFromNf = useCallback(
    (nf: NotaFiscal) => {
      updateData((prev) => {
        const synced = sincronizarClientesFromNotas(prev, [nf])
        return synced.clientes.length > prev.clientes.length ? synced : prev
      })
    },
    [updateData],
  )

  return {
    data,
    loading,
    saving,
    error,
    updateData,
    saveNow,
    registrarClienteFromNf,
    reload: load,
  }
}
