/** APIs de configuração do portal (Super Usuário) no Pro. */

import { getProApiBase, loadHubSession } from './portalApi'

export type SistemaId = 'light' | 'plus' | 'pro'

/** Nível de acesso por tela/módulo. */
export type ModuloAcesso = 'visualizar' | 'editar'

export type SistemaPermissao = {
  pode_acessar: boolean
  /**
   * null = todas as telas com editar;
   * {} = nenhuma;
   * mapa id → visualizar | editar
   * (legado: string[] ainda é aceito na leitura)
   */
  modulos: Record<string, ModuloAcesso> | null
}

/** Normaliza resposta da API (lista legado → mapa editar). */
export function normalizeModulosMap(
  raw: Record<string, ModuloAcesso> | string[] | null | undefined,
): Record<string, ModuloAcesso> | null {
  if (raw == null) return null
  if (Array.isArray(raw)) {
    const out: Record<string, ModuloAcesso> = {}
    for (const id of raw) {
      const k = String(id || '').trim()
      if (k) out[k] = 'editar'
    }
    return out
  }
  if (typeof raw === 'object') {
    const out: Record<string, ModuloAcesso> = {}
    for (const [k, v] of Object.entries(raw)) {
      const id = String(k || '').trim()
      if (!id) continue
      const acesso = String(v || '').toLowerCase()
      out[id] = acesso === 'visualizar' ? 'visualizar' : 'editar'
    }
    return out
  }
  return {}
}

export type PortalUsuarioRow = {
  usuario: string
  email?: string
  ativo?: boolean
  nivel?: string
  superior?: string
  is_superuser?: boolean
}

export type OrgTipo =
  | 'operador_logistico'
  | 'filial_operador'
  | 'embarcador'
  | 'unidade'
  | 'transportadora'

export type OrgNo = {
  id: string
  parent_id: string | null
  tipo: OrgTipo | string
  nome: string
  cnpj?: string | null
  codigo?: string | null
  ordem?: number
  sistema?: SistemaId | string
  label_tipo?: string
  usuarios_count?: number
  children?: OrgNo[]
}

export type PortalConfigOverview = {
  ok: true
  actor: string
  usuarios: PortalUsuarioRow[]
  niveis: { id: string; label: string; ordem: number }[]
  matriz: Record<string, Record<SistemaId, SistemaPermissao>>
  sistemas: SistemaId[]
  modulos: Record<SistemaId, { id: string; label: string }[]>
  arvore?: OrgNo[]
  arvores?: Partial<Record<SistemaId, OrgNo[]>>
  tipos_org?: { id: string; label: string }[]
  sistemas_org?: { id: string; label: string }[]
}

