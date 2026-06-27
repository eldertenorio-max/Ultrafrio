import type { VoiceAssistantPhase } from '../hooks/useVoiceAssistant'

type Props = {
  phase: VoiceAssistantPhase
  liveText: string
  lastHint: string | null
  feedback: string | null
  onCancel: () => void
}

export function VoiceAssistantHUD({
  phase,
  liveText,
  lastHint,
  feedback,
  onCancel,
}: Props) {
  // Escuta contínua: mostra o que o microfone capta enquanto aguarda a frase de ativação
  if (phase === 'ouvindo') {
    return (
      <div className="voice-assistant-hud voice-assistant-hud--passive" role="status" aria-live="polite">
        <div className="voice-assistant-hud-inner">
          <span className="voice-assistant-hud-dot voice-assistant-hud-dot--ouvindo" aria-hidden />
          <div className="voice-assistant-hud-body">
            <strong className="voice-assistant-hud-title">Aguardando frase de ativação…</strong>
            {liveText ? (
              <p className="voice-assistant-hud-live">
                Ouvindo: <strong>{liveText}</strong>
              </p>
            ) : (
              <p className="voice-assistant-hud-hint muted">Fale &quot;ok estoque&quot; com calma.</p>
            )}
            {feedback && <p className="voice-assistant-hud-feedback">{feedback}</p>}
          </div>
        </div>
      </div>
    )
  }

  if (phase !== 'armado') return null

  return (
    <div className="voice-assistant-hud" role="status" aria-live="polite">
      <div className="voice-assistant-hud-inner">
        <span className="voice-assistant-hud-dot voice-assistant-hud-dot--armado" aria-hidden />
        <div className="voice-assistant-hud-body">
          <strong className="voice-assistant-hud-title">Fale o comando…</strong>
          {liveText && <p className="voice-assistant-hud-live">{liveText}</p>}
          {feedback && <p className="voice-assistant-hud-feedback">{feedback}</p>}
          {!liveText && !feedback && lastHint && (
            <p className="voice-assistant-hud-hint muted">{lastHint}</p>
          )}
          {!liveText && !feedback && !lastHint && (
            <p className="voice-assistant-hud-hint muted">
              Após falar, aguarde — o comando será executado automaticamente.
            </p>
          )}
        </div>
        <span className="voice-assistant-hud-waves" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className="voice-assistant-hud-wave"
              style={{ animationDelay: `${i * 0.12}s` }}
            />
          ))}
        </span>
        <button
          type="button"
          className="voice-assistant-hud-cancel"
          onClick={onCancel}
          aria-label="Cancelar comando de voz"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
