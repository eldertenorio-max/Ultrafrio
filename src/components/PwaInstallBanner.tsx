import { useState } from 'react'
import { usePwaInstall } from '../hooks/usePwaInstall'
import { useIsMobile } from '../hooks/useIsMobile'

export function PwaInstallBanner() {
  const mobile = useIsMobile()
  const { canInstall, isIosSafari, isAndroidChrome, installed, dismissed, promptInstall, dismiss } =
    usePwaInstall()
  const [showHelp, setShowHelp] = useState(false)

  if (!mobile || installed || dismissed) return null
  if (!canInstall && !isIosSafari && !isAndroidChrome) return null

  return (
    <div className="pwa-install-banner" role="dialog" aria-label="Instalar aplicativo">
      <div className="pwa-install-icon" aria-hidden>
        <img src="/icon-192.png" alt="" width={40} height={40} />
      </div>
      <div className="pwa-install-text">
        <strong>Instalar o Doca Livre</strong>
        <span>Adicione o app à tela inicial para abrir mais rápido e em tela cheia.</span>
        {showHelp && isIosSafari && (
          <span className="pwa-install-ios-help">
            Toque em <span className="pwa-ios-share" aria-hidden>⎋</span> Compartilhar e depois em
            “Adicionar à Tela de Início”.
          </span>
        )}
        {showHelp && isAndroidChrome && !canInstall && (
          <span className="pwa-install-ios-help">
            Se a opção não aparecer, feche e abra o Chrome, toque nos 3 pontos e escolha
            “Instalar app” ou “Adicionar à tela inicial”.
          </span>
        )}
      </div>
      <div className="pwa-install-actions">
        {canInstall ? (
          <button type="button" className="btn primary pwa-install-btn" onClick={() => void promptInstall()}>
            Instalar
          </button>
        ) : (
          <button type="button" className="btn primary pwa-install-btn" onClick={() => setShowHelp((v) => !v)}>
            Como instalar
          </button>
        )}
        <button type="button" className="pwa-install-close" onClick={dismiss} aria-label="Dispensar">
          ✕
        </button>
      </div>
    </div>
  )
}
