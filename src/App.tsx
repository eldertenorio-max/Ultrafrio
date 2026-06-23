import { useCallback, useMemo, useState } from 'react'
import { DetailModal } from './components/DetailModal'
import { LayoutPanel } from './components/LayoutPanel'
import { NfSidebar } from './components/NfSidebar'
import { useEnderecamentoStore } from './hooks/useEnderecamentoStore'
import { allItemsAllocated } from './lib/repository'
import { parseNfeXml } from './lib/parseNfeXml'
import type { AddressId, AddressOccupancy } from './types'
import './App.css'

function buildOccupancyMap(notas: import('./types').NotaFiscal[]): Map<AddressId, AddressOccupancy> {
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
  const [pendingSelection, setPendingSelection] = useState<Set<AddressId>>(new Set())
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [detailAddress, setDetailAddress] = useState<AddressId | null>(null)

  const occupancy = useMemo(() => buildOccupancyMap(state.notas), [state.notas])
  const activeNf = state.notas.find((n) => n.id === state.activeNfId) ?? null
  const allocateMode =
    !!activeNf && activeNf.status !== 'concluida' && state.activeItemIndex != null

  const syncPendingFromItem = useCallback((nf: import('./types').NotaFiscal, itemIndex: number) => {
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
        activeNfId: nf.id,
        activeItemIndex: 0,
      }))
      setPendingSelection(new Set())
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
      return { ...s, notas }
    })

    const nextItem = activeNf.items.find(
      (it) => it.index !== currentItemIndex && it.allocatedAddresses.length === 0,
    )
    if (nextItem) {
      setState((s) => ({ ...s, activeItemIndex: nextItem.index }))
      setPendingSelection(new Set())
    }
  }

  function handleFinishNf() {
    if (!activeNf || !allItemsAllocated(activeNf)) return
    setState((s) => ({
      ...s,
      notas: s.notas.map((n) => (n.id === activeNf.id ? { ...n, status: 'concluida' as const } : n)),
      activeItemIndex: null,
    }))
    setPendingSelection(new Set())
  }

  function handleRemoveNf(id: string) {
    setState((s) => ({
      ...s,
      notas: s.notas.filter((n) => n.id !== id),
      activeNfId: s.activeNfId === id ? null : s.activeNfId,
      activeItemIndex: s.activeNfId === id ? null : s.activeItemIndex,
    }))
    setPendingSelection(new Set())
    setDetailAddress(null)
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
      <NfSidebar
        notas={state.notas}
        activeNfId={state.activeNfId}
        activeItemIndex={state.activeItemIndex}
        pendingCount={pendingSelection.size}
        saving={saving}
        persistError={error}
        onUpload={handleUpload}
        onSelectNf={handleSelectNf}
        onSelectItem={handleSelectItem}
        onConfirmItem={handleConfirmItem}
        onFinishNf={handleFinishNf}
        onRemoveNf={handleRemoveNf}
        uploadError={uploadError}
      />

      <main className="main-panel">
        <LayoutPanel
          occupancy={occupancy}
          pendingSelection={pendingSelection}
          activeNfNumero={activeNf?.numero ?? null}
          allocateMode={allocateMode}
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
