import { useState, type FormEvent, type InputHTMLAttributes } from 'react'
import { LOGO_DOCA_LIVRE_SRC } from '../lib/brandAssets'
import {
  portalCadastroConcluir,
  portalCadastroEnviarCodigo,
  portalCadastroVerificarCodigo,
  portalLogin,
  portalSenhaEnviarCodigo,
  portalSenhaRedefinir,
  portalSenhaVerificarCodigo,
} from '../lib/portalApi'
import './PortalLoginScreen.css'

type Props = {
  onSuccess: (usuario: string) => void
}

type Mode = 'login' | 'cadastro' | 'senha'
type Step = 'form' | 'codigo' | 'dados'

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  id: string
}

function PasswordField({ id, className, ...rest }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="portal-login__password-wrap">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        className={`portal-login__input portal-login__input--password${className ? ` ${className}` : ''}`}
        {...rest}
      />
      <button
        type="button"
        className="portal-login__password-toggle"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
        title={visible ? 'Ocultar senha' : 'Mostrar senha'}
      >
        {visible ? (
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path
              fill="currentColor"
              d="M12 6a9.8 9.8 0 0 1 8.9 5.5A9.8 9.8 0 0 1 12 17a9.8 9.8 0 0 1-8.9-5.5A9.8 9.8 0 0 1 12 6m0-2C7 4 2.7 7.1 1 12c1.7 4.9 6 8 11 8s9.3-3.1 11-8c-1.7-4.9-6-8-11-8zm0 5a3 3 0 1 1 0 6 3 3 0 0 1 0-6zm0-2a5 5 0 1 0 .001 10.001A5 5 0 0 0 12 7z"
            />
            <path
              fill="currentColor"
              d="M3.3 2.9 2 4.2l18.5 18.5 1.3-1.3L3.3 2.9z"
            />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path
              fill="currentColor"
              d="M12 6a9.8 9.8 0 0 1 8.9 5.5A9.8 9.8 0 0 1 12 17a9.8 9.8 0 0 1-8.9-5.5A9.8 9.8 0 0 1 12 6m0-2C7 4 2.7 7.1 1 12c1.7 4.9 6 8 11 8s9.3-3.1 11-8c-1.7-4.9-6-8-11-8zm0 5a3 3 0 1 1 0 6 3 3 0 0 1 0-6zm0-2a5 5 0 1 0 .001 10.001A5 5 0 0 0 12 7z"
            />
          </svg>
        )}
      </button>
    </div>
  )
}

