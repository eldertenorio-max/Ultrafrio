import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { AppSidebar } from './components/AppSidebar'
import { AppTopBar } from './components/AppTopBar'
import { VoiceAssistantHUD } from './components/VoiceAssistantHUD'
import type { SidebarSectionId } from './components/CollapsibleSidebarSection'
import { DetailModal } from './components/DetailModal'
import { ManualNfModal, type ManualNfModalResult } from './components/ManualNfModal'
import { IntroSplash } from './components/IntroSplash'
import { LayoutPanel } from './components/LayoutPanel'
import { StageModal } from './components/StageModal'
import { EntradaDestinoModal } from './components/EntradaDestinoModal'
import { EscolhaEstoqueModal } from './components/EscolhaEstoqueModal'
import { PrintLayoutDocument } from './components/PrintLayoutDocument'
import { CAMARAS } from './layout/camaras'
import { listarItensStage, itemNoStage } from './layout/stage'
import { EntradaPendenteAlert } from './components/EntradaPendenteAlert'
import { OcupadoAlert } from './components/OcupadoAlert'
import { PaletesLimiteAlert } from './components/PaletesLimiteAlert'
import { BuscaEncontradaToast } from './components/BuscaEncontradaToast'
import { useEnderecamentoStore } from './hooks/useEnderecamentoStore'
import { useTheme } from './hooks/useTheme'
import { useSidebarMode } from './hooks/useSidebarMode'
import { useVoiceAssistant } from './hooks/useVoiceAssistant'
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
  criarMovimentoMovimentacao,
  criarMovimentoSaida,
  enderecosAlterados,
  enderecosDaNf,
  nfTemEnderecosValidos,
  nfTemHistoricoEnderecos,
  removerNfDoEstoque,
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
import { buscarEstoque, temFiltroConsulta, alternarDestaqueConsulta, resultadosEstaoDestacados, CONSULTA_FILTROS_VAZIOS, type ConsultaEstoqueFiltros, type ConsultaEstoqueResultado } from './lib/consultaEstoque'
import {
  avisoConsultaEncontrada,
  avisoNfEncontrada,
  primeiroEnderecoConsulta,
  primeiroEnderecoIds,
  primeiroEnderecoNf,
  type BuscaEncontradaAviso,
  type MapFocusTarget,
} from './lib/focarMapaBusca'
import {
  describeVoiceCommand,
  painelFiltrosPorDias,
  parseVoiceCommand,
  type VoiceCommand,
} from './lib/parseVoiceCommand'
import {
  createConversationState,
  processConversationTurn,
  VOICE_CONVERSATION_GREETING,
} from './lib/voiceConversation'
import { speakText, stopSpeaking } from './lib/voiceSpeech'
import { getStoredVoicePrefs, storeVoicePrefs, type VoicePrefs } from './lib/voicePrefs'
import { prepareVoiceCommandText } from './lib/voiceNormalize'
import { hasRegisteredVoices } from './lib/voiceProfile'
import {
  CONTA_SISTEMA_ID,
  getUsuarioAtivoId,
  listarUsuariosSessao,
  registrarAcessoUsuario,
  setUsuarioAtivoId,
  type ContaUsuario,
} from './lib/contaSessao'
import { useVoiceRegistry } from './hooks/useVoiceRegistry'
import { findNotaByNumero, mensagemNfCanceladaDuplicada, mensagemNfDuplicada } from './lib/nfDuplicate'
import { repararNfDuplicadaDoXml, tentarRepararPersistido } from './lib/repararNfEstoque'
import { parseCanceladaXml } from './lib/parseCanceladaXml'
import { parseNfeReferenciaChaves, parseNfeXml } from './lib/parseNfeXml'
import { parseEnderecoFalado, validarEnderecoDestinoVoz } from './lib/parseEnderecoFalado'
import { splitMovimentacaoVozTranscript } from './lib/movimentacaoVoz'
import {
  documentoSaidaFromNota,
  notasDisponiveisParaSaida,
  sugerirOrigemSaida,
  vincularSaidaXmlOrigem,
} from './lib/saidaXml'
import {
  aplicarLocalizacaoItem,
  aplicarLocalizacaoNf,
  aplicarSaidaStage,
  adicionarPosicoesItemArmazem,
  itensStageDaNf,
  moverEnderecosParaStage,
  moverItemStageParaArmazem,
  nfTemEstoqueArmazem,
  nfTemEstoqueStage,
  snapshotSaidaStage,
} from './lib/stageEstoque'
import type { ModoMovimentacao } from './components/EditarPosicaoPanel'
import type { EntradaItemCampos } from './lib/entradaCampos'
import { quantidadeEstoqueItem } from './lib/nfeUnidades'
import type { SaidaItemDraft } from './lib/saidaParcial'
import type { AddressId, AddressOccupancy, JustificativaSaidaId, LocalizacaoEstoque, MotivoRemocaoEstoqueId, MovimentoRegistro, NotaFiscal, SaidaXmlDocumento } from './types'
import {
  defaultPainelFiltros,
  type PainelFiltros,
} from './lib/painelAnalytics'
import type { SaidaModoBusca, SaidaOrigemEstoque } from './components/SaidaPanel'
import './App.css'
import './doca-theme.css'

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

function mensagemNfSemEstoqueVisivel(nf: NotaFiscal, movimentos: MovimentoRegistro[]): string {
  const tinhaEnderecosInvalidos = nf.items.some(
    (it) => it.allocatedAddresses.length > 0 && !nfTemEnderecosValidos({ ...nf, items: [it] }),
  )
  if (nfTemHistoricoEnderecos(nf, movimentos)) {
    return (
      `NF ${nf.numero} existe no sistema, mas os endereços sumiram do mapa. ` +
      'Recarregue a página (F5) ou suba o XML de novo na Entrada para restaurar.'
    )
  }
  if (tinhaEnderecosInvalidos) {
    return (
      `NF ${nf.numero} está cadastrada com posições inválidas no mapa. ` +
      'Suba o XML na aba Entrada para corrigir.'
    )
  }
  if (nf.items.length === 0) {
    return (
      `NF ${nf.numero} está cadastrada, mas sem itens. ` +
      'Suba o XML na aba Entrada — o sistema atualiza automaticamente.'
    )
  }
  return (
    `NF ${nf.numero} está cadastrada, mas sem posições no armazém. ` +
    'Suba o XML na Entrada para atualizar ou enderece no mapa.'
  )
}

const PAINEL_FILTROS_KEY = 'ultrafrio-painel-filtros'

function loadPainelFiltros(): PainelFiltros {
  try {
    const raw = localStorage.getItem(PAINEL_FILTROS_KEY)
    if (raw) return { ...defaultPainelFiltros(), ...JSON.parse(raw) }
  } catch {
    /* ignore */
  }
  return defaultPainelFiltros()
}

