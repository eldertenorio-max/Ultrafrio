import { formatAddressLabel } from '../layout/camaras'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'
import type { AddressId } from '../types'

type Props = {
  origemSelecionada: AddressId | null
  onDestinoFalado: (transcript: string) => void
  onErro: (message: string) => void
  erro: string | null
  onLimparErro: () => void
}

export function MovimentacaoVozControle({
  origemSelecionada,
  onDestinoFalado,
  onErro,
  erro,
  onLimparErro,
}: Props) {
  const { listening, supported, interimTranscript, start, stop } = useSpeechRecognition()

  function handleMicClick() {
    onLimparErro()
    if (listening) {
      stop()
      return
    }
    if (!origemSelecionada) return
    start(onDestinoFalado, onErro)
  }

  return (
    <div className={`movimentacao-voz${listening ? ' movimentacao-voz--listening' : ''}`}>
      <p className="movimentacao-voz-title">Mover por voz</p>
      {!supported ? (
        <p className="muted movimentacao-voz-hint">
          Seu navegador não suporta reconhecimento de voz. Use Chrome ou Edge no computador ou
          celular.
        </p>
      ) : (
        <>
          <p className="muted movimentacao-voz-hint">
            {origemSelecionada ? (
              <>
                Origem: <strong>{formatAddressLabel(origemSelecionada)}</strong> — toque no
                microfone e fale o destino (ex.: &quot;câmara 6 rua 1 coluna 2 nível 3&quot;).
              </>
            ) : (
              <>Selecione um endereço na lista acima e depois fale para onde mover.</>
            )}
          </p>
          {listening && (
            <div className="movimentacao-voz-live" role="status" aria-live="polite">
              <span className="movimentacao-voz-live-dot" aria-hidden />
              <ListeningWaveBars />
              <span className="movimentacao-voz-live-label">
                {interimTranscript ? (
                  <>
                    Ouvindo: <strong>{interimTranscript}</strong>
                  </>
                ) : (
                  'Aguardando sua voz…'
                )}
              </span>
            </div>
          )}
          <button
            type="button"
            className={`movimentacao-voz-mic${listening ? ' is-listening' : ''}`}
            disabled={!origemSelecionada}
            title={
              origemSelecionada
                ? listening
                  ? 'Parar escuta'
                  : 'Falar endereço de destino'
                : 'Selecione um endereço de origem primeiro'
            }
            aria-label={
              origemSelecionada
                ? listening
                  ? 'Parar escuta'
                  : 'Falar endereço de destino'
                : 'Selecione um endereço de origem primeiro'
            }
            aria-pressed={listening}
            onClick={handleMicClick}
          >
            <span className="movimentacao-voz-mic-icon-wrap">
              <MicIcon />
            </span>
            <span>{listening ? 'Ouvindo… toque para parar' : 'Falar destino'}</span>
          </button>
        </>
      )}
      {erro && <p className="error movimentacao-voz-erro">{erro}</p>}
    </div>
  )
}

function ListeningWaveBars() {
  return (
    <span className="movimentacao-voz-waves" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="movimentacao-voz-wave-bar"
          style={{ animationDelay: `${i * 0.11}s` }}
        />
      ))}
    </span>
  )
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden fill="currentColor">
      <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z" />
    </svg>
  )
}
