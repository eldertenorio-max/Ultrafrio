import { FormEvent, useState } from 'react'
import { LOGO_DOCA_LIVRE_SRC } from '../lib/brandAssets'
import './PortalLoginScreen.css'

type Props = {
  onSuccess: (usuario: string) => void
}

export default function PortalLoginScreen({ onSuccess }: Props) {
  const [usuario, setUsuario] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setLoading(true)
    try {
      const { portalLogin } = await import('../lib/portalApi')
      const result = await portalLogin(usuario.trim(), senha)
      if (!result.ok) {
        setErro(result.erro)
        return
      }
      onSuccess(result.usuario)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="portal-login" role="main">
      <div className="portal-login__card">
        <div className="portal-login__header">
          <img className="portal-login__logo" src={LOGO_DOCA_LIVRE_SRC} alt="Doca Livre" />
          <p className="portal-login__tagline">Um login para Light, Plus e Pro</p>
        </div>
        <form className="portal-login__form" onSubmit={handleSubmit}>
          <label className="portal-login__label" htmlFor="portal-user">
            Usuário
          </label>
          <input
            id="portal-user"
            className="portal-login__input"
            autoComplete="username"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            required
          />
          <label className="portal-login__label" htmlFor="portal-pass">
            Senha
          </label>
          <input
            id="portal-pass"
            type="password"
            className="portal-login__input"
            autoComplete="current-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
          />
          {erro ? (
            <p className="portal-login__erro" role="alert">
              {erro}
            </p>
          ) : null}
          <button type="submit" className="portal-login__submit" disabled={loading}>
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