export default function PortalLoginScreen({ onSuccess }: Props) {
  const [mode, setMode] = useState<Mode>('login')
  const [step, setStep] = useState<Step>('form')

  const [usuario, setUsuario] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [email, setEmail] = useState('')
  const [identificador, setIdentificador] = useState('')
  const [codigo, setCodigo] = useState('')
  const [verifyToken, setVerifyToken] = useState('')

  const [erro, setErro] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function resetMessages() {
    setErro(null)
    setInfo(null)
  }

  function goMode(next: Mode) {
    setMode(next)
    setStep('form')
    setCodigo('')
    setVerifyToken('')
    setSenha('')
    setConfirmarSenha('')
    setErro(null)
    setInfo(null)
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault()
    resetMessages()
    setLoading(true)
    try {
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

  async function handleCadastroEnviar(e: FormEvent) {
    e.preventDefault()
    resetMessages()
    setLoading(true)
    try {
      const result = await portalCadastroEnviarCodigo(email.trim())
      if (!result.ok) {
        setErro(result.erro)
        return
      }
      setInfo(result.mensagem || 'Código enviado para o e-mail. Cole-o abaixo.')
      setStep('codigo')
    } finally {
      setLoading(false)
    }
  }

  async function handleCadastroVerificar(e: FormEvent) {
    e.preventDefault()
    resetMessages()
    setLoading(true)
    try {
      const result = await portalCadastroVerificarCodigo(email.trim(), codigo.trim())
      if (!result.ok) {
        setErro(result.erro)
        return
      }
      setVerifyToken(result.verify_token)
      setInfo(result.mensagem || 'E-mail confirmado. Defina usuário e senha.')
      setStep('dados')
      setCodigo('')
    } finally {
      setLoading(false)
    }
  }

  async function handleCadastroConcluir(e: FormEvent) {
    e.preventDefault()
    resetMessages()
    if (senha !== confirmarSenha) {
      setErro('As senhas não coincidem.')
      return
    }
    setLoading(true)
    try {
      const result = await portalCadastroConcluir({
        verifyToken,
        usuario: usuario.trim(),
        senha,
        confirmarSenha,
      })
      if (!result.ok) {
        setErro(result.erro)
        return
      }
      setInfo(result.mensagem || 'Cadastro realizado. Faça login.')
      setUsuario(result.usuario || usuario)
      setSenha('')
      setConfirmarSenha('')
      goMode('login')
      setInfo(result.mensagem || 'Cadastro realizado. Faça login.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSenhaEnviar(e: FormEvent) {
    e.preventDefault()
    resetMessages()
    setLoading(true)
    try {
      const result = await portalSenhaEnviarCodigo(identificador.trim())
      if (!result.ok) {
        setErro(result.erro)
        return
      }
      const enviado = result.enviado === true || Boolean(result.email_mascarado || result.debug_codigo)
      if (!enviado) {
        setInfo(
          result.mensagem ||
            'Não encontramos uma conta com e-mail para esse usuário. Faça o cadastro ou use o usuário/e-mail cadastrado.',
        )
        return
      }
      const mask = result.email_mascarado ? ` (${result.email_mascarado})` : ''
      setInfo((result.mensagem || 'Código enviado.') + mask)
      setStep('codigo')
    } finally {
      setLoading(false)
    }
  }

  async function handleSenhaVerificar(e: FormEvent) {
    e.preventDefault()
    resetMessages()
    setLoading(true)
    try {
      const result = await portalSenhaVerificarCodigo(identificador.trim(), codigo.trim())
      if (!result.ok) {
        setErro(result.erro)
        return
      }
      setVerifyToken(result.verify_token)
      if (result.usuario) setUsuario(result.usuario)
      setInfo(result.mensagem || 'Código confirmado. Defina a nova senha.')
      setStep('dados')
      setCodigo('')
    } finally {
      setLoading(false)
    }
  }

  async function handleSenhaRedefinir(e: FormEvent) {
    e.preventDefault()
    resetMessages()
    if (senha !== confirmarSenha) {
      setErro('As senhas não coincidem.')
      return
    }
    setLoading(true)
    try {
      const result = await portalSenhaRedefinir({
        verifyToken,
        senha,
        confirmarSenha,
      })
      if (!result.ok) {
        setErro(result.erro)
        return
      }
      setUsuario(result.usuario || usuario)
      setSenha('')
      setConfirmarSenha('')
      goMode('login')
      setInfo(result.mensagem || 'Senha atualizada. Faça login.')
    } finally {
      setLoading(false)
    }
  }

  const title =
    mode === 'login'
      ? 'Login para sistemas'
      : mode === 'cadastro'
        ? step === 'codigo'
          ? 'Confirmar e-mail'
          : step === 'dados'
            ? 'Criar conta'
            : 'Cadastro'
        : step === 'codigo'
          ? 'Código no e-mail'
          : step === 'dados'
            ? 'Nova senha'
            : 'Trocar senha'

  const tagline =
    mode === 'login'
      ? 'Um acesso para WMS Light, Plus e Pro'
      : mode === 'cadastro'
        ? step === 'codigo'
          ? 'Cole o código enviado para o seu e-mail'
          : step === 'dados'
            ? 'Escolha usuário e senha para entrar nos sistemas'
            : 'Informe o e-mail para receber o código de confirmação'
        : step === 'codigo'
          ? 'Cole o código enviado para o e-mail da conta'
          : step === 'dados'
            ? 'Defina a nova senha de acesso'
            : 'Informe usuário ou e-mail cadastrado'

  return (
    <div className="portal-login" role="main">
      <div className="portal-login__card">
        <div className="portal-login__header">
          <img className="portal-login__logo" src={LOGO_DOCA_LIVRE_SRC} alt="Doca Livre" />
          <h1 className="portal-login__title">{title}</h1>
          <p className="portal-login__tagline">{tagline}</p>
        </div>

        {mode === 'login' ? (
          <form className="portal-login__form" onSubmit={handleLogin}>
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
            <PasswordField
              id="portal-pass"
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
            {info ? <p className="portal-login__info">{info}</p> : null}
            <button type="submit" className="portal-login__submit" disabled={loading}>
              {loading ? 'Entrando…' : 'Entrar'}
            </button>
            <div className="portal-login__links">
              <button type="button" className="portal-login__link" onClick={() => goMode('cadastro')}>
                Criar conta
              </button>
              <button type="button" className="portal-login__link" onClick={() => goMode('senha')}>
                Trocar senha
              </button>
            </div>
          </form>
        ) : null}

        {mode === 'cadastro' && step === 'form' ? (
          <form className="portal-login__form" onSubmit={handleCadastroEnviar}>
            <label className="portal-login__label" htmlFor="portal-email">
              E-mail
            </label>
            <input
              id="portal-email"
              type="email"
              className="portal-login__input"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {erro ? (
              <p className="portal-login__erro" role="alert">
                {erro}
              </p>
            ) : null}
            <button type="submit" className="portal-login__submit" disabled={loading}>
              {loading ? 'Enviando…' : 'Enviar código'}
            </button>
            <div className="portal-login__links">
              <button type="button" className="portal-login__link" onClick={() => goMode('login')}>
                Voltar ao login
              </button>
            </div>
          </form>
        ) : null}

        {mode === 'cadastro' && step === 'codigo' ? (
          <form className="portal-login__form" onSubmit={handleCadastroVerificar}>
            <p className="portal-login__hint">
              Enviamos um código para <strong>{email}</strong>. Abra o e-mail, copie o código e cole
              abaixo.
            </p>
            <label className="portal-login__label" htmlFor="portal-otp">
              Código
            </label>
            <input
              id="portal-otp"
              className="portal-login__input portal-login__input--otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              required
              minLength={6}
              maxLength={6}
            />
            {erro ? (
              <p className="portal-login__erro" role="alert">
                {erro}
              </p>
            ) : null}
            {info ? <p className="portal-login__info">{info}</p> : null}
            <button type="submit" className="portal-login__submit" disabled={loading || codigo.length < 6}>
              {loading ? 'Validando…' : 'Confirmar código'}
            </button>
            <div className="portal-login__links">
              <button
                type="button"
                className="portal-login__link"
                disabled={loading}
                onClick={() => {
                  setStep('form')
                  setCodigo('')
                }}
              >
                Reenviar / outro e-mail
              </button>
              <button type="button" className="portal-login__link" onClick={() => goMode('login')}>
                Voltar ao login
              </button>
            </div>
          </form>
        ) : null}

        {mode === 'cadastro' && step === 'dados' ? (
          <form className="portal-login__form" onSubmit={handleCadastroConcluir}>
            <p className="portal-login__hint">
              E-mail confirmado: <strong>{email}</strong>
            </p>
            <label className="portal-login__label" htmlFor="portal-new-user">
              Usuário
            </label>
            <input
              id="portal-new-user"
              className="portal-login__input"
              autoComplete="username"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              required
              minLength={2}
            />
            <label className="portal-login__label" htmlFor="portal-new-pass">
              Senha
            </label>
            <PasswordField
              id="portal-new-pass"
              autoComplete="new-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
              minLength={4}
            />
            <label className="portal-login__label" htmlFor="portal-new-pass2">
              Confirmar senha
            </label>
            <PasswordField
              id="portal-new-pass2"
              autoComplete="new-password"
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
              required
              minLength={4}
            />
            {erro ? (
              <p className="portal-login__erro" role="alert">
                {erro}
              </p>
            ) : null}
            <button type="submit" className="portal-login__submit" disabled={loading}>
              {loading ? 'Salvando…' : 'Concluir cadastro'}
            </button>
            <div className="portal-login__links">
              <button type="button" className="portal-login__link" onClick={() => goMode('login')}>
                Voltar ao login
              </button>
            </div>
          </form>
        ) : null}

        {mode === 'senha' && step === 'form' ? (
          <form className="portal-login__form" onSubmit={handleSenhaEnviar}>
            <label className="portal-login__label" htmlFor="portal-ident">
              Usuário ou e-mail
            </label>
            <input
              id="portal-ident"
              className="portal-login__input"
              autoComplete="username"
              value={identificador}
              onChange={(e) => setIdentificador(e.target.value)}
              required
            />
            {erro ? (
              <p className="portal-login__erro" role="alert">
                {erro}
              </p>
            ) : null}
            <button type="submit" className="portal-login__submit" disabled={loading}>
              {loading ? 'Enviando…' : 'Enviar código'}
            </button>
            <div className="portal-login__links">
              <button type="button" className="portal-login__link" onClick={() => goMode('login')}>
                Voltar ao login
              </button>
            </div>
          </form>
        ) : null}

        {mode === 'senha' && step === 'codigo' ? (
          <form className="portal-login__form" onSubmit={handleSenhaVerificar}>
            <p className="portal-login__hint">
              Digite o código do e-mail com assunto{' '}
              <strong>Doca Livre — código para trocar a senha</strong> enviado para{' '}
              <strong>{identificador}</strong>. O e-mail de cadastro (“confirmação de e-mail”)
              não serve para trocar senha.
            </p>
            <label className="portal-login__label" htmlFor="portal-senha-otp">
              Código
            </label>
            <input
              id="portal-senha-otp"
              className="portal-login__input portal-login__input--otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              required
              minLength={6}
              maxLength={6}
            />
            {erro ? (
              <p className="portal-login__erro" role="alert">
                {erro}
              </p>
            ) : null}
            {info ? <p className="portal-login__info">{info}</p> : null}
            <button type="submit" className="portal-login__submit" disabled={loading || codigo.length < 6}>
              {loading ? 'Validando…' : 'Confirmar código'}
            </button>
            <div className="portal-login__links">
              <button
                type="button"
                className="portal-login__link"
                onClick={() => {
                  setStep('form')
                  setCodigo('')
                }}
              >
                Reenviar / outro usuário
              </button>
              <button type="button" className="portal-login__link" onClick={() => goMode('login')}>
                Voltar ao login
              </button>
            </div>
          </form>
        ) : null}

        {mode === 'senha' && step === 'dados' ? (
          <form className="portal-login__form" onSubmit={handleSenhaRedefinir}>
            <label className="portal-login__label" htmlFor="portal-reset-pass">
              Nova senha
            </label>
            <PasswordField
              id="portal-reset-pass"
              autoComplete="new-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
              minLength={4}
            />
            <label className="portal-login__label" htmlFor="portal-reset-pass2">
              Confirmar nova senha
            </label>
            <PasswordField
              id="portal-reset-pass2"
              autoComplete="new-password"
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
              required
              minLength={4}
            />
            {erro ? (
              <p className="portal-login__erro" role="alert">
                {erro}
              </p>
            ) : null}
            <button type="submit" className="portal-login__submit" disabled={loading}>
              {loading ? 'Salvando…' : 'Salvar nova senha'}
            </button>
            <div className="portal-login__links">
              <button type="button" className="portal-login__link" onClick={() => goMode('login')}>
                Voltar ao login
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </div>
  )
}
