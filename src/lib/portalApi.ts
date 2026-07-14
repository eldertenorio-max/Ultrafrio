/** API do portal único hospedado no Plus → autenticação/SSO no Pro. */

const HUB_TOKEN_KEY = 'doca_hub_token_v1'
const HUB_USER_KEY = 'doca_hub_user_v1'

export function getProApiBase(): string {
  const fromEnv = (import.meta.env.VITE_WMS_PRO_URL as string | undefined)?.trim()
  return (fromEnv || 'https://doca-livre-wms-pro.onrender.com/').replace(/\/?$/, '/')
}

export function loadHubSession(): { usuario: string; hubToken: string } | null {
  try {
    const hubToken = sessionStorage.getItem(HUB_TOKEN_KEY)?.trim() || ''
    const usuario = sessionStorage.getItem(HUB_USER_KEY)?.trim() || ''
    if (!hubToken || !usuario) return null
    return { usuario, hubToken }
  } catch {
    return null
  }
}

export function saveHubSession(usuario: string, hubToken: string): void {
  sessionStorage.setItem(HUB_USER_KEY, usuario)
  sessionStorage.setItem(HUB_TOKEN_KEY, hubToken)
}

export function clearHubSession(): void {
  try {
    sessionStorage.removeItem(HUB_TOKEN_KEY)
    sessionStorage.removeItem(HUB_USER_KEY)
  } catch {
    /* ignore */
  }
}

export async function portalLogin(
  usuario: string,
  senha: string,
): Promise<{ ok: true; usuario: string; hubToken: string } | { ok: false; erro: string }> {
  try {
    const res = await fetch(`${getProApiBase()}api/portal/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario, senha }),
    })
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean
      usuario?: string
      hub_token?: string
      erro?: string
    }
    if (!res.ok || !data.ok || !data.hub_token || !data.usuario) {
      return { ok: false, erro: data.erro || 'Usuário ou senha incorretos.' }
    }
    saveHubSession(data.usuario, data.hub_token)
    return { ok: true, usuario: data.usuario, hubToken: data.hub_token }
  } catch {
    return { ok: false, erro: 'Falha de conexão com o portal.' }
  }
}

export async function issueSystemSsoUrl(
  system: 'light' | 'plus' | 'pro',
  hubToken: string,
): Promise<{ ok: true; url: string } | { ok: false; erro: string }> {
  try {
    const res = await fetch(`${getProApiBase()}api/sso/issue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hubToken}`,
      },
      body: JSON.stringify({ system, hub_token: hubToken }),
    })
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; url?: string; erro?: string }
    if (!res.ok || !data.ok || !data.url) {
      return { ok: false, erro: data.erro || 'Não foi possível abrir o sistema.' }
    }
    return { ok: true, url: data.url }
  } catch {
    return { ok: false, erro: 'Falha de conexão ao emitir SSO.' }
  }
}
