import type { SidebarSectionId } from '../components/CollapsibleSidebarSection'
import type { ConsultaEstoqueFiltros } from './consultaEstoque'
import {
  isDestructiveVoiceCommand,
  parseVoiceCommand,
  type VoiceCommand,
} from './parseVoiceCommand'
import { interpretVoiceNaturally } from './voiceNaturalLanguage'
import { normalizeVoiceText } from './voiceNormalize'

export type VoiceResolveOptions = {
  aiEnabled?: boolean
  geminiApiKey?: string
}

const VALID_SECTIONS = new Set<SidebarSectionId>([
  'painel',
  'consulta',
  'entrada',
  'saida',
  'editar',
  'historico',
  'relatorio',
  'imprimir',
  'canceladas',
  'cadastroVoz',
  'financeiro',
])

const SECTION_LABELS: Record<SidebarSectionId, string> = {
  painel: 'Painel',
  consulta: 'Consulta estoque',
  entrada: 'Entrada',
  saida: 'Saída',
  editar: 'Movimentação',
  historico: 'Histórico',
  relatorio: 'Relatório',
  imprimir: 'Mapa',
  canceladas: 'NF cancelada',
  cadastroVoz: 'Comando de voz',
  financeiro: 'Financeiro',
}

type AiPayload = {
  action?: string
  section?: string
  numero?: string
  item?: string
  nfNumero?: string
  remetente?: string
  dias?: number
  theme?: string
  mode?: string
  addressId?: string
  message?: string
}

const AI_SYSTEM = `Você interpreta comandos de voz em português para um WMS de estoque (Ultrafrio).
Responda SOMENTE com JSON válido, sem markdown.

Ações permitidas (NUNCA apagar/excluir/deletar dados):
- open_section: section = painel|consulta|entrada|saida|editar|historico|relatorio|imprimir|canceladas|cadastroVoz
- close_section: section = mesmas opções, ou "all" para fechar tudo, ou "current" para aba aberta
- buscar_nota: numero (só dígitos)
- consultar: item OU nfNumero OU remetente
- limpar_consulta
- painel_periodo: dias (0=hoje, 7, 30)
- confirmar_movimentacao
- sidebar_mode: collapsed|open|fullscreen
- toggle_theme: light|dark|auto
- endereco: addressId ex C6-R1-C2-N3
- parar: encerrar assistente
- unknown: não entendeu
- blocked: pedido destrutivo (excluir/apagar/remover estoque)

Exemplos:
{"action":"open_section","section":"painel"}
{"action":"consultar","item":"leite integral"}
{"action":"buscar_nota","numero":"20835"}
{"action":"close_section","section":"current"}
{"action":"unknown"}`

