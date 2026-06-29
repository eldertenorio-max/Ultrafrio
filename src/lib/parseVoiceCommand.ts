import type { SidebarSectionId } from '../components/CollapsibleSidebarSection'
import type { ConsultaEstoqueFiltros } from './consultaEstoque'
import { parseEnderecoFalado } from './parseEnderecoFalado'
import type { SidebarMode } from './sidebarMode'
import { normalizeVoiceText } from './voiceNormalize'
import type { AddressId } from '../types'

const SPOKEN_DIGITS: Record<string, string> = {
  zero: '0',
  um: '1',
  uma: '1',
  dois: '2',
  duas: '2',
  tres: '3',
  três: '3',
  quatro: '4',
  cinco: '5',
  seis: '6',
  meia: '6',
  sete: '7',
  oito: '8',
  nove: '9',
}

export type VoiceCommand =
  | { type: 'open_section'; section: SidebarSectionId; label: string }
  | { type: 'close_section'; section: SidebarSectionId | null; label: string }
  | { type: 'buscar_nota'; numero: string }
  | { type: 'consultar'; filtros: Partial<ConsultaEstoqueFiltros> }
  | { type: 'painel_periodo'; dias: number; label: string }
  | { type: 'confirmar_movimentacao' }
  | { type: 'sidebar_mode'; mode: SidebarMode; label: string }
  | { type: 'toggle_theme'; theme: 'light' | 'dark'; label: string }
  | { type: 'endereco'; addressId: AddressId }
  | { type: 'parar' }
  | { type: 'blocked'; message: string }
  | { type: 'desconhecido'; raw: string }

type SectionVoiceConfig = {
  section: SidebarSectionId
  label: string
  openPatterns: RegExp[]
  closePatterns: RegExp[]
  openExample: string
  closeExample: string
}

const VOICE_SECTIONS: SectionVoiceConfig[] = [
  {
    section: 'painel',
    label: 'Painel',
    openExample: 'abrir painel',
    closeExample: 'fechar painel',
    openPatterns: [
      /\b(abrir|mostrar|ver|ir para|ir ao)\s+(o\s+)?painel\b/,
      /\bpainel analitico\b/,
    ],
    closePatterns: [
      /\b(fechar|ocultar|esconder|recolher|sair)\s+(do\s+)?(o\s+)?painel\b/,
    ],
  },
  {
    section: 'consulta',
    label: 'Consulta estoque',
    openExample: 'abrir consulta',
    closeExample: 'fechar consulta',
    openPatterns: [
      /\b(abrir|mostrar|ver|ir para|abre|mostra)\s+(a\s+)?consulta\b/,
      /\bconsulta estoque\b/,
      /\bconsultar estoque\b/,
    ],
    closePatterns: [
      /\b(fechar|ocultar|esconder|recolher|sair)\s+(da\s+)?(a\s+)?consulta\b/,
    ],
  },
  {
    section: 'editar',
    label: 'Movimentação',
    openExample: 'abrir movimentação',
    closeExample: 'fechar movimentação',
    openPatterns: [
      /\b(abrir|mostrar|ver|ir para|ir ao|abre|mostra)\s+(a\s+)?movimentac(ao|ao)\b/,
      /\b(abrir|mostrar|abre|mostra)\s+reposicionar\b/,
      /\bmovimentac(ao|ao)\b/,
      /\breposicionar\b/,
    ],
    closePatterns: [
      /\b(fechar|ocultar|esconder|recolher|sair)\s+(da\s+)?(a\s+)?movimentac(ao|ao)\b/,
      /\b(fechar|ocultar|esconder|recolher|sair)\s+(do\s+)?reposicionar\b/,
    ],
  },
  {
    section: 'entrada',
    label: 'Entrada',
    openExample: 'abrir entrada',
    closeExample: 'fechar entrada',
    openPatterns: [/\b(abrir|mostrar|ver|ir para)\s+(a\s+)?entrada\b/],
    closePatterns: [
      /\b(fechar|ocultar|esconder|recolher|sair)\s+(da\s+)?(a\s+)?entrada\b/,
    ],
  },
  {
    section: 'saida',
    label: 'Saída',
    openExample: 'abrir saída',
    closeExample: 'fechar saída',
    openPatterns: [/\b(abrir|mostrar|ver|ir para)\s+(a\s+)?saida\b/],
    closePatterns: [
      /\b(fechar|ocultar|esconder|recolher|sair)\s+(da\s+)?(a\s+)?saida\b/,
    ],
  },
  {
    section: 'historico',
    label: 'Histórico',
    openExample: 'abrir histórico',
    closeExample: 'fechar histórico',
    openPatterns: [/\b(abrir|mostrar|ver|ir para)\s+(o\s+)?historico\b/],
    closePatterns: [
      /\b(fechar|ocultar|esconder|recolher|sair)\s+(do\s+)?(o\s+)?historico\b/,
    ],
  },
  {
    section: 'imprimir',
    label: 'Mapa',
    openExample: 'abrir mapa',
    closeExample: 'fechar mapa',
    openPatterns: [
      /\b(abrir|mostrar|ver|ir para)\s+(o\s+)?mapa\b/,
      /\bimprimir mapa\b/,
    ],
    closePatterns: [
      /\b(fechar|ocultar|esconder|recolher|sair)\s+(do\s+)?(o\s+)?mapa\b/,
    ],
  },
  {
    section: 'canceladas',
    label: 'NF cancelada',
    openExample: 'abrir nf cancelada',
    closeExample: 'fechar nf cancelada',
    openPatterns: [
      /\b(abrir|mostrar|ver|ir para)\s+(as\s+)?(nf\s+)?cancelad/,
      /\b(abrir|mostrar|ver)\s+(nf\s+)?cancelad/,
    ],
    closePatterns: [
      /\b(fechar|ocultar|esconder|recolher|sair)\s+(das?\s+)?(nf\s+)?cancelad/,
    ],
  },
  {
    section: 'cadastroVoz',
    label: 'Cadastro de voz',
    openExample: 'abrir cadastro de voz',
    closeExample: 'fechar cadastro de voz',
    openPatterns: [
      /\b(abrir|mostrar|ver|ir para)\s+(o\s+)?cadastro de voz\b/,
      /\b(abrir|mostrar)\s+(a\s+)?voz\b/,
    ],
    closePatterns: [
      /\b(fechar|ocultar|esconder|recolher|sair)\s+(do\s+)?(o\s+)?cadastro de voz\b/,
      /\b(fechar|ocultar|esconder|recolher|sair)\s+(da\s+)?(a\s+)?voz\b/,
    ],
  },
]

