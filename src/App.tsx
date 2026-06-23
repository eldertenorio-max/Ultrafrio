import { useCallback, useMemo, useState } from 'react'
import { AppSidebar } from './components/AppSidebar'
import { DetailModal } from './components/DetailModal'
import { LayoutPanel } from './components/LayoutPanel'
import { useEnderecamentoStore } from './hooks/useEnderecamentoStore'
import { allItemsAllocated } from './lib/repository'
import {
  aplicarSaidaItens,
  buscarNfPorNumero,
  criarMovimentoSaida,
  enderecosDaNf,
  enderecosDosItens,
  excluirMovimento,
  upsertMovimentoEntrada,
} from './lib/movimentos'
import { parseNfeXml } from './lib/parseNfeXml'
import type { AddressId, AddressOccupancy, AppTab, NotaFiscal } from './types'
import './App.css'

function buildOccupancyMap(notas: NotaFiscal[]): Map<AddressId, AddressOccupancy> {
  const map = new Map<AddressId, AddressOccupancy>()
  for (const nf of notas) {
    for (const item of nf.items) {
      for (const addr of item.allocatedAddresses) {
        map.set(addr, {
          nfId: nf.id,
          nfNumero: nf.numero,
          itemIndex: item.index,
          codigo: item.codigo,
          descricao: item.descricao,
          quantidade: item.quantidade,
          unidade: item.unidade,
        })
      }
    }
  }
  return map
}