function mapAiPayload(payload: AiPayload): VoiceCommand | null {
  const action = payload.action?.toLowerCase()
  if (!action || action === 'unknown') return null

  if (action === 'blocked') {
    return {
      type: 'blocked',
      message:
        payload.message ??
        'Comando bloqueado. Ações que apagam ou removem dados não são permitidas por voz.',
    }
  }

  if (action === 'parar') return { type: 'parar' }

  if (action === 'limpar_consulta') return { type: 'limpar_consulta' }

  if (action === 'confirmar_movimentacao') return { type: 'confirmar_movimentacao' }

  if (action === 'open_section') {
    const section = payload.section as SidebarSectionId
    if (!section || !VALID_SECTIONS.has(section)) return null
    return { type: 'open_section', section, label: SECTION_LABELS[section] }
  }

  if (action === 'close_section') {
    if (payload.section === 'all') {
      return { type: 'close_section', section: null, label: 'Todas as seções' }
    }
    if (payload.section === 'current') {
      return { type: 'close_current_section', label: 'Aba atual' }
    }
    const section = payload.section as SidebarSectionId
    if (!section || !VALID_SECTIONS.has(section)) return null
    return { type: 'close_section', section, label: SECTION_LABELS[section] }
  }

  if (action === 'buscar_nota') {
    const numero = String(payload.numero ?? '').replace(/\D/g, '')
    if (numero.length < 3) return null
    return { type: 'buscar_nota', numero }
  }

  if (action === 'consultar') {
    const filtros: Partial<ConsultaEstoqueFiltros> = {}
    if (payload.nfNumero) filtros.nfNumero = String(payload.nfNumero).replace(/\D/g, '')
    if (payload.item) filtros.item = payload.item.trim()
    if (payload.remetente) filtros.remetente = payload.remetente.trim()
    if (Object.keys(filtros).length === 0) return null
    return { type: 'consultar', filtros }
  }

  if (action === 'painel_periodo') {
    const dias = Number(payload.dias)
    if (![0, 7, 30].includes(dias)) return null
    const label = dias === 0 ? 'Hoje' : dias === 7 ? 'Últimos 7 dias' : 'Último mês'
    return { type: 'painel_periodo', dias, label }
  }

  if (action === 'sidebar_mode') {
    const mode = payload.mode as 'collapsed' | 'open' | 'fullscreen'
    if (!mode || !['collapsed', 'open', 'fullscreen'].includes(mode)) return null
    const labels = {
      collapsed: 'Menu recolhido',
      open: 'Menu aberto',
      fullscreen: 'Menu tela cheia',
    }
    return { type: 'sidebar_mode', mode, label: labels[mode] }
  }

  if (action === 'toggle_theme') {
    const theme = (payload.theme ?? 'auto') as 'light' | 'dark' | 'auto'
    const label =
      theme === 'dark' ? 'Tema escuro' : theme === 'light' ? 'Tema claro' : 'Alternar tema'
    return { type: 'toggle_theme', theme, label }
  }

  if (action === 'endereco' && payload.addressId) {
    return { type: 'endereco', addressId: payload.addressId.toUpperCase() }
  }

  return null
}

function parseAiJson(raw: string): AiPayload | null {
  const trimmed = raw.trim()
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    return JSON.parse(trimmed.slice(start, end + 1)) as AiPayload
  } catch {
    return null
  }
}

export async function interpretVoiceWithGemini(
  text: string,
  apiKey: string,
): Promise<VoiceCommand | null> {
  const norm = normalizeVoiceText(text)
  if (!norm || isDestructiveVoiceCommand(text)) return null

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: `${AI_SYSTEM}\n\nUsuário disse: "${text}"` }],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 256,
            responseMimeType: 'application/json',
          },
        }),
      },
    )

    if (!res.ok) return null

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[]
    }
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!raw) return null

    const payload = parseAiJson(raw)
    if (!payload) return null
    return mapAiPayload(payload)
  } catch {
    return null
  }
}

/** Resolve comando: regras exatas → linguagem natural → IA (se configurada). */
export function resolveVoiceCommandSync(text: string): VoiceCommand | null {
  if (isDestructiveVoiceCommand(text)) {
    return {
      type: 'blocked',
      message:
        'Comando bloqueado. Ações que apagam ou removem dados não são permitidas por voz.',
    }
  }

  const direct = parseVoiceCommand(text)
  if (direct && direct.type !== 'desconhecido') return direct

  const natural = interpretVoiceNaturally(text)
  if (natural) return natural

  return direct
}

export async function resolveVoiceCommandAsync(
  text: string,
  options: VoiceResolveOptions = {},
): Promise<VoiceCommand | null> {
  const sync = resolveVoiceCommandSync(text)
  if (sync && sync.type !== 'desconhecido') return sync

  const aiEnabled = options.aiEnabled !== false
  const apiKey =
    options.geminiApiKey?.trim() ||
    (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim() ||
    ''

  if (aiEnabled && apiKey) {
    const ai = await interpretVoiceWithGemini(text, apiKey)
    if (ai) return ai
  }

  return sync
}