const DESTRUCTIVE_RULES: { pattern: RegExp; hint: string }[] = [
  {
    pattern: /\b(excluir|apagar|deletar|eliminar|destroy|delete|wipe)\b/,
    hint: 'excluir ou apagar',
  },
  {
    pattern:
      /\bremover\b.*\b(estoque|nota|nf|item|palete|movimento|historico|tudo|dados|registro)\b/,
    hint: 'remover dados',
  },
  {
    pattern:
      /\b(excluir|apagar|deletar|remover|eliminar)\b.*\b(tudo|todos|todas|estoque|dados|notas?|nfs?|itens?|movimentos?|historico)\b/,
    hint: 'apagar em massa',
  },
  { pattern: /\blimpar\s+(tudo|estoque|dados|notas?|base|sistema)\b/, hint: 'limpar dados' },
  { pattern: /\b(apaga|deleta|exclui|elimina)\s+tudo\b/, hint: 'apagar tudo' },
  { pattern: /\bzerar\b/, hint: 'zerar dados' },
  {
    pattern: /\breset(ar|)\b.*\b(dados|estoque|sistema|tudo|base)\b/,
    hint: 'resetar dados',
  },
  { pattern: /\bformatar\b/, hint: 'formatar' },
  {
    pattern: /\bcancelar?\s+(entrada|nota|nf)\b/,
    hint: 'cancelar entrada ou nota',
  },
  {
    pattern: /\bdesfazer?\s+(tudo|entrada|movimento|nota|nf)\b/,
    hint: 'desfazer operação',
  },
  {
    pattern: /\bconfirmar\s+(remocao|exclusao|apagar|deletar|excluir)\b/,
    hint: 'confirmar exclusão',
  },
]

export const VOICE_COMMAND_BLOCKED_NOTE =
  'Por segurança, comandos de excluir, apagar, deletar, remover do estoque, limpar dados ou zerar o sistema são bloqueados e não executam nenhuma ação.'

