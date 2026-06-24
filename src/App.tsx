import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { AppSidebar } from './components/AppSidebar'
import { DetailModal } from './components/DetailModal'
import { ManualNfModal, type ManualNfModalResult } from './components/ManualNfModal'
import { IntroSplash } from './components/IntroSplash'
import { LayoutPanel } from './components/LayoutPanel'
import { PrintLayoutDocument } from './components/PrintLayoutDocument'
import { CAMARAS } from './layout/camaras'
import { OcupadoAlert } from './components/OcupadoAlert'
import { useEnderecamentoStore } from './hooks/useEnderecamentoStore'
import { useEntradaCamposConfig } from './hooks/useEntradaCamposConfig'
import { useTheme } from './hooks/useTheme'
import { useSidebarMode } from './hooks/useSidebarMode'
import { allItemsAllocated } from './lib/repository'
import { adicionarNotaManual } from './lib/manualNf'
import { mesclarEmitentesSugeridos } from './lib/emitentesRegistry'
import {
  aplicarSaidaItens,
  buscarNfPorNumero,
  criarMovimentoSaida,
  enderecosDaNf,
  enderecosDosItens,
  excluirMovimento,
  findMovimentoEntradaAtivo,
  upsertMovimentoEntrada,
} from './lib/movimentos'
import {
  desvincularNotaCancelada,
  excluirNotaCancelada,
  notaFiscalToCancelada,
  syncVinculosNotas,
  vincularNotaCancelada,
} from './lib/nfCanceladas'
import { mensagemNfCanceladaDuplicada, mensagemNfDuplicada } from './lib/nfDuplicate'
import { parseCanceladaXml } from './lib/parseCanceladaXml'
import { parseNfeXml } from './lib/parseNfeXml'
import type { EntradaItemCampos } from './lib/entradaCampos'
import type { AddressId, AddressOccupancy, JustificativaSaidaId, NotaFiscal } from './types'
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
  const {
    state,
    setState,
    saveNow,
    registrarEmitente,
    loading,
    saving,
    error,
    clearError,
  } = useEnderecamentoStore()
  const { theme, toggleTheme } = useTheme()
  const { sidebarFixed, toggleSidebarMode } = useSidebarMode()
  const entradaCampos = useEntradaCamposConfig()
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
  const [canceladaPendenteId, setCanceladaPendenteId] = useState<string | null>(null)
  const [printCamaras, setPrintCamaras] = useState<number[]>(() => CAMARAS.map((c) => c.id))
  const [ocupadoAlert, setOcupadoAlert] = useState<{
    addressId: AddressId
    occ: AddressOccupancy
  } | null>(null)
  const [manualNfModalOpen, setManualNfModalOpen] = useState(false)
  const [manualNfError, setManualNfError] = useState<string | null>(null)
  const [selectedEntradaIds, setSelectedEntradaIds] = useState<string[]>([])
  const lastEntradaClickRef = useRef<string | null>(null)

  const emAndamentoIds = useMemo(
    () => state.notas.filter((n) => n.status === 'em_andamento').map((n) => n.id),
    [state.notas],
  )

  useEffect(() => {
    const valid = new Set(emAndamentoIds)
    setSelectedEntradaIds((prev) => {
      const next = prev.filter((id) => valid.has(id))
      return next.length === prev.length ? prev : next
    })
  }, [emAndamentoIds])

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

  const canceladasAtivas = useMemo(
    () => state.notasCanceladas.filter((c) => !c.excluido),
    [state.notasCanceladas],
  )

  const movimentoEntradaEditar = useMemo(() => {
    if (!nfEditarId) return null
    return findMovimentoEntradaAtivo(state.movimentos, nfEditarId) ?? null
  }, [nfEditarId, state.movimentos])

  const emitentesSugeridos = useMemo(
    () =>
      mesclarEmitentesSugeridos(
        state.emitentes,
        state.notas.map((n) => n.emitente),
        state.notasCanceladas.map((c) => c.emitente),
      ),
    [state.emitentes, state.notas, state.notasCanceladas, manualNfModalOpen],
  )

  const syncPendingFromItem = useCallback((nf: NotaFiscal, itemIndex: number) => {
    const item = nf.items[itemIndex]
    if (!item) {
      setPendingSelection(new Set())
      return
    }
    setPendingSelection(new Set(item.allocatedAddresses))
  }, [])

  async function handleUpload(files: File[]) {
    setUploadError(null)
    clearError()
    if (files.length === 0) return

    const imported: NotaFiscal[] = []
    const skipped: string[] = []
    const errors: string[] = []
    const acumulado = [...state.notas]
    let movimentos = state.movimentos

    for (const file of files) {
      try {
        const text = await file.text()
        const nf = parseNfeXml(text)
        const dup = mensagemNfDuplicada(nf, acumulado, state.notasCanceladas)
        if (dup) {
          skipped.push(`NF ${nf.numero} (${file.name}): ${dup}`)
          continue
        }
        imported.push(nf)
        acumulado.unshift(nf)
        movimentos = upsertMovimentoEntrada(movimentos, nf)
        registrarEmitente(nf.emitente)
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Erro ao ler XML.'
        errors.push(`${file.name}: ${msg}`)
      }
    }

    if (imported.length > 0) {
      const nextState = {
        ...state,
        notas: [...imported, ...state.notas],
        movimentos,
        activeNfId: imported[0].id,
        activeItemIndex: 0,
      }
      setState(nextState)
      setPendingSelection(new Set())
      setSelectedEntradaIds(imported.map((nf) => nf.id))
      lastEntradaClickRef.current = imported[0].id
      await saveNow(nextState)
    }

    const feedback: string[] = []
    if (imported.length > 0) {
      feedback.push(
        imported.length === 1
          ? `NF ${imported[0].numero} importada.`
          : `${imported.length} NFs importadas.`,
      )
    }
    if (skipped.length > 0) {
      feedback.push(`Ignoradas (${skipped.length}): ${skipped.join(' · ')}`)
    }
    if (errors.length > 0) {
      feedback.push(`Erros (${errors.length}): ${errors.join(' · ')}`)
    }

    if (imported.length === 0 && feedback.length > 0) {
      setUploadError(feedback.join(' '))
    } else if (skipped.length > 0 || errors.length > 0) {
      setUploadError(feedback.join(' '))
    }
  }

  async function handleUploadCancelada(file: File) {
    setUploadCanceladaError(null)
    clearError()
    try {
      const text = await file.text()
      const parsed = parseCanceladaXml(text, state.notas)
      const dup = mensagemNfCanceladaDuplicada(parsed, state.notasCanceladas)
      if (dup) {
        setUploadCanceladaError(dup)
        return
      }
      const cancelada = notaFiscalToCancelada(parsed)
      const nextState = {
        ...state,
        notasCanceladas: [cancelada, ...state.notasCanceladas],
      }
      setState(nextState)
      registrarEmitente(cancelada.emitente)
      setCanceladaPendenteId(cancelada.id)
      await saveNow(nextState)
    } catch (e) {
      setUploadCanceladaError(e instanceof Error ? e.message : 'Erro ao ler XML.')
    }
  }

  function handleVincularCancelada(canceladaId: string, novaNfId: string) {
    const nextState = {
      ...state,
      ...syncVinculosNotas(vincularNotaCancelada(state, canceladaId, novaNfId)),
    }
    setState(nextState)
    if (canceladaId === canceladaPendenteId) setCanceladaPendenteId(null)
    void saveNow(nextState)
  }

  function handleDesvincularCancelada(canceladaId: string) {
    const nextState = {
      ...state,
      ...syncVinculosNotas(desvincularNotaCancelada(state, canceladaId)),
    }
    setState(nextState)
    void saveNow(nextState)
  }

  async function handleExcluirCancelada(canceladaId: string) {
    const nextSlice = syncVinculosNotas(excluirNotaCancelada(state, canceladaId))
    const nextState = { ...state, ...nextSlice }
    setState(nextState)
    if (canceladaId === canceladaPendenteId) setCanceladaPendenteId(null)
    await saveNow(nextState)
  }

  function handleCancelarCancelada(canceladaId: string) {
    handleExcluirCancelada(canceladaId)
  }

  function handleSelectNf(id: string, event?: MouseEvent) {
    const nf = state.notas.find((n) => n.id === id)
    if (!nf || nf.status !== 'em_andamento') return

    const multi = event?.ctrlKey || event?.metaKey
    const range = event?.shiftKey
    let nextSelected: string[]

    if (range && lastEntradaClickRef.current && emAndamentoIds.includes(lastEntradaClickRef.current)) {
      const a = emAndamentoIds.indexOf(lastEntradaClickRef.current)
      const b = emAndamentoIds.indexOf(id)
      if (a >= 0 && b >= 0) {
        const [lo, hi] = a <= b ? [a, b] : [b, a]
        const slice = emAndamentoIds.slice(lo, hi + 1)
        nextSelected = multi ? [...new Set([...selectedEntradaIds, ...slice])] : slice
      } else {
        nextSelected = multi ? toggleEntradaSelection(selectedEntradaIds, id) : [id]
      }
    } else if (multi) {
      nextSelected = toggleEntradaSelection(selectedEntradaIds, id)
    } else {
      nextSelected = [id]
    }

    lastEntradaClickRef.current = id

    let nextActiveId: string | null
    if (nextSelected.length === 0) {
      nextActiveId = null
    } else if (!multi && !range) {
      nextActiveId = id
    } else if (nextSelected.includes(id)) {
      nextActiveId = id
    } else if (state.activeNfId && nextSelected.includes(state.activeNfId)) {
      nextActiveId = state.activeNfId
    } else {
      nextActiveId = nextSelected[nextSelected.length - 1] ?? null
    }

    setSelectedEntradaIds(nextSelected)

    const nextNf = nextActiveId ? state.notas.find((n) => n.id === nextActiveId) ?? null : null
    const switchingNf = nextActiveId !== state.activeNfId
    const nextItemIndex =
      !nextActiveId ? null : switchingNf ? (nextNf?.items[0]?.index ?? null) : state.activeItemIndex

    setState((s) => ({
      ...s,
      activeNfId: nextActiveId,
      activeItemIndex: nextItemIndex,
    }))

    if (nextNf && nextItemIndex != null) syncPendingFromItem(nextNf, nextItemIndex)
    else setPendingSelection(new Set())

    setDetailAddress(null)
  }

  function handleSelectItem(index: number) {
    if (!activeNf) return
    setState((s) => ({ ...s, activeItemIndex: index }))
    syncPendingFromItem(activeNf, index)
  }

  function handleCellClick(addressId: AddressId, canInteract: boolean) {
    handleCellPaint(addressId, pendingSelection.has(addressId) || editPendingSelection.has(addressId) ? 'remove' : 'add', canInteract)
  }

  function handleCellPaint(addressId: AddressId, mode: 'add' | 'remove', canInteract: boolean) {
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

      setEditPendingSelection((prev) => {
        const next = new Set(prev)
        if (mode === 'add') next.add(addressId)
        else next.delete(addressId)
        return next
      })
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

      const currentItemIndex = state.activeItemIndex
      setPendingSelection((prev) => {
        const next = new Set(prev)
        if (mode === 'add') next.add(addressId)
        else next.delete(addressId)

        setState((s) => ({
          ...s,
          notas: s.notas.map((nf) => {
            if (nf.id !== activeNf.id) return nf
            return {
              ...nf,
              items: nf.items.map((it) =>
                it.index === currentItemIndex
                  ? { ...it, allocatedAddresses: [...next] }
                  : it,
              ),
            }
          }),
        }))

        return next
      })
      return
    }

    if (occ) {
      if (allocateMode || editMode) {
        setOcupadoAlert({ addressId, occ })
        return
      }
      setDetailAddress(addressId)
    }
  }

  async function handleConfirmItem() {
    if (!activeNf || state.activeItemIndex == null) return
    const addresses = [...pendingSelection]
    const currentItemIndex = state.activeItemIndex

    const notas = state.notas.map((nf) => {
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
    const nextItem = activeNf.items.find(
      (it) => it.index !== currentItemIndex && it.allocatedAddresses.length === 0,
    )
    const nextState = {
      ...state,
      notas,
      movimentos: upsertMovimentoEntrada(state.movimentos, updatedNf),
      activeItemIndex: nextItem?.index ?? state.activeItemIndex,
    }
    setState(nextState)
    setPendingSelection(new Set())
    await saveNow(nextState)
  }

  function handleUpdateItemCampos(itemIndex: number, patch: EntradaItemCampos) {
    if (!state.activeNfId) return
    setState((s) => ({
      ...s,
      notas: s.notas.map((nf) => {
        if (nf.id !== s.activeNfId) return nf
        return {
          ...nf,
          items: nf.items.map((it) => (it.index === itemIndex ? { ...it, ...patch } : it)),
        }
      }),
    }))
  }

  async function handleFinishEntrada() {
    if (!activeNf || !allItemsAllocated(activeNf)) return
    const notas = state.notas.map((n) =>
      n.id === activeNf.id ? { ...n, status: 'concluida' as const } : n,
    )
    const updatedNf = notas.find((n) => n.id === activeNf.id)!
    const nextState = {
      ...state,
      notas,
      movimentos: upsertMovimentoEntrada(state.movimentos, updatedNf),
      activeItemIndex: null,
    }
    setState(nextState)
    setPendingSelection(new Set())
    await saveNow(nextState)
  }

  async function handleManualNfConfirm(result: ManualNfModalResult) {
    setManualNfError(null)

    let nextState = state

    if (result.kind === 'existing') {
      if (!state.notas.some((n) => n.id === result.nfId)) {
        setManualNfError('Nota fiscal não encontrada.')
        return
      }
      nextState = {
        ...state,
        activeNfId: result.nfId,
        activeItemIndex: result.itemIndex,
      }
    } else {
      const added = adicionarNotaManual(state, result.input)
      if ('error' in added) {
        setManualNfError(added.error)
        return
      }
      registrarEmitente(result.input.emitente ?? '')
      nextState = {
        ...state,
        notas: added.notas,
        movimentos: added.movimentos,
        activeNfId: added.nf.id,
        activeItemIndex: 0,
      }
    }

    setState(nextState)
    setPendingSelection(new Set())
    setSelectedEntradaIds((prev) => {
      const exists = prev.includes(result.kind === 'existing' ? result.nfId : nextState.activeNfId!)
      if (result.kind === 'existing') {
        return exists ? prev : [...prev, result.nfId]
      }
      return nextState.activeNfId ? [nextState.activeNfId] : prev
    })
    if (nextState.activeNfId) lastEntradaClickRef.current = nextState.activeNfId
    await saveNow(nextState)
    setManualNfModalOpen(false)
    setManualNfError(null)
  }

  function toggleEntradaSelection(list: string[], id: string): string[] {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
  }

  async function handleCancelarEntrada(nfId: string) {
    const mov = findMovimentoEntradaAtivo(state.movimentos, nfId)
    const base = mov
      ? excluirMovimento(
          {
            notas: state.notas,
            movimentos: state.movimentos,
            notasCanceladas: state.notasCanceladas,
            emitentes: state.emitentes,
          },
          mov.id,
        )
      : {
          notas: state.notas.filter((n) => n.id !== nfId),
          movimentos: state.movimentos,
          notasCanceladas: state.notasCanceladas,
          emitentes: state.emitentes,
        }

    const wasActive = state.activeNfId === nfId
    const nextNf = wasActive
      ? base.notas.find((n) => n.status === 'em_andamento') ?? null
      : base.notas.find((n) => n.id === state.activeNfId) ?? null

    const nextState = {
      ...state,
      notas: base.notas,
      movimentos: base.movimentos,
      notasCanceladas: base.notasCanceladas,
      activeNfId: wasActive ? nextNf?.id ?? null : state.activeNfId,
      activeItemIndex: wasActive ? nextNf?.items[0]?.index ?? null : state.activeItemIndex,
    }
    setState(nextState)
    setPendingSelection(new Set())
    setSelectedEntradaIds((prev) => {
      const next = prev.filter((nid) => nid !== nfId)
      if (next.length > 0) return next
      return nextNf ? [nextNf.id] : []
    })
    setUploadError(null)
    await saveNow(nextState)
  }

  async function handleLimparSelecao() {
    if (!activeNf || state.activeItemIndex == null) return
    const currentItemIndex = state.activeItemIndex
    setPendingSelection(new Set())
    const notas = state.notas.map((nf) => {
      if (nf.id !== activeNf.id) return nf
      return {
        ...nf,
        items: nf.items.map((it) =>
          it.index === currentItemIndex ? { ...it, allocatedAddresses: [] } : it,
        ),
      }
    })
    const updatedNf = notas.find((n) => n.id === activeNf.id)!
    const nextState = {
      ...state,
      notas,
      movimentos: upsertMovimentoEntrada(state.movimentos, updatedNf),
    }
    setState(nextState)
    await saveNow(nextState)
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

  async function handleFinalizarSaida(justificativaSaida: JustificativaSaidaId) {
    if (!nfBuscaSaida || itensFlagados.size === 0) return
    const indexes = [...itensFlagados]
    const mov = criarMovimentoSaida(nfBuscaSaida, indexes, justificativaSaida)
    const nextState = {
      ...state,
      notas: state.notas.map((n) => (n.id === nfBuscaSaida.id ? aplicarSaidaItens(n, indexes) : n)),
      movimentos: [mov, ...state.movimentos],
    }
    setState(nextState)
    await saveNow(nextState)
    setNfBuscaSaidaId(null)
    setItensFlagados(new Set())
  }

  function handleCancelarSaida() {
    setNfBuscaSaidaId(null)
    setItensFlagados(new Set())
    setBuscaErro(null)
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

  async function handleSalvarEditar() {
    if (!nfEditar || editItemIndex == null || editPendingSelection.size === 0) return
    const addresses = [...editPendingSelection]
    const currentItemIndex = editItemIndex

    const notas = state.notas.map((nf) => {
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
    const nextState = {
      ...state,
      notas,
      movimentos: upsertMovimentoEntrada(state.movimentos, updatedNf),
    }
    setState(nextState)
    await saveNow(nextState)
    setEditPendingSelection(new Set())
    setEditItemIndex(null)
  }

  function handleCancelarEditar() {
    setNfEditarId(null)
    setEditItemIndex(null)
    setEditPendingSelection(new Set())
    setBuscaEditarErro(null)
  }

  async function handleExcluirMovimento(movId: string) {
    const mov = state.movimentos.find((m) => m.id === movId)
    const result = excluirMovimento(
      {
        notas: state.notas,
        movimentos: state.movimentos,
        notasCanceladas: state.notasCanceladas,
        emitentes: state.emitentes,
      },
      movId,
    )
    const nfRemoved = mov?.tipo === 'entrada'
    const nextState = {
      ...state,
      notas: result.notas,
      movimentos: result.movimentos,
      notasCanceladas: result.notasCanceladas,
      activeNfId:
        nfRemoved || !result.notas.some((n) => n.id === state.activeNfId) ? null : state.activeNfId,
      activeItemIndex:
        nfRemoved || !result.notas.some((n) => n.id === state.activeNfId)
          ? null
          : state.activeItemIndex,
    }
    setState(nextState)
    await saveNow(nextState)
    if (mov?.nfId === nfEditarId) {
      setNfEditarId(null)
      setEditItemIndex(null)
      setEditPendingSelection(new Set())
      setBuscaEditarErro(null)
    }
    if (nfBuscaSaidaId) {
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
        sidebarFixed={sidebarFixed}
        onToggleSidebarMode={toggleSidebarMode}
        entrada={{
          notas: state.notas,
          activeNfId: state.activeNfId,
          selectedNfIds: selectedEntradaIds,
          activeItemIndex: state.activeItemIndex,
          pendingCount: pendingSelection.size,
          camposConfig: entradaCampos.config,
          camposDraft: entradaCampos.draft,
          camposDirty: entradaCampos.dirty,
          camposSavedHint: entradaCampos.savedHint,
          onToggleCampo: entradaCampos.toggleDraft,
          onSaveCampos: entradaCampos.saveDraft,
          onUpload: handleUpload,
          onSelectNf: handleSelectNf,
          onSelectItem: handleSelectItem,
          onUpdateItemCampos: handleUpdateItemCampos,
          onConfirmItem: handleConfirmItem,
          onFinishEntrada: handleFinishEntrada,
          onCancelarEntrada: handleCancelarEntrada,
          onLimparSelecao: handleLimparSelecao,
          onCadastrarManual: () => {
            setManualNfError(null)
            setManualNfModalOpen(true)
          },
          uploadError,
        }}
        saida={{
          nfBusca: nfBuscaSaida,
          itensFlagados,
          onBuscar: handleBuscarSaida,
          onToggleItem: handleToggleItemSaida,
          onFinalizarSaida: handleFinalizarSaida,
          onCancelarSaida: handleCancelarSaida,
          buscaErro,
        }}
        historico={{
          movimentos: movimentosOrdenados,
          canceladas: state.notasCanceladas,
        }}
        canceladas={{
          canceladas: canceladasAtivas,
          notas: state.notas,
          onUpload: handleUploadCancelada,
          onVincular: handleVincularCancelada,
          onDesvincular: handleDesvincularCancelada,
          onExcluir: handleExcluirCancelada,
          onCancelarCancelada: handleCancelarCancelada,
          canceladaPendenteId,
          uploadError: uploadCanceladaError,
        }}
        editar={{
          nfBusca: nfEditar,
          movimentoEntradaId: movimentoEntradaEditar?.id ?? null,
          itemIndex: editItemIndex,
          pendingCount: editPendingSelection.size,
          onBuscar: handleBuscarEditar,
          onSelectItem: handleSelectItemEditar,
          onSalvar: handleSalvarEditar,
          onExcluirEntrada: handleExcluirMovimento,
          onCancelarEditar: handleCancelarEditar,
          buscaErro: buscaEditarErro,
        }}
        imprimir={{
          selectedCamaras: printCamaras,
          onToggleCamara: (id) =>
            setPrintCamaras((prev) =>
              prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id].sort((a, b) => a - b),
            ),
          onSelectAll: () => setPrintCamaras(CAMARAS.map((c) => c.id)),
          onClearAll: () => setPrintCamaras([]),
        }}
      />

      <main className="main-panel">
        <LayoutPanel
          occupancy={displayOccupancy}
          pendingSelection={panelPendingSelection}
          activeNfNumero={panelActiveNfNumero}
          activeNfId={editMode ? nfEditar?.id ?? null : activeNf?.id ?? null}
          allocateMode={panelAllocateMode}
          editMode={editMode}
          editAddresses={nfEditar ? editNfAddresses : undefined}
          saidaAddresses={nfEditar ? undefined : saidaAddresses}
          saidaFlaggedAddresses={editMode ? undefined : saidaFlaggedAddresses}
          paintMode={editMode || allocateMode}
          onCellClick={handleCellClick}
          onCellPaint={handleCellPaint}
        />
      </main>

      <PrintLayoutDocument camaraIds={printCamaras} />

      {ocupadoAlert && (
        <OcupadoAlert
          addressId={ocupadoAlert.addressId}
          occupancy={ocupadoAlert.occ}
          onClose={() => setOcupadoAlert(null)}
        />
      )}

      {manualNfModalOpen && (
        <ManualNfModal
          notas={state.notas}
          emitentesSugeridos={emitentesSugeridos}
          serverError={manualNfError}
          onConfirm={handleManualNfConfirm}
          onClose={() => {
            setManualNfModalOpen(false)
            setManualNfError(null)
          }}
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