export default function App() {
  const { state, setState, loading, saving, error, clearError } = useEnderecamentoStore()
  const [tab, setTab] = useState<AppTab>('entrada')
  const [pendingSelection, setPendingSelection] = useState<Set<AddressId>>(new Set())
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [detailAddress, setDetailAddress] = useState<AddressId | null>(null)

  const [nfBuscaSaidaId, setNfBuscaSaidaId] = useState<string | null>(null)
  const [itensFlagados, setItensFlagados] = useState<Set<number>>(new Set())
  const [buscaErro, setBuscaErro] = useState<string | null>(null)

  const occupancy = useMemo(() => buildOccupancyMap(state.notas), [state.notas])
  const activeNf = state.notas.find((n) => n.id === state.activeNfId) ?? null
  const nfBuscaSaida = nfBuscaSaidaId
    ? state.notas.find((n) => n.id === nfBuscaSaidaId) ?? null
    : null

  const allocateMode =
    tab === 'entrada' &&
    !!activeNf &&
    activeNf.status === 'em_andamento' &&
    state.activeItemIndex != null

  const saidaAddresses = useMemo(() => {
    if (tab !== 'saida' || !nfBuscaSaida) return new Set<AddressId>()
    return new Set(enderecosDaNf(nfBuscaSaida))
  }, [tab, nfBuscaSaida])

  const saidaFlaggedAddresses = useMemo(() => {
    if (!nfBuscaSaida || itensFlagados.size === 0) return new Set<AddressId>()
    return new Set(enderecosDosItens(nfBuscaSaida, [...itensFlagados]))
  }, [nfBuscaSaida, itensFlagados])

  const movimentosOrdenados = useMemo(
    () => [...state.movimentos].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [state.movimentos],
  )

  const syncPendingFromItem = useCallback((nf: NotaFiscal, itemIndex: number) => {
    const item = nf.items[itemIndex]
    if (!item) {
      setPendingSelection(new Set())
      return
    }
    setPendingSelection(new Set(item.allocatedAddresses))
  }, [])

  async function handleUpload(file: File) {
    setUploadError(null)
    clearError()
    try {
      const text = await file.text()
      const nf = parseNfeXml(text)
      if (state.notas.some((n) => n.id === nf.id)) {
        setUploadError('Esta NF já foi importada.')
        return
      }
      setState((s) => ({
        ...s,
        notas: [nf, ...s.notas],
        movimentos: upsertMovimentoEntrada(s.movimentos, nf),
        activeNfId: nf.id,
        activeItemIndex: 0,
      }))
      setPendingSelection(new Set())
      setTab('entrada')
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Erro ao ler XML.')
    }
  }

  function handleSelectNf(id: string) {
    const nf = state.notas.find((n) => n.id === id)
    setState((s) => ({ ...s, activeNfId: id, activeItemIndex: nf?.items[0]?.index ?? null }))
    if (nf && nf.items[0]) syncPendingFromItem(nf, nf.items[0].index)
    else setPendingSelection(new Set())
    setDetailAddress(null)
    setTab('entrada')
  }

  function handleSelectItem(index: number) {
    if (!activeNf) return
    setState((s) => ({ ...s, activeItemIndex: index }))
    syncPendingFromItem(activeNf, index)
  }

  function handleCellClick(addressId: AddressId, canInteract: boolean) {
    if (!canInteract) return

    const occ = occupancy.get(addressId)

    if (occ && (!allocateMode || occ.nfId !== state.activeNfId)) {
      setDetailAddress(addressId)
      return
    }

    if (!allocateMode || !activeNf) {
      if (occ) setDetailAddress(addressId)
      return
    }

    const occupiedByOther = occ && occ.nfId !== activeNf.id
    if (occupiedByOther) {
      setDetailAddress(addressId)
      return
    }

    setPendingSelection((prev) => {
      const next = new Set(prev)
      if (next.has(addressId)) next.delete(addressId)
      else next.add(addressId)
      return next
    })
  }

  function handleConfirmItem() {
    if (!activeNf || state.activeItemIndex == null) return
    const addresses = [...pendingSelection]
    const currentItemIndex = state.activeItemIndex

    setState((s) => {
      const notas = s.notas.map((nf) => {
        if (nf.id !== activeNf.id) {
          return {
            ...nf,
            items: nf.items.map((it) => ({
              ...it,
              allocatedAddresses: it.allocatedAddresses.filter((a) => !addresses.includes(a)),
            })),
          }
        }
        return {
          ...nf,
          items: nf.items.map((it) => {
            if (it.index !== currentItemIndex) {
              return {
                ...it,
                allocatedAddresses: it.allocatedAddresses.filter((a) => !addresses.includes(a)),
              }
            }
            return { ...it, allocatedAddresses: addresses }
          }),
        }
      })
      const updatedNf = notas.find((n) => n.id === activeNf.id)!
      return {
        ...s,
        notas,
        movimentos: upsertMovimentoEntrada(s.movimentos, updatedNf),
      }
    })

    const nextItem = activeNf.items.find(
      (it) => it.index !== currentItemIndex && it.allocatedAddresses.length === 0,
    )
    if (nextItem) {
      setState((s) => ({ ...s, activeItemIndex: nextItem.index }))
      setPendingSelection(new Set())
    }
  }

  function handleFinishEntrada() {
    if (!activeNf || !allItemsAllocated(activeNf)) return
    setState((s) => {
      const notas = s.notas.map((n) =>
        n.id === activeNf.id ? { ...n, status: 'concluida' as const } : n,
      )
      const updatedNf = notas.find((n) => n.id === activeNf.id)!
      return {
        ...s,
        notas,
        movimentos: upsertMovimentoEntrada(s.movimentos, updatedNf),
        activeItemIndex: null,
      }
    })
    setPendingSelection(new Set())
    setTab('historico')
  }

  function handleBuscarSaida(numero: string) {
    setBuscaErro(null)
    const nf = buscarNfPorNumero(state.notas, numero)
    if (!nf) {
      setBuscaErro('NF não encontrada.')
      setNfBuscaSaidaId(null)
      setItensFlagados(new Set())
      return
    }
    setNfBuscaSaidaId(nf.id)
    setItensFlagados(new Set())
  }

  function handleToggleItemSaida(index: number) {
    setItensFlagados((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  function handleFinalizarSaida() {
    if (!nfBuscaSaida || itensFlagados.size === 0) return
    const indexes = [...itensFlagados]
    const mov = criarMovimentoSaida(nfBuscaSaida, indexes)
    setState((s) => ({
      ...s,
      notas: s.notas.map((n) => (n.id === nfBuscaSaida.id ? aplicarSaidaItens(n, indexes) : n)),
      movimentos: [mov, ...s.movimentos],
    }))
    setNfBuscaSaidaId(null)
    setItensFlagados(new Set())
    setTab('historico')
  }

  function handleExcluirMovimento(movId: string) {
    setState((s) => {
      const result = excluirMovimento({ notas: s.notas, movimentos: s.movimentos }, movId)
      const mov = s.movimentos.find((m) => m.id === movId)
      const nfRemoved = mov?.tipo === 'entrada'
      return {
        ...s,
        notas: result.notas,
        movimentos: result.movimentos,
        activeNfId: nfRemoved || !result.notas.some((n) => n.id === s.activeNfId) ? null : s.activeNfId,
        activeItemIndex:
          nfRemoved || !result.notas.some((n) => n.id === s.activeNfId) ? null : s.activeItemIndex,
      }
    })
    if (nfBuscaSaidaId) {
      const mov = state.movimentos.find((m) => m.id === movId)
      if (mov?.nfId === nfBuscaSaidaId && mov.tipo === 'entrada') {
        setNfBuscaSaidaId(null)
        setItensFlagados(new Set())
      }
    }
    setPendingSelection(new Set())
    setDetailAddress(null)
  }

  function handleTabChange(next: AppTab) {
    setTab(next)
    if (next !== 'saida') {
      setNfBuscaSaidaId(null)
      setItensFlagados(new Set())
      setBuscaErro(null)
    }
  }

  const detailOcc = detailAddress ? occupancy.get(detailAddress) : null
  const detailNota = detailOcc ? state.notas.find((n) => n.id === detailOcc.nfId) : null

  if (loading) {
    return (
      <div className="app-loading">
        <p>Carregando endereçamento…</p>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <AppSidebar
        tab={tab}
        onTabChange={handleTabChange}
        saving={saving}
        persistError={error}
        entrada={{
          notas: state.notas,
          activeNfId: state.activeNfId,
          activeItemIndex: state.activeItemIndex,
          pendingCount: pendingSelection.size,
          onUpload: handleUpload,
          onSelectNf: handleSelectNf,
          onSelectItem: handleSelectItem,
          onConfirmItem: handleConfirmItem,
          onFinishEntrada: handleFinishEntrada,
          uploadError,
        }}
        saida={{
          nfBusca: nfBuscaSaida,
          itensFlagados,
          onBuscar: handleBuscarSaida,
          onToggleItem: handleToggleItemSaida,
          onFinalizarSaida: handleFinalizarSaida,
          buscaErro,
        }}
        historico={{
          movimentos: movimentosOrdenados,
          onExcluir: handleExcluirMovimento,
        }}
      />

      <main className="main-panel">
        <LayoutPanel
          occupancy={occupancy}
          pendingSelection={pendingSelection}
          activeNfNumero={activeNf?.numero ?? null}
          allocateMode={allocateMode}
          saidaAddresses={saidaAddresses}
          saidaFlaggedAddresses={saidaFlaggedAddresses}
          onCellClick={handleCellClick}
        />
      </main>

      {detailAddress && detailOcc && detailNota && (
        <DetailModal
          addressId={detailAddress}
          nota={detailNota}
          onClose={() => setDetailAddress(null)}
        />
      )}
    </div>
  )
}
