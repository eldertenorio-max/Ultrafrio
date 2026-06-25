import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { AppSidebar } from './components/AppSidebar'
import { DetailModal } from './components/DetailModal'
import { ManualNfModal, type ManualNfModalResult } from './components/ManualNfModal'
import { IntroSplash } from './components/IntroSplash'
import { LayoutPanel } from './components/LayoutPanel'
import { PrintLayoutDocument } from './components/PrintLayoutDocument'
import { CAMARAS } from './layout/camaras'
import { EntradaPendenteAlert } from './components/EntradaPendenteAlert'
import { OcupadoAlert } from './components/OcupadoAlert'
import { PaletesLimiteAlert } from './components/PaletesLimiteAlert'
import { useEnderecamentoStore } from './hooks/useEnderecamentoStore'
import { useTheme } from './hooks/useTheme'
import { useSidebarMode } from './hooks/useSidebarMode'
import { allItemsAllocated } from './lib/repository'
import { adicionarNotaManual } from './lib/manualNf'
import { desmembrarNfeItem, patchNfeItemQuantidade } from './lib/desmembrarItem'
import {
  itemEnderecamentoCompleto,
  parsePaletesInput,
  paletesLimiteItem,
  podeAdicionarEndereco,
} from './lib/paletes'
import { excluirItemNotaFiscal, sanitizarNotasEntrada } from './lib/excluirItemNf'
import {
  adicionarItemManualNotaFiscal,
  replicarItemNotaFiscal,
  validarItemManualInput,
  type ItemManualInput,
} from './lib/adicionarItemNf'
import { contarItensSemEndereco, nfEntradaIncompleta } from './lib/entradaPendente'
import { mesclarEmitentesSugeridos } from './lib/emitentesRegistry'
import {
  aplicarSaidaPaletes,
  calcularSaidaPalete,
  enderecosALiberar,
  paletesDisponiveisItem,
  parseQuantidadeSaida,
  sobraItem,
  type SaidaPaleteDraft,
} from './lib/saidaParcial'
import {
  buscarNfPorNumero,
  criarMovimentoSaida,
  enderecosDaNf,
  excluirMovimento,
  removerNfDoEstoque,
  findMovimentoEntradaAtivo,
  removerMovimentoEntradaAtivo,
  upsertMovimentoEntrada,
} from './lib/movimentos'
import {
  desvincularNotaCancelada,
  excluirNotaCancelada,
  notaFiscalToCancelada,
  syncVinculosNotas,
  vincularNotaCancelada,
} from './lib/nfCanceladas'
import { buscarEstoque, temFiltroConsulta, alternarDestaqueConsulta, type ConsultaEstoqueFiltros, type ConsultaEstoqueResultado } from './lib/consultaEstoque'
import { findNotaByNumero, mensagemNfCanceladaDuplicada, mensagemNfDuplicada } from './lib/nfDuplicate'
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
  const [introDone, setIntroDone] = useState(false)
  const [pendingSelection, setPendingSelection] = useState<Set<AddressId>>(new Set())
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [detailAddress, setDetailAddress] = useState<AddressId | null>(null)

  const [nfBuscaSaidaId, setNfBuscaSaidaId] = useState<string | null>(null)
  const [saidaItemIndex, setSaidaItemIndex] = useState<number | null>(null)
  const [saidaModoPalete, setSaidaModoPalete] = useState(false)
  const [saidaQtdPaletesInput, setSaidaQtdPaletesInput] = useState('')
  const [saidaQtdPaletesAlvo, setSaidaQtdPaletesAlvo] = useState<number | null>(null)
  const [saidaPaletesSelecionados, setSaidaPaletesSelecionados] = useState<Set<AddressId>>(new Set())
  const [saidaPaletesNaFila, setSaidaPaletesNaFila] = useState<AddressId[]>([])
  const [saidaSelecaoConcluida, setSaidaSelecaoConcluida] = useState(false)
  const [saidaPaleteAtivo, setSaidaPaleteAtivo] = useState<AddressId | null>(null)
  const [saidaCaixasPalete, setSaidaCaixasPalete] = useState('')
  const [saidaPaletesConfirmados, setSaidaPaletesConfirmados] = useState<SaidaPaleteDraft[]>([])
  const [saidaSelecaoErro, setSaidaSelecaoErro] = useState<string | null>(null)
  const [buscaErro, setBuscaErro] = useState<string | null>(null)
  const [nfEditarId, setNfEditarId] = useState<string | null>(null)
  const [editItemIndex, setEditItemIndex] = useState<number | null>(null)
  const [editPendingSelection, setEditPendingSelection] = useState<Set<AddressId>>(new Set())
  const [buscaEditarErro, setBuscaEditarErro] = useState<string | null>(null)
  const [consultaResultados, setConsultaResultados] = useState<ConsultaEstoqueResultado[]>([])
  const [consultaErro, setConsultaErro] = useState<string | null>(null)
  const [consultaNfAdicionarId, setConsultaNfAdicionarId] = useState<string | null>(null)
  const [consultaNfAdicionarErro, setConsultaNfAdicionarErro] = useState<string | null>(null)
  const [consultaItemAdicionadoMsg, setConsultaItemAdicionadoMsg] = useState<string | null>(null)
  const [consultaItemManualErro, setConsultaItemManualErro] = useState<string | null>(null)
  const [consultaAguardandoEndereco, setConsultaAguardandoEndereco] = useState(false)
  const [uploadCanceladaError, setUploadCanceladaError] = useState<string | null>(null)
  const [canceladaPendenteId, setCanceladaPendenteId] = useState<string | null>(null)
  const [printCamaras, setPrintCamaras] = useState<number[]>(() => CAMARAS.map((c) => c.id))
  const [ocupadoAlert, setOcupadoAlert] = useState<{
    addressId: AddressId
    occ: AddressOccupancy
  } | null>(null)
  const [paletesLimiteAlert, setPaletesLimiteAlert] = useState<
    'sem_paletes' | 'maximo' | 'incompleto' | null
  >(null)
  const [entradaPendenteAlert, setEntradaPendenteAlert] = useState<{
    nfNumero: string
    itensPendentes: number
    onConfirmLeave?: () => void
  } | null>(null)
  const entradaPendenteDismissedRef = useRef<string | null>(null)
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

  const trySairEntradaIncompleta = useCallback(
    (action: () => void) => {
      if (
        !nfEntradaIncompleta(activeNf) ||
        entradaPendenteDismissedRef.current === activeNf!.id
      ) {
        action()
        return
      }
      setEntradaPendenteAlert({
        nfNumero: activeNf!.numero,
        itensPendentes: contarItensSemEndereco(activeNf!),
        onConfirmLeave: () => {
          entradaPendenteDismissedRef.current = activeNf!.id
          setEntradaPendenteAlert(null)
          action()
        },
      })
    },
    [activeNf],
  )
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
    if (saidaItemIndex != null) {
      const item = nfBuscaSaida.items.find((it) => it.index === saidaItemIndex)
      if (item && item.allocatedAddresses.length > 0) {
        return new Set(item.allocatedAddresses)
      }
    }
    return new Set(enderecosDaNf(nfBuscaSaida))
  }, [nfBuscaSaida, saidaItemIndex])

  const saidaFlaggedAddresses = useMemo(() => {
    const flagged = new Set(saidaPaletesConfirmados.map((p) => p.addressId))
    if (saidaPaleteAtivo) flagged.add(saidaPaleteAtivo)
    if (!saidaSelecaoConcluida) {
      for (const a of saidaPaletesSelecionados) flagged.add(a)
    }
    return flagged
  }, [saidaPaletesConfirmados, saidaPaleteAtivo, saidaSelecaoConcluida, saidaPaletesSelecionados])

  const editNfAddresses = useMemo(() => {
    if (!nfEditar) return new Set<AddressId>()
    return new Set(enderecosDaNf(nfEditar))
  }, [nfEditar])

  const consultaAddresses = useMemo(
    () => new Set(consultaResultados.map((r) => r.addressId)),
    [consultaResultados],
  )

  const consultaNfAdicionar = consultaNfAdicionarId
    ? state.notas.find((n) => n.id === consultaNfAdicionarId) ?? null
    : null

  const panelPendingSelection = editMode
    ? editPendingSelection
    : saidaModoPalete && !saidaSelecaoConcluida
      ? saidaPaletesSelecionados
      : saidaModoPalete && saidaPaleteAtivo
        ? new Set([saidaPaleteAtivo])
        : pendingSelection
  const panelAllocateMode =
    allocateMode ||
    editMode ||
    (saidaModoPalete && (saidaQtdPaletesAlvo != null || saidaSelecaoConcluida))
  const panelActiveNfNumero = editMode ? nfEditar?.numero ?? null : activeNf?.numero ?? null

  const activeAllocateItem = useMemo(() => {
    if (!allocateMode || !activeNf || state.activeItemIndex == null) return null
    return activeNf.items.find((it) => it.index === state.activeItemIndex) ?? null
  }, [allocateMode, activeNf, state.activeItemIndex])

  const paletesTotal =
    activeAllocateItem?.paletes != null && activeAllocateItem.paletes > 0
      ? activeAllocateItem.paletes
      : null
  const paletesRestantesCount =
    paletesTotal != null ? Math.max(0, paletesTotal - pendingSelection.size) : null

  const panelPaletesTotal = paletesTotal

  const movimentosOrdenados = useMemo(
    () =>
      [...state.movimentos]
        .filter((m) => !m.excluido)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
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
    const item = nf.items.find((it) => it.index === itemIndex)
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
      const applyImport = async () => {
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

      const switchingAway =
        nfEntradaIncompleta(activeNf) && activeNf && imported[0].id !== activeNf.id
      if (switchingAway) {
        trySairEntradaIncompleta(() => void applyImport())
      } else {
        await applyImport()
      }
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

    const nextNf = nextActiveId ? state.notas.find((n) => n.id === nextActiveId) ?? null : null
    const switchingNf = nextActiveId !== state.activeNfId
    const nextItemIndex =
      !nextActiveId ? null : switchingNf ? (nextNf?.items[0]?.index ?? null) : state.activeItemIndex
    const leavingIncomplete =
      switchingNf && nfEntradaIncompleta(activeNf) && activeNf != null

    const applySelection = () => {
      if (nextActiveId === entradaPendenteDismissedRef.current) {
        entradaPendenteDismissedRef.current = null
      }

      lastEntradaClickRef.current = id
      setSelectedEntradaIds(nextSelected)
      setState((s) => ({
        ...s,
        activeNfId: nextActiveId,
        activeItemIndex: nextItemIndex,
      }))

      if (nextNf && nextItemIndex != null) syncPendingFromItem(nextNf, nextItemIndex)
      else setPendingSelection(new Set())

      setDetailAddress(null)
    }

    if (leavingIncomplete) {
      trySairEntradaIncompleta(applySelection)
      return
    }

    applySelection()
  }

  function handleSelectItem(index: number) {
    if (!activeNf) return
    setState((s) => ({ ...s, activeItemIndex: index }))
    syncPendingFromItem(activeNf, index)
  }

  function handleCellClick(addressId: AddressId, canInteract: boolean) {
    const saidaPending =
      saidaModoPalete &&
      (saidaPaletesSelecionados.has(addressId) ||
        (saidaSelecaoConcluida && saidaPaleteAtivo === addressId))
    const editPending = editPendingSelection.has(addressId)
    const entradaPending = pendingSelection.has(addressId)
    handleCellPaint(
      addressId,
      saidaPending || editPending || entradaPending ? 'remove' : 'add',
      canInteract,
    )
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

    if (saidaModoPalete && nfBuscaSaida) {
      const enderecosNf = new Set(enderecosDaNf(nfBuscaSaida))
      if (!enderecosNf.has(addressId)) return
      if (saidaPaletesConfirmados.some((p) => p.addressId === addressId)) return

      const itemAtivo =
        saidaItemIndex != null
          ? nfBuscaSaida.items.find((it) => it.index === saidaItemIndex)
          : null
      if (!itemAtivo?.allocatedAddresses.includes(addressId)) return

      if (!saidaSelecaoConcluida) {
        setSaidaPaletesSelecionados((prev) => {
          const next = new Set(prev)
          if (mode === 'add') {
            if (next.has(addressId)) return prev
            if (saidaQtdPaletesAlvo != null && next.size >= saidaQtdPaletesAlvo) {
              setSaidaSelecaoErro(`Selecione no máximo ${saidaQtdPaletesAlvo} palete(s).`)
              return prev
            }
            next.add(addressId)
          } else {
            next.delete(addressId)
          }
          return next
        })
        setSaidaSelecaoErro(null)
        return
      }

      if (!saidaPaletesNaFila.includes(addressId)) return

      if (mode === 'add') {
        setSaidaPaleteAtivo(addressId)
        setSaidaCaixasPalete('')
      } else if (saidaPaleteAtivo === addressId) {
        setSaidaPaleteAtivo(null)
        setSaidaCaixasPalete('')
      }
      setSaidaSelecaoErro(null)
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
      const item = activeNf.items.find((it) => it.index === currentItemIndex)
      const limitePaletes = paletesLimiteItem(item)

      setPendingSelection((prev) => {
        const next = new Set(prev)
        if (mode === 'add') {
          if (next.has(addressId)) return prev
          if (limitePaletes <= 0) {
            setPaletesLimiteAlert('sem_paletes')
            return prev
          }
          if (!podeAdicionarEndereco(limitePaletes, next.size)) {
            setPaletesLimiteAlert('maximo')
            return prev
          }
          next.add(addressId)
        } else {
          next.delete(addressId)
        }

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
      if (allocateMode || editMode || saidaModoPalete) {
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
    const item = activeNf.items.find((it) => it.index === currentItemIndex)
    const limitePaletes = paletesLimiteItem(item)
    if (limitePaletes > 0 && addresses.length < limitePaletes) {
      setPaletesLimiteAlert('incompleto')
      return
    }

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
    let updatedNf = notas.find((n) => n.id === activeNf.id)!
    if (consultaAguardandoEndereco && allItemsAllocated(updatedNf)) {
      updatedNf = { ...updatedNf, status: 'concluida' as const }
    }
    const notasFinais = notas.map((n) => (n.id === updatedNf.id ? updatedNf : n))
    const nextItem = updatedNf.items.find(
      (it) => it.index !== currentItemIndex && !itemEnderecamentoCompleto(it),
    )
    const nextState = {
      ...state,
      notas: notasFinais,
      movimentos: upsertMovimentoEntrada(state.movimentos, updatedNf),
      activeItemIndex: consultaAguardandoEndereco
        ? null
        : nextItem?.index ?? state.activeItemIndex,
      activeNfId:
        consultaAguardandoEndereco && updatedNf.status === 'concluida'
          ? null
          : state.activeNfId,
    }
    setState(nextState)
    setPendingSelection(new Set())
    if (consultaAguardandoEndereco) {
      setConsultaAguardandoEndereco(false)
      setConsultaItemAdicionadoMsg(`Posições confirmadas na NF ${activeNf.numero}.`)
      if (updatedNf.status === 'concluida') {
        setSelectedEntradaIds((prev) => prev.filter((id) => id !== updatedNf.id))
      }
    }
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

  function handleUpdateItemQuantidade(itemIndex: number, quantidade: string) {
    if (!state.activeNfId) return
    setState((s) => ({
      ...s,
      notas: s.notas.map((nf) => {
        if (nf.id !== s.activeNfId) return nf
        return {
          ...nf,
          items: nf.items.map((it) =>
            it.index === itemIndex ? patchNfeItemQuantidade(it, quantidade) : it,
          ),
        }
      }),
    }))
  }

  function handleUpdateItemPaletes(itemIndex: number, value: string) {
    if (!state.activeNfId) return
    const paletes = parsePaletesInput(value)
    const shouldTrim =
      state.activeItemIndex === itemIndex &&
      paletes != null &&
      paletes > 0 &&
      pendingSelection.size > paletes
    const trimmed = shouldTrim ? [...pendingSelection].slice(0, paletes) : null
    if (trimmed) setPendingSelection(new Set(trimmed))

    setState((s) => ({
      ...s,
      notas: s.notas.map((nf) => {
        if (nf.id !== s.activeNfId) return nf
        return {
          ...nf,
          items: nf.items.map((it) => {
            if (it.index !== itemIndex) return it
            const next = { ...it, paletes }
            if (trimmed) return { ...next, allocatedAddresses: trimmed }
            return next
          }),
        }
      }),
    }))
  }

  async function handleDesmembrarItem(itemIndex: number) {
    if (!activeNf || activeNf.status !== 'em_andamento') return
    const result = desmembrarNfeItem(activeNf, itemIndex)
    if (!result) return

    const notas = state.notas.map((nf) =>
      nf.id !== activeNf.id ? nf : { ...nf, items: result.items },
    )
    const updatedNf = notas.find((n) => n.id === activeNf.id)!
    const nextState = {
      ...state,
      notas,
      activeItemIndex: result.newItemIndex,
    }
    setState(nextState)
    syncPendingFromItem(updatedNf, result.newItemIndex)
    await saveNow(nextState)
  }

  async function handleFinishEntrada() {
    if (!activeNf || activeNf.status !== 'em_andamento') return
    if (!allItemsAllocated(activeNf)) {
      setEntradaPendenteAlert({
        nfNumero: activeNf.numero,
        itensPendentes: contarItensSemEndereco(activeNf),
      })
      return
    }
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

    const applyManual = async () => {
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

    const leavingIncomplete =
      nfEntradaIncompleta(activeNf) &&
      (result.kind === 'new' ||
        (result.kind === 'existing' && result.nfId !== activeNf!.id))

    if (leavingIncomplete) {
      trySairEntradaIncompleta(() => void applyManual())
      return
    }

    await applyManual()
  }

  function toggleEntradaSelection(list: string[], id: string): string[] {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
  }

  async function handleCancelarEntrada(nfId: string) {
    const base = removerNfDoEstoque(
      {
        notas: state.notas,
        movimentos: state.movimentos,
        notasCanceladas: state.notasCanceladas,
        emitentes: state.emitentes,
      },
      nfId,
    )

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

  function limparEstadoSaida() {
    setSaidaItemIndex(null)
    setSaidaModoPalete(false)
    setSaidaQtdPaletesInput('')
    setSaidaQtdPaletesAlvo(null)
    setSaidaPaletesSelecionados(new Set())
    setSaidaPaletesNaFila([])
    setSaidaSelecaoConcluida(false)
    setSaidaPaleteAtivo(null)
    setSaidaCaixasPalete('')
    setSaidaPaletesConfirmados([])
    setSaidaSelecaoErro(null)
  }

  function handleBuscarSaida(numero: string) {
    setBuscaErro(null)
    setSaidaSelecaoErro(null)
    const nf = buscarNfPorNumero(state.notas, numero)
    if (!nf) {
      setBuscaErro('NF não encontrada.')
      setNfBuscaSaidaId(null)
      limparEstadoSaida()
      return
    }
    setNfBuscaSaidaId(nf.id)
    limparEstadoSaida()
  }

  function resetSelecaoPaletesSaida() {
    setSaidaQtdPaletesInput('')
    setSaidaQtdPaletesAlvo(null)
    setSaidaPaletesSelecionados(new Set())
    setSaidaPaletesNaFila([])
    setSaidaSelecaoConcluida(false)
    setSaidaPaleteAtivo(null)
    setSaidaCaixasPalete('')
    setSaidaModoPalete(false)
    setSaidaSelecaoErro(null)
  }

  function handleSelectItemSaida(index: number) {
    if (!nfBuscaSaida) return
    const item = nfBuscaSaida.items.find((it) => it.index === index)
    if (!item || item.allocatedAddresses.length === 0) return
    if (paletesDisponiveisItem(item, saidaPaletesConfirmados) <= 0) return

    if (saidaItemIndex !== index) {
      resetSelecaoPaletesSaida()
      setSaidaItemIndex(index)
    }
  }

  function handleIniciarSelecaoSaida() {
    if (!nfBuscaSaida || saidaItemIndex == null) {
      setSaidaSelecaoErro('Selecione um item na tabela.')
      return
    }
    const item = nfBuscaSaida.items.find((it) => it.index === saidaItemIndex)
    if (!item) return

    const qtd = parsePaletesInput(saidaQtdPaletesInput)
    if (qtd == null || qtd <= 0) {
      setSaidaSelecaoErro('Informe uma quantidade válida de paletes.')
      return
    }
    const disponivel = paletesDisponiveisItem(item, saidaPaletesConfirmados)
    if (qtd > disponivel) {
      setSaidaSelecaoErro(`Máximo de ${disponivel} palete(s) disponível(is) neste item.`)
      return
    }
    setSaidaQtdPaletesAlvo(qtd)
    setSaidaModoPalete(true)
    setSaidaPaletesSelecionados(new Set())
    setSaidaPaletesNaFila([])
    setSaidaSelecaoConcluida(false)
    setSaidaPaleteAtivo(null)
    setSaidaCaixasPalete('')
    setSaidaSelecaoErro(null)
  }

  function handleConfirmarSelecaoPaletes() {
    if (saidaQtdPaletesAlvo == null) return
    if (saidaPaletesSelecionados.size !== saidaQtdPaletesAlvo) {
      setSaidaSelecaoErro(`Selecione exatamente ${saidaQtdPaletesAlvo} palete(s) no painel.`)
      return
    }
    const fila = [...saidaPaletesSelecionados]
    setSaidaPaletesNaFila(fila)
    setSaidaSelecaoConcluida(true)
    setSaidaPaleteAtivo(fila[0] ?? null)
    setSaidaCaixasPalete('')
    setSaidaSelecaoErro(null)
  }

  function handleQtdPaletesChange(value: string) {
    setSaidaQtdPaletesInput(value)
    setSaidaSelecaoErro(null)
  }

  function handleCaixasPaleteChange(value: string) {
    setSaidaCaixasPalete(value)
    setSaidaSelecaoErro(null)
  }

  function handleConfirmarPaleteSaida() {
    if (!nfBuscaSaida || !saidaPaleteAtivo) return
    const item = nfBuscaSaida.items.find((it) => it.allocatedAddresses.includes(saidaPaleteAtivo))
    if (!item) return

    const caixas = parseQuantidadeSaida(saidaCaixasPalete)
    if (caixas == null || caixas <= 0) {
      setSaidaSelecaoErro('Informe uma quantidade válida de caixas.')
      return
    }

    const calc = calcularSaidaPalete(
      nfBuscaSaida,
      item,
      saidaPaleteAtivo,
      caixas,
      saidaPaletesConfirmados,
    )
    if (!calc) {
      setSaidaSelecaoErro('Quantidade de caixas excede o disponível neste item.')
      return
    }

    setSaidaPaletesConfirmados((prev) => {
      const next = [
        ...prev.filter((p) => p.addressId !== saidaPaleteAtivo),
        {
          addressId: saidaPaleteAtivo,
          itemIndex: item.index,
          quantidadeCaixas: caixas,
        },
      ]
      const restantes = saidaPaletesNaFila.filter(
        (a) => !next.some((p) => p.addressId === a),
      )
      if (restantes.length > 0) {
        setSaidaPaleteAtivo(restantes[0])
      } else {
        setSaidaPaleteAtivo(null)
        setSaidaSelecaoConcluida(false)
        setSaidaPaletesSelecionados(new Set())
        setSaidaPaletesNaFila([])
        setSaidaQtdPaletesAlvo(null)
        setSaidaModoPalete(false)
        const itemAtual = nfBuscaSaida.items.find((it) => it.index === saidaItemIndex)
        if (
          itemAtual &&
          paletesDisponiveisItem(itemAtual, next) <= 0 &&
          sobraItem(itemAtual, next) <= 1e-9
        ) {
          setSaidaItemIndex(null)
        }
      }
      return next
    })
    setSaidaCaixasPalete('')
    setSaidaSelecaoErro(null)
  }

  function handleRemoverPaleteSaida(addressId: AddressId) {
    setSaidaPaletesConfirmados((prev) => prev.filter((p) => p.addressId !== addressId))
    if (saidaPaleteAtivo === addressId) {
      setSaidaPaleteAtivo(null)
      setSaidaCaixasPalete('')
    }
    setSaidaSelecaoErro(null)
  }

  async function handleFinalizarSaida(justificativaSaida: JustificativaSaidaId) {
    if (!nfBuscaSaida || saidaPaletesConfirmados.length === 0) return

    const liberar = enderecosALiberar(nfBuscaSaida, saidaPaletesConfirmados)
    const mov = criarMovimentoSaida(
      nfBuscaSaida,
      liberar,
      justificativaSaida,
      undefined,
      saidaPaletesConfirmados,
    )
    const nextState = {
      ...state,
      notas: state.notas.map((n) =>
        n.id === nfBuscaSaida.id ? aplicarSaidaPaletes(n, saidaPaletesConfirmados) : n,
      ),
      movimentos: [mov, ...state.movimentos],
    }
    setState(nextState)
    await saveNow(nextState)
    setNfBuscaSaidaId(null)
    limparEstadoSaida()
  }

  function handleCancelarSaida() {
    setNfBuscaSaidaId(null)
    limparEstadoSaida()
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

  function handleBuscarConsulta(filtros: ConsultaEstoqueFiltros) {
    setConsultaErro(null)
    if (!temFiltroConsulta(filtros)) {
      setConsultaResultados([])
      setConsultaErro('Informe ao menos um filtro para pesquisar.')
      return
    }
    const resultados = buscarEstoque(state.notas, filtros)
    setConsultaResultados(resultados)
    if (resultados.length === 0) {
      setConsultaErro('Nenhum endereço encontrado com os filtros informados.')
    }
  }

  function handleLimparConsulta() {
    setConsultaResultados([])
    setConsultaErro(null)
  }

  function handleAlternarDestaqueInventario(resultados: ConsultaEstoqueResultado[]) {
    setConsultaResultados((prev) => alternarDestaqueConsulta(prev, resultados))
    setConsultaErro(null)
  }

  function handleBuscarNfAdicionar(numero: string) {
    setConsultaItemAdicionadoMsg(null)
    setConsultaNfAdicionarErro(null)
    setConsultaItemManualErro(null)
    if (!numero) {
      setConsultaNfAdicionarErro('Informe o número da NF.')
      setConsultaNfAdicionarId(null)
      return
    }
    const nf = findNotaByNumero(state.notas, numero)
    if (!nf) {
      setConsultaNfAdicionarErro('NF não encontrada. Suba o XML na aba Entrada primeiro.')
      setConsultaNfAdicionarId(null)
      return
    }
    setConsultaNfAdicionarId(nf.id)
  }

  function handleLimparNfAdicionar() {
    setConsultaNfAdicionarId(null)
    setConsultaNfAdicionarErro(null)
    setConsultaItemAdicionadoMsg(null)
    setConsultaItemManualErro(null)
    setConsultaAguardandoEndereco(false)
    setPendingSelection(new Set())
  }

  function handleCancelarEnderecoConsulta() {
    setConsultaAguardandoEndereco(false)
    setPendingSelection(new Set())
    setConsultaItemAdicionadoMsg(null)
  }

  async function aplicarItemConsultaNaNf(
    nfId: string,
    nota: NotaFiscal,
    newItemIndex: number,
  ) {
    const notas = state.notas.map((n) => (n.id === nfId ? nota : n))
    const nextState = {
      ...state,
      notas,
      movimentos: upsertMovimentoEntrada(state.movimentos, nota),
      activeNfId: nfId,
      activeItemIndex: newItemIndex,
    }
    setState(nextState)
    setPendingSelection(new Set())
    setSelectedEntradaIds((prev) => (prev.includes(nfId) ? prev : [...prev, nfId]))
    lastEntradaClickRef.current = nfId
    setConsultaAguardandoEndereco(true)
    setConsultaItemAdicionadoMsg(null)
    setConsultaItemManualErro(null)
    await saveNow(nextState)
  }

  async function handleReplicarItemConsulta(itemIndex: number, paletes: number) {
    const nf = state.notas.find((n) => n.id === consultaNfAdicionarId)
    if (!nf) return

    const result = replicarItemNotaFiscal(nf, itemIndex, paletes)
    if (!result) {
      setConsultaItemManualErro('Informe uma quantidade válida de paletes.')
      return
    }

    await aplicarItemConsultaNaNf(nf.id, result.nota, result.newItemIndex)
  }

  async function handleAdicionarItemManualConsulta(input: ItemManualInput) {
    const nf = state.notas.find((n) => n.id === consultaNfAdicionarId)
    if (!nf) return

    const erro = validarItemManualInput(input)
    if (erro) {
      setConsultaItemManualErro(erro)
      return
    }

    const result = adicionarItemManualNotaFiscal(nf, input)
    if (!result) {
      setConsultaItemManualErro('Não foi possível adicionar o item.')
      return
    }

    await aplicarItemConsultaNaNf(nf.id, result.nota, result.newItemIndex)
  }

  async function handleExcluirItemConsulta(itemIndex: number) {
    const nf = state.notas.find((n) => n.id === consultaNfAdicionarId)
    if (!nf) return

    const result = excluirItemNotaFiscal(nf, itemIndex)
    if (!result) {
      setConsultaItemManualErro(
        'Não é possível excluir este item. O último item com endereços precisa permanecer na NF.',
      )
      return
    }

    let notas: NotaFiscal[]
    let movimentos = state.movimentos
    let activeNfId = state.activeNfId
    let activeItemIndex = state.activeItemIndex
    let consultaNfId = consultaNfAdicionarId
    let mensagem: string

    if (result.acao === 'remover_nf') {
      notas = state.notas.filter((n) => n.id !== nf.id)
      movimentos = removerMovimentoEntradaAtivo(movimentos, nf.id)
      if (activeNfId === nf.id) {
        activeNfId = null
        activeItemIndex = null
      }
      consultaNfId = null
      mensagem = `NF ${nf.numero} removida das entradas em andamento.`
    } else {
      const nota = result.nota
      notas = state.notas.map((n) => (n.id === nf.id ? nota : n))
      movimentos = upsertMovimentoEntrada(state.movimentos, nota)

      if (nota.status === 'concluida') {
        if (activeNfId === nf.id) {
          activeNfId = null
          activeItemIndex = null
        }
        mensagem = `Item removido. NF ${nf.numero} voltou para concluída.`
      } else {
        if (activeNfId === nf.id && activeItemIndex === itemIndex) {
          activeItemIndex = null
        }
        mensagem = `Item removido da NF ${nf.numero}.`
      }
    }

    notas = sanitizarNotasEntrada(notas)

    const nextState = {
      ...state,
      notas,
      movimentos,
      activeNfId,
      activeItemIndex,
    }
    setState(nextState)
    setConsultaNfAdicionarId(consultaNfId)
    setSelectedEntradaIds((prev) => prev.filter((id) => id !== nf.id))
    if (activeNfId !== state.activeNfId || activeItemIndex !== state.activeItemIndex) {
      setPendingSelection(new Set())
    }
    setConsultaResultados((prev) =>
      prev.filter((r) => !(r.nfId === nf.id && r.itemIndex === itemIndex)),
    )
    setConsultaItemAdicionadoMsg(mensagem)
    setConsultaItemManualErro(null)
    setConsultaAguardandoEndereco(false)
    await saveNow(nextState)
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
    const nextState = {
      ...state,
      notas: result.notas,
      movimentos: result.movimentos,
      notasCanceladas: result.notasCanceladas,
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
        limparEstadoSaida()
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
        onBeforeLeaveEntrada={trySairEntradaIncompleta}
        entrada={{
          notas: state.notas,
          activeNfId: state.activeNfId,
          selectedNfIds: selectedEntradaIds,
          activeItemIndex: state.activeItemIndex,
          pendingCount: pendingSelection.size,
          paletesRestantes: paletesRestantesCount,
          onUpload: handleUpload,
          onSelectNf: handleSelectNf,
          onSelectItem: handleSelectItem,
          onUpdateItemCampos: handleUpdateItemCampos,
          onUpdateItemQuantidade: handleUpdateItemQuantidade,
          onUpdateItemPaletes: handleUpdateItemPaletes,
          onDesmembrarItem: handleDesmembrarItem,
          onConfirmItem: handleConfirmItem,
          onFinishEntrada: handleFinishEntrada,
          onCancelarEntrada: handleCancelarEntrada,
          onLimparSelecao: handleLimparSelecao,
          onCadastrarManual: () => {
            trySairEntradaIncompleta(() => {
              setManualNfError(null)
              setManualNfModalOpen(true)
            })
          },
          uploadError,
        }}
        saida={{
          nfBusca: nfBuscaSaida,
          itemIndex: saidaItemIndex,
          modoPalete: saidaModoPalete,
          qtdPaletesInput: saidaQtdPaletesInput,
          qtdPaletesAlvo: saidaQtdPaletesAlvo,
          paletesDisponiveis:
            nfBuscaSaida && saidaItemIndex != null
              ? (() => {
                  const item = nfBuscaSaida.items.find((it) => it.index === saidaItemIndex)
                  return item ? paletesDisponiveisItem(item, saidaPaletesConfirmados) : 0
                })()
              : 0,
          paletesSelecionados: [...saidaPaletesSelecionados],
          selecaoConcluida: saidaSelecaoConcluida,
          paleteAtivo: saidaPaleteAtivo,
          caixasPalete: saidaCaixasPalete,
          paletesConfirmados: saidaPaletesConfirmados,
          onBuscar: handleBuscarSaida,
          onSelectItem: handleSelectItemSaida,
          onQtdPaletesChange: handleQtdPaletesChange,
          onIniciarSelecao: handleIniciarSelecaoSaida,
          onConfirmarSelecaoPaletes: handleConfirmarSelecaoPaletes,
          onCaixasPaleteChange: handleCaixasPaleteChange,
          onConfirmarPalete: handleConfirmarPaleteSaida,
          onRemoverPalete: handleRemoverPaleteSaida,
          onFinalizarSaida: handleFinalizarSaida,
          onCancelarSaida: handleCancelarSaida,
          buscaErro,
          selecaoErro: saidaSelecaoErro,
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
        consulta={{
          notas: state.notas,
          emitentesSugeridos,
          resultados: consultaResultados,
          buscaErro: consultaErro,
          onBuscar: handleBuscarConsulta,
          onLimpar: handleLimparConsulta,
          onAlternarDestaqueInventario: handleAlternarDestaqueInventario,
          resultadosDestacados: consultaResultados,
          nfAdicionar: consultaNfAdicionar,
          nfAdicionarErro: consultaNfAdicionarErro,
          itemAdicionadoMsg: consultaItemAdicionadoMsg,
          itemManualErro: consultaItemManualErro,
          aguardandoEndereco: consultaAguardandoEndereco,
          paletesTotal: consultaAguardandoEndereco ? paletesTotal : null,
          enderecosSelecionados: consultaAguardandoEndereco ? pendingSelection.size : 0,
          onBuscarNfAdicionar: handleBuscarNfAdicionar,
          onReplicarItem: handleReplicarItemConsulta,
          onExcluirItem: handleExcluirItemConsulta,
          onAdicionarItemManual: handleAdicionarItemManualConsulta,
          onConfirmarEnderecos: handleConfirmItem,
          onCancelarEnderecos: handleCancelarEnderecoConsulta,
          onLimparNfAdicionar: handleLimparNfAdicionar,
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
          consultaAddresses={consultaAddresses.size > 0 ? consultaAddresses : undefined}
          saidaAddresses={nfEditar ? undefined : saidaAddresses}
          saidaFlaggedAddresses={editMode ? undefined : saidaFlaggedAddresses}
          paintMode={
            editMode ||
            allocateMode ||
            (saidaModoPalete && (saidaQtdPaletesAlvo != null || saidaSelecaoConcluida))
          }
          onCellClick={handleCellClick}
          onCellPaint={handleCellPaint}
          paletesRestantes={paletesRestantesCount}
          paletesTotal={panelPaletesTotal}
          saidaMode={saidaModoPalete}
        />
      </main>

      <PrintLayoutDocument camaraIds={printCamaras} />

      {entradaPendenteAlert && (
        <EntradaPendenteAlert
          nfNumero={entradaPendenteAlert.nfNumero}
          itensPendentes={entradaPendenteAlert.itensPendentes}
          onClose={() => setEntradaPendenteAlert(null)}
          onConfirmLeave={entradaPendenteAlert.onConfirmLeave}
        />
      )}

      {paletesLimiteAlert && (
        <PaletesLimiteAlert
          kind={paletesLimiteAlert}
          onClose={() => setPaletesLimiteAlert(null)}
        />
      )}

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
