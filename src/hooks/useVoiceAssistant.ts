import { useCallback, useEffect, useRef, useState } from 'react'
import { extractVoiceFeatures } from '../lib/voiceFeatures'
import {
  stripWakePhrase,
  wakePhraseMatches,
} from '../lib/voiceNormalize'
import {
  findBestVoiceMatch,
  VOICE_MATCH_THRESHOLD,
  type NamedVoiceProfile,
} from '../lib/voiceProfile'

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
  resultIndex: number
  results: {
    [index: number]: {
      [index: number]: { transcript: string }
      isFinal?: boolean
      length: number
    }
    length: number
  }
}

type SpeechRecognitionErrorEvent = {
  error: string
}

export type VoiceAssistantPhase = 'off' | 'ouvindo' | 'armado' | 'executando'

const ARMED_TIMEOUT_MS = 8000
const AUDIO_BUFFER_MS = 9000
const SILENCE_AFTER_SPEECH_MS = 1500

function readResultSnapshot(ev: SpeechRecognitionResultEvent): {
  interim: string
  final: string
  snapshot: string
} {
  let interim = ''
  let final = ''
  for (let i = ev.resultIndex; i < ev.results.length; i++) {
    const result = ev.results[i]
    const piece = result?.[0]?.transcript ?? ''
    if (result?.isFinal) final += piece
    else interim += piece
  }

  let allFinal = ''
  let lastInterim = ''
  for (let i = 0; i < ev.results.length; i++) {
    const result = ev.results[i]
    const piece = result?.[0]?.transcript ?? ''
    if (result?.isFinal) allFinal += piece
    else lastInterim = piece
  }

  const snapshot = `${allFinal}${lastInterim}`.trim()
  return { interim: interim.trim(), final: final.trim(), snapshot }
}

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

type Options = {
  enabled: boolean
  wakePhrase: string
  voiceProfiles: NamedVoiceProfile[]
  requireVoiceMatch: boolean
  onCommandText: (text: string) => void
  onError?: (message: string) => void
}

