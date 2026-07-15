/** API do portal único hospedado no Plus → autenticação/SSO no Pro. */

const HUB_TOKEN_KEY = 'doca_hub_token_v1'
const HUB_USER_KEY = 'doca_hub_user_v1'

export function getProApiBase(): string {
  const fromEnv = (import.meta.env.VITE_WMS_PRO_URL as string | undefined)?.trim()
  return (fromEnv || 'https://doca-livre-wms-pro.onrender.com/').replace(/\/?$/, '/')
}

async function portalPost<T extends { ok?: boolean; erro?: string }>(
  path: string,
  body: Record<string, unknown>,
): Promise<T | { ok: false; erro: string }> {
  try {
    const res = await fetch(`${getProApiBase()}${path.replace(/^\//, '')}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = (await res.json().catch(() => ({}))) as T & {
      smtp_motivo?: string
    }
    if (!res.ok || !data.ok) {
      const base = data.erro || 'Não foi possível concluir a operação.'
      const detail = (data.smtp_motivo || '').trim()
      return {
        ok: false,
        erro: detail && !base.includes(detail) ? `${base} (${detail})` : base,
      }
    }
    return data
  } catch {
    return { ok: false, erro: 'Falha de conexão com o portal.' }
  }
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

export async function portalCadastroEnviarCodigo(email: string) {
  return portalPost<{
    ok: true
    mensagem?: string
    email?: string
    debug_codigo?: string
  }>('api/portal/cadastro/enviar-codigo', { email })
}

export async function portalCadastroVerificarCodigo(email: string, codigo: string) {
  return portalPost<{
    ok: true
    verify_token: string
    email?: string
    mensagem?: string
  }>('api/portal/cadastro/verificar-codigo', { email, codigo })
}

export async function portalCadastroConcluir(input: {
  verifyToken: string
  usuario: string
  senha: string
  confirmarSenha: string
}) {
  return portalPost<{ ok: true; mensagem?: string; usuario?: string }>('api/portal/cadastro/concluir', {
    verify_token: input.verifyToken,
    usuario: input.usuario,
    senha: input.senha,
    confirmar_senha: input.confirmarSenha,
  })
}

export async function portalSenhaEnviarCodigo(identificador: string) {
  return portalPost<{
    ok: true
    enviado?: boolean
    mensagem?: string
    email_mascarado?: string
    debug_codigo?: string
  }>('api/portal/senha/enviar-codigo', { identificador })
}

export async function portalSenhaVerificarCodigo(identificador: string, codigo: string) {
  return portalPost<{
    ok: true
    verify_token: string
    usuario?: string
    email?: string
    mensagem?: string
  }>('api/portal/senha/verificar-codigo', { identificador, codigo })
}

export async function portalSenhaRedefinir(input: {
  verifyToken: string
  senha: string
  confirmarSenha: string
}) {
  return portalPost<{ ok: true; mensagem?: string; usuario?: string }>('api/portal/senha/redefinir', {
    verify_token: input.verifyToken,
    senha: input.senha,
    confirmar_senha: input.confirmarSenha,
  })
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
