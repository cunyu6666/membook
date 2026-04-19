/**
 * [WHO]: 提供 useSpeechRecognition Hook，封装浏览器Web Speech API语音识别能力
 * [FROM]: 依赖React hooks、浏览器SpeechRecognition/webkitSpeechRecognition API
 * [TO]: 被App.tsx消费，用于实时语音转文字
 * [HERE]: src/hooks/useSpeechRecognition.ts，语音识别能力封装层
 */
import { useEffect, useRef, useState } from "react";

type SpeechRecognitionConstructor = new () => SpeechRecognition;

type WindowWithSpeech = Window &
  typeof globalThis & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

type SpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

type SpeechRecognitionEvent = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: {
      transcript: string;
    };
  }>;
};

export function useSpeechRecognition(lang: string) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const SpeechApi =
    typeof window !== "undefined"
      ? (window as WindowWithSpeech).SpeechRecognition ??
        (window as WindowWithSpeech).webkitSpeechRecognition
      : undefined;

  const isSupported = Boolean(SpeechApi);

  useEffect(() => {
    if (!SpeechApi) {
      return;
    }

    const recognition = new SpeechApi();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;
    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result.isFinal) {
          finalText += result[0].transcript;
        } else {
          interimText += result[0].transcript;
        }
      }

      if (finalText) {
        setTranscript((current) => `${current}${finalText}`);
      }
      setInterimTranscript(interimText);
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
      recognitionRef.current = null;
    };
  }, [SpeechApi, lang]);

  return {
    isSupported,
    isListening,
    transcript,
    interimTranscript,
    setTranscript,
    start: () => {
      recognitionRef.current?.start();
      setIsListening(true);
    },
    stop: () => {
      recognitionRef.current?.stop();
      setIsListening(false);
    },
    reset: () => {
      setTranscript("");
      setInterimTranscript("");
    },
  };
}