export function useVoiceAssistant({
  enabled,
  wakePhrase,
  voiceProfiles,
  requireVoiceMatch,
  onCommandText,
  onError,
}: Options) {
  const [supported, setSupported] = useState(false)
  const [phase, setPhase] = useState<VoiceAssistantPhase>('off')
  const [liveText, setLiveText] = useState('')
  const [lastHint, setLastHint] = useState<string | null>(null)

  const recRef = useRef<SpeechRecognitionInstance | null>(null)
  const runningRef = useRef(false)
  const armedRef = useRef(false)
  const armedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const armedBufferRef = useRef('')
  const armedInterimRef = useRef('')
  const listeningBufferRef = useRef('')
  const sessionAccumRef = useRef('')
  const onCommandTextRef = useRef(onCommandText)
  const onErrorRef = useRef(onError)
  const wakePhraseRef = useRef(wakePhrase)
  const voiceProfilesRef = useRef(voiceProfiles)
  const requireVoiceMatchRef = useRef(requireVoiceMatch)

  const audioStreamRef = useRef<MediaStream | null>(null)
  const audioRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<{ data: Blob; ts: number }[]>([])

  useEffect(() => {
    onCommandTextRef.current = onCommandText
  }, [onCommandText])

  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])

  useEffect(() => {
    wakePhraseRef.current = wakePhrase
  }, [wakePhrase])

  useEffect(() => {
    voiceProfilesRef.current = voiceProfiles
  }, [voiceProfiles])

  useEffect(() => {
    requireVoiceMatchRef.current = requireVoiceMatch
  }, [requireVoiceMatch])

  const clearArmedTimer = useCallback(() => {
    if (armedTimerRef.current) {
      clearTimeout(armedTimerRef.current)
      armedTimerRef.current = null
    }
  }, [])

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }
  }, [])

  const stopAudioCapture = useCallback(() => {
    audioRecorderRef.current?.stop()
    audioRecorderRef.current = null
    audioStreamRef.current?.getTracks().forEach((t) => t.stop())
    audioStreamRef.current = null
    audioChunksRef.current = []
  }, [])

  const startAudioCapture = useCallback(async () => {
    stopAudioCapture()
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      })
      audioStreamRef.current = stream
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm'
      const recorder = new MediaRecorder(stream, { mimeType })
      recorder.ondataavailable = (e) => {
        if (e.data.size === 0) return
        const ts = Date.now()
        audioChunksRef.current.push({ data: e.data, ts })
        const cutoff = ts - AUDIO_BUFFER_MS
        audioChunksRef.current = audioChunksRef.current.filter((c) => c.ts >= cutoff)
      }
      recorder.start(400)
      audioRecorderRef.current = recorder
    } catch {
      onErrorRef.current?.('Não foi possível acessar o microfone para verificação de voz.')
    }
  }, [stopAudioCapture])

  const getRecentAudioBlob = useCallback((): Blob | null => {
    const chunks = audioChunksRef.current
    if (chunks.length === 0) return null
    return new Blob(
      chunks.map((c) => c.data),
      { type: chunks[0]?.data.type || 'audio/webm' },
    )
  }, [])

  const verifyRegisteredVoice = useCallback(async (): Promise<boolean> => {
    const profiles = voiceProfilesRef.current
    if (!requireVoiceMatchRef.current || profiles.length === 0) return true

    const blob = getRecentAudioBlob()
    if (!blob || blob.size === 0) {
      onErrorRef.current?.('Não foi possível verificar sua voz. Tente falar de novo.')
      return false
    }

    try {
      const features = await extractVoiceFeatures(blob)
      const { match, score, profile } = findBestVoiceMatch(
        profiles,
        features,
        VOICE_MATCH_THRESHOLD,
      )
      if (!match) {
        onErrorRef.current?.(
          `Voz não reconhecida (${Math.round(score * 100)}%). Só responde às vozes cadastradas com "${wakePhraseRef.current}".`,
        )
        return false
      }
      if (profile) {
        setLastHint(`Voz de ${profile.name} reconhecida`)
      }
      return true
    } catch {
      onErrorRef.current?.('Erro ao verificar voz cadastrada.')
      return false
    }
  }, [getRecentAudioBlob])

  const disarm = useCallback(() => {
    armedRef.current = false
    clearArmedTimer()
    armedBufferRef.current = ''
    armedInterimRef.current = ''
    setPhase('ouvindo')
    setLastHint(`Diga "${wakePhraseRef.current}" com sua voz cadastrada`)
  }, [clearArmedTimer])

  const arm = useCallback(() => {
    armedRef.current = true
    armedBufferRef.current = ''
    armedInterimRef.current = ''
    clearArmedTimer()
    setPhase('armado')
    setLastHint('Ouvindo comando…')
    armedTimerRef.current = setTimeout(() => {
      disarm()
    }, ARMED_TIMEOUT_MS)
  }, [clearArmedTimer, disarm])

  const dispatchCommand = useCallback(
    (text: string) => {
      const trimmed = text.trim()
      if (!trimmed) return
      clearSilenceTimer()
      armedBufferRef.current = ''
      armedInterimRef.current = ''
      listeningBufferRef.current = ''
      sessionAccumRef.current = ''
      setPhase('executando')
      setLiveText(trimmed)
      onCommandTextRef.current(trimmed)
      disarm()
    },
    [clearSilenceTimer, disarm],
  )

  const processWake = useCallback(
    async (raw: string) => {
      const wake = wakePhraseRef.current
      if (!wakePhraseMatches(raw, wake)) return false

      const ok = await verifyRegisteredVoice()
      if (!ok) return true

      const remainder = stripWakePhrase(raw, wake)
      if (remainder) {
        dispatchCommand(remainder)
        return true
      }

      arm()
      sessionAccumRef.current = ''
      return true
    },
    [arm, dispatchCommand, verifyRegisteredVoice],
  )

  const flushAfterSilence = useCallback(async () => {
    silenceTimerRef.current = null

    if (armedRef.current) {
      const text = `${armedBufferRef.current} ${armedInterimRef.current}`.replace(/\s+/g, ' ').trim()
      if (text) dispatchCommand(text)
      return
    }

    const full = listeningBufferRef.current.trim()
    if (!full) return
    const handled = await processWake(full)
    if (handled) {
      listeningBufferRef.current = ''
      sessionAccumRef.current = ''
    }
  }, [dispatchCommand, processWake])

  const scheduleSilenceFlush = useCallback(() => {
    clearSilenceTimer()
    silenceTimerRef.current = setTimeout(() => {
      void flushAfterSilence()
    }, SILENCE_AFTER_SPEECH_MS)
  }, [clearSilenceTimer, flushAfterSilence])

  const processTranscript = useCallback(
    async (raw: string, isFinal: boolean) => {
      if (await processWake(raw)) return

      if (armedRef.current && isFinal) {
        armedBufferRef.current = `${armedBufferRef.current} ${raw}`.replace(/\s+/g, ' ').trim()
      }
    },
    [processWake],
  )

  const stopRecognition = useCallback(() => {
    runningRef.current = false
    recRef.current?.abort()
    recRef.current = null
    stopAudioCapture()
    clearArmedTimer()
    clearSilenceTimer()
    armedRef.current = false
    armedBufferRef.current = ''
    armedInterimRef.current = ''
    listeningBufferRef.current = ''
    sessionAccumRef.current = ''
    setPhase('off')
    setLiveText('')
  }, [clearArmedTimer, clearSilenceTimer, stopAudioCapture])

  const startRecognition = useCallback(async () => {
    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) {
      onErrorRef.current?.('Reconhecimento de voz não disponível neste navegador.')
      return
    }

    if (requireVoiceMatchRef.current && voiceProfilesRef.current.length === 0) {
      onErrorRef.current?.('Cadastre pelo menos uma voz individual antes de ativar o assistente.')
      return
    }

    await startAudioCapture()

    recRef.current?.abort()
    const rec = new Ctor()
    recRef.current = rec
    rec.lang = 'pt-BR'
    rec.interimResults = true
    rec.maxAlternatives = 1
    rec.continuous = true

    rec.onresult = (ev) => {
      const { interim, final, snapshot } = readResultSnapshot(ev)

      if (armedRef.current) {
        if (final) {
          armedBufferRef.current = `${armedBufferRef.current} ${final}`.replace(/\s+/g, ' ').trim()
        }
        armedInterimRef.current = interim
        const preview = `${armedBufferRef.current}${interim ? ` ${interim}` : ''}`.trim()
        setLiveText(preview)
        setPhase('armado')
        if (preview) scheduleSilenceFlush()
        return
      }

      if (final) {
        sessionAccumRef.current = `${sessionAccumRef.current} ${final}`.replace(/\s+/g, ' ').trim()
        void processTranscript(final, true)
      }

      const working = `${sessionAccumRef.current}${interim ? ` ${interim}` : ''}`.trim() || snapshot
      if (working) {
        listeningBufferRef.current = working
        setLiveText(working)
        scheduleSilenceFlush()
      }
    }

    rec.onerror = (ev) => {
      if (ev.error === 'not-allowed') {
        onErrorRef.current?.('Permita o uso do microfone no navegador.')
        stopRecognition()
        return
      }
      if (ev.error !== 'aborted' && ev.error !== 'no-speech') {
        onErrorRef.current?.('Erro no microfone. Tentando reconectar…')
      }
    }

    rec.onend = () => {
      if (!runningRef.current) return
      try {
        rec.start()
      } catch {
        /* reinicia no próximo ciclo */
      }
    }

    runningRef.current = true
    armedRef.current = false
    setPhase('ouvindo')
    setLastHint(
      requireVoiceMatchRef.current
        ? `Diga "${wakePhraseRef.current}" com sua voz cadastrada`
        : `Diga "${wakePhraseRef.current}" e fale o comando`,
    )
    rec.start()
  }, [processTranscript, startAudioCapture, stopRecognition])

  useEffect(() => {
    setSupported(getSpeechRecognitionCtor() != null)
  }, [])

  useEffect(() => {
    if (enabled && supported) {
      void startRecognition()
    } else {
      stopRecognition()
    }
    return () => stopRecognition()
  }, [enabled, supported, startRecognition, stopRecognition])

  const testPhrase = useCallback(
    (spoken: string): boolean => wakePhraseMatches(spoken, wakePhraseRef.current),
    [],
  )

  return {
    supported,
    phase,
    liveText,
    lastHint,
    testPhrase,
    stop: stopRecognition,
  }
}
