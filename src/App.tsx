import { useCallback, useMemo, useState } from 'react'
import { AppSidebar } from './components/AppSidebar'
import { DetailModal } from './components/DetailModal'
import { IntroSplash } from './components/IntroSplash'
import { LayoutPanel } from './components/LayoutPanel'
import { OcupadoAlert } from './components/OcupadoAlert'
import { useEnderecamentoStore } from './hooks/useEnderecamentoStore'
import { useTheme } from './hooks/useTheme'
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
import {
  desvincularNotaCancelada,
  excluirNotaCancelada,
  notaFiscalToCancelada,
  syncVinculosNotas,
  vincularNotaCancelada,
} from './lib/nfCanceladas'
import { mensagemNfDuplicada } from './lib/nfDuplicate'
import { parseNfeXml } from './lib/parseNfeXml'
import type { AddressId, AddressOccupancy, NotaFiscal } from './types'
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
  const { theme, toggleTheme } = useTheme()
  const [introDone, setIntroDone] = useState(false)
  const [pendingSelection, setPendingSelection] = useState<Set<AddressId>>(new Set())
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [detailAddress, setDetailAddress] = useState<AddressId | null>(null)

  const [nfBuscaSaidaId, setNfBuscaSaidaId] = useState<string | null>(null)
  const [itensFlagados, setItensFlagados] = useState<Set<number>>(new Set())
  const [buscaErro, setBuscaErro] = useState<string | null>(null)
  const [nfEditarId, setNfEditarId] = useState<string | null>(null)
  const [editItemIndex, setEditItemIndex] = useState<number | null>(null)
  const [editPendingSelection, setEditPendingSelection] = useState<Set<AddressId>>(new Set())
  const [buscaEditarErro, setBuscaEditarErro] = useState<string | null>(null)
  const [uploadCanceladaError, setUploadCanceladaError] = useState<string | null>(null)
  const [ocupadoAlert, setOcupadoAlert] = useState<{
    addressId: AddressId
    occ: AddressOccupancy
  } | null>(null)

  const occupancy = useMemo(() => buildOccupancyMap(state.notas), [state.notas])
  const activeNf = state.notas.find((n) => n.id === state.activeNfId) ?? null
  const nfBuscaSaida = nfBuscaSaidaId
    ? state.notas.find((n) => n.id === nfBuscaSaidaId) ?? null
    : null
  const nfEditar = nfEditarId ? state.notas.find((n) => n.id === nfEditarId) ?? null : null

  const allocateMode =
    !!activeNf &&
    activeNf.status === 'em_andamento' &&
    state.activeItemIndex != null

  const editMode = nfEditar != null && editItemIndex != null

  const displayOccupancy = useMemo(() => {
    const map = new Map(occupancy)
    if (editMode) {
      for (const addr of editPendingSelection) map.delete(addr)
      return map
    }
    if (allocateMode && activeNf && state.activeItemIndex != null) {
      for (const addr of pendingSelection) map.delete(addr)
    }
    return map
  }, [
    occupancy,
    editMode,
    editPendingSelection,
    allocateMode,
    activeNf,
    state.activeItemIndex,
    pendingSelection,
  ])

  const saidaAddresses = useMemo(() => {
    if (!nfBuscaSaida) return new Set<AddressId>()
    return new Set(enderecosDaNf(nfBuscaSaida))
  }, [nfBuscaSaida])

  const saidaFlaggedAddresses = useMemo(() => {
    if (!nfBuscaSaida || itensFlagados.size === 0) return new Set<AddressId>()
    return new Set(enderecosDosItens(nfBuscaSaida, [...itensFlagados]))
  }, [nfBuscaSaida, itensFlagados])

  const editNfAddresses = useMemo(() => {
    if (!nfEditar) return new Set<AddressId>()
    return new Set(enderecosDaNf(nfEditar))
  }, [nfEditar])

  const panelPendingSelection = editMode ? editPendingSelection : pendingSelection
  const panelAllocateMode = allocateMode || editMode
  const panelActiveNfNumero = editMode ? nfEditar?.numero ?? null : activeNf?.numero ?? null

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
      const dup = mensagemNfDuplicada(nf, state.notas, state.notasCanceladas)
      if (dup) {
        setUploadError(dup)
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
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Erro ao ler XML.')
    }
  }

  async function handleUploadCancelada(file: File) {
    setUploadCanceladaError(null)
    clearError()
    try {
      const text = await file.text()
      const parsed = parseNfeXml(text)
      const dup = mensagemNfDuplicada(parsed, state.notas, state.notasCanceladas)
      if (dup) {
        setUploadCanceladaError(dup)
        return
      }
      const cancelada = notaFiscalToCancelada(parsed)
      setState((s) => ({
        ...s,
        notasCanceladas: [cancelada, ...s.notasCanceladas],
      }))
    } catch (e) {
      setUploadCanceladaError(e instanceof Error ? e.message : 'Erro ao ler XML.')
    }
  }

  function handleVincularCancelada(canceladaId: string, novaNfId: string) {
    setState((s) => ({ ...s, ...syncVinculosNotas(vincularNotaCancelada(s, canceladaId, novaNfId)) }))
  }

  function handleDesvincularCancelada(canceladaId: string) {
    setState((s) => ({ ...s, ...syncVinculosNotas(desvincularNotaCancelada(s, canceladaId)) }))
  }

  function handleExcluirCancelada(canceladaId: string) {
    setState((s) => ({ ...s, ...syncVinculosNotas(excluirNotaCancelada(s, canceladaId)) }))
  }

  function handleSelectNf(id: string) {
    const nf = state.notas.find((n) => n.id === id)
    setState((s) => ({ ...s, activeNfId: id, activeItemIndex: nf?.items[0]?.index ?? null }))
    if (nf && nf.items[0]) syncPendingFromItem(nf, nf.items[0].index)
    else setPendingSelection(new Set())
    setDetailAddress(null)
  }

  function handleSelectItem(index: number) {
    if (!activeNf) return
    setState((s) => ({ ...s, activeItemIndex: index }))
    syncPendingFromItem(activeNf, index)
  }

  function handleCellClick(addressId: AddressId, canInteract: boolean) {
    if (!canInteract) return

    const occ = occupancy.get(addressId)

    if (editMode && nfEditar && editItemIndex != null) {
      if (occ) {
        const mesmoItem = occ.nfId === nfEditar.id && occ.itemIndex === editItemIndex
        if (!mesmoItem) {
          setOcupadoAlert({ addressId, occ })
          return
        }
      }

      const nextPending = new Set(editPendingSelection)
      if (nextPending.has(addressId)) nextPending.delete(addressId)
      else nextPending.add(addressId)
      setEditPendingSelection(nextPending)
      return
    }

    if (allocateMode && activeNf && state.activeItemIndex != null) {
      if (occ) {
        const mesmoItem =
          occ.nfId === activeNf.id && occ.itemIndex === state.activeItemIndex
        if (!mesmoItem) {
          setOcupadoAlert({ addressId, occ })
          return
        }
      }

      const nextPending = new Set(pendingSelection)
      if (nextPending.has(addressId)) nextPending.delete(addressId)
      else nextPending.add(addressId)

      const currentItemIndex = state.activeItemIndex
      setPendingSelection(nextPending)
      setState((s) => ({
        ...s,
        notas: s.notas.map((nf) => {
          if (nf.id !== activeNf.id) return nf
          return {
            ...nf,
            items: nf.items.map((it) =>
              it.index === currentItemIndex
                ? { ...it, allocatedAddresses: [...nextPending] }
                : it,
            ),
          }
        }),
      }))
      return
    }

    if (occ) {
      if (allocateMode) {
        setOcupadoAlert({ addressId, occ })
        return
      }
      setDetailAddress(addressId)
      return
    }
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
  }

  function handleBuscarEditar(numero: string) {
    setBuscaEditarErro(null)
    const nf = buscarNfPorNumero(state.notas, numero)
    if (!nf) {
      setBuscaEditarErro('NF não encontrada.')
      setNfEditarId(null)
      setEditItemIndex(null)
      setEditPendingSelection(new Set())
      return
    }
    setNfEditarId(nf.id)
    setEditItemIndex(null)
    setEditPendingSelection(new Set())
  }

  function handleSelectItemEditar(index: number) {
    if (!nfEditar) return
    const item = nfEditar.items.find((it) => it.index === index)
    if (!item) return
    setEditItemIndex(index)
    setEditPendingSelection(new Set(item.allocatedAddresses))
    setDetailAddress(null)
  }

  function handleSalvarEditar() {
    if (!nfEditar || editItemIndex == null || editPendingSelection.size === 0) return
    const addresses = [...editPendingSelection]
    const currentItemIndex = editItemIndex

    setState((s) => {
      const notas = s.notas.map((nf) => {
        if (nf.id !== nfEditar.id) {
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
      const updatedNf = notas.find((n) => n.id === nfEditar.id)!
      return {
        ...s,
        notas,
        movimentos: upsertMovimentoEntrada(s.movimentos, updatedNf),
      }
    })
  }

  function handleExcluirMovimento(movId: string) {
    setState((s) => {
      const result = excluirMovimento(
        { notas: s.notas, movimentos: s.movimentos, notasCanceladas: s.notasCanceladas },
        movId,
      )
      const mov = s.movimentos.find((m) => m.id === movId)
      const nfRemoved = mov?.tipo === 'entrada'
      return {
        ...s,
        notas: result.notas,
        movimentos: result.movimentos,
        notasCanceladas: result.notasCanceladas,
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

  const detailOcc = detailAddress ? occupancy.get(detailAddress) : null
  const detailNota = detailOcc ? state.notas.find((n) => n.id === detailOcc.nfId) : null

  if (!introDone) {
    return <IntroSplash loading={loading} onFinish={() => setIntroDone(true)} />
  }

  return (
    <div className="app-shell">
      <AppSidebar
        saving={saving}
        persistError={error}
        theme={theme}
        onToggleTheme={toggleTheme}
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
          canceladas: state.notasCanceladas,
          onExcluir: handleExcluirMovimento,
          onExcluirCancelada: handleExcluirCancelada,
        }}
        canceladas={{
          canceladas: state.notasCanceladas,
          notas: state.notas,
          onUpload: handleUploadCancelada,
          onVincular: handleVincularCancelada,
          onDesvincular: handleDesvincularCancelada,
          onExcluir: handleExcluirCancelada,
          uploadError: uploadCanceladaError,
        }}
        editar={{
          nfBusca: nfEditar,
          itemIndex: editItemIndex,
          pendingCount: editPendingSelection.size,
          onBuscar: handleBuscarEditar,
          onSelectItem: handleSelectItemEditar,
          onSalvar: handleSalvarEditar,
          buscaErro: buscaEditarErro,
        }}
      />

      <main className="main-panel">
        <LayoutPanel
          occupancy={displayOccupancy}
          pendingSelection={panelPendingSelection}
          activeNfNumero={panelActiveNfNumero}
          allocateMode={panelAllocateMode}
          editMode={editMode}
          editAddresses={editMode ? editNfAddresses : undefined}
          saidaAddresses={editMode ? undefined : saidaAddresses}
          saidaFlaggedAddresses={editMode ? undefined : saidaFlaggedAddresses}
          onCellClick={handleCellClick}
        />
      </main>

      {ocupadoAlert && (
        <OcupadoAlert
          addressId={ocupadoAlert.addressId}
          occupancy={ocupadoAlert.occ}
          onClose={() => setOcupadoAlert(null)}
        />
      )}

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