function buildCommandExamples(): { frase: string; descricao: string }[] {
  const wake = 'ok estoque'
  const sectionExamples = VOICE_SECTIONS.flatMap((s) => [
    { frase: `${wake} ${s.openExample}`, descricao: `Abre ${s.label}.` },
    { frase: `${wake} ${s.closeExample}`, descricao: `Fecha ${s.label}.` },
  ])

  return [
    { frase: wake, descricao: 'Ativa o assistente — depois fale o comando.' },
    ...sectionExamples,
    { frase: `${wake} fechar tudo`, descricao: 'Fecha todas as seções abertas no menu.' },
    { frase: `${wake} buscar nota 20835`, descricao: 'Busca NF na movimentação.' },
    { frase: `${wake} consultar leite`, descricao: 'Pesquisa item no estoque.' },
    { frase: `${wake} consultar nota 20835`, descricao: 'Pesquisa NF na consulta.' },
    { frase: `${wake} últimos sete dias`, descricao: 'Filtra o painel pelos últimos 7 dias.' },
    { frase: `${wake} último mês`, descricao: 'Filtra o painel pelos últimos 30 dias.' },
    { frase: `${wake} painel hoje`, descricao: 'Filtra o painel para hoje.' },
    { frase: `${wake} confirme`, descricao: 'Confirma a movimentação se a distribuição estiver completa.' },
    {
      frase: `${wake} confirmar movimentação`,
      descricao: 'Confirma reposição se a distribuição estiver completa.',
    },
    {
      frase: `${wake} câmara 6 rua 1 coluna 2 nível 3`,
      descricao: 'Define destino na movimentação (com origem já selecionada).',
    },
    { frase: `${wake} menu tela cheia`, descricao: 'Expande o menu lateral.' },
    { frase: `${wake} menu aberto`, descricao: 'Menu lateral aberto (modo normal).' },
    { frase: `${wake} menu recolhido`, descricao: 'Recolhe o menu lateral.' },
    { frase: `${wake} tema escuro`, descricao: 'Ativa o tema escuro.' },
    { frase: `${wake} tema claro`, descricao: 'Ativa o tema claro.' },
    { frase: `${wake} parar`, descricao: 'Desarma o assistente até a próxima frase de ativação.' },
  ]
}

export const VOICE_COMMAND_EXAMPLES = buildCommandExamples()

function extractAfter(text: string, pattern: RegExp): string | null {
  const m = text.match(pattern)
  if (!m) return null
  for (let i = m.length - 1; i >= 1; i--) {
    const g = m[i]?.trim()
    if (g) return g
  }
  return null
}

/** Converte sequência falada de dígitos ("dois zero um zero sete sete") em número. */
function parseSpokenDigitSequence(text: string): string {
  const out: string[] = []
  for (const raw of text.split(/\s+/)) {
    const tok = normalizeVoiceText(raw)
    if (!tok) continue
    if (/^\d+$/.test(tok)) {
      out.push(...tok.split(''))
      continue
    }
    const digit = SPOKEN_DIGITS[tok]
    if (digit != null) {
      out.push(digit)
    }
  }
  return out.join('')
}

function extractNumeroNota(norm: string): string | null {
  const patterns = [
    /\b(buscar|procurar|pesquisar|abrir|localizar|achar)\s+(a\s+)?(nota|nf)\s+(.+)/,
    /\b(nota|nf)\s+(numero\s+)?(.+)/,
    /\b(buscar|procurar|pesquisar)\s+(?:a\s+)?(\d[\d\s.-]+)/,
    /\b(buscar|procurar|pesquisar)\s+(?:a\s+)?(.+)/,
  ]

  for (const re of patterns) {
    const tail = extractAfter(norm, re)
    if (!tail) continue
    const compact = tail.replace(/\D/g, '')
    if (compact.length >= 3) return compact
    const spoken = parseSpokenDigitSequence(tail)
    if (spoken.length >= 3) return spoken
  }

  return null
}

export function isDestructiveVoiceCommand(text: string): boolean {
  const norm = normalizeVoiceText(text)
  if (!norm) return false
  return DESTRUCTIVE_RULES.some((rule) => rule.pattern.test(norm))
}

function matchBlockedCommand(norm: string): VoiceCommand | null {
  for (const rule of DESTRUCTIVE_RULES) {
    if (rule.pattern.test(norm)) {
      return {
        type: 'blocked',
        message: `Comando bloqueado (${rule.hint}). Ações que apagam ou removem dados não são permitidas por voz.`,
      }
    }
  }
  return null
}

function matchCloseSection(norm: string): VoiceCommand | null {
  if (
    /\b(fechar|ocultar|esconder|recolher)\s+(tudo|todas|as secoes|o menu|menu)\b/.test(norm) ||
    norm === 'fechar tudo' ||
    norm === 'fechar menu'
  ) {
    return { type: 'close_section', section: null, label: 'Todas as seções' }
  }

  for (const entry of VOICE_SECTIONS) {
    if (entry.closePatterns.some((p) => p.test(norm))) {
      return { type: 'close_section', section: entry.section, label: entry.label }
    }
  }

  return null
}

function matchOpenSection(norm: string): VoiceCommand | null {
  for (const entry of VOICE_SECTIONS) {
    if (entry.openPatterns.some((p) => p.test(norm))) {
      return { type: 'open_section', section: entry.section, label: entry.label }
    }
  }
  return null
}

