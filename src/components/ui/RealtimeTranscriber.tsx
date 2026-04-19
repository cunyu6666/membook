/**
 * [WHO]: 提供 RealtimeTranscriber 实时语音转写组件
 * [FROM]: 依赖 framer-motion, react, lib/utils
 * [TO]: 被 App.tsx 消费
 * [HERE]: src/components/ui/，实时语音交互核心组件
 */
"use client"

import { AnimatePresence, motion } from "framer-motion"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { cn } from "../../lib/utils"

type SpeechRecognitionResultLike = {
  isFinal: boolean
  0: { transcript: string }
}

type SpeechRecognitionEventLike = {
  results: {
    length: number
    [index: number]: SpeechRecognitionResultLike
  }
}

type SpeechRecognitionLike = {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

// Memoized background aura effect
const BackgroundAura = ({
  isActive,
}: {
  isActive: boolean
}) => {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 transition-opacity duration-500",
        isActive ? "opacity-100" : "opacity-0",
      )}
    >
      {/* Center bottom pool */}
      <div
        className="absolute inset-x-0 bottom-0"
        style={{
          height: "45%",
          background:
            "radial-gradient(ellipse 100% 100% at 50% 100%, oklch(var(--primary) / 0.35) 0%, oklch(var(--accent) / 0.25) 35%, transparent 70%)",
          filter: "blur(80px)",
        }}
      />
      {/* Pulsing layer */}
      <div
        className="absolute inset-x-0 bottom-0 animate-pulse"
        style={{
          height: "35%",
          background:
            "radial-gradient(ellipse 100% 100% at 50% 100%, oklch(var(--primary) / 0.3) 0%, transparent 60%)",
          filter: "blur(60px)",
          animationDuration: "4s",
        }}
      />
    </div>
  )
}

// Memoized transcript character with blur-in animation
const TranscriptCharacter = ({
  char,
  delay,
}: {
  char: string
  delay: number
}) => {
  return (
    <motion.span
      initial={{ filter: "blur(3.5px)", opacity: 0 }}
      animate={{ filter: "none", opacity: 1 }}
      transition={{ duration: 0.5, delay }}
      style={{ willChange: delay > 0 ? "filter, opacity" : "auto" }}
    >
      {char}
    </motion.span>
  )
}

// Transcript component with auto-scroll
const TranscriptDisplay = ({
  text,
  isPartial,
  isActive,
}: {
  text: string
  isPartial: boolean
  isActive: boolean
}) => {
  const scrollRef = useRef<HTMLDivElement>(null)
  const characters = useMemo(() => text.split(""), [text])
  const prevLengthRef = useRef(0)

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current && isActive) {
      const timer = setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [text, isActive])

  // Track previous length for animation delays
  useEffect(() => {
    prevLengthRef.current = characters.length
  }, [characters.length])

  return (
    <div ref={scrollRef} className="flex-1 overflow-auto px-2">
      <div className="w-full px-2 py-4">
        <div
          className={cn(
            "text-xl leading-relaxed font-light tracking-wide",
            isActive ? "text-foreground/85" : "text-muted-foreground/60",
            isPartial && "text-foreground/50",
          )}
        >
          {characters.map((char, index) => {
            const delay =
              index >= prevLengthRef.current - 10
                ? (index - (prevLengthRef.current - 10) + 1) * 0.012
                : 0
            return (
              <TranscriptCharacter key={index} char={char} delay={delay} />
            )
          })}
        </div>
      </div>
    </div>
  )
}

