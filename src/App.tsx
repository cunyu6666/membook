/**
 * [WHO]: 提供 App 主应用组件，包含访谈录制、AI追问、回忆录生成的完整业务逻辑
 * [FROM]: 依赖UI组件库(Button/Card/Badge/Textarea)、自定义Hooks(useAudioRecorder/useSpeechRecognition)、
 *         客户端库(agentClient/asrClient/ttsClient/i18n/types/utils)
 * [TO]: 被 main.tsx 挂载到DOM，用户直接交互的前端界面
 * [HERE]: src/App.tsx，前端应用核心，与components/、hooks/、lib/模块直接相邻
 */
import { type ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { Badge } from "./components/ui/Badge";
import { Button } from "./components/ui/Button";
import { Card } from "./components/ui/Card";
import { Textarea } from "./components/ui/Textarea";
import { RealtimeTranscriber } from "./components/ui/RealtimeTranscriber";
import { useAudioRecorder } from "./hooks/useAudioRecorder";
import { askAgent, generateBook, getApiStatus } from "./lib/agentClient";
import { transcribeWithBailian } from "./lib/asrClient";
import { copy, type Locale } from "./lib/i18n";
import { synthesizeWithBailian } from "./lib/ttsClient";
import type {
  ApiStatus,
  BookDraft,
  InterviewSession,
  InterviewTurn,
} from "./lib/types";
import { cn } from "./lib/utils";

const defaultBailianEndpoint =
  "wss://dashscope.aliyuncs.com/api-ws/v1/inference/";
const defaultBailianTtsEndpoint =
  "wss://dashscope.aliyuncs.com/api-ws/v1/realtime";

type ConversationPhase =
  | "idle"
  | "ready"
  | "recording"
  | "transcribing"
  | "thinking"
  | "speaking"
  | "error";

type SavedMemoir = {
  id: string;
  title: string;
  updatedAt: string;
  session: InterviewSession;
  bookDraft: BookDraft | null;
};

function nowTurn(role: InterviewTurn["role"], content: string): InterviewTurn {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    createdAt: new Date().toISOString(),
  };
}

function createInitialSession(locale: Locale): InterviewSession {
  const text = copy[locale];
  return {
    id: crypto.randomUUID(),
    turns: [nowTurn("agent", text.firstQuestion)],
    insights: [
      { label: text.people, value: locale === "zh" ? "等待提及" : "Waiting" },
      { label: text.places, value: locale === "zh" ? "等待提及" : "Waiting" },
      {
        label: text.emotionalArc,
        value: locale === "zh" ? "温和开场" : "Opening gently",
      },
    ],
    readiness: 12,
  };
}

function readSavedMemoirs(): SavedMemoir[] {
  try {
    const raw = localStorage.getItem("membook.history");
    return raw ? (JSON.parse(raw) as SavedMemoir[]) : [];
  } catch {
    return [];
  }
}

