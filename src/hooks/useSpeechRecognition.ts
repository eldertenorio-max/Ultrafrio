import { useCallback, useEffect, useRef, useState } from 'react'

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance

type SpeechRecognitionInstance = {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  continuous: boolean
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((ev: SpeechRecognitionResultEvent) => void) | null
  onerror: ((ev: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
}

type SpeechRecognitionResultEvent = {
  results: {
    [index: number]: { [index: number]: { transcript: string }; isFinal?: boolean }
    length: number
  }
}

type SpeechRecognitionErrorEvent = {
  error: string
}

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function useSpeechRecognition() {
  const [listening, setListening] = useState(false)
  const [supported, setSupported] = useState(false)
  const [interimTranscript, setInterimTranscript] = useState('')
  const recRef = useRef<SpeechRecognitionInstance | null>(null)

  useEffect(() => {
    setSupported(getSpeechRecognitionCtor() != null)
    return () => {
      recRef.current?.abort()
      recRef.current = null
    }
  }, [])

  const stop = useCallback(() => {
    recRef.current?.stop()
    recRef.current = null
    setListening(false)
    setInterimTranscript('')
  }, [])

  const start = useCallback(
    (onResult: (text: string) => void, onError?: (message: string) => void) => {
      const Ctor = getSpeechRecognitionCtor()
      if (!Ctor) {
        onError?.('Reconhecimento de voz não disponível neste navegador.')
        return
      }

      recRef.current?.abort()
      const rec = new Ctor()
      recRef.current = rec
      rec.lang = 'pt-BR'
      rec.interimResults = true
      rec.maxAlternatives = 1
      rec.continuous = false

      rec.onresult = (ev) => {
        let interim = ''
        let final = ''
        for (let i = 0; i < ev.results.length; i++) {
          const result = ev.results[i]
          const piece = result?.[0]?.transcript ?? ''
          if (result?.isFinal) {
            final += piece
          } else {
            interim += piece
          }
        }
        const preview = (interim || final).trim()
        setInterimTranscript(preview)
        if (final.trim()) {
          onResult(final.trim())
          setInterimTranscript('')
        }
      }

      rec.onerror = (ev) => {
        if (ev.error !== 'aborted') {
          onError?.(
            ev.error === 'not-allowed'
              ? 'Permita o uso do microfone no navegador.'
              : 'Não foi possível capturar a voz. Tente novamente.',
          )
        }
        setListening(false)
        setInterimTranscript('')
        recRef.current = null
      }

      rec.onend = () => {
        setListening(false)
        setInterimTranscript('')
        recRef.current = null
      }

      setInterimTranscript('')
      setListening(true)
      rec.start()
    },
    [],
  )

  return { listening, supported, interimTranscript, start, stop }
}