// Bottom recording controls
const BottomControls = ({
  isRecording,
  isMac,
  onToggle,
}: {
  isRecording: boolean
  isMac: boolean
  onToggle: () => void
}) => {
  return (
    <AnimatePresence mode="popLayout">
      {isRecording && (
        <motion.div
          key="bottom-controls"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.1 } }}
          exit={{ opacity: 0, y: 10, transition: { duration: 0.1 } }}
          className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2"
        >
          <button
            onClick={onToggle}
            className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-foreground/90 px-4 py-2.5 text-sm font-medium text-background shadow-lg transition-opacity hover:opacity-90"
          >
            <span className="h-2 w-2 rounded-full bg-red-400 animate-pulse" />
            停止录音
            <kbd className="ml-1 inline-flex h-5 items-center rounded border border-background/20 bg-background/10 px-1.5 font-mono text-xs">
              {isMac ? "⌘K" : "Ctrl+K"}
            </kbd>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

type TranscriberState = "idle" | "connecting" | "recording" | "error"

export function RealtimeTranscriber({
  onTranscript,
  onStateChange,
  isSupported,
}: {
  onTranscript: (text: string) => void
  onStateChange?: (state: TranscriberState) => void
  isSupported: boolean
}) {
  const [state, setState] = useState<TranscriberState>("idle")
  const [partialText, setPartialText] = useState("")
  const [finalText, setFinalText] = useState("")
  const [isMac, setIsMac] = useState(true)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const finalChunksRef = useRef<string[]>([])

  useEffect(() => {
    setIsMac(/(Mac|iPhone|iPod|iPad)/i.test(navigator.userAgent))
  }, [])

  const isActive = state === "recording" || state === "connecting"

  const displayText = finalText || partialText || ""
  const isPartial = Boolean(partialText && !finalText)

  const startRecording = useCallback(() => {
    if (!isSupported) return

    setState("connecting")
    finalChunksRef.current = []
    setFinalText("")
    setPartialText("")

    // Use Web Speech API for realtime transcription
    const speechWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructor
      webkitSpeechRecognition?: SpeechRecognitionConstructor
    }
    const SpeechRecognition =
      speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition

    if (!SpeechRecognition) {
      setState("error")
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = "zh-CN"

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let interim = ""
      let final = ""

      for (let i = 0; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalChunksRef.current.push(transcript)
          final = finalChunksRef.current.join("")
        } else {
          interim = finalChunksRef.current.join("") + transcript
        }
      }

      if (final) {
        setFinalText(final)
        setPartialText("")
      }
      if (interim) {
        setPartialText(interim)
      }
    }

    recognition.onerror = () => {
      setState("error")
    }

    recognition.onend = () => {
      // Auto-restart if still in recording state
      if (state === "recording") {
        try {
          recognition.start()
        } catch {
          // Already started
        }
      }
    }

    recognitionRef.current = recognition

    try {
      recognition.start()
      setState("recording")
    } catch {
      setState("error")
    }
  }, [isSupported, state])

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }

    // Commit final text
    const committedText =
      finalText || finalChunksRef.current.join("") || partialText
    if (committedText.trim()) {
      onTranscript(committedText.trim())
    }

    setFinalText("")
    setPartialText("")
    finalChunksRef.current = []
    setState("idle")
  }, [finalText, partialText, onTranscript])

  const handleToggle = useCallback(() => {
    if (state === "recording" || state === "connecting") {
      stopRecording()
    } else {
      startRecording()
    }
  }, [state, startRecording, stopRecording])

  // Cmd+K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "k" &&
        (e.metaKey || e.ctrlKey) &&
        e.target instanceof HTMLElement &&
        !["INPUT", "TEXTAREA"].includes(e.target.tagName)
      ) {
        e.preventDefault()
        handleToggle()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleToggle])

  // Notify parent of state changes
  useEffect(() => {
    onStateChange?.(state)
  }, [state, onStateChange])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
    }
  }, [])

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden">
      <BackgroundAura isActive={isActive} />

      {/* Idle state: start button */}
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center transition-opacity duration-300",
          state === "idle"
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
        )}
      >
        <div className="flex w-full max-w-sm flex-col items-center gap-5 px-6">
          <div className="text-center">
            <h2 className="text-2xl font-semibold tracking-tight">
              实时语音转写
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              点击开始录音，文字会实时显示在屏幕上
            </p>
          </div>

          <button
            onClick={startRecording}
            disabled={!isSupported}
            className="w-full rounded-xl border border-border bg-foreground/90 px-6 py-3 text-sm font-medium text-background shadow-lg transition-all hover:bg-foreground hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40"
          >
            <span className="flex items-center justify-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
              开始录音转写
              <kbd className="ml-2 inline-flex h-5 items-center rounded border border-background/20 bg-background/10 px-1.5 font-mono text-xs">
                {isMac ? "⌘K" : "Ctrl+K"}
              </kbd>
            </span>
          </button>
        </div>
      </div>

      {/* Recording state: transcript + controls */}
      <div
        className={cn(
          "absolute inset-0 flex flex-col transition-opacity duration-300",
          state === "recording"
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
        )}
      >
        {/* Status indicator */}
        <div className="flex items-center justify-center py-3">
          <div className="flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            正在听你说…
          </div>
        </div>

        {/* Transcript area */}
        <TranscriptDisplay
          text={displayText}
          isPartial={isPartial}
          isActive={isActive}
        />

        {/* Bottom controls */}
        <BottomControls
          isRecording={state === "recording"}
          isMac={isMac}
          onToggle={stopRecording}
        />
      </div>

      {/* Connecting state */}
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center transition-opacity duration-300",
          state === "connecting"
            ? "pointer-events-none opacity-100"
            : "pointer-events-none opacity-0",
        )}
      >
        <p className="text-xl font-light tracking-wide text-muted-foreground animate-pulse">
          正在连接…
        </p>
      </div>

      {/* Error state */}
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center transition-opacity duration-300",
          state === "error"
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
        )}
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="text-xl font-light tracking-wide text-red-500">
            语音识别不可用
          </p>
          <p className="text-sm text-muted-foreground">
            请使用 Chrome 浏览器，或在设置中开启语音权限。
          </p>
          <button
            onClick={() => setState("idle")}
            className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            返回
          </button>
        </div>
      </div>
    </div>
  )
}