async function authFetch<T extends { ok?: boolean; erro?: string }>(
  path: string,
  init?: RequestInit,
): Promise<T | { ok: false; erro: string }> {
  const hub = loadHubSession()
  if (!hub?.hubToken) return { ok: false, erro: 'Sessão do portal expirada. Faça login de novo.' }
  const url = `${getProApiBase()}${path.replace(/^\//, '')}`
  // Envia hub_token no body + Authorization (alguns proxies cortam o header).
  let body = init?.body
  if (typeof body === 'string') {
    try {
      const parsed = JSON.parse(body || '{}') as Record<string, unknown>
      if (parsed && typeof parsed === 'object' && !parsed.hub_token) {
        body = JSON.stringify({ ...parsed, hub_token: hub.hubToken })
      }
    } catch {
      body = JSON.stringify({ hub_token: hub.hubToken })
    }
  } else if (body == null) {
    body = JSON.stringify({ hub_token: hub.hubToken })
  }
  try {
    const res = await fetch(url, {
      ...init,
      method: init?.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hub.hubToken}`,
        ...(init?.headers || {}),
      },
      body,
    })
    const data = (await res.json().catch(() => ({}))) as T
    if (!res.ok || !data.ok) {
      return {
        ok: false,
        erro:
          (data as { erro?: string }).erro ||
          `Falha na configuração do portal (${res.status}).`,
      }
    }
    return data
  } catch {
    return {
      ok: false,
      erro: `Falha de conexão com o portal (${getProApiBase()}). Se o Pro estiver “acordando”, aguarde 1 min e recarregue.`,
    }
  }
}

export async function fetchPortalMe(): Promise<
  | { ok: true; usuario: string; is_superuser: boolean; permissoes: Record<SistemaId, SistemaPermissao> | null }
  | { ok: false; erro: string }
> {
  return authFetch('api/portal/me', { method: 'POST', body: '{}' })
}

export async function fetchPortalConfigOverview(): Promise<PortalConfigOverview | { ok: false; erro: string }> {
  return authFetch('api/portal/config/overview', { method: 'POST', body: '{}' })
}

export async function savePortalPermissoes(
  usuario: string,
  permissoes: Record<SistemaId, SistemaPermissao>,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  return authFetch('api/portal/config/permissoes', {
    method: 'POST',
    body: JSON.stringify({ usuario, permissoes }),
  })
}

export async function savePortalHierarquia(input: {
  usuario: string
  nivel?: string
  superior?: string
}): Promise<{ ok: true } | { ok: false; erro: string }> {
  return authFetch('api/portal/config/hierarquia', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function savePortalOrgNo(input: {
  id?: string
  parent_id?: string | null
  tipo?: string
  nome: string
  cnpj?: string
  codigo?: string
  sistema?: SistemaId | string
}): Promise<{ ok: true; no?: OrgNo; id?: string } | { ok: false; erro: string }> {
  return authFetch('api/portal/config/org', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function deletePortalOrgNo(id: string): Promise<{ ok: true } | { ok: false; erro: string }> {
  return authFetch('api/portal/config/org/delete', {
    method: 'POST',
    body: JSON.stringify({ id }),
  })
}

/** Próximo tipo filho permitido na árvore. */
export function nextOrgChildType(tipoPai: string | null | undefined): OrgTipo | null {
  const map: Record<string, OrgTipo | null> = {
    '': 'operador_logistico',
    operador_logistico: 'filial_operador',
    filial_operador: 'embarcador',
    embarcador: 'unidade',
    unidade: 'transportadora',
    transportadora: null,
  }
  if (!tipoPai) return 'operador_logistico'
  return map[tipoPai] ?? null
}

/** Super usuários conhecidos (fallback se API antiga não devolver is_superuser). */
export function isLocalSuperUser(usuario: string): boolean {
  const u = (usuario || '').trim().toLowerCase()
  if (!u) return false
  const ascii = u
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  const locals = [
    'diego',
    'elder',
    'diego.isidoro',
    'elder.tenorio',
    'eldertenorio',
    'diegoisidoro',
    'diego isidoro',
    'elder tenorio',
  ]
  if (locals.includes(u) || locals.includes(ascii)) return true
  const local = (ascii.split('@')[0] || '').trim()
  if (locals.includes(local)) return true
  if (locals.some((s) => ascii === s || ascii.startsWith(`${s}.`) || ascii.startsWith(`${s}@`))) {
    return true
  }
  if (local.startsWith('diego') || local.startsWith('elder')) return true
  return false
}

const PORTAL_CONFIG_SEEN_KEY = 'doca_portal_config_seen_v1'

export function clearPortalConfigSeen(): void {
  try {
    sessionStorage.removeItem(PORTAL_CONFIG_SEEN_KEY)
  } catch {
    /* ignore */
  }
}

export function markPortalConfigSeen(): void {
  try {
    sessionStorage.setItem(PORTAL_CONFIG_SEEN_KEY, '1')
  } catch {
    /* ignore */
  }
}

export function hasPortalConfigSeen(): boolean {
  try {
    return sessionStorage.getItem(PORTAL_CONFIG_SEEN_KEY) === '1'
  } catch {
    return false
  }
}