export function App() {
  const [locale, setLocale] = useState<Locale>("zh");
  const [isDark, setIsDark] = useState(false);
  const t = copy[locale];
  const recorder = useAudioRecorder();
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => localStorage.getItem("membook.auth") === "admin",
  );
  const [loginError, setLoginError] = useState("");
  const [history, setHistory] = useState<SavedMemoir[]>(readSavedMemoirs);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isBookOpen, setIsBookOpen] = useState(false);
  const [typedAnswer, setTypedAnswer] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [conversationPhase, setConversationPhase] =
    useState<ConversationPhase>("idle");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [ttsAudioUrl, setTtsAudioUrl] = useState("");
  const [bookDraft, setBookDraft] = useState<BookDraft | null>(null);
  const [apiStatus, setApiStatus] = useState<ApiStatus | null>(null);
  const [bailianApiKey, setBailianApiKey] = useState(
    () => localStorage.getItem("membook.bailianApiKey") ?? "",
  );
  const [bailianEndpoint, setBailianEndpoint] = useState(
    () => localStorage.getItem("membook.bailianAsrEndpoint") ?? defaultBailianEndpoint,
  );
  const [bailianAsrModel, setBailianAsrModel] = useState(
    () =>
      localStorage.getItem("membook.bailianAsrModel") ??
      "fun-asr-realtime-2026-02-28",
  );
  const [bailianTtsEndpoint, setBailianTtsEndpoint] = useState(
    () => localStorage.getItem("membook.bailianTtsEndpoint") ?? defaultBailianTtsEndpoint,
  );
  const [bailianTtsModel, setBailianTtsModel] = useState(
    () =>
      localStorage.getItem("membook.bailianTtsModel") ??
      "qwen3-tts-instruct-flash-realtime",
  );
  const [ttsVoice, setTtsVoice] = useState(
    () => localStorage.getItem("membook.bailianTtsVoice") ?? "Cherry",
  );
  const [error, setError] = useState("");
  const [transcriberText, setTranscriberText] = useState("");
  const [session, setSession] = useState<InterviewSession>(() =>
    createInitialSession("zh"),
  );

  const answerText = typedAnswer.trim();
  const elderTurns = useMemo(
    () => session.turns.filter((turn) => turn.role === "elder"),
    [session.turns],
  );
  const latestAgentQuestion =
    [...session.turns].reverse().find((turn) => turn.role === "agent")?.content ??
    t.fallbackQuestion;
  const phaseCopy = getPhaseCopy(conversationPhase, locale);
  const isVoiceBusy =
    conversationPhase === "transcribing" ||
    conversationPhase === "thinking" ||
    conversationPhase === "speaking";
  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  useEffect(() => {
    localStorage.setItem("membook.history", JSON.stringify(history.slice(0, 20)));
  }, [history]);

  useEffect(() => {
    localStorage.setItem("membook.bailianApiKey", bailianApiKey);
  }, [bailianApiKey]);

  useEffect(() => {
    localStorage.setItem("membook.bailianAsrEndpoint", bailianEndpoint);
  }, [bailianEndpoint]);

  useEffect(() => {
    localStorage.setItem("membook.bailianAsrModel", bailianAsrModel);
  }, [bailianAsrModel]);

  useEffect(() => {
    localStorage.setItem("membook.bailianTtsEndpoint", bailianTtsEndpoint);
  }, [bailianTtsEndpoint]);

  useEffect(() => {
    localStorage.setItem("membook.bailianTtsModel", bailianTtsModel);
  }, [bailianTtsModel]);

  useEffect(() => {
    localStorage.setItem("membook.bailianTtsVoice", ttsVoice);
  }, [ttsVoice]);

  useEffect(() => {
    void getApiStatus()
      .then((status) => {
        setApiStatus(status);
        if (!localStorage.getItem("membook.bailianAsrEndpoint")) {
          setBailianEndpoint(status.asrEndpoint || defaultBailianEndpoint);
        }
        if (!localStorage.getItem("membook.bailianAsrModel")) {
          setBailianAsrModel(status.asrModel || "fun-asr-realtime-2026-02-28");
        }
        if (!localStorage.getItem("membook.bailianTtsEndpoint")) {
          setBailianTtsEndpoint(status.ttsEndpoint || defaultBailianTtsEndpoint);
        }
        if (!localStorage.getItem("membook.bailianTtsModel")) {
          setBailianTtsModel(
            status.ttsModel || "qwen3-tts-instruct-flash-realtime",
          );
        }
      })
      .catch(() => {
        setApiStatus({
          mode: "local",
          asrModel: "qwen3-asr-flash-filetrans",
          asrEndpoint: defaultBailianEndpoint,
          ttsModel: "qwen3-tts-instruct-flash-realtime",
          ttsEndpoint: defaultBailianTtsEndpoint,
        });
      });
  }, []);

  useEffect(() => {
    setSession((current) => {
      const [first, ...rest] = current.turns;
      if (rest.length > 0 || first.role !== "agent") {
        return current;
      }

      return {
        ...current,
        turns: [{ ...first, content: t.firstQuestion }],
        insights: [
          { label: t.people, value: locale === "zh" ? "等待提及" : "Waiting" },
          { label: t.places, value: locale === "zh" ? "等待提及" : "Waiting" },
          {
            label: t.emotionalArc,
            value: locale === "zh" ? "温和开场" : "Opening gently",
          },
        ],
      };
    });
  }, [locale, t.emotionalArc, t.firstQuestion, t.people, t.places]);

  useEffect(() => {
    if (!isAuthenticated || (session.turns.length <= 1 && !bookDraft)) {
      return;
    }

    const saved: SavedMemoir = {
      id: session.id,
      title: bookDraft?.title ?? makeHistoryTitle(session, locale),
      updatedAt: new Date().toISOString(),
      session,
      bookDraft,
    };
    setHistory((current) => [
      saved,
      ...current.filter((item) => item.id !== session.id),
    ].slice(0, 20));
  }, [bookDraft, isAuthenticated, locale, session]);

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const username = String(form.get("username") ?? "");
    const password = String(form.get("password") ?? "");
    if (username === "admin" && password === "12345678") {
      localStorage.setItem("membook.auth", "admin");
      setIsAuthenticated(true);
      setLoginError("");
      return;
    }

    setLoginError(locale === "zh" ? "账号或密码不对。" : "Invalid username or password.");
  }

  function handleLogout() {
    localStorage.removeItem("membook.auth");
    setIsAuthenticated(false);
    setIsCallActive(false);
    setConversationPhase("idle");
  }

  function handleNewInterview() {
    setSession(createInitialSession(locale));
    setBookDraft(null);
    setTypedAnswer("");
    setTtsAudioUrl("");
    setConversationPhase("idle");
    setIsCallActive(false);
  }

  function handleLoadHistory(item: SavedMemoir) {
    setSession(item.session);
    setBookDraft(item.bookDraft);
    setIsHistoryOpen(false);
    setIsBookOpen(Boolean(item.bookDraft));
    setTypedAnswer("");
    setConversationPhase("idle");
    setIsCallActive(false);
  }

  function handleDeleteHistory(id: string) {
    setHistory((current) => current.filter((item) => item.id !== id));
    if (session.id === id) {
      handleNewInterview();
    }
  }

  async function submitAnswerText(answer: string, shouldSpeakResponse = false) {
    const cleanAnswer = answer.trim();
    if (!cleanAnswer || isAsking) {
      return;
    }

    const elderTurn = nowTurn("elder", cleanAnswer);
    const nextSession = {
      ...session,
      turns: [...session.turns, elderTurn],
    };

    setSession(nextSession);
    setTypedAnswer("");
    setIsAsking(true);
    setConversationPhase("thinking");
    setError("");

    let questionToSpeak = "";
    try {
      const response = await askAgent(nextSession, cleanAnswer);
      questionToSpeak = response.question;
      setSession({
        ...nextSession,
        turns: [...nextSession.turns, nowTurn("agent", response.question)],
        insights: response.insights,
        readiness: response.readiness,
      });
    } catch {
      questionToSpeak = t.fallbackQuestion;
      setSession({
        ...nextSession,
        turns: [...nextSession.turns, nowTurn("agent", t.fallbackQuestion)],
        readiness: Math.min(100, nextSession.readiness + 10),
      });
      setError(t.errAgentFallback);
    } finally {
      setIsAsking(false);
    }

    if (shouldSpeakResponse && questionToSpeak) {
      await speakQuestionText(questionToSpeak);
    } else {
      setConversationPhase("ready");
    }
  }

  async function submitAnswer(event: FormEvent) {
    event.preventDefault();
    await submitAnswerText(answerText, isCallActive);
  }

  async function transcribeAudioFile(file: File) {
    if (!bailianApiKey) {
      setIsSettingsOpen(true);
      throw new Error(locale === "zh" ? "请先在设置里填写百炼 API Key。" : "Add your Bailian API key in settings first.");
    }

    setIsTranscribing(true);
    setConversationPhase("transcribing");
    setError("");
    try {
      const text = await transcribeWithBailian({
        apiKey: bailianApiKey,
        endpoint: bailianEndpoint,
        model: bailianAsrModel,
        file,
      });
      setTypedAnswer(text);
      return text;
    } catch (caught) {
      setError(
        locale === "zh"
          ? `语音转文字失败：${errorMessage(caught)}`
          : `Speech-to-text failed: ${errorMessage(caught)}`,
      );
      setConversationPhase("error");
      return "";
    } finally {
      setIsTranscribing(false);
    }
  }

  async function handleBailianTranscribe() {
    if (!recorder.audioFile || isTranscribing) {
      return;
    }

    const text = await transcribeAudioFile(recorder.audioFile);
    if (text) {
      setConversationPhase("ready");
    }
  }

  async function handleVoiceTurn(file: File) {
    const text = await transcribeAudioFile(file);
    if (!text) {
      return;
    }
    await submitAnswerText(text, true);
  }

  async function speakQuestionText(text: string) {
    if (!bailianApiKey || isSpeaking) {
      if (!bailianApiKey) {
        setIsSettingsOpen(true);
        setError(
          locale === "zh"
            ? "请先在设置里填写百炼 API Key，才能播放 AI 语音。"
            : "Add your Bailian API key in settings before voice playback.",
        );
      }
      setConversationPhase("ready");
      return;
    }

    setIsSpeaking(true);
    setConversationPhase("speaking");
    setError("");
    try {
      const audioUrl = await synthesizeWithBailian({
        apiKey: bailianApiKey,
        endpoint: bailianTtsEndpoint,
        model: bailianTtsModel,
        text,
        voice: ttsVoice,
        instructions:
          locale === "zh"
            ? "用温柔、耐心、适合老人访谈的语气朗读。语速稍慢，停顿自然。"
            : "Read warmly and patiently for an elder interview. Keep the pace slow and clear.",
      });
      setTtsAudioUrl(audioUrl);
      try {
        const audio = new Audio(audioUrl);
        await audio.play();
      } catch (playError) {
        setError(
          locale === "zh"
            ? `音频已生成，请点击播放器手动播放。自动播放提示：${errorMessage(playError)}`
            : `Audio ready. Tap the player to listen. Autoplay note: ${errorMessage(playError)}`,
        );
      }
    } catch (caught) {
      setError(
        locale === "zh"
          ? `朗读失败：${errorMessage(caught)}`
          : `Voice reading failed: ${errorMessage(caught)}`,
      );
    } finally {
      setIsSpeaking(false);
      setConversationPhase("ready");
    }
  }

  async function handleSpeakQuestion() {
    await speakQuestionText(latestAgentQuestion);
  }

  async function handleTranscriberSubmit(text: string) {
    if (text.trim()) {
      await submitAnswerText(text.trim(), isCallActive);
    }
  }

  async function handleCallButton() {
    if (!isCallActive) {
      setIsCallActive(true);
      setConversationPhase("ready");
      await speakQuestionText(latestAgentQuestion);
      return;
    }

    if (recorder.isRecording) {
      setConversationPhase("transcribing");
      const file = recorder.stop();
      if (file) {
        await handleVoiceTurn(file);
      }
      return;
    }

    if (isVoiceBusy) {
      return;
    }

    if (!bailianApiKey) {
      setIsSettingsOpen(true);
      setError(
        locale === "zh"
          ? "请先在设置里填写百炼 API Key，然后就可以像打电话一样对话。"
          : "Add your Bailian API key first, then the call flow can run voice-to-voice.",
      );
      return;
    }

    setError("");
    setTtsAudioUrl("");
    setConversationPhase("recording");
    try {
      await recorder.start();
    } catch (caught) {
      setConversationPhase("error");
      setError(
        locale === "zh"
          ? `无法打开麦克风：${errorMessage(caught)}`
          : `Could not open microphone: ${errorMessage(caught)}`,
      );
    }
  }

  async function handleGenerateBook() {
    setIsGenerating(true);
    setError("");

    try {
      const draft = await generateBook(session);
      setBookDraft(draft);
      setIsBookOpen(true);
    } catch {
      setBookDraft({
        title: t.bookFallbackTitle,
        subtitle: t.bookFallbackSub,
        soulSentence: locale === "zh" ? "那些慢慢说出的日子，会被家人记住。" : "The days told slowly can be kept.",
        chapters: [
          {
            title: t.bookChapter1,
            summary: elderTurns[0]?.content ?? t.emptyTranscript,
            contentMarkdown: `# ${t.bookChapter1}\n\n${elderTurns[0]?.content ?? t.emptyTranscript}`,
          },
          {
            title: t.bookChapter2,
            summary: t.bookWaiting,
            contentMarkdown: `# ${t.bookChapter2}\n\n${t.bookWaiting}`,
          },
        ],
        excerpt:
          elderTurns.map((turn) => turn.content).join("\n\n") ||
          t.emptyTranscript,
      });
      setIsBookOpen(true);
      setError(t.errBookFallback);
    } finally {
      setIsGenerating(false);
    }
  }

  if (!isAuthenticated) {
    return (
      <LoginScreen
        locale={locale}
        isDark={isDark}
        error={loginError}
        onLogin={handleLogin}
        onToggleTheme={() => setIsDark((value) => !value)}
        onToggleLocale={() => setLocale(locale === "zh" ? "en" : "zh")}
      />
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-4 sm:px-5 lg:h-screen">
      {/* Starlight ambient accents */}
      <div className="pointer-events-none absolute left-1/4 top-0 h-80 w-80 -translate-x-1/2 rounded-full bg-primary/8 blur-3xl" />
      <div className="pointer-events-none absolute right-1/4 top-1/4 h-60 w-60 rounded-full bg-accent/8 blur-3xl" />

      <div className="relative mx-auto grid h-full max-w-7xl gap-4 lg:grid-cols-[0.78fr_1.08fr_0.92fr]">
        {/* Left panel: Brand & status */}
        <Card className="animate-rise-in flex min-h-0 flex-col gap-4 p-4">
          <header className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/10">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-primary"
                >
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </div>
              <div>
                <p className="text-lg font-bold">{t.appName}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="icon"
                aria-label={locale === "zh" ? "历史" : "History"}
                onClick={() => setIsHistoryOpen(true)}
              >
                <i className="ri-history-line" />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                aria-label={locale === "zh" ? "新访谈" : "New interview"}
                onClick={handleNewInterview}
              >
                <i className="ri-add-line" />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                aria-label={t.theme}
                onClick={() => setIsDark((value) => !value)}
              >
                <i className={isDark ? "ri-sun-line" : "ri-moon-line"} />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                aria-label={t.settings}
                onClick={() => setIsSettingsOpen(true)}
              >
                <i className="ri-settings-3-line" />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                aria-label={locale === "zh" ? "退出登录" : "Log out"}
                onClick={handleLogout}
              >
                <i className="ri-logout-box-r-line" />
              </Button>
            </div>
          </header>

          <section className="rounded-[1.75rem] bg-gradient-to-br from-primary to-accent p-5 text-background">
            <Badge className="border-background/20 bg-background/10 text-background/80">
              {t.compactHint}
            </Badge>
            <h1 className="mt-5 text-3xl font-bold leading-[0.92] tracking-[-0.04em] text-background">
              {t.heroTitle}
            </h1>
            <p className="mt-3 text-sm leading-6 text-background/75">
              {t.heroBody}
            </p>
          </section>

          {/* Connection status */}
          <section className="space-y-3">
            <div className="rounded-3xl border border-border bg-background/42 p-3">
              <ConnectionLine
                items={[
                  { label: t.connService, active: Boolean(apiStatus) },
                  {
                    label: t.connAssistant,
                    active: apiStatus?.mode === "rpc" || apiStatus?.mode === "acp",
                  },
                  { label: t.connRecognition, active: Boolean(bailianApiKey && bailianEndpoint) },
                  {
                    label: t.connReading,
                    active: Boolean(bailianApiKey && bailianTtsEndpoint),
                  },
                  {
                    label: locale === "zh" ? "成书" : "Book",
                    active: Boolean(apiStatus?.memoirPipeline),
                  },
                ]}
              />
            </div>
          </section>

          {/* Metrics */}
          <div className="mt-auto grid grid-cols-3 gap-2">
            <Metric label={t.readiness} value={`${session.readiness}%`} />
            <Metric label={t.rawMaterial} value={`${elderTurns.length}`} />
            <Metric label={locale === "zh" ? "对话" : "turns"} value={`${session.turns.length}`} />
          </div>
        </Card>

        {/* Center panel: voice-first call */}
        <Card className="animate-rise-in flex min-h-0 flex-col overflow-hidden p-4 [animation-delay:100ms]">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <Badge>{isCallActive ? phaseCopy.badge : t.agent}</Badge>
              <h2 className="mt-3 font-serif-cn text-xl font-bold leading-snug tracking-tight lg:text-2xl">
                {latestAgentQuestion}
              </h2>
            </div>
            <Button
              variant="secondary"
              size="icon"
              disabled={!bailianApiKey || isSpeaking}
              onClick={handleSpeakQuestion}
              aria-label={t.playQuestion}
            >
              <i className={isSpeaking ? "ri-loader-4-line animate-spin" : "ri-volume-up-line"} />
            </Button>
          </div>

          <section className="relative mt-4 flex-1 overflow-hidden rounded-[2rem] border border-border">
            <RealtimeTranscriber
              onTranscript={handleTranscriberSubmit}
              isSupported={recorder.isSupported}
              bailianApiKey={bailianApiKey}
            />
          </section>

          {ttsAudioUrl && (
            <audio className="mt-3 w-full" src={ttsAudioUrl} controls />
          )}

          <form className="mt-3 grid gap-2" onSubmit={submitAnswer}>
            <Textarea
              className="h-20 rounded-[1.25rem] text-sm leading-6"
              value={typedAnswer}
              onChange={(event) => setTypedAnswer(event.target.value)}
              placeholder={t.placeholder}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 flex-1 gap-2">
                <input
                  className="min-w-0 flex-1 rounded-2xl border border-border bg-card/60 px-3 py-2 text-xs"
                  type="file"
                  accept="audio/*"
                  onChange={(event) =>
                    recorder.setAudioFile(event.target.files?.[0] ?? null)
                  }
                  aria-label={t.uploadAudio}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={!recorder.audioFile || !bailianApiKey || isTranscribing}
                  onClick={handleBailianTranscribe}
                >
                  {isTranscribing ? (
                    <i className="ri-loader-4-line animate-spin" />
                  ) : (
                    <i className="ri-text" />
                  )}
                  {t.transcribe}
                </Button>
              </div>
              <Button type="submit" size="sm" disabled={!answerText || isAsking}>
                {isAsking ? (
                  <i className="ri-loader-4-line animate-spin" />
                ) : (
                  <i className="ri-send-plane-2-line" />
                )}
                {locale === "zh" ? "文字发送" : "Send text"}
              </Button>
            </div>
          </form>
        </Card>

        {/* Right panel: Transcript & Book */}
        <section className="grid min-h-0 gap-4">
          <Card className="animate-rise-in flex min-h-0 flex-col p-4 [animation-delay:180ms]">
            <div className="flex items-center justify-between gap-4">
              <Badge>{t.transcript}</Badge>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleGenerateBook}
                disabled={isGenerating || elderTurns.length === 0}
              >
                {isGenerating ? (
                  <i className="ri-loader-4-line animate-spin" />
                ) : (
                  <i className="ri-book-3-line" />
                )}
                {t.generate}
              </Button>
            </div>
            <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-auto pr-1">
              {session.turns.length === 1 ? (
                <p className="rounded-3xl bg-muted/24 p-4 text-sm text-muted-foreground">
                  {t.emptyTranscript}
                </p>
              ) : (
                session.turns.slice(-8).map((turn) => (
                  <article
                    key={turn.id}
                    className={cn(
                      "rounded-3xl p-3 text-sm leading-6",
                      turn.role === "agent"
                        ? "border border-border bg-background/48 text-muted-foreground"
                        : "bg-foreground text-background",
                    )}
                  >
                    <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-[0.14em] opacity-70">
                      {turn.role === "agent"
                        ? locale === "zh"
                          ? "助手"
                          : "Guide"
                        : locale === "zh"
                          ? "长辈"
                          : "Elder"}
                    </p>
                    {turn.content}
                  </article>
                ))
              )}
            </div>
          </Card>

          <Card className="animate-rise-in min-h-0 p-4 [animation-delay:260ms]">
            <div className="flex items-center justify-between gap-3">
              <Badge>{bookDraft ? t.bookReady : t.chapterPlan}</Badge>
              {bookDraft && (
                <Button variant="secondary" size="sm" onClick={() => setIsBookOpen(true)}>
                  <i className="ri-book-open-line" />
                  {locale === "zh" ? "打开书" : "Open"}
                </Button>
              )}
            </div>
            {bookDraft ? (
              <div className="mt-3 max-h-64 space-y-3 overflow-auto pr-1">
                <div>
                  <h3 className="font-serif-cn text-2xl font-bold">
                    {bookDraft.title}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {bookDraft.subtitle}
                  </p>
                  {bookDraft.pipeline && (
                    <p className="mt-2 rounded-full border border-border bg-background/44 px-3 py-1 text-xs text-muted-foreground">
                      {bookDraft.pipeline.package}@{bookDraft.pipeline.version} · {bookDraft.pipeline.mode}
                    </p>
                  )}
                </div>
                {bookDraft.chapters.slice(0, 3).map((chapter) => (
                  <div
                    key={chapter.title}
                    className="rounded-3xl border border-border bg-background/42 p-3"
                  >
                    <p className="font-semibold">{chapter.title}</p>
                    <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
                      {chapter.summary}
                    </p>
                  </div>
                ))}
                <Button className="w-full" onClick={() => setIsBookOpen(true)}>
                  <i className="ri-book-open-line" />
                  {locale === "zh" ? "进入拟真翻页阅读" : "Read as a book"}
                </Button>
              </div>
            ) : (
              <div className="mt-3 grid gap-2">
                {session.insights.map((insight) => (
                  <div
                    key={insight.label}
                    className="rounded-3xl border border-border bg-background/42 p-3"
                  >
                    <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      {insight.label}
                    </p>
                    <p className="mt-1 text-sm font-semibold">{insight.value}</p>
                  </div>
                ))}
                <div className="h-2 overflow-hidden rounded-full bg-muted/40">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${session.readiness}%` }}
                  />
                </div>
              </div>
            )}
            {error && (
              <p className="mt-3 rounded-2xl bg-primary/10 p-3 text-sm text-primary">
                {error}
              </p>
            )}
          </Card>
        </section>
      </div>

      {isHistoryOpen && (
        <HistoryDialog
          history={history}
          locale={locale}
          onClose={() => setIsHistoryOpen(false)}
          onLoad={handleLoadHistory}
          onDelete={handleDeleteHistory}
          onNew={handleNewInterview}
        />
      )}

      {bookDraft && isBookOpen && (
        <BookReader
          book={bookDraft}
          locale={locale}
          onClose={() => setIsBookOpen(false)}
        />
      )}

      {/* Settings dialog */}
      {isSettingsOpen && (
        <SettingsDialog
          apiStatus={apiStatus}
          bailianApiKey={bailianApiKey}
          bailianEndpoint={bailianEndpoint}
          bailianAsrModel={bailianAsrModel}
          bailianTtsEndpoint={bailianTtsEndpoint}
          bailianTtsModel={bailianTtsModel}
          ttsVoice={ttsVoice}
          isDark={isDark}
          locale={locale}
          t={t}
          onClose={() => setIsSettingsOpen(false)}
          onToggleTheme={() => setIsDark((value) => !value)}
          onToggleLocale={() => setLocale(locale === "zh" ? "en" : "zh")}
          onBailianApiKeyChange={setBailianApiKey}
          onBailianEndpointChange={setBailianEndpoint}
          onBailianAsrModelChange={setBailianAsrModel}
          onBailianTtsEndpointChange={setBailianTtsEndpoint}
          onBailianTtsModelChange={setBailianTtsModel}
          onTtsVoiceChange={setTtsVoice}
          onResetVoiceDefaults={() => {
            setBailianEndpoint(defaultBailianEndpoint);
            setBailianAsrModel("fun-asr-realtime-2026-02-28");
            setBailianTtsEndpoint(defaultBailianTtsEndpoint);
            setBailianTtsModel("qwen3-tts-instruct-flash-realtime");
            setTtsVoice("Cherry");
          }}
        />
      )}
    </main>
  );
}

function LoginScreen({
  locale,
  isDark,
  error,
  onLogin,
  onToggleTheme,
  onToggleLocale,
}: {
  locale: Locale;
  isDark: boolean;
  error: string;
  onLogin: (event: FormEvent<HTMLFormElement>) => void;
  onToggleTheme: () => void;
  onToggleLocale: () => void;
}) {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-4 py-6">
      <div className="pointer-events-none absolute left-1/2 top-10 h-80 w-80 -translate-x-1/2 rounded-full bg-primary/14 blur-3xl" />
      <Card className="relative z-10 w-full max-w-md p-5">
        <div className="flex items-center justify-between">
          <Badge>{locale === "zh" ? "管理员登录" : "Admin login"}</Badge>
          <div className="flex gap-2">
            <Button variant="secondary" size="icon" onClick={onToggleLocale}>
              <i className="ri-translate-2" />
            </Button>
            <Button variant="secondary" size="icon" onClick={onToggleTheme}>
              <i className={isDark ? "ri-sun-line" : "ri-moon-line"} />
            </Button>
          </div>
        </div>
        <h1 className="mt-6 font-serif-cn text-4xl font-bold tracking-[-0.05em]">
          {locale === "zh" ? "星光回忆录工作台" : "Starlight Memoir Studio"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {locale === "zh"
            ? "暂时锁定单管理员账号：admin / 12345678。登录后可管理访谈历史和回忆录。"
            : "Temporary single admin account: admin / 12345678. Sign in to manage sessions and books."}
        </p>
        <form className="mt-6 grid gap-3" onSubmit={onLogin}>
          <Field
            label={locale === "zh" ? "账号" : "Username"}
            name="username"
            value={undefined}
            placeholder="admin"
          />
          <Field
            label={locale === "zh" ? "密码" : "Password"}
            name="password"
            type="password"
            value={undefined}
            placeholder="12345678"
          />
          {error && (
            <p className="rounded-2xl bg-primary/10 p-3 text-sm text-primary">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" className="mt-2">
            <i className="ri-login-circle-line" />
            {locale === "zh" ? "进入工作台" : "Enter studio"}
          </Button>
        </form>
      </Card>
    </main>
  );
}

function HistoryDialog({
  history,
  locale,
  onClose,
  onLoad,
  onDelete,
  onNew,
}: {
  history: SavedMemoir[];
  locale: Locale;
  onClose: () => void;
  onLoad: (item: SavedMemoir) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/36 px-4 backdrop-blur-xl">
      <div className="max-h-[88vh] w-full max-w-3xl overflow-auto rounded-[2rem] border border-border bg-card p-5 shadow-[0_32px_120px_hsl(220_30%_4%/0.28)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Badge>{locale === "zh" ? "历史管理" : "History"}</Badge>
            <h3 className="mt-3 text-2xl font-bold tracking-[-0.04em]">
              {locale === "zh" ? "访谈与回忆录历史" : "Sessions and memoirs"}
            </h3>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                onNew();
                onClose();
              }}
            >
              <i className="ri-add-line" />
              {locale === "zh" ? "新建" : "New"}
            </Button>
            <Button variant="secondary" size="icon" onClick={onClose}>
              <i className="ri-close-line" />
            </Button>
          </div>
        </div>
        <div className="mt-5 grid gap-3">
          {history.length === 0 ? (
            <p className="rounded-3xl border border-border bg-background/44 p-5 text-sm text-muted-foreground">
              {locale === "zh" ? "还没有历史记录。完成一次访谈或生成书稿后会自动保存。" : "No history yet. Sessions are saved after an interview or book generation."}
            </p>
          ) : (
            history.map((item) => (
              <article
                key={item.id}
                className="grid gap-3 rounded-3xl border border-border bg-background/44 p-4 sm:grid-cols-[1fr_auto]"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">{item.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(item.updatedAt).toLocaleString()} · {item.session.turns.length} turns · {item.bookDraft ? (locale === "zh" ? "已有书稿" : "Book ready") : (locale === "zh" ? "未成书" : "No book yet")}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => onLoad(item)}>
                    <i className="ri-folder-open-line" />
                    {locale === "zh" ? "打开" : "Open"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => onDelete(item.id)}>
                    <i className="ri-delete-bin-line" />
                  </Button>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function BookReader({
  book,
  locale,
  onClose,
}: {
  book: BookDraft;
  locale: Locale;
  onClose: () => void;
}) {
  const pages = buildBookPages(book, locale);
  const [pageIndex, setPageIndex] = useState(0);
  const left = pages[pageIndex];
  const right = pages[pageIndex + 1];

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-[radial-gradient(circle_at_50%_18%,hsl(var(--primary)/0.18),transparent_30rem),hsl(var(--foreground)/0.42)] px-4 py-5 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        <Badge className="bg-card/80">
          {book.pipeline
            ? `${book.pipeline.package}@${book.pipeline.version}`
            : locale === "zh"
              ? "回忆录"
              : "Memoir"}
        </Badge>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPageIndex((value) => Math.max(0, value - 2))}
            disabled={pageIndex === 0}
          >
            <i className="ri-arrow-left-s-line" />
            {locale === "zh" ? "上一页" : "Previous"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPageIndex((value) => Math.min(pages.length - 1, value + 2))}
            disabled={pageIndex >= pages.length - 2}
          >
            {locale === "zh" ? "下一页" : "Next"}
            <i className="ri-arrow-right-s-line" />
          </Button>
          <Button variant="secondary" size="icon" onClick={onClose}>
            <i className="ri-close-line" />
          </Button>
        </div>
      </div>

      <div className="mx-auto mt-5 max-w-6xl [perspective:1800px]">
        <div className="relative grid min-h-[72vh] gap-0 rounded-[2rem] bg-[#3b261a] p-4 shadow-[0_42px_140px_hsl(25_30%_4%/0.45)] md:grid-cols-2">
          <BookPage page={left} side="left" />
          <BookPage page={right} side="right" />
          <div className="pointer-events-none absolute inset-y-4 left-1/2 hidden w-8 -translate-x-1/2 bg-gradient-to-r from-black/24 via-white/16 to-black/24 blur-sm md:block" />
        </div>
      </div>
    </div>
  );
}

function BookPage({
  page,
  side,
}: {
  page?: { title: string; body: string; kind: "cover" | "toc" | "chapter" | "back" };
  side: "left" | "right";
}) {
  if (!page) {
    return <div className="hidden md:block" />;
  }

  return (
    <section
      className={cn(
        "relative min-h-[34rem] overflow-hidden bg-[#f8efd9] p-8 text-[#332414] shadow-inner",
        side === "left"
          ? "rounded-l-[1.5rem] md:[transform:rotateY(2deg)]"
          : "rounded-r-[1.5rem] md:[transform:rotateY(-2deg)]",
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.58),transparent_18rem),linear-gradient(90deg,rgba(0,0,0,0.12),transparent_12%,transparent_88%,rgba(0,0,0,0.08))]" />
      <div className="relative z-10 h-full">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[#8b6041]">
          {page.kind}
        </p>
        <h2 className="mt-4 font-serif-cn text-3xl font-bold leading-tight tracking-[-0.04em]">
          {page.title}
        </h2>
        <div className="mt-6 whitespace-pre-wrap font-serif-cn text-[1.02rem] leading-8">
          {page.body}
        </div>
      </div>
    </section>
  );
}

function makeHistoryTitle(session: InterviewSession, locale: Locale) {
  const firstAnswer = session.turns.find((turn) => turn.role === "elder")?.content;
  if (!firstAnswer) {
    return locale === "zh" ? "新的访谈" : "New interview";
  }
  return firstAnswer.slice(0, 18) + (firstAnswer.length > 18 ? "..." : "");
}

function buildBookPages(book: BookDraft, locale: Locale) {
  const toc = book.chapters
    .map((chapter, index) => `${index + 1}. ${chapter.title}`)
    .join("\n");
  return [
    {
      kind: "cover" as const,
      title: book.title,
      body: [book.subtitle, book.soulSentence].filter(Boolean).join("\n\n"),
    },
    {
      kind: "toc" as const,
      title: locale === "zh" ? "目录" : "Contents",
      body: toc,
    },
    ...book.chapters.map((chapter) => ({
      kind: "chapter" as const,
      title: chapter.title,
      body: markdownToPlainText(chapter.contentMarkdown || chapter.summary),
    })),
    {
      kind: "back" as const,
      title: locale === "zh" ? "留给家人的话" : "For the family",
      body: book.excerpt || book.soulSentence || "",
    },
  ];
}

function markdownToPlainText(markdown: string) {
  return markdown
    .replace(/^#\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/^---[\s\S]*$/m, "")
    .trim();
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function getPhaseCopy(phase: ConversationPhase, locale: Locale) {
  const zh: Record<
    ConversationPhase,
    { badge: string; status: string; action: string; title: string; description: string }
  > = {
    idle: {
      badge: "语音通话",
      status: "等待开始",
      action: "开始通话",
      title: "像打电话一样聊回忆",
      description: "点击电话按钮后，AI 会先把问题读给老人听。",
    },
    ready: {
      badge: "轮到您说",
      status: "可以说话",
      action: "开始录音",
      title: "现在轮到您说",
      description: "点一下麦克风开始说，讲完再点一次，系统会自动识别并追问。",
    },
    recording: {
      badge: "正在听",
      status: "正在听你说",
      action: "停止录音",
      title: "我在听，慢慢说",
      description: "讲完这一段后点停止，不需要再点转文字或发送。",
    },
    transcribing: {
      badge: "识别中",
      status: "正在转成文字",
      action: "正在识别",
      title: "正在整理刚才的话",
      description: "语音正在交给百炼识别，完成后会自动发送给访谈助手。",
    },
    thinking: {
      badge: "思考中",
      status: "AI 正在思考下一问",
      action: "正在思考",
      title: "正在想一个更贴近的追问",
      description: "本地 nanoPencil agent 正在根据刚才的回答组织下一句。",
    },
    speaking: {
      badge: "朗读中",
      status: "正在朗读回复",
      action: "正在朗读",
      title: "AI 正在说话",
      description: "请听完这一句，再继续回答。若浏览器拦截自动播放，下方播放器可手动播放。",
    },
    error: {
      badge: "需要处理",
      status: "刚才这步失败了",
      action: "重新开始",
      title: "这一步没有走通",
      description: "检查设置里的 API Key、麦克风权限或网络后，可以重新录一段。",
    },
  };

  const en: typeof zh = {
    idle: {
      badge: "Voice call",
      status: "Waiting to start",
      action: "Start call",
      title: "Talk like a phone call",
      description: "Tap the phone button and the guide will read the first question aloud.",
    },
    ready: {
      badge: "Your turn",
      status: "Ready for your voice",
      action: "Start recording",
      title: "Your turn to speak",
      description: "Tap the mic, speak naturally, then tap again. The rest runs automatically.",
    },
    recording: {
      badge: "Listening",
      status: "Listening to you",
      action: "Stop recording",
      title: "I am listening",
      description: "When this memory is complete, stop recording. No extra send step is needed.",
    },
    transcribing: {
      badge: "Transcribing",
      status: "Converting speech to text",
      action: "Transcribing",
      title: "Turning voice into text",
      description: "Bailian ASR is processing the audio and will send it to the guide automatically.",
    },
    thinking: {
      badge: "Thinking",
      status: "AI is preparing the next question",
      action: "Thinking",
      title: "Preparing a better follow-up",
      description: "The local nanoPencil agent is reading the answer and choosing the next prompt.",
    },
    speaking: {
      badge: "Speaking",
      status: "Reading the response",
      action: "Speaking",
      title: "The guide is speaking",
      description: "Listen first, then continue. If autoplay is blocked, use the player below.",
    },
    error: {
      badge: "Needs attention",
      status: "The last step failed",
      action: "Try again",
      title: "This step did not complete",
      description: "Check the API key, microphone permission, or network, then record again.",
    },
  };

  return locale === "zh" ? zh[phase] : en[phase];
}

function getCallSteps(locale: Locale) {
  return locale === "zh"
    ? [
        { phase: "recording" as ConversationPhase, label: "倾听" },
        { phase: "transcribing" as ConversationPhase, label: "识别" },
        { phase: "thinking" as ConversationPhase, label: "思考" },
        { phase: "speaking" as ConversationPhase, label: "朗读" },
      ]
    : [
        { phase: "recording" as ConversationPhase, label: "Listen" },
        { phase: "transcribing" as ConversationPhase, label: "ASR" },
        { phase: "thinking" as ConversationPhase, label: "Think" },
        { phase: "speaking" as ConversationPhase, label: "Speak" },
      ];
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background/44 p-3">
      <p className="truncate text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 truncate text-lg font-bold">{value}</p>
    </div>
  );
}

function SettingsDialog({
  apiStatus,
  bailianApiKey,
  bailianEndpoint,
  bailianAsrModel,
  bailianTtsEndpoint,
  bailianTtsModel,
  ttsVoice,
  isDark,
  t,
  locale,
  onClose,
  onToggleTheme,
  onToggleLocale,
  onBailianApiKeyChange,
  onBailianEndpointChange,
  onBailianAsrModelChange,
  onBailianTtsEndpointChange,
  onBailianTtsModelChange,
  onTtsVoiceChange,
  onResetVoiceDefaults,
}: {
  apiStatus: ApiStatus | null;
  bailianApiKey: string;
  bailianEndpoint: string;
  bailianAsrModel: string;
  bailianTtsEndpoint: string;
  bailianTtsModel: string;
  ttsVoice: string;
  isDark: boolean;
  locale: Locale;
  t: (typeof copy)[Locale];
  onClose: () => void;
  onToggleTheme: () => void;
  onToggleLocale: () => void;
  onBailianApiKeyChange: (value: string) => void;
  onBailianEndpointChange: (value: string) => void;
  onBailianAsrModelChange: (value: string) => void;
  onBailianTtsEndpointChange: (value: string) => void;
  onBailianTtsModelChange: (value: string) => void;
  onTtsVoiceChange: (value: string) => void;
  onResetVoiceDefaults: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/36 px-4 backdrop-blur-xl">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-auto rounded-[2rem] border border-border bg-card p-5 shadow-[0_32px_120px_hsl(220_30%_4%/0.28)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Badge>{t.settingsTitle}</Badge>
            <h3 className="mt-3 text-2xl font-bold tracking-[-0.04em]">
              {t.settingsTitle}
            </h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {t.settingsDesc}
            </p>
          </div>
          <Button variant="secondary" size="icon" onClick={onClose} aria-label={t.close}>
            <i className="ri-close-line" />
          </Button>
        </div>

        <div className="mt-5 grid gap-4">
          {/* Connection status */}
          <div className="rounded-3xl border border-border bg-background/42 p-3">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {t.connectionStatus}
            </p>
            <ConnectionLine
              items={[
                { label: t.connService, active: Boolean(apiStatus) },
                {
                  label: t.connAssistant,
                  active: apiStatus?.mode === "rpc" || apiStatus?.mode === "acp",
                },
                { label: t.connRecognition, active: Boolean(bailianApiKey && bailianEndpoint) },
                { label: t.connReading, active: Boolean(bailianApiKey && bailianTtsEndpoint) },
                { label: locale === "zh" ? "成书" : "Book", active: Boolean(apiStatus?.memoirPipeline) },
              ]}
            />
          </div>

          {/* Interface controls */}
          <div className="rounded-3xl border border-border bg-background/42 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {t.interface}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={onToggleLocale}>
                {t.language}
              </Button>
              <Button variant="secondary" size="sm" onClick={onToggleTheme}>
                <i className={isDark ? "ri-sun-line" : "ri-moon-line"} />
                {t.theme}
              </Button>
              <Button variant="secondary" size="sm" onClick={onResetVoiceDefaults}>
                {locale === "zh" ? "恢复语音默认" : "Reset voice"}
              </Button>
            </div>
          </div>

          {/* Service key */}
          <Field
            label={t.bailianKey}
            type="password"
            value={bailianApiKey}
            placeholder={t.bailianKeyPlaceholder}
            onChange={onBailianApiKeyChange}
          />

          {/* Recognition */}
          <div className="grid gap-3 sm:grid-cols-[1fr_0.72fr]">
            <Field
              label={t.bailianEndpoint}
              value={bailianEndpoint}
              onChange={onBailianEndpointChange}
            />
            <Field
              label={t.asrModel}
              value={bailianAsrModel}
              onChange={onBailianAsrModelChange}
            />
          </div>

          {/* Voice reading */}
          <div className="grid gap-3 sm:grid-cols-[1fr_0.72fr]">
            <Field
              label={t.ttsEndpoint}
              value={bailianTtsEndpoint}
              onChange={onBailianTtsEndpointChange}
            />
            <Field
              label={t.ttsModel}
              value={bailianTtsModel}
              onChange={onBailianTtsModelChange}
            />
          </div>

          <Field label={t.ttsVoice} value={ttsVoice} onChange={onTtsVoiceChange} />
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  name,
  type = "text",
  placeholder,
}: {
  label: string;
  value?: string;
  onChange?: (value: string) => void;
  name?: string;
  type?: string;
  placeholder?: string;
}) {
  const controlledProps =
    value === undefined
      ? {}
      : {
          value,
          onChange: (event: ChangeEvent<HTMLInputElement>) =>
            onChange?.(event.target.value),
        };

  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      <input
        className="h-11 w-full rounded-2xl border border-border bg-background/70 px-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
        name={name}
        type={type}
        placeholder={placeholder}
        {...controlledProps}
      />
    </label>
  );
}

function ConnectionLine({
  items,
}: {
  items: Array<{ label: string; active: boolean }>;
}) {
  return (
    <div className="flex items-center">
      {items.map((item, index) => (
        <div key={item.label} className="flex flex-1 items-center">
          <div className="flex min-w-0 flex-col items-center gap-1">
            <span
              className={cn(
                "h-3 w-3 rounded-full ring-4 transition-colors",
                item.active
                  ? "bg-accent ring-accent/15"
                  : "bg-muted ring-muted/20",
              )}
            />
            <span className="max-w-16 truncate text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {item.label}
            </span>
          </div>
          {index < items.length - 1 && (
            <div
              className={cn(
                "mx-2 h-px flex-1 transition-colors",
                item.active && items[index + 1]?.active
                  ? "bg-accent"
                  : "bg-border",
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}
