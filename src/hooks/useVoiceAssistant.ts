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

function readIncrementalTranscript(ev: SpeechRecognitionResultEvent): {
  interim: string
  final: string
} {
  let interim = ''
  let final = ''
  for (let i = ev.resultIndex; i < ev.results.length; i++) {
    const result = ev.results[i]
    if (!result) continue

    let best = result[0]?.transcript ?? ''
    for (let a = 1; a < result.length; a++) {
      const alt = result[a]?.transcript ?? ''
      if (alt.length > best.length) best = alt
    }

    if (result.isFinal) final += best
    else interim += best
  }
  return { interim: interim.trim(), final: final.trim() }
}

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

function createRecognitionInstance(): SpeechRecognitionInstance | null {
  const Ctor = getSpeechRecognitionCtor()
  if (!Ctor) return null
  const rec = new Ctor()
  rec.lang = 'pt-BR'
  rec.interimResults = true
  rec.maxAlternatives = 5
  rec.continuous = true
  return rec
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
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const armedBufferRef = useRef('')
  const armedInterimRef = useRef('')
  const listeningBufferRef = useRef('')
  const sessionAccumRef = useRef('')
  const onCommandTextRef = useRef(onCommandText)
  const onErrorRef = useRef(onError)
  const wakePhraseRef = useRef(wakePhrase)
  const voiceProfilesRef = useRef(voiceProfiles)
  const requireVoiceMatchRef = useRef(requireVoiceMatch)
  const stopRecognitionRef = useRef<() => void>(() => {})
  const scheduleRecognitionRestartRef = useRef<() => void>(() => {})
  const restartingRef = useRef(false)
  const localSpeechHoldRef = useRef(0)
  const pausedForLocalSpeechRef = useRef(false)
  const enabledRef = useRef(enabled)

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

  useEffect(() => {
    enabledRef.current = enabled
  }, [enabled])

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

  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current)
      restartTimerRef.current = null
    }
  }, [])

  const clearListeningBuffers = useCallback(() => {
    armedBufferRef.current = ''
    armedInterimRef.current = ''
    listeningBufferRef.current = ''
    sessionAccumRef.current = ''
    setLiveText('')
  }, [])

  const audioDeferredTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearAudioDeferredTimer = useCallback(() => {
    if (audioDeferredTimerRef.current) {
      clearTimeout(audioDeferredTimerRef.current)
      audioDeferredTimerRef.current = null
    }
  }, [])

  const stopAudioCapture = useCallback(() => {
    clearAudioDeferredTimer()
    audioRecorderRef.current?.stop()
    audioRecorderRef.current = null
    audioStreamRef.current?.getTracks().forEach((t) => t.stop())
    audioStreamRef.current = null
    audioChunksRef.current = []
  }, [clearAudioDeferredTimer])

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

  const scheduleAudioCapture = useCallback(() => {
    clearAudioDeferredTimer()
    audioDeferredTimerRef.current = setTimeout(() => {
      audioDeferredTimerRef.current = null
      if (runningRef.current && !pausedForLocalSpeechRef.current) {
        void startAudioCapture()
      }
    }, 700)
  }, [clearAudioDeferredTimer, startAudioCapture])

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
    if (!blob || blob.size < 200) {
      setLastHint('Frase reconhecida — fale o comando.')
      return true
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

  const dispatchCommand = useCallback(
    (text: string) => {
      const trimmed = text.trim()
      if (!trimmed) return
      clearSilenceTimer()
      clearListeningBuffers()
      onCommandTextRef.current(trimmed)
    },
    [clearListeningBuffers, clearSilenceTimer],
  )

  const arm = useCallback(() => {
    armedRef.current = true
    armedBufferRef.current = ''
    armedInterimRef.current = ''
    sessionAccumRef.current = ''
    listeningBufferRef.current = ''
    clearArmedTimer()
    setPhase('armado')
    setLastHint('Ouvindo comando…')
    armedTimerRef.current = setTimeout(() => {
      scheduleRecognitionRestartRef.current()
    }, ARMED_TIMEOUT_MS)
  }, [clearArmedTimer])

  const processWake = useCallback(
    async (raw: string) => {
      const wake = wakePhraseRef.current
      if (!wakePhraseMatches(raw, wake)) return false

      const ok = await verifyRegisteredVoice()
      if (!ok) {
        sessionAccumRef.current = ''
        listeningBufferRef.current = ''
        return true
      }

      const remainder = stripWakePhrase(raw, wake)
      if (remainder) {
        dispatchCommand(remainder)
        scheduleRecognitionRestartRef.current()
        return true
      }

      arm()
      sessionAccumRef.current = ''
      listeningBufferRef.current = ''
      return true
    },
    [arm, dispatchCommand, verifyRegisteredVoice],
  )

  const flushAfterSilence = useCallback(async () => {
    silenceTimerRef.current = null

    if (armedRef.current) {
      const text = `${armedBufferRef.current} ${armedInterimRef.current}`.replace(/\s+/g, ' ').trim()
      if (text) {
        dispatchCommand(text)
        scheduleRecognitionRestartRef.current()
      }
      return
    }

    const full = listeningBufferRef.current.trim()
    if (!full) return
    const handled = await processWake(full)
    if (handled) {
      sessionAccumRef.current = ''
      listeningBufferRef.current = ''
    }
  }, [dispatchCommand, processWake])

  const scheduleSilenceFlush = useCallback(() => {
    clearSilenceTimer()
    silenceTimerRef.current = setTimeout(() => {
      void flushAfterSilence()
    }, SILENCE_AFTER_SPEECH_MS)
  }, [clearSilenceTimer, flushAfterSilence])

  const handlePassiveTranscript = useCallback(
    async (final: string, interim: string) => {
      if (final) {
        sessionAccumRef.current = `${sessionAccumRef.current} ${final}`.replace(/\s+/g, ' ').trim()
        if (await processWake(sessionAccumRef.current)) return
      }

      const working = `${sessionAccumRef.current}${interim ? ` ${interim}` : ''}`.trim()
      if (working) {
        listeningBufferRef.current = working
        setLiveText(working)
        setPhase('ouvindo')
        if (wakePhraseMatches(working, wakePhraseRef.current)) {
          if (await processWake(working)) return
        }
        scheduleSilenceFlush()
      }
    },
    [processWake, scheduleSilenceFlush],
  )

  const bindRecognitionHandlers = useCallback(
    (rec: SpeechRecognitionInstance) => {
      rec.onresult = (ev) => {
        const { interim, final } = readIncrementalTranscript(ev)

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

        void handlePassiveTranscript(final, interim)
      }

      rec.onerror = (ev) => {
        if (ev.error === 'not-allowed') {
          onErrorRef.current?.('Permita o uso do microfone no navegador.')
          stopRecognitionRef.current()
          return
        }
        if (ev.error !== 'aborted' && ev.error !== 'no-speech') {
          onErrorRef.current?.('Erro no microfone. Tentando reconectar…')
        }
      }

      rec.onend = () => {
        if (!runningRef.current || restartingRef.current || pausedForLocalSpeechRef.current) return
        scheduleRecognitionRestartRef.current()
      }
    },
    [handlePassiveTranscript, scheduleSilenceFlush],
  )

  const scheduleRecognitionRestart = useCallback(() => {
    if (!runningRef.current || pausedForLocalSpeechRef.current) return
    clearRestartTimer()
    restartTimerRef.current = setTimeout(() => {
      restartTimerRef.current = null
      if (!runningRef.current) return

      restartingRef.current = true
      const oldRec = recRef.current
      recRef.current = null
      try {
        oldRec?.abort()
      } catch {
        /* ignore */
      }

      clearListeningBuffers()
      armedRef.current = false
      clearArmedTimer()
      clearSilenceTimer()
      setLastHint(null)
      setPhase('ouvindo')

      const rec = createRecognitionInstance()
      if (!rec) return
      recRef.current = rec
      bindRecognitionHandlers(rec)

      try {
        rec.start()
      } catch {
        /* onend tenta de novo */
      } finally {
        restartingRef.current = false
      }
    }, 0)
  }, [
    bindRecognitionHandlers,
    clearArmedTimer,
    clearListeningBuffers,
    clearRestartTimer,
    clearSilenceTimer,
  ])

  useEffect(() => {
    scheduleRecognitionRestartRef.current = scheduleRecognitionRestart
  }, [scheduleRecognitionRestart])

  const disarm = useCallback(() => {
    scheduleRecognitionRestart()
  }, [scheduleRecognitionRestart])

  const cancelArmed = useCallback(() => {
    if (!armedRef.current) return
    disarm()
  }, [disarm])

  const stopRecognition = useCallback(() => {
    runningRef.current = false
    localSpeechHoldRef.current = 0
    pausedForLocalSpeechRef.current = false
    clearRestartTimer()
    recRef.current?.abort()
    recRef.current = null
    stopAudioCapture()
    clearArmedTimer()
    clearSilenceTimer()
    armedRef.current = false
    clearListeningBuffers()
    setPhase('off')
    setLastHint(null)
  }, [
    clearArmedTimer,
    clearListeningBuffers,
    clearRestartTimer,
    clearSilenceTimer,
    stopAudioCapture,
  ])

  useEffect(() => {
    stopRecognitionRef.current = stopRecognition
  }, [stopRecognition])

  const startRecognition = useCallback(async () => {
    if (pausedForLocalSpeechRef.current) return

    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) {
      onErrorRef.current?.('Reconhecimento de voz não disponível neste navegador.')
      return
    }

    if (requireVoiceMatchRef.current && voiceProfilesRef.current.length === 0) {
      onErrorRef.current?.('Cadastre pelo menos uma voz individual antes de ativar o assistente.')
      return
    }

    scheduleAudioCapture()

    recRef.current?.abort()
    const rec = createRecognitionInstance()
    if (!rec) return
    recRef.current = rec
    bindRecognitionHandlers(rec)

    runningRef.current = true
    armedRef.current = false
    clearListeningBuffers()
    setPhase('ouvindo')
    setLastHint(null)
    rec.start()
  }, [bindRecognitionHandlers, clearListeningBuffers, scheduleAudioCapture])

  const suspendForLocalSpeech = useCallback(() => {
    localSpeechHoldRef.current += 1
    if (localSpeechHoldRef.current > 1) return

    pausedForLocalSpeechRef.current = true
    clearRestartTimer()
    clearArmedTimer()
    clearSilenceTimer()
    armedRef.current = false
    restartingRef.current = false

    const oldRec = recRef.current
    recRef.current = null
    try {
      oldRec?.abort()
    } catch {
      /* ignore */
    }

    stopAudioCapture()
    setLiveText('')
    setLastHint('Microfone em uso na movimentação')
  }, [clearArmedTimer, clearRestartTimer, clearSilenceTimer, stopAudioCapture])

  const resumeAfterLocalSpeech = useCallback(() => {
    if (localSpeechHoldRef.current <= 0) return
    localSpeechHoldRef.current -= 1
    if (localSpeechHoldRef.current > 0) return

    pausedForLocalSpeechRef.current = false
    setLastHint(null)

    if (runningRef.current && enabledRef.current) {
      void startRecognition()
    }
  }, [startRecognition])

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
    cancelArmed,
    suspendForLocalSpeech,
    resumeAfterLocalSpeech,
  }
}