export function parseVoiceCommand(text: string): VoiceCommand | null {
  const norm = normalizeVoiceText(text)
  if (!norm) return null

  const blocked = matchBlockedCommand(norm)
  if (blocked) return blocked

  if (/^(parar|cancelar|desligar|silencio|pare)$/.test(norm)) {
    return { type: 'parar' }
  }

  if (/^(tema escuro|modo escuro|dark mode)$/.test(norm)) {
    return { type: 'toggle_theme', theme: 'dark', label: 'Tema escuro' }
  }
  if (/^(tema claro|modo claro|light mode)$/.test(norm)) {
    return { type: 'toggle_theme', theme: 'light', label: 'Tema claro' }
  }

  if (/\b(menu|sidebar)\s+(tela cheia|fullscreen|cheio)\b/.test(norm) || norm === 'tela cheia') {
    return { type: 'sidebar_mode', mode: 'fullscreen', label: 'Menu tela cheia' }
  }
  if (/\b(menu|sidebar)\s+(aberto|lateral)\b/.test(norm) || norm === 'menu aberto') {
    return { type: 'sidebar_mode', mode: 'open', label: 'Menu aberto' }
  }
  if (/\b(menu|sidebar)\s+(recolhido|fechado|minimo)\b/.test(norm) || norm === 'menu recolhido') {
    return { type: 'sidebar_mode', mode: 'collapsed', label: 'Menu recolhido' }
  }

  if (/^(confirme|confirmar|confirmado|confirmada|sim confirmar|pode confirmar)$/.test(norm)) {
    return { type: 'confirmar_movimentacao' }
  }
  if (/\bconfirmar movimentac/.test(norm) || /\bconfirmar reposicion/.test(norm)) {
    return { type: 'confirmar_movimentacao' }
  }

  const closeSection = matchCloseSection(norm)
  if (closeSection) return closeSection

  const notaNum = extractNumeroNota(norm)
  if (notaNum) {
    return { type: 'buscar_nota', numero: notaNum }
  }

  const consultaNota = extractAfter(
    norm,
    /\b(?:consultar|consulta|pesquisar)\s+(?:a\s+)?(?:nota|nf)\s+(.+)/,
  )
  if (consultaNota) {
    const compact = consultaNota.replace(/\D/g, '')
    const spoken = parseSpokenDigitSequence(consultaNota)
    const numero = compact.length >= 3 ? compact : spoken.length >= 3 ? spoken : ''
    if (numero) return { type: 'consultar', filtros: { nfNumero: numero } }
  }

  const consultaQuery =
    extractAfter(norm, /\b(?:consultar|consulta)\s+(?:o\s+)?(?:item\s+)?(.+)/) ??
    extractAfter(norm, /\bpesquisar\s+(?:o\s+)?(?:item\s+)?(.+)/)
  if (consultaQuery) {
    const q = consultaQuery.trim()
    if (/^\d[\d\s.-]*$/.test(q.replace(/\s/g, ''))) {
      return {
        type: 'consultar',
        filtros: { nfNumero: q.replace(/\D/g, '') },
      }
    }
    return { type: 'consultar', filtros: { item: q } }
  }

  if (/\b(ultimos|ultimo)\s+(7|sete)\s+dias\b/.test(norm)) {
    return { type: 'painel_periodo', dias: 7, label: 'Últimos 7 dias' }
  }
  if (/\b(ultimos|ultimo)\s+(30|trinta)\s+dias\b/.test(norm) || /\bultimo mes\b/.test(norm)) {
    return { type: 'painel_periodo', dias: 30, label: 'Último mês' }
  }
  if (/\bhoje\b/.test(norm) && /\bpainel\b/.test(norm)) {
    return { type: 'painel_periodo', dias: 0, label: 'Hoje' }
  }

  const openSection = matchOpenSection(norm)
  if (openSection) return openSection

  const endereco = parseEnderecoFalado(norm)
  if (endereco) {
    return { type: 'endereco', addressId: endereco }
  }

  if (norm.length > 2) {
    return { type: 'desconhecido', raw: text.trim() }
  }

  return null
}

export function describeVoiceCommand(cmd: VoiceCommand): string {
  switch (cmd.type) {
    case 'open_section':
      return `Abrindo ${cmd.label}`
    case 'close_section':
      return cmd.section ? `Fechando ${cmd.label}` : 'Fechando seções abertas'
    case 'buscar_nota':
      return `Buscando NF ${cmd.numero}`
    case 'consultar':
      return 'Consultando estoque'
    case 'painel_periodo':
      return `Painel: ${cmd.label}`
    case 'confirmar_movimentacao':
      return 'Confirmando movimentação'
    case 'sidebar_mode':
      return cmd.label
    case 'toggle_theme':
      return cmd.label
    case 'endereco':
      return `Endereço ${cmd.addressId}`
    case 'parar':
      return 'Assistente desarmado'
    case 'blocked':
      return cmd.message
    case 'desconhecido':
      return `Não entendi: "${cmd.raw}"`
  }
}

export { painelFiltrosPorDias } from './painelAnalytics'