function savePainelFiltros(filtros: PainelFiltros) {
  try {
    localStorage.setItem(PAINEL_FILTROS_KEY, JSON.stringify(filtros))
  } catch {
    /* ignore */
  }
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
  const { theme, toggleTheme, setTheme } = useTheme()
  const { sidebarMode, setSidebarMode } = useSidebarMode()
  const [openSection, setOpenSection] = useState<SidebarSectionId | null>(null)
  const [voicePrefs, setVoicePrefs] = useState<VoicePrefs>(() => getStoredVoicePrefs())
  const {
    registry: voiceRegistry,
    setRegistry: setVoiceRegistry,
    syncError: voiceSyncError,
    refresh: refreshVoiceRegistry,
  } = useVoiceRegistry()
  const [voiceFeedback, setVoiceFeedback] = useState<string | null>(null)
  const [contaUsuarios, setContaUsuarios] = useState<ContaUsuario[]>(() => listarUsuariosSessao())
  const [contaUsuarioAtivoId, setContaUsuarioAtivoId] = useState(() => getUsuarioAtivoId())
  const [conversationLines, setConversationLines] = useState<
    { role: 'user' | 'assistant'; text: string }[]
  >([])
  const conversationStateRef = useRef(createConversationState())
  const openSectionRef = useRef<SidebarSectionId | null>(null)
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
  const [saidaModoBusca, setSaidaModoBusca] = useState<SaidaModoBusca>('numero')
  const [saidaXmlDoc, setSaidaXmlDoc] = useState<SaidaXmlDocumento | null>(null)
  const [saidaOrigemSelecionadaId, setSaidaOrigemSelecionadaId] = useState('')
  const [saidaUploadXmlErro, setSaidaUploadXmlErro] = useState<string | null>(null)
  const [buscaErro, setBuscaErro] = useState<string | null>(null)
  const [nfEditarId, setNfEditarId] = useState<string | null>(null)
  const [editItemIndex, setEditItemIndex] = useState<number | null>(null)
  const [editPendingSelection, setEditPendingSelection] = useState<Set<AddressId>>(new Set())
  const [editMoveOrigens, setEditMoveOrigens] = useState<Set<AddressId>>(new Set())
  const [editMoveDestinos, setEditMoveDestinos] = useState<Set<AddressId>>(new Set())
  const [editSalvando, setEditSalvando] = useState(false)
  const [editModoMovimentacao, setEditModoMovimentacao] = useState<ModoMovimentacao>('reposicionar')
  const editMarcandoStage = editModoMovimentacao === 'enviar-stage'
  const editTirandoDoStage = editModoMovimentacao === 'tirar-stage'
  const [vozOrigemAddress, setVozOrigemAddress] = useState<AddressId | null>(null)
  const [vozErro, setVozErro] = useState<string | null>(null)
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
  const [printWithOccupancy, setPrintWithOccupancy] = useState(false)
  const [printOrientacao, setPrintOrientacao] = useState<'landscape' | 'portrait'>('landscape')
  const [ocupadoAlert, setOcupadoAlert] = useState<{
    addressId: AddressId
    occ: AddressOccupancy
  } | null>(null)
  const [paletesLimiteAlert, setPaletesLimiteAlert] = useState<
    'sem_paletes' | 'maximo' | 'incompleto' | 'posicoes_adicionar' | null
  >(null)
  const [entradaPendenteAlert, setEntradaPendenteAlert] = useState<{
    nfNumero: string
    itensPendentes: number
    onConfirmLeave?: () => void
  } | null>(null)
  const entradaPendenteDismissedRef = useRef<string | null>(null)
  const editOriginalAddressesRef = useRef<Set<AddressId>>(new Set())
  const editMoveOrigensRef = useRef<Set<AddressId>>(new Set())
  const editMoveDestinosRef = useRef<Set<AddressId>>(new Set())
  const [manualNfModalOpen, setManualNfModalOpen] = useState(false)
  const [manualNfError, setManualNfError] = useState<string | null>(null)
  const [selectedEntradaIds, setSelectedEntradaIds] = useState<string[]>([])
  const lastEntradaClickRef = useRef<string | null>(null)
  const stateRef = useRef(state)
  const [stageModalOpen, setStageModalOpen] = useState(false)
  const [entradaDestinoPendente, setEntradaDestinoPendente] = useState<{
    imported: NotaFiscal[]
    movimentos: MovimentoRegistro[]
  } | null>(null)
  const [editStagePending, setEditStagePending] = useState<Set<AddressId>>(new Set())
  const [editAdicionarPosicoesAlvo, setEditAdicionarPosicoesAlvo] = useState<number | null>(null)
  const [editNovasPosicoes, setEditNovasPosicoes] = useState<Set<AddressId>>(new Set())
  const [saidaOrigemEstoque, setSaidaOrigemEstoque] = useState<SaidaOrigemEstoque>('armazem')
  const [saidaDestinoPendente, setSaidaDestinoPendente] = useState<NotaFiscal | null>(null)
  const [saidaStageItemIndex, setSaidaStageItemIndex] = useState<number | null>(null)
  const [saidaStageQtdInput, setSaidaStageQtdInput] = useState('')
  const [saidaStageConfirmados, setSaidaStageConfirmados] = useState<SaidaItemDraft[]>([])
  const [painelFiltros, setPainelFiltros] = useState<PainelFiltros>(() => loadPainelFiltros())
  const [mapFocusAddressId, setMapFocusAddressId] = useState<AddressId | null>(null)
  const [mapFocusStage, setMapFocusStage] = useState(false)
  const [mapFocusScrollToken, setMapFocusScrollToken] = useState(0)
  const [mapPulseAddressId, setMapPulseAddressId] = useState<AddressId | null>(null)
  const [buscaEncontrada, setBuscaEncontrada] = useState<BuscaEncontradaAviso | null>(null)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  const reparoInicialFeitoRef = useRef(false)
  useEffect(() => {
    if (loading || reparoInicialFeitoRef.current) return
    reparoInicialFeitoRef.current = true
    const atual = stateRef.current
    const { data, reparado } = tentarRepararPersistido({
      notas: atual.notas,
      movimentos: atual.movimentos,
      notasCanceladas: atual.notasCanceladas,
      emitentes: atual.emitentes,
    })
    if (!reparado) return
    void saveNow({ ...atual, ...data })
  }, [loading, saveNow])

  useEffect(() => {
    openSectionRef.current = openSection
  }, [openSection])

  useEffect(() => {
    editMoveOrigensRef.current = editMoveOrigens
  }, [editMoveOrigens])

  useEffect(() => {
    editMoveDestinosRef.current = editMoveDestinos
  }, [editMoveDestinos])

  useEffect(() => {
    storeVoicePrefs(voicePrefs)
  }, [voicePrefs])

  const focarMapaDestaque = useCallback(
    (target: MapFocusTarget | null) => {
      if (!target) return
      if (sidebarMode === 'fullscreen') setSidebarMode('open')

      setMapFocusScrollToken((t) => t + 1)
      if (target.type === 'address') {
        setMapFocusAddressId(target.addressId)
        setMapFocusStage(false)
        setMapPulseAddressId(target.addressId)
      } else {
        setMapFocusAddressId(null)
        setMapFocusStage(true)
        setMapPulseAddressId(null)
      }
    },
    [sidebarMode, setSidebarMode],
  )

  const focarMapaBuscaEncontrado = useCallback(
    (target: MapFocusTarget | null, aviso: BuscaEncontradaAviso) => {
      focarMapaDestaque(target)
      setBuscaEncontrada(aviso)
    },
    [focarMapaDestaque],
  )

  useEffect(() => {
    if (!buscaEncontrada) return
    const t = setTimeout(() => setBuscaEncontrada(null), 6000)
    return () => clearTimeout(t)
  }, [buscaEncontrada])

  useEffect(() => {
    if (!mapPulseAddressId && !mapFocusStage) return
    const t = setTimeout(() => {
      setMapPulseAddressId(null)
      setMapFocusStage(false)
    }, 3500)
    return () => clearTimeout(t)
  }, [mapPulseAddressId, mapFocusStage, mapFocusScrollToken])

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
  const [printJobId, setPrintJobId] = useState(0)

  const schedulePrint = useCallback(
    (withOccupancy: boolean, orientacao: 'landscape' | 'portrait') => {
      setPrintWithOccupancy(withOccupancy)
      setPrintOrientacao(orientacao)
      setPrintJobId((n) => n + 1)
    },
    [],
  )

  useEffect(() => {
    if (printJobId === 0) return
    const styleId = 'print-page-style'
    let el = document.getElementById(styleId) as HTMLStyleElement | null
    if (!el) {
      el = document.createElement('style')
      el.id = styleId
      document.head.appendChild(el)
    }
    el.textContent = `@page { size: A4 ${printOrientacao}; margin: 5mm; }`
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print()
      })
    })
    return () => cancelAnimationFrame(raf)
  }, [printJobId, printOrientacao, printWithOccupancy])

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
  const notasOrigemSaida = useMemo(() => notasDisponiveisParaSaida(state.notas), [state.notas])
  const saidaVinculo = useMemo(() => {
    if (!nfBuscaSaida || !saidaXmlDoc) return null
    return vincularSaidaXmlOrigem(nfBuscaSaida, saidaXmlDoc)
  }, [nfBuscaSaida, saidaXmlDoc])
  const saidaItensExibicao = useMemo(() => {
    if (!nfBuscaSaida) return []
    if (saidaOrigemEstoque === 'stage') {
      return nfBuscaSaida.items.filter((it) => it.localizacao === 'stage')
    }
    if (saidaVinculo) return saidaVinculo.itensExibicao
    return nfBuscaSaida.items.filter((it) => it.allocatedAddresses.length > 0)
  }, [nfBuscaSaida, saidaVinculo, saidaOrigemEstoque])
  const saidaLimitesPorItem = saidaVinculo?.limitesPorItem
  const saidaVinculoAvisos = saidaVinculo?.avisos ?? []
  const nfEditar = nfEditarId ? state.notas.find((n) => n.id === nfEditarId) ?? null : null

  const activeEntradaItem = useMemo(() => {
    if (!activeNf || activeNf.status !== 'em_andamento' || state.activeItemIndex == null) return null
    return activeNf.items.find((it) => it.index === state.activeItemIndex) ?? null
  }, [activeNf, state.activeItemIndex])

  const allocateMode =
    activeEntradaItem != null && activeEntradaItem.localizacao !== 'stage'

  const nfEmEdicao = nfEditar != null
  const editMode = nfEmEdicao && editItemIndex != null

  const mapaEmOperacaoAtiva =
    editAdicionarPosicoesAlvo != null ||
    allocateMode ||
    consultaAguardandoEndereco ||
    saidaModoPalete ||
    editMode ||
    (nfEmEdicao &&
      (editMarcandoStage ||
        editTirandoDoStage ||
        editMoveOrigens.size > 0 ||
        editMoveDestinos.size > 0 ||
        editStagePending.size > 0))

  const displayOccupancy = useMemo(() => {
    const map = new Map(occupancy)
    if (editMode && nfEditar) {
      for (const addr of editStagePending) map.delete(addr)
      if (!editMarcandoStage) {
        for (const addr of editMoveOrigens) {
          const occ = map.get(addr)
          if (!occ || occ.nfId === nfEditar.id) map.delete(addr)
        }
      }
      return map
    }
    if (allocateMode && activeNf && state.activeItemIndex != null) {
      for (const addr of pendingSelection) map.delete(addr)
    }
    return map
  }, [
    occupancy,
    editMode,
    editMarcandoStage,
    editStagePending,
    editMoveOrigens,
    allocateMode,
    activeNf,
    nfEditar,
    state.activeItemIndex,
    pendingSelection,
  ])

  const saidaAddresses = useMemo(() => {
    if (!nfBuscaSaida || saidaItemIndex != null) return new Set<AddressId>()
    return new Set(enderecosDaNf(nfBuscaSaida))
  }, [nfBuscaSaida, saidaItemIndex])

  const saidaItemDestaqueAddresses = useMemo(() => {
    if (!nfBuscaSaida || saidaItemIndex == null) return new Set<AddressId>()
    const item = nfBuscaSaida.items.find((it) => it.index === saidaItemIndex)
    if (!item || item.allocatedAddresses.length === 0) return new Set<AddressId>()
    return new Set(item.allocatedAddresses)
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

  /** Endereços da NF ou do item selecionado — destaque verde no mapa da movimentação. */
  const editMapAddresses = useMemo(() => {
    if (!nfEditar) return undefined
    if (editItemIndex != null) {
      const item = nfEditar.items.find((it) => it.index === editItemIndex)
      if (!item || item.allocatedAddresses.length === 0) return undefined
      return new Set(item.allocatedAddresses)
    }
    if (editNfAddresses.size === 0) return undefined
    return editNfAddresses
  }, [nfEditar, editItemIndex, editNfAddresses])

  const consultaAddresses = useMemo(
    () => new Set(consultaResultados.filter((r) => !r.isStage).map((r) => r.addressId)),
    [consultaResultados],
  )

  const consultaStageHighlighted = useMemo(
    () => consultaResultados.some((r) => r.isStage),
    [consultaResultados],
  )

  const consultaNfAdicionar = consultaNfAdicionarId
    ? state.notas.find((n) => n.id === consultaNfAdicionarId) ?? null
    : null

  const panelPendingSelection = editAdicionarPosicoesAlvo != null
    ? editNovasPosicoes
    : editMode
      ? editPendingSelection
      : saidaModoPalete && !saidaSelecaoConcluida
        ? saidaPaletesSelecionados
        : saidaModoPalete && saidaPaleteAtivo
          ? new Set([saidaPaleteAtivo])
          : pendingSelection
  const panelAllocateMode =
    allocateMode ||
    editMode ||
    nfEmEdicao ||
    (saidaModoPalete && (saidaQtdPaletesAlvo != null || saidaSelecaoConcluida))
  const panelActiveNfNumero = nfEmEdicao ? nfEditar?.numero ?? null : activeNf?.numero ?? null

  const activeAllocateItem = allocateMode ? activeEntradaItem : null

  const paletesTotal =
    activeAllocateItem?.paletes != null && activeAllocateItem.paletes > 0
      ? activeAllocateItem.paletes
      : null
  const paletesRestantesCount =
    editAdicionarPosicoesAlvo != null
      ? Math.max(0, editAdicionarPosicoesAlvo - editNovasPosicoes.size)
      : paletesTotal != null
        ? Math.max(0, paletesTotal - pendingSelection.size)
        : null

  const panelPaletesTotal =
    editAdicionarPosicoesAlvo ?? paletesTotal

  const editEnderecosOcupados = useMemo(() => {
    const ocupados = new Set(occupancy.keys())
    for (const addr of editPendingSelection) ocupados.delete(addr)
    return ocupados
  }, [occupancy, editPendingSelection])

  const movimentosHistorico = useMemo(
    () => [...state.movimentos].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [state.movimentos],
  )

  const canceladasAtivas = useMemo(
    () => state.notasCanceladas.filter((c) => !c.excluido),
    [state.notasCanceladas],
  )

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
    if (!item || item.localizacao === 'stage') {
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
    let reparos: string[] = []

    for (const file of files) {
      try {
        const text = await file.text()
        const nf = parseNfeXml(text)
        const dup = mensagemNfDuplicada(nf, acumulado, state.notasCanceladas, movimentos)
        if (dup) {
          const resultado = repararNfDuplicadaDoXml(
            {
              notas: acumulado,
              movimentos,
              notasCanceladas: state.notasCanceladas,
              emitentes: state.emitentes,
            },
            nf,
          )
          if (resultado) {
            const nextState = { ...state, ...resultado.data }
            setState(nextState)
            movimentos = resultado.data.movimentos
            acumulado.splice(0, acumulado.length, ...resultado.data.notas)
            await saveNow(nextState)
            reparos.push(resultado.mensagem)
            continue
          }
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
      const askDestino = () => {
        setEntradaDestinoPendente({ imported, movimentos })
      }

      const switchingAway =
        nfEntradaIncompleta(activeNf) && activeNf && imported[0].id !== activeNf.id
      if (switchingAway) {
        trySairEntradaIncompleta(askDestino)
      } else {
        askDestino()
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
    if (reparos.length > 0) {
      feedback.push(reparos.join(' · '))
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

  async function handleEntradaDestinoConfirm(localizacao: LocalizacaoEstoque) {
    if (!entradaDestinoPendente) return
    const { imported, movimentos } = entradaDestinoPendente
    const nfsComDestino = imported.map((nf) => aplicarLocalizacaoNf(nf, localizacao))
    const nextState = {
      ...state,
      notas: [...nfsComDestino, ...state.notas],
      movimentos,
      activeNfId: nfsComDestino[0].id,
      activeItemIndex: nfsComDestino[0].items[0]?.index ?? 0,
    }
    setState(nextState)
    setPendingSelection(new Set())
    setSelectedEntradaIds(nfsComDestino.map((nf) => nf.id))
    lastEntradaClickRef.current = nfsComDestino[0].id
    setEntradaDestinoPendente(null)
    await saveNow(nextState)
  }

  function handleEntradaDestinoCancel() {
    setEntradaDestinoPendente(null)
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
    const occ = occupancy.get(addressId)
    if (occ && !mapaEmOperacaoAtiva) {
      setDetailAddress(addressId)
      return
    }

    const saidaPending =
      saidaModoPalete &&
      (saidaPaletesSelecionados.has(addressId) ||
        (saidaSelecaoConcluida && saidaPaleteAtivo === addressId))
    const stagePending = editStagePending.has(addressId)
    const editPending = editPendingSelection.has(addressId)
    const entradaPending = pendingSelection.has(addressId)
    const movOrigemOuDestino =
      editMoveOrigens.has(addressId) || editMoveDestinos.has(addressId)
    handleCellPaint(
      addressId,
      saidaPending ||
        editPending ||
        stagePending ||
        entradaPending ||
        movOrigemOuDestino
        ? 'remove'
        : 'add',
      canInteract,
    )
  }

  function handleCellPaint(addressId: AddressId, mode: 'add' | 'remove', canInteract: boolean) {
    const occ = occupancy.get(addressId)
    if (!canInteract) {
      if (occ && !mapaEmOperacaoAtiva) {
        setDetailAddress(addressId)
      }
      return
    }

    if (nfEditar) {
      if (
        editAdicionarPosicoesAlvo != null &&
        editItemIndex != null &&
        !editMarcandoStage
      ) {
        if (occ) {
          setOcupadoAlert({ addressId, occ })
          return
        }

        setEditNovasPosicoes((prev) => {
          const next = new Set(prev)
          if (mode === 'add') {
            if (next.has(addressId)) return prev
            if (next.size >= editAdicionarPosicoesAlvo) {
              setPaletesLimiteAlert('posicoes_adicionar')
              return prev
            }
            next.add(addressId)
          } else {
            next.delete(addressId)
          }
          return next
        })
        return
      }

      if (editMode && editItemIndex != null) {
        const item = nfEditar.items.find((it) => it.index === editItemIndex)
        if (item && itemNoStage(item)) {
          if (occ) {
            const mesmoItem = occ.nfId === nfEditar.id && occ.itemIndex === editItemIndex
            if (!mesmoItem) {
              setOcupadoAlert({ addressId, occ })
              return
            }
          }

          setEditPendingSelection((prev) => {
            const next = new Set(prev)
            if (mode === 'add') {
              if (next.has(addressId)) return prev
              next.add(addressId)
            } else {
              next.delete(addressId)
            }
            return next
          })
          return
        }
      }

      if (editMarcandoStage) {
        if (editItemIndex == null) {
          if (occ?.nfId === nfEditar.id && mode === 'add') {
            const idx = occ.itemIndex
            const item = nfEditar.items.find((it) => it.index === idx)
            if (item && !itemNoStage(item) && item.allocatedAddresses.length > 0) {
              editOriginalAddressesRef.current = new Set(item.allocatedAddresses)
              setEditItemIndex(idx)
              setEditPendingSelection(new Set())
              setEditMoveOrigens(new Set())
              setEditMoveDestinos(new Set())
              setEditStagePending(new Set([addressId]))
            }
          }
          return
        }

        if (occ) {
          const mesmoItem = occ.nfId === nfEditar.id && occ.itemIndex === editItemIndex
          if (!mesmoItem) {
            setOcupadoAlert({ addressId, occ })
            return
          }

          if (mode === 'add') {
            setEditStagePending((prev) => {
              if (prev.has(addressId)) return prev
              const next = new Set(prev)
              next.add(addressId)
              return next
            })
            setEditMoveOrigens(new Set())
            setEditMoveDestinos(new Set())
          } else {
            setEditStagePending((prev) => {
              const next = new Set(prev)
              next.delete(addressId)
              return next
            })
          }
        }
        return
      }

      const itemReposicionar =
        editItemIndex != null
          ? nfEditar.items.find((it) => it.index === editItemIndex)
          : null
      const reposicionarAtivo =
        !editMarcandoStage &&
        (!itemReposicionar || !itemNoStage(itemReposicionar))

      if (reposicionarAtivo) {
        if (occ) {
          if (occ.nfId !== nfEditar.id) {
            setOcupadoAlert({ addressId, occ })
            return
          }

          const itemFromOcc = nfEditar.items.find((it) => it.index === occ.itemIndex)
          if (!itemFromOcc || itemNoStage(itemFromOcc)) return

          if (editItemIndex != null && editItemIndex !== occ.itemIndex) {
            setOcupadoAlert({ addressId, occ })
            return
          }

          if (editItemIndex == null) {
            editOriginalAddressesRef.current = new Set(itemFromOcc.allocatedAddresses)
            setEditItemIndex(occ.itemIndex)
          }

          setEditMoveOrigens((prevOrigens) => {
            const nextOrigens = new Set(prevOrigens)
            if (mode === 'add') nextOrigens.add(addressId)
            else nextOrigens.delete(addressId)

            let nextDestinos = editMoveDestinosRef.current
            if (nextDestinos.size > nextOrigens.size) {
              nextDestinos = new Set([...nextDestinos].slice(0, nextOrigens.size))
              editMoveDestinosRef.current = nextDestinos
              setEditMoveDestinos(nextDestinos)
            }

            editMoveOrigensRef.current = nextOrigens
            return nextOrigens
          })
          return
        }

        if (editMoveOrigensRef.current.size === 0) return
        if (occupancy.has(addressId) && !editMoveOrigensRef.current.has(addressId)) return

        setEditMoveDestinos((prev) => {
          const next = new Set(prev)
          const origensSize = editMoveOrigensRef.current.size
          if (mode === 'add') {
            if (next.has(addressId)) return prev
            if (next.size >= origensSize) return prev
            next.add(addressId)
          } else {
            next.delete(addressId)
          }
          editMoveDestinosRef.current = next
          return next
        })
        return
      }

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

    if (allocateMode && state.activeItemIndex != null) {
      const snapshot = stateRef.current
      const nfAloc = snapshot.notas.find((n) => n.id === snapshot.activeNfId)
      if (!nfAloc) return

      if (occ) {
        const mesmoItem =
          occ.nfId === nfAloc.id && occ.itemIndex === snapshot.activeItemIndex
        if (!mesmoItem) {
          setOcupadoAlert({ addressId, occ })
          return
        }
      }

      const currentItemIndex = snapshot.activeItemIndex
      const item = nfAloc.items.find((it) => it.index === currentItemIndex)
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
            if (nf.id !== nfAloc.id) return nf
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
    if (allItemsAllocated(updatedNf)) {
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
    }
    if (updatedNf.status === 'concluida') {
      setSelectedEntradaIds((prev) => prev.filter((id) => id !== updatedNf.id))
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

    setState((s) => {
      const nf = s.notas.find((n) => n.id === s.activeNfId)
      const item = nf?.items.find((it) => it.index === itemIndex)
      if (!nf || !item) return s

      const trimmed = value.trim()
      let paletes: number | undefined
      if (trimmed === '') {
        paletes = undefined
      } else {
        const parsed = parsePaletesInput(value)
        if (parsed == null || parsed <= 0) return s
        paletes = parsed
      }

      let allocatedAddresses = item.allocatedAddresses
      if (
        s.activeItemIndex === itemIndex &&
        paletes != null &&
        paletes > 0 &&
        allocatedAddresses.length > paletes
      ) {
        allocatedAddresses = allocatedAddresses.slice(0, paletes)
      }

      if (s.activeItemIndex === itemIndex) {
        queueMicrotask(() => {
          setPendingSelection((prev) => {
            if (paletes != null && paletes > 0 && prev.size > paletes) {
              return new Set([...prev].slice(0, paletes))
            }
            return prev
          })
        })
      }

      const next: typeof s = {
        ...s,
        notas: s.notas.map((n) => {
          if (n.id !== s.activeNfId) return n
          return {
            ...n,
            items: n.items.map((it) =>
              it.index === itemIndex ? { ...it, paletes, allocatedAddresses } : it,
            ),
          }
        }),
      }

      queueMicrotask(() => {
        void saveNow(next)
      })

      return next
    })
  }

  function handleUpdateItemLocalizacao(itemIndex: number, localizacao: LocalizacaoEstoque) {
    if (!state.activeNfId) return
    if (state.activeItemIndex === itemIndex && localizacao === 'stage') {
      setPendingSelection(new Set())
    }
    setState((s) => ({
      ...s,
      notas: s.notas.map((nf) => {
        if (nf.id !== s.activeNfId) return nf
        return {
          ...nf,
          items: nf.items.map((it) =>
            it.index === itemIndex ? aplicarLocalizacaoItem(it, localizacao) : it,
          ),
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
      setManualNfModalOpen(false)
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
    setSaidaStageItemIndex(null)
    setSaidaStageQtdInput('')
    setSaidaStageConfirmados([])
  }

  function aplicarBuscaSaida(nf: NotaFiscal, origem: SaidaOrigemEstoque) {
    setSaidaOrigemEstoque(origem)
    setNfBuscaSaidaId(nf.id)
    limparEstadoSaida()
    focarMapaBuscaEncontrado(primeiroEnderecoNf(nf), avisoNfEncontrada(nf, 'saida'))
  }

  function resolverDestinoSaida(nf: NotaFiscal): boolean {
    const temArmazem = nfTemEstoqueArmazem(nf)
    const temStage = nfTemEstoqueStage(nf)
    if (temArmazem && temStage) {
      setSaidaDestinoPendente(nf)
      return false
    }
    if (temStage && !temArmazem) {
      aplicarBuscaSaida(nf, 'stage')
      return true
    }
    if (temArmazem) {
      aplicarBuscaSaida(nf, 'armazem')
      return true
    }
    setBuscaErro(mensagemNfSemEstoqueVisivel(nf, state.movimentos))
    setNfBuscaSaidaId(null)
    limparEstadoSaida()
    return false
  }

  function handleModoBuscaSaidaChange(modo: SaidaModoBusca) {
    setSaidaModoBusca(modo)
    setBuscaErro(null)
    setSaidaUploadXmlErro(null)
    if (modo === 'numero') {
      setSaidaXmlDoc(null)
      setSaidaOrigemSelecionadaId('')
      setNfBuscaSaidaId(null)
      limparEstadoSaida()
    }
  }

  async function handleUploadSaidaXml(file: File) {
    setSaidaUploadXmlErro(null)
    setBuscaErro(null)
    limparEstadoSaida()
    try {
      const text = await file.text()
      const refs = parseNfeReferenciaChaves(text)
      const parsed = parseNfeXml(text)
      const doc = documentoSaidaFromNota(parsed)
      const sugerida = sugerirOrigemSaida(state.notas, doc, refs)
      setSaidaXmlDoc(doc)
      setSaidaModoBusca('xml')
      if (sugerida) {
        setSaidaOrigemSelecionadaId(sugerida.id)
        setNfBuscaSaidaId(sugerida.id)
      } else {
        setSaidaOrigemSelecionadaId('')
        setNfBuscaSaidaId(null)
      }
    } catch (e) {
      setSaidaUploadXmlErro(e instanceof Error ? e.message : 'Erro ao ler XML.')
      setSaidaXmlDoc(null)
      setNfBuscaSaidaId(null)
    }
  }

  function handleVincularOrigemSaida() {
    setBuscaErro(null)
    if (!saidaXmlDoc) return
    const nf = state.notas.find((n) => n.id === saidaOrigemSelecionadaId)
    if (!nf) {
      setBuscaErro('Selecione a NF de origem.')
      return
    }
    const vinculo = vincularSaidaXmlOrigem(nf, saidaXmlDoc)
    if (vinculo.itensExibicao.length === 0) {
      setBuscaErro('Nenhum item do XML encontrado com estoque na NF selecionada.')
      setNfBuscaSaidaId(null)
      return
    }
    setNfBuscaSaidaId(nf.id)
    resolverDestinoSaida(nf)
  }

  function handleBuscarSaida(numero: string) {
    setSaidaModoBusca('numero')
    setSaidaXmlDoc(null)
    setSaidaOrigemSelecionadaId('')
    setSaidaUploadXmlErro(null)
    setBuscaErro(null)
    setSaidaSelecaoErro(null)
    const nf = buscarNfPorNumero(state.notas, numero)
    if (!nf) {
      setBuscaErro('NF não encontrada.')
      setNfBuscaSaidaId(null)
      limparEstadoSaida()
      return
    }
    resolverDestinoSaida(nf)
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

    if (saidaItemIndex === index) {
      if (saidaModoPalete) return
      resetSelecaoPaletesSaida()
      setSaidaItemIndex(null)
      return
    }

    if (paletesDisponiveisItem(item, saidaPaletesConfirmados) <= 0) return

    resetSelecaoPaletesSaida()
    setSaidaItemIndex(index)
    focarMapaDestaque(primeiroEnderecoIds(item.allocatedAddresses))
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
      saidaLimitesPorItem,
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
          sobraItem(itemAtual, next, saidaLimitesPorItem) <= 1e-9
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
      saidaXmlDoc
        ? {
            nfSaida: {
              numero: saidaXmlDoc.numero,
              serie: saidaXmlDoc.serie,
              chave: saidaXmlDoc.chave,
              emitente: saidaXmlDoc.emitente,
              dataEmissao: saidaXmlDoc.dataEmissao,
            },
          }
        : undefined,
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
    setSaidaXmlDoc(null)
    setSaidaOrigemSelecionadaId('')
    setSaidaUploadXmlErro(null)
    limparEstadoSaida()
  }

  function handleSelectItemStage(index: number) {
    if (!nfBuscaSaida) return
    const item = nfBuscaSaida.items.find((it) => it.index === index)
    if (!item || item.localizacao !== 'stage') return
    if (saidaStageConfirmados.some((s) => s.itemIndex === index)) return
    setSaidaStageItemIndex(index)
    setSaidaStageQtdInput(String(quantidadeEstoqueItem(item)))
    setSaidaSelecaoErro(null)
  }

  function handleStageQtdChange(value: string) {
    setSaidaStageQtdInput(value)
    setSaidaSelecaoErro(null)
  }

  function handleConfirmarItemStage() {
    if (!nfBuscaSaida || saidaStageItemIndex == null) return
    const item = nfBuscaSaida.items.find((it) => it.index === saidaStageItemIndex)
    if (!item) return
    const qtd = parseQuantidadeSaida(saidaStageQtdInput)
    if (qtd == null || qtd <= 0) {
      setSaidaSelecaoErro('Informe uma quantidade válida.')
      return
    }
    const max = quantidadeEstoqueItem(item)
    if (qtd > max) {
      setSaidaSelecaoErro(`Quantidade máxima: ${max}.`)
      return
    }
    setSaidaStageConfirmados((prev) => [
      ...prev.filter((s) => s.itemIndex !== saidaStageItemIndex),
      { itemIndex: saidaStageItemIndex, quantidadeSaida: qtd },
    ])
    setSaidaStageItemIndex(null)
    setSaidaStageQtdInput('')
    setSaidaSelecaoErro(null)
  }

  function handleRemoverItemStage(itemIndex: number) {
    setSaidaStageConfirmados((prev) => prev.filter((s) => s.itemIndex !== itemIndex))
    if (saidaStageItemIndex === itemIndex) {
      setSaidaStageItemIndex(null)
      setSaidaStageQtdInput('')
    }
    setSaidaSelecaoErro(null)
  }

  async function handleFinalizarSaidaStage(justificativaSaida: JustificativaSaidaId) {
    if (!nfBuscaSaida || saidaStageConfirmados.length === 0) return

    const movBase = criarMovimentoSaida(
      nfBuscaSaida,
      [],
      justificativaSaida,
      saidaStageConfirmados,
      undefined,
      saidaXmlDoc
        ? {
            nfSaida: {
              numero: saidaXmlDoc.numero,
              serie: saidaXmlDoc.serie,
              chave: saidaXmlDoc.chave,
              emitente: saidaXmlDoc.emitente,
              dataEmissao: saidaXmlDoc.dataEmissao,
            },
          }
        : undefined,
    )
    const mov = {
      ...movBase,
      itens: snapshotSaidaStage(nfBuscaSaida, saidaStageConfirmados),
    }
    const nextState = {
      ...state,
      notas: state.notas.map((n) =>
        n.id === nfBuscaSaida.id ? aplicarSaidaStage(n, saidaStageConfirmados) : n,
      ),
      movimentos: [mov, ...state.movimentos],
    }
    setState(nextState)
    await saveNow(nextState)
    setNfBuscaSaidaId(null)
    setSaidaXmlDoc(null)
    setSaidaOrigemSelecionadaId('')
    setSaidaUploadXmlErro(null)
    limparEstadoSaida()
  }

  function handleCancelarSaida() {
    setNfBuscaSaidaId(null)
    setSaidaXmlDoc(null)
    setSaidaOrigemSelecionadaId('')
    setSaidaUploadXmlErro(null)
    limparEstadoSaida()
    setBuscaErro(null)
  }

  function limparEstadoMapaEditar() {
    setEditItemIndex(null)
    setEditPendingSelection(new Set())
    setEditStagePending(new Set())
    setEditMoveOrigens(new Set())
    setEditMoveDestinos(new Set())
    editMoveOrigensRef.current = new Set()
    editMoveDestinosRef.current = new Set()
    setEditAdicionarPosicoesAlvo(null)
    setEditNovasPosicoes(new Set())
    setEditModoMovimentacao('reposicionar')
    setVozOrigemAddress(null)
    setVozErro(null)
    editOriginalAddressesRef.current = new Set()
  }

  function handleEditModoMovimentacao(modo: ModoMovimentacao) {
    setEditModoMovimentacao(modo)
    setEditAdicionarPosicoesAlvo(null)
    setEditNovasPosicoes(new Set())
    setEditMoveOrigens(new Set())
    setEditMoveDestinos(new Set())
    setEditStagePending(new Set())
    setVozOrigemAddress(null)
    setVozErro(null)

    if (modo !== 'tirar-stage' || !nfEditar) return

    const stageItems = itensStageDaNf(nfEditar)
    if (stageItems.length === 1) {
      handleSelectItemEditar(stageItems[0].index)
      return
    }

    const atual =
      editItemIndex != null ? nfEditar.items.find((it) => it.index === editItemIndex) : null
    if (atual && !itemNoStage(atual)) {
      setEditItemIndex(null)
      setEditPendingSelection(new Set())
      editOriginalAddressesRef.current = new Set()
    }
  }

  function iniciarEdicaoNf(nf: NotaFiscal) {
    setNfEditarId(nf.id)
    limparEstadoMapaEditar()
  }

  function handleBuscarEditar(numero: string) {
    setBuscaEditarErro(null)
    const nf = buscarNfPorNumero(state.notas, numero)
    if (!nf) {
      setBuscaEditarErro('NF não encontrada.')
      setNfEditarId(null)
      limparEstadoMapaEditar()
      return
    }
    const temArmazem = nfTemEstoqueArmazem(nf)
    const temStage = nfTemEstoqueStage(nf)
    if (!temArmazem && !temStage) {
      setBuscaEditarErro(mensagemNfSemEstoqueVisivel(nf, state.movimentos))
      setNfEditarId(null)
      limparEstadoMapaEditar()
      return
    }
    iniciarEdicaoNf(nf)
    focarMapaBuscaEncontrado(primeiroEnderecoNf(nf), avisoNfEncontrada(nf, 'movimentacao'))
  }

  function handleSelectItemEditar(index: number) {
    if (!nfEditar) return
    setEditAdicionarPosicoesAlvo(null)
    setEditNovasPosicoes(new Set())
    const item = nfEditar.items.find((it) => it.index === index)
    if (!item) return

    setEditStagePending(new Set())

    if (itemNoStage(item)) {
      editOriginalAddressesRef.current = new Set()
      setEditItemIndex(index)
      setEditPendingSelection(new Set())
      setEditMoveOrigens(new Set())
      setEditMoveDestinos(new Set())
      setVozOrigemAddress(null)
      setVozErro(null)
      setEditModoMovimentacao('tirar-stage')
      setDetailAddress(null)
      focarMapaDestaque({ type: 'stage' })
      return
    }

  if (item.allocatedAddresses.length === 0) return
  const original = new Set(item.allocatedAddresses)
  editOriginalAddressesRef.current = original
  setEditItemIndex(index)
  setEditPendingSelection(new Set())
  setEditMoveOrigens(new Set())
  setEditMoveDestinos(new Set())
  setVozOrigemAddress(null)
  setVozErro(null)
  if (editModoMovimentacao !== 'enviar-stage') {
    setEditModoMovimentacao('reposicionar')
  }
  setDetailAddress(null)
  focarMapaDestaque(primeiroEnderecoIds(item.allocatedAddresses))
  }

  function handleSelectVozOrigem(addressId: AddressId, index: number) {
    if (!nfEditar) return
    const item = nfEditar.items.find((it) => it.index === index)
    if (!item || itemNoStage(item)) return
    setVozErro(null)
    if (editItemIndex !== index) {
      handleSelectItemEditar(index)
      setVozOrigemAddress(addressId)
      return
    }
    setVozOrigemAddress(addressId)
  }

  function handleVozDestino(transcript: string): boolean {
    if (!transcript.trim()) return false
    setVozErro(null)

    const { addressText, confirm } = splitMovimentacaoVozTranscript(transcript)

    if (addressText) {
      if (!vozOrigemAddress || !nfEditar || editItemIndex == null || editMarcandoStage) return false

      const destId = parseEnderecoFalado(addressText)
      if (!destId) {
        setVozErro(
          `Não entendi "${addressText.trim()}". Fale devagar: "câmara 6 rua 1 coluna 2 nível 3".`,
        )
        return false
      }

      const item = nfEditar.items.find((it) => it.index === editItemIndex)
      if (!item?.allocatedAddresses.includes(vozOrigemAddress)) {
        setVozErro('Endereço de origem inválido para este item.')
        return false
      }

      const validationError = validarEnderecoDestinoVoz(
        destId,
        occupancy,
        editMoveOrigens,
        editMoveDestinos,
        vozOrigemAddress,
      )
      if (validationError) {
        setVozErro(validationError)
        return false
      }

      const origem = vozOrigemAddress
      const nextOrigens = new Set(editMoveOrigensRef.current)
      nextOrigens.add(origem)
      const nextDestinos = new Set(editMoveDestinosRef.current)
      nextDestinos.add(destId)
      editMoveOrigensRef.current = nextOrigens
      editMoveDestinosRef.current = nextDestinos
      setEditMoveOrigens(nextOrigens)
      setEditMoveDestinos(nextDestinos)
      setVozOrigemAddress(null)

      if (!confirm) {
        return nextOrigens.size > 0 && nextOrigens.size === nextDestinos.size
      }
    } else if (!confirm) {
      return false
    }

    if (confirm) {
      if (
        editMoveOrigensRef.current.size === 0 ||
        editMoveOrigensRef.current.size !== editMoveDestinosRef.current.size
      ) {
        setVozErro('Distribuição incompleta. Fale o destino antes de confirmar.')
        return false
      }
      void handleSalvarEditar()
      return false
    }

    return false
  }

  function handleAdicionarEnderecoDestino(addressId: AddressId) {
    if (!nfEditar || editItemIndex == null) return
    setEditPendingSelection((prev) => {
      const next = new Set(prev)
      next.add(addressId)
      return next
    })
  }

  async function handleAplicarStageDrop() {
    if (!nfEditar || editItemIndex == null || editStagePending.size === 0) return
    const currentItemIndex = editItemIndex
    const addresses = [...editStagePending]
    const notas = state.notas.map((nf) =>
      nf.id === nfEditar.id ? moverEnderecosParaStage(nf, currentItemIndex, addresses) : nf,
    )
    const updatedNf = notas.find((n) => n.id === nfEditar.id)!
    const nextState = {
      ...state,
      notas,
      movimentos: [
        criarMovimentoMovimentacao(updatedNf, currentItemIndex, addresses),
        ...state.movimentos,
      ],
    }
    setState(nextState)
    await saveNow(nextState)
    setEditStagePending(new Set())
    setEditModoMovimentacao('reposicionar')

    const updatedItem = updatedNf.items.find((it) => it.index === currentItemIndex)
    if (
      updatedItem &&
      !itemNoStage(updatedItem) &&
      updatedItem.allocatedAddresses.length > 0
    ) {
      editOriginalAddressesRef.current = new Set(updatedItem.allocatedAddresses)
      setEditMoveOrigens(new Set())
      setEditMoveDestinos(new Set())
    } else {
      setEditItemIndex(null)
      setEditPendingSelection(new Set())
      editOriginalAddressesRef.current = new Set()
    }
  }

  async function handleSalvarEditar(): Promise<boolean> {
    if (editSalvando) return false
    const nfAtual = nfEditarId
      ? stateRef.current.notas.find((n) => n.id === nfEditarId) ?? null
      : null
    if (!nfAtual) {
      setVozErro('Nota fiscal não encontrada. Busque a NF novamente.')
      return false
    }

    if (editItemIndex != null) {
      const stageItem = nfAtual.items.find((it) => it.index === editItemIndex)
      if (stageItem && itemNoStage(stageItem)) {
        if (editPendingSelection.size === 0) {
          setVozErro('Marque ao menos um endereço de destino no armazém físico.')
          return false
        }
        const addresses = [...editPendingSelection]
        const currentItemIndex = editItemIndex
        const snapshot = stateRef.current
        const notas = snapshot.notas.map((nf) =>
          nf.id === nfAtual.id
            ? moverItemStageParaArmazem(nf, currentItemIndex, addresses)
            : nf,
        )
        const updatedNf = notas.find((n) => n.id === nfAtual.id)!
        const nextState = {
          ...snapshot,
          notas,
          movimentos: [
            criarMovimentoMovimentacao(updatedNf, currentItemIndex, addresses),
            ...snapshot.movimentos,
          ],
        }
        setEditSalvando(true)
        setEditPendingSelection(new Set())
        editOriginalAddressesRef.current = new Set(addresses)
        setState(nextState)
        setEditItemIndex(null)
        setEditSalvando(false)
        setVozErro(null)
        void saveNow(nextState)
        return true
      }
    }

    const origensSet =
      editMoveOrigens.size >= editMoveOrigensRef.current.size
        ? editMoveOrigens
        : editMoveOrigensRef.current
    const destinosSet =
      editMoveDestinos.size >= editMoveDestinosRef.current.size
        ? editMoveDestinos
        : editMoveDestinosRef.current

    if (origensSet.size === 0 || origensSet.size !== destinosSet.size) {
      setVozErro('Distribuição incompleta. Marque origens e destinos no mapa antes de confirmar.')
      return false
    }

    const origens = [...origensSet]
    const destinos = [...destinosSet]
    const occMap = buildOccupancyMap(stateRef.current.notas)
    const origOcc = occMap.get(origens[0]!)
    if (!origOcc || origOcc.nfId !== nfAtual.id) {
      setVozErro('Endereço de origem inválido ou não pertence a esta NF.')
      return false
    }

    const currentItemIndex = origOcc.itemIndex
    const item = nfAtual.items.find((it) => it.index === currentItemIndex)
    if (!item || itemNoStage(item)) {
      setVozErro('Item inválido para reposicionamento no armazém.')
      return false
    }

    for (const orig of origens) {
      const o = occMap.get(orig)
      if (!o || o.nfId !== nfAtual.id || o.itemIndex !== currentItemIndex) {
        setVozErro('Um ou mais endereços de origem são inválidos para este item.')
        return false
      }
    }

    if (new Set(destinos).size !== destinos.length) {
      setVozErro('Cada palete precisa de um destino diferente.')
      return false
    }
    for (const dest of destinos) {
      if (origens.includes(dest)) {
        setVozErro('Origem e destino não podem ser o mesmo endereço.')
        return false
      }
      if (occMap.has(dest) && !origensSet.has(dest)) {
        setVozErro('Um ou mais endereços de destino já estão ocupados.')
        return false
      }
    }

    const moveMap = new Map(origens.map((orig, i) => [orig, destinos[i] as AddressId]))
    const addresses = item.allocatedAddresses.map((addr) => moveMap.get(addr) ?? addr)

    const original = editOriginalAddressesRef.current
    if (!enderecosAlterados(original, addresses)) {
      setVozErro('Nenhuma alteração de endereço para salvar.')
      return false
    }

    const removedFromItem = item.allocatedAddresses.filter((a) => !addresses.includes(a))
    const snapshot = stateRef.current

    const notas = snapshot.notas.map((nf) => ({
      ...nf,
      items: nf.items.map((it) => {
        if (nf.id === nfAtual.id && it.index === currentItemIndex) {
          const paletesAtualizados =
            addresses.length > 0
              ? Math.max(it.paletes ?? 0, addresses.length)
              : it.paletes
          return { ...it, allocatedAddresses: addresses, paletes: paletesAtualizados }
        }
        return {
          ...it,
          allocatedAddresses: it.allocatedAddresses.filter(
            (a) => !addresses.includes(a) && !removedFromItem.includes(a),
          ),
        }
      }),
    }))
    const updatedNf = notas.find((n) => n.id === nfAtual.id)!
    const nextState = {
      ...snapshot,
      notas,
      movimentos: [
        criarMovimentoMovimentacao(updatedNf, currentItemIndex, addresses),
        ...snapshot.movimentos,
      ],
    }

    setEditSalvando(true)
    setEditMoveOrigens(new Set())
    setEditMoveDestinos(new Set())
    editMoveOrigensRef.current = new Set()
    editMoveDestinosRef.current = new Set()
    setVozOrigemAddress(null)
    setVozErro(null)
    editOriginalAddressesRef.current = new Set(addresses)
    setState(nextState)
    setEditSalvando(false)
    void saveNow(nextState)
    return true
  }

  function handleIniciarAdicionarPosicoes(itemIndex: number, quantidade: number) {
    if (!nfEditar || !(quantidade > 0)) return
    const item = nfEditar.items.find((it) => it.index === itemIndex)
    if (!item || itemNoStage(item) || item.allocatedAddresses.length === 0) return

    setEditItemIndex(itemIndex)
    setEditModoMovimentacao('reposicionar')
    setEditMoveOrigens(new Set())
    setEditMoveDestinos(new Set())
    setEditPendingSelection(new Set())
    setEditStagePending(new Set())
    setVozOrigemAddress(null)
    setVozErro(null)
    editOriginalAddressesRef.current = new Set(item.allocatedAddresses)
    setEditAdicionarPosicoesAlvo(quantidade)
    setEditNovasPosicoes(new Set())
    setDetailAddress(null)
    focarMapaDestaque(primeiroEnderecoIds(item.allocatedAddresses))
  }

  function handleCancelarAdicionarPosicoes() {
    setEditAdicionarPosicoesAlvo(null)
    setEditNovasPosicoes(new Set())
  }

  async function handleConfirmarAdicionarPosicoes() {
    if (editSalvando || !nfEditar || editItemIndex == null || editAdicionarPosicoesAlvo == null) {
      return
    }
    if (editNovasPosicoes.size !== editAdicionarPosicoesAlvo) return

    const item = nfEditar.items.find((it) => it.index === editItemIndex)
    if (!item || itemNoStage(item)) return

    const novos = [...editNovasPosicoes]
    const notas = state.notas.map((nf) =>
      nf.id === nfEditar.id ? adicionarPosicoesItemArmazem(nf, editItemIndex, novos) : nf,
    )
    const updatedNf = notas.find((n) => n.id === nfEditar.id)!
    const updatedItem = updatedNf.items.find((it) => it.index === editItemIndex)!
    const nextState = {
      ...state,
      notas,
      movimentos: [
        criarMovimentoMovimentacao(updatedNf, editItemIndex, updatedItem.allocatedAddresses),
        ...state.movimentos,
      ],
    }

    setEditSalvando(true)
    setEditAdicionarPosicoesAlvo(null)
    setEditNovasPosicoes(new Set())
    editOriginalAddressesRef.current = new Set(updatedItem.allocatedAddresses)
    setEditMoveOrigens(new Set())
    setEditMoveDestinos(new Set())
    setState(nextState)
    setEditSalvando(false)
    await saveNow(nextState)
  }

  function handleCancelarEditar() {
    setNfEditarId(null)
    limparEstadoMapaEditar()
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
    if (resultados.length > 0) {
      setConsultaErro(null)
      focarMapaBuscaEncontrado(
        primeiroEnderecoConsulta(resultados),
        avisoConsultaEncontrada(resultados),
      )
      return
    }
    const nfQ = filtros.nfNumero.trim()
    if (nfQ) {
      const nf = buscarNfPorNumero(state.notas, nfQ)
      if (nf) {
        setConsultaErro(mensagemNfSemEstoqueVisivel(nf, state.movimentos))
        return
      }
    }
    setConsultaErro('Nenhum resultado encontrado com os filtros informados.')
  }

  function handleLimparConsulta() {
    setConsultaResultados([])
    setConsultaErro(null)
  }

  function handleAlternarDestaqueInventario(resultados: ConsultaEstoqueResultado[]) {
    setConsultaErro(null)
    const removendo = resultadosEstaoDestacados(resultados, consultaResultados)
    setConsultaResultados((prev) => alternarDestaqueConsulta(prev, resultados))
    if (!removendo) {
      focarMapaDestaque(primeiroEnderecoConsulta(resultados))
    }
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

  async function handleRemoverDoEstoque(nfId: string, motivo: MotivoRemocaoEstoqueId) {
    const base = removerNfDoEstoque(
      {
        notas: state.notas,
        movimentos: state.movimentos,
        notasCanceladas: state.notasCanceladas,
        emitentes: state.emitentes,
      },
      nfId,
      { motivoRemocaoEstoque: motivo },
    )

    const nextState = {
      ...state,
      notas: base.notas,
      movimentos: base.movimentos,
      notasCanceladas: base.notasCanceladas,
    }
    setState(nextState)
    await saveNow(nextState)

    if (nfEditarId === nfId) {
      setNfEditarId(null)
      setEditItemIndex(null)
      setEditPendingSelection(new Set())
      setBuscaEditarErro(null)
    }
    if (nfBuscaSaidaId === nfId) {
      setNfBuscaSaidaId(null)
      limparEstadoSaida()
    }
    if (state.activeNfId === nfId) {
      setPendingSelection(new Set())
    }
    setDetailAddress(null)
  }

  function handlePainelFiltrosChange(patch: Partial<PainelFiltros>) {
    setPainelFiltros((prev) => {
      const next = { ...prev, ...patch }
      savePainelFiltros(next)
      return next
    })
  }

  const handleOpenSection = useCallback(
    (id: SidebarSectionId | null) => {
      const apply = () => {
        if (id === 'painel') {
          setSidebarMode('fullscreen')
        } else if (id != null && sidebarMode === 'fullscreen') {
          setSidebarMode('open')
        }
        setOpenSection(id)
      }
      if (openSectionRef.current === 'entrada' && id !== 'entrada') {
        trySairEntradaIncompleta(apply)
      } else {
        apply()
      }
    },
    [trySairEntradaIncompleta, setSidebarMode, sidebarMode],
  )

  const handleVoicePrefsChange = useCallback((patch: Partial<VoicePrefs>) => {
    setVoicePrefs((prev) => {
      const next = { ...prev, ...patch }
      if (patch.enabled === true && next.voiceLocked && !hasRegisteredVoices(voiceRegistry)) {
        setVoiceFeedback('Cadastre pelo menos uma voz individual antes de ativar.')
        return prev
      }
      if (patch.enabled === false) {
        stopSpeaking()
        setConversationLines([])
        setVoiceFeedback('Voz desativada.')
      }
      return next
    })
  }, [voiceRegistry])

  const executeVoiceCommand = useCallback(
    (cmd: VoiceCommand) => {
      if (cmd.type === 'parar') {
        setVoiceFeedback('Assistente desarmado.')
        return
      }

      if (cmd.type === 'blocked') {
        setVoiceFeedback(cmd.message)
        return
      }

      const msg = describeVoiceCommand(cmd)
      if (cmd.type !== 'desconhecido') {
        setVoiceFeedback(msg)
      }

      switch (cmd.type) {
        case 'open_section':
          handleOpenSection(cmd.section)
          break
        case 'close_section': {
          const current = openSectionRef.current
          if (cmd.section === null) {
            if (current === 'painel') setSidebarMode('open')
            handleOpenSection(null)
            break
          }
          if (current !== cmd.section) {
            setVoiceFeedback(`${cmd.label} não está aberta.`)
            break
          }
          if (cmd.section === 'painel') setSidebarMode('open')
          handleOpenSection(null)
          break
        }
        case 'buscar_nota':
          handleOpenSection('editar')
          handleBuscarEditar(cmd.numero)
          break
        case 'consultar': {
          handleOpenSection('consulta')
          const filtros: ConsultaEstoqueFiltros = {
            ...CONSULTA_FILTROS_VAZIOS,
            ...cmd.filtros,
          }
          handleBuscarConsulta(filtros)
          break
        }
        case 'painel_periodo':
          handleOpenSection('painel')
          handlePainelFiltrosChange(painelFiltrosPorDias(cmd.dias))
          break
        case 'confirmar_movimentacao':
          handleOpenSection('editar')
          if (
            editMoveOrigensRef.current.size === 0 ||
            editMoveOrigensRef.current.size !== editMoveDestinosRef.current.size
          ) {
            setVoiceFeedback('Distribuição incompleta. Complete os destinos antes de confirmar.')
            break
          }
          void handleSalvarEditar()
          break
        case 'sidebar_mode':
          setSidebarMode(cmd.mode)
          break
        case 'toggle_theme':
          setTheme(cmd.theme)
          break
        case 'endereco':
          handleOpenSection('editar')
          if (vozOrigemAddress) {
            handleVozDestino(cmd.addressId)
          } else {
            setVoiceFeedback(
              'Abra a movimentação, selecione a origem na lista e repita o endereço de destino.',
            )
          }
          break
        case 'desconhecido':
          setVoiceFeedback(
            `Não entendi "${cmd.raw}". Exemplos: abrir consulta, buscar nota 201077, confirmar movimentação.`,
          )
          break
      }
    },
    [
      handleOpenSection,
      setSidebarMode,
      setTheme,
      vozOrigemAddress,
    ],
  )

  const handleVoiceCommandText = useCallback(
    (text: string) => {
      const cleaned = prepareVoiceCommandText(text, voicePrefs.wakePhrase)
      const cmd = parseVoiceCommand(cleaned || text)
      if (!cmd) {
        setVoiceFeedback('Comando vazio ou não reconhecido. Tente: "abrir consulta" ou "buscar nota 12345".')
        return
      }
      executeVoiceCommand(cmd)
    },
    [executeVoiceCommand, voicePrefs.wakePhrase],
  )

  const handleConversationStart = useCallback(async () => {
    conversationStateRef.current = createConversationState()
    setConversationLines([{ role: 'assistant', text: VOICE_CONVERSATION_GREETING }])
    setVoiceFeedback(VOICE_CONVERSATION_GREETING)
    await speakText(VOICE_CONVERSATION_GREETING)
  }, [])

  const handleVoiceRecognized = useCallback((profile: { id: string; name: string }) => {
    setContaUsuarios(
      registrarAcessoUsuario({
        id: `voz-${profile.id}`,
        nome: profile.name,
      }),
    )
    setContaUsuarioAtivoId(getUsuarioAtivoId())
  }, [])

  const handleSelectContaUsuario = useCallback((id: string) => {
    setUsuarioAtivoId(id)
    setContaUsuarioAtivoId(id)
    setContaUsuarios(listarUsuariosSessao())
  }, [])

  const handleOpenContaSection = useCallback(
    (section: SidebarSectionId) => {
      handleOpenSection(section)
      if (sidebarMode === 'fullscreen') {
        setSidebarMode('open')
      }
    },
    [handleOpenSection, sidebarMode, setSidebarMode],
  )

  useEffect(() => {
    setContaUsuarios(
      registrarAcessoUsuario({ id: CONTA_SISTEMA_ID, nome: 'Doca Livre', tornarAtivo: false }),
    )
  }, [])

  const handleConversationUtterance = useCallback(
    async (text: string): Promise<boolean> => {
      const result = processConversationTurn(text, conversationStateRef.current)
      conversationStateRef.current = result.state

      setConversationLines((prev) => [
        ...prev,
        { role: 'user', text: text.trim() },
        { role: 'assistant', text: result.reply },
      ])
      setVoiceFeedback(result.reply)
      await speakText(result.reply)

      if (result.command) {
        executeVoiceCommand(result.command)
      }

      if (result.endSession) {
        setConversationLines([])
      }

      return !result.endSession
    },
    [executeVoiceCommand],
  )

  const voiceAssistant = useVoiceAssistant({
    enabled: voicePrefs.enabled,
    wakePhrase: voicePrefs.wakePhrase,
    voiceProfiles: voiceRegistry.profiles,
    requireVoiceMatch: voicePrefs.voiceLocked,
    interactive: voicePrefs.interactiveMode,
    onCommandText: handleVoiceCommandText,
    onConversationStart: handleConversationStart,
    onConversationUtterance: handleConversationUtterance,
    onError: (message) => setVoiceFeedback(message),
    onVoiceRecognized: handleVoiceRecognized,
  })

  useEffect(() => {
    if (!voiceFeedback) return
    const t = setTimeout(() => setVoiceFeedback(null), 5000)
    return () => clearTimeout(t)
  }, [voiceFeedback])

  const stageItens = useMemo(() => listarItensStage(state.notas), [state.notas])

  const detailOcc = detailAddress ? occupancy.get(detailAddress) : null
  const detailNota = detailOcc ? state.notas.find((n) => n.id === detailOcc.nfId) : null

  if (!introDone) {
    return <IntroSplash loading={loading} onFinish={() => setIntroDone(true)} />
  }

  return (
    <div className={`app-shell${sidebarMode === 'fullscreen' ? ' app-shell--menu-fullscreen' : ''}`}>
      <AppTopBar
        sidebarMode={sidebarMode}
        onSidebarModeChange={setSidebarMode}
        theme={theme}
        onToggleTheme={toggleTheme}
        saving={saving}
        persistError={error}
        mapLegend={{
          allocateMode: panelAllocateMode,
          editMode: editMode || (nfEditar != null && !editMarcandoStage),
          activeNfNumero: panelActiveNfNumero,
          editItemAtivo: editMode,
          editAddresses: editMapAddresses,
          consultaAddresses: consultaAddresses.size > 0 ? consultaAddresses : undefined,
          saidaAddresses:
            nfEditar ? undefined : saidaAddresses.size > 0 ? saidaAddresses : undefined,
          saidaItemDestaqueAddresses:
            nfEditar || saidaItemDestaqueAddresses.size === 0
              ? undefined
              : saidaItemDestaqueAddresses,
          saidaFlaggedAddresses: editMode ? undefined : saidaFlaggedAddresses,
        }}
        contaUsuarios={contaUsuarios}
        contaUsuarioAtivoId={contaUsuarioAtivoId}
        onSelectContaUsuario={handleSelectContaUsuario}
        onOpenContaSection={handleOpenContaSection}
      />
      <div className="app-workspace">
      <AppSidebar
        sidebarMode={sidebarMode}
        onSidebarModeChange={setSidebarMode}
        openSection={openSection}
        onOpenSectionChange={handleOpenSection}
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
          onUpdateItemLocalizacao: handleUpdateItemLocalizacao,
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
          origemEstoque: saidaOrigemEstoque,
          modoBusca: saidaModoBusca,
          onModoBuscaChange: handleModoBuscaSaidaChange,
          nfBusca: nfBuscaSaida,
          saidaXml: saidaXmlDoc,
          notasOrigem: notasOrigemSaida,
          origemSelecionadaId: saidaOrigemSelecionadaId,
          onOrigemSelecionadaChange: setSaidaOrigemSelecionadaId,
          onVincularOrigem: handleVincularOrigemSaida,
          onUploadXml: handleUploadSaidaXml,
          itensSaida: saidaItensExibicao,
          limitesPorItem: saidaLimitesPorItem,
          vinculoAvisos: saidaVinculoAvisos,
          itemIndex: saidaItemIndex,
          modoPalete: saidaModoPalete,
          qtdPaletesInput: saidaQtdPaletesInput,
          qtdPaletesAlvo: saidaQtdPaletesAlvo,
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
          stageItemIndex: saidaStageItemIndex,
          stageQtdInput: saidaStageQtdInput,
          stageConfirmados: saidaStageConfirmados,
          onSelectItemStage: handleSelectItemStage,
          onStageQtdChange: handleStageQtdChange,
          onConfirmarItemStage: handleConfirmarItemStage,
          onRemoverItemStage: handleRemoverItemStage,
          onFinalizarSaidaStage: handleFinalizarSaidaStage,
          buscaErro,
          uploadXmlErro: saidaUploadXmlErro,
          selecaoErro: saidaSelecaoErro,
        }}
        historico={{
          movimentos: movimentosHistorico,
          canceladas: state.notasCanceladas,
          notas: state.notas,
        }}
        relatorio={{
          notas: state.notas,
        }}
        painel={{
          filtros: painelFiltros,
          movimentos: movimentosHistorico,
          notas: state.notas,
          onFiltrosChange: handlePainelFiltrosChange,
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
          itemIndex: editItemIndex,
          pendingCount: editPendingSelection.size,
          stagePendingCount: editStagePending.size,
          moveOrigensCount: editMoveOrigens.size,
          moveDestinosCount: editMoveDestinos.size,
          salvando: editSalvando,
          marcandoStage: editMarcandoStage,
          modoMovimentacao: editModoMovimentacao,
          onModoMovimentacaoChange: handleEditModoMovimentacao,
          vozOrigemAddress,
          vozErro,
          onSelectVozOrigem: handleSelectVozOrigem,
          onVozDestino: handleVozDestino,
          onVozErro: setVozErro,
          onLimparVozErro: () => setVozErro(null),
          onPrepareLocalSpeech: voiceAssistant.suspendForLocalSpeech,
          onReleaseLocalSpeech: voiceAssistant.resumeAfterLocalSpeech,
          enderecosOcupados: editEnderecosOcupados,
          enderecosSelecionados: editPendingSelection,
          onBuscar: handleBuscarEditar,
          onSelectItem: handleSelectItemEditar,
          onAdicionarEnderecoDestino: handleAdicionarEnderecoDestino,
          onSalvar: handleSalvarEditar,
          onRemoverDoEstoque: handleRemoverDoEstoque,
          onCancelarEditar: handleCancelarEditar,
          adicionarPosicoesAlvo: editAdicionarPosicoesAlvo,
          adicionarPosicoesSelecionadas: editNovasPosicoes.size,
          onIniciarAdicionarPosicoes: handleIniciarAdicionarPosicoes,
          onConfirmarAdicionarPosicoes: handleConfirmarAdicionarPosicoes,
          onCancelarAdicionarPosicoes: handleCancelarAdicionarPosicoes,
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
          onPrint: schedulePrint,
        }}
        cadastroVoz={{
          prefs: voicePrefs,
          voiceRegistry,
          supported: voiceAssistant.supported,
          assistantActive: voicePrefs.enabled && voiceAssistant.phase !== 'off',
          voiceFeedback,
          voiceSyncError,
          onPrefsChange: handleVoicePrefsChange,
          onVoiceRegistryChange: setVoiceRegistry,
          onRefreshVoiceRegistry: refreshVoiceRegistry,
          onTestWakePhrase: voiceAssistant.testPhrase,
          sectionOpen: openSection === 'cadastroVoz',
        }}
      />

      <main className="main-panel">
        {buscaEncontrada && (
          <BuscaEncontradaToast aviso={buscaEncontrada} onClose={() => setBuscaEncontrada(null)} />
        )}
        <LayoutPanel
          occupancy={displayOccupancy}
          pendingSelection={panelPendingSelection}
          activeNfNumero={panelActiveNfNumero}
          activeNfId={nfEditar?.id ?? activeNf?.id ?? null}
          allocateMode={panelAllocateMode}
          editMode={editMode || (nfEditar != null && !editMarcandoStage)}
          editItemAtivo={editMode}
          editMoveOrigens={nfEditar ? editMoveOrigens : undefined}
          editMoveDestinos={nfEditar ? editMoveDestinos : undefined}
          editMarcandoStage={nfEditar ? editMarcandoStage : false}
          editItemIndex={nfEditar ? editItemIndex : null}
          editItemNoStage={(() => {
            if (nfEditar == null || editItemIndex == null) return false
            const it = nfEditar.items.find((i) => i.index === editItemIndex)
            return it != null && itemNoStage(it)
          })()}
          editAdicionandoPosicoes={editAdicionarPosicoesAlvo != null}
          editAddresses={editMapAddresses}
          consultaAddresses={consultaAddresses.size > 0 ? consultaAddresses : undefined}
          notas={state.notas}
          movimentos={state.movimentos}
          stageHighlighted={consultaStageHighlighted || mapFocusStage}
          onStageOpen={() => setStageModalOpen(true)}
          saidaAddresses={
            nfEditar ? undefined : saidaAddresses.size > 0 ? saidaAddresses : undefined
          }
          saidaItemDestaqueAddresses={
            nfEditar || saidaItemDestaqueAddresses.size === 0
              ? undefined
              : saidaItemDestaqueAddresses
          }
          saidaFlaggedAddresses={editMode ? undefined : saidaFlaggedAddresses}
          paintMode={
            editAdicionarPosicoesAlvo != null ||
            (editMode && editMarcandoStage) ||
            (editMode && !editMarcandoStage) ||
            allocateMode ||
            consultaAguardandoEndereco ||
            (saidaModoPalete && (saidaQtdPaletesAlvo != null || saidaSelecaoConcluida))
          }
          onCellClick={handleCellClick}
          onCellPaint={handleCellPaint}
          paletesRestantes={paletesRestantesCount}
          paletesTotal={panelPaletesTotal}
          saidaMode={saidaModoPalete}
          editStagePending={editStagePending}
          stageDropEnabled={editStagePending.size > 0}
          onStageDrop={() => void handleAplicarStageDrop()}
          focusAddressId={vozOrigemAddress ?? mapFocusAddressId}
          focusStage={!vozOrigemAddress && mapFocusStage}
          focusScrollToken={mapFocusScrollToken}
          pulseAddressId={mapPulseAddressId}
        />
      </main>
      </div>

      <VoiceAssistantHUD
        phase={voiceAssistant.phase}
        liveText={voiceAssistant.liveText}
        lastHint={voiceAssistant.lastHint}
        feedback={voiceFeedback}
        conversationLines={conversationLines}
        interactiveMode={voicePrefs.interactiveMode}
        wakePhrase={voicePrefs.wakePhrase}
        onCancel={() => {
          stopSpeaking()
          setConversationLines([])
          voiceAssistant.cancelArmed()
          setVoiceFeedback(null)
        }}
      />

      <PrintLayoutDocument
        camaraIds={printCamaras}
        occupancy={printWithOccupancy ? occupancy : undefined}
      />

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
          startInCreateMode
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

      {entradaDestinoPendente && (
        <EntradaDestinoModal
          nfNumeros={entradaDestinoPendente.imported.map((nf) => nf.numero)}
          onConfirm={(destino) => void handleEntradaDestinoConfirm(destino)}
          onCancel={handleEntradaDestinoCancel}
        />
      )}

      {saidaDestinoPendente && (
        <EscolhaEstoqueModal
          title="Origem da saída"
          pergunta={`A NF ${saidaDestinoPendente.numero} possui estoque no armazém e no stage. De onde deseja dar saída?`}
          opcoes={[
            {
              id: 'armazem',
              label: 'Saída normal (armazém)',
              descricao: 'Retirar paletes endereçados',
            },
            {
              id: 'stage',
              label: 'Saída do stage',
              descricao: 'Retirar itens em separação',
            },
          ]}
          onConfirm={(opcao) => {
            const nf = saidaDestinoPendente
            setSaidaDestinoPendente(null)
            aplicarBuscaSaida(nf, opcao === 'stage' ? 'stage' : 'armazem')
          }}
          onCancel={() => setSaidaDestinoPendente(null)}
        />
      )}

      {stageModalOpen && (
        <StageModal itens={stageItens} onClose={() => setStageModalOpen(false)} />
      )}
    </div>
  )
}
