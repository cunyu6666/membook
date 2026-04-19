/**
 * [WHO]: 访谈录制工作台主页面（状态管理 + 面板组装）
 * [FROM]: 依赖 hooks、lib 模块、面板子组件
 * [TO]: 被 App.tsx 的路由挂载
 */
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { BookReader } from "./components/pages/BookReader";
import { HistoryDialog, SettingsDialog, ImportDialog } from "./components/pages/BookReader";
import { StudioLeftPanel } from "./components/pages/StudioLeftPanel";
import { StudioCenterPanel } from "./components/pages/StudioCenterPanel";
import { StudioRightPanel } from "./components/pages/StudioRightPanel";
import { useAudioRecorder } from "./hooks/useAudioRecorder";
import { askAgent, generateBook, getApiStatus } from "./lib/agentClient";
import { transcribeWithBailian } from "./lib/asrClient";
import { copy, type Locale } from "./lib/i18n";
import { synthesizeWithBailian } from "./lib/ttsClient";
import type { ApiStatus, BookDraft, InterviewSession, InterviewTurn } from "./lib/types";
import type { SavedMemoir } from "./lib/session";
import { nowTurn, createInitialSession, readSavedMemoirs, makeHistoryTitle } from "./lib/session";
import type { ConversationPhase } from "./lib/phaseCopy";
import { getPhaseCopy, getPhaseProgress } from "./lib/phaseCopy";

const defaultBailianEndpoint = "wss://dashscope.aliyuncs.com/api-ws/v1/inference/";
const defaultBailianTtsEndpoint = "wss://dashscope.aliyuncs.com/api-ws/v1/realtime";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

/* ─── Main Studio Page ─── */
export function StudioPage({ onLogout }: { onLogout: () => void }) {
  const [locale, setLocale] = useState<Locale>("zh");
  const [isDark, setIsDark] = useState(false);
  const t = copy[locale];
  const recorder = useAudioRecorder();
  const [history, setHistory] = useState<SavedMemoir[]>(readSavedMemoirs);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isBookOpen, setIsBookOpen] = useState(false);
  const [typedAnswer, setTypedAnswer] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [conversationPhase, setConversationPhase] = useState<ConversationPhase>("idle");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [, setTtsAudioUrl] = useState("");
  const [bookDraft, setBookDraft] = useState<BookDraft | null>(null);
  const [apiStatus, setApiStatus] = useState<ApiStatus | null>(null);
  const [bailianApiKey, setBailianApiKey] = useState(() => localStorage.getItem("membook.bailianApiKey") ?? "");
  const [bailianEndpoint, setBailianEndpoint] = useState(() => localStorage.getItem("membook.bailianAsrEndpoint") ?? defaultBailianEndpoint);
  const [bailianAsrModel, setBailianAsrModel] = useState(() => localStorage.getItem("membook.bailianAsrModel") ?? "fun-asr-realtime-2026-02-28");
  const [bailianTtsEndpoint, setBailianTtsEndpoint] = useState(() => localStorage.getItem("membook.bailianTtsEndpoint") ?? defaultBailianTtsEndpoint);
  const [bailianTtsModel, setBailianTtsModel] = useState(() => localStorage.getItem("membook.bailianTtsModel") ?? "qwen3-tts-instruct-flash-realtime");
  const [ttsVoice, setTtsVoice] = useState(() => localStorage.getItem("membook.bailianTtsVoice") ?? "Cherry");
  const [error, setError] = useState("");
  const [session, setSession] = useState<InterviewSession>(() => createInitialSession("zh"));

  const answerText = typedAnswer.trim();
  const elderTurns = useMemo(() => session.turns.filter((turn) => turn.role === "elder"), [session.turns]);
  const latestAgentQuestion = [...session.turns].reverse().find((turn) => turn.role === "agent")?.content ?? t.fallbackQuestion;
  const phaseCopy = getPhaseCopy(conversationPhase, locale);
  const phaseProgress = getPhaseProgress(conversationPhase);
  const isVoiceBusy = conversationPhase === "transcribing" || conversationPhase === "thinking" || conversationPhase === "speaking";

  useEffect(() => { document.documentElement.classList.toggle("dark", isDark); }, [isDark]);
  useEffect(() => { localStorage.setItem("membook.history", JSON.stringify(history.slice(0, 20))); }, [history]);
  useEffect(() => { localStorage.setItem("membook.bailianApiKey", bailianApiKey); }, [bailianApiKey]);
  useEffect(() => { localStorage.setItem("membook.bailianAsrEndpoint", bailianEndpoint); }, [bailianEndpoint]);
  useEffect(() => { localStorage.setItem("membook.bailianAsrModel", bailianAsrModel); }, [bailianAsrModel]);
  useEffect(() => { localStorage.setItem("membook.bailianTtsEndpoint", bailianTtsEndpoint); }, [bailianTtsEndpoint]);
  useEffect(() => { localStorage.setItem("membook.bailianTtsModel", bailianTtsModel); }, [bailianTtsModel]);
  useEffect(() => { localStorage.setItem("membook.bailianTtsVoice", ttsVoice); }, [ttsVoice]);

  useEffect(() => {
    void getApiStatus()
      .then((status) => {
        setApiStatus(status);
        if (!localStorage.getItem("membook.bailianAsrEndpoint")) setBailianEndpoint(status.asrEndpoint || defaultBailianEndpoint);
        if (!localStorage.getItem("membook.bailianAsrModel")) setBailianAsrModel(status.asrModel || "fun-asr-realtime-2026-02-28");
        if (!localStorage.getItem("membook.bailianTtsEndpoint")) setBailianTtsEndpoint(status.ttsEndpoint || defaultBailianTtsEndpoint);
        if (!localStorage.getItem("membook.bailianTtsModel")) setBailianTtsModel(status.ttsModel || "qwen3-tts-instruct-flash-realtime");
      })
      .catch(() => {
        setApiStatus({ mode: "local", asrModel: "qwen3-asr-flash-filetrans", asrEndpoint: defaultBailianEndpoint, ttsModel: "qwen3-tts-instruct-flash-realtime", ttsEndpoint: defaultBailianTtsEndpoint });
      });
  }, []);

  useEffect(() => {
    setSession((current) => {
      const [first, ...rest] = current.turns;
      if (rest.length > 0 || first.role !== "agent") return current;
      return {
        ...current,
        turns: [{ ...first, content: t.firstQuestion }],
        insights: [
          { label: t.people, value: locale === "zh" ? "等待提及" : "Waiting" },
          { label: t.places, value: locale === "zh" ? "等待提及" : "Waiting" },
          { label: t.emotionalArc, value: locale === "zh" ? "温和开场" : "Opening gently" },
        ],
      };
    });
  }, [locale, t.emotionalArc, t.firstQuestion, t.people, t.places]);

  useEffect(() => {
    if (session.turns.length <= 1 && !bookDraft) return;
    const saved: SavedMemoir = { id: session.id, title: bookDraft?.title ?? makeHistoryTitle(session, locale), updatedAt: new Date().toISOString(), session, bookDraft };
    setHistory((current) => [saved, ...current.filter((item) => item.id !== session.id)].slice(0, 20));
  }, [bookDraft, locale, session]);

  function handleLogout() { localStorage.removeItem("membook.auth"); onLogout(); }
  function handleNewInterview() { setSession(createInitialSession(locale)); setBookDraft(null); setTypedAnswer(""); setTtsAudioUrl(""); setConversationPhase("idle"); setIsCallActive(false); }
  function handleLoadHistory(item: SavedMemoir) { setSession(item.session); setBookDraft(item.bookDraft); setIsHistoryOpen(false); setIsBookOpen(Boolean(item.bookDraft)); setTypedAnswer(""); setConversationPhase("idle"); setIsCallActive(false); }
  function handleDeleteHistory(id: string) { setHistory((current) => current.filter((item) => item.id !== id)); if (session.id === id) handleNewInterview(); }

  async function submitAnswerText(answer: string, shouldSpeakResponse = false) {
    const cleanAnswer = answer.trim();
    if (!cleanAnswer || isAsking) return;
    const elderTurn = nowTurn("elder", cleanAnswer);
    const nextSession = { ...session, turns: [...session.turns, elderTurn] };
    setSession(nextSession);
    setTypedAnswer("");
    setIsAsking(true);
    setConversationPhase("thinking");
    setError("");
    let questionToSpeak = "";
    try {
      const response = await askAgent(nextSession, cleanAnswer);
      questionToSpeak = response.question;
      setSession({ ...nextSession, turns: [...nextSession.turns, nowTurn("agent", response.question)], insights: response.insights, readiness: response.readiness });
    } catch {
      questionToSpeak = t.fallbackQuestion;
      setSession({ ...nextSession, turns: [...nextSession.turns, nowTurn("agent", t.fallbackQuestion)], readiness: Math.min(100, nextSession.readiness + 10) });
      setError(t.errAgentFallback);
    } finally { setIsAsking(false); }
    if (shouldSpeakResponse && questionToSpeak) {
      await speakQuestionText(questionToSpeak, { autoResumeRecording: true });
    } else { setConversationPhase("ready"); }
  }

  async function submitAnswer(event: FormEvent) { event.preventDefault(); await submitAnswerText(answerText, isCallActive); }

  async function transcribeAudioFile(file: File) {
    if (!bailianApiKey) { setIsSettingsOpen(true); throw new Error(locale === "zh" ? "请先在设置里填写百炼 API Key。" : "Add your Bailian API key in settings first."); }
    setIsTranscribing(true);
    setConversationPhase("transcribing");
    setError("");
    try {
      const text = await transcribeWithBailian({ apiKey: bailianApiKey, endpoint: bailianEndpoint, model: bailianAsrModel, file });
      setTypedAnswer(text);
      return text;
    } catch (caught) {
      setError(locale === "zh" ? `语音转文字失败：${errorMessage(caught)}` : `Speech-to-text failed: ${errorMessage(caught)}`);
      setConversationPhase("error");
      return "";
    } finally { setIsTranscribing(false); }
  }

  async function handleBailianTranscribe() { if (!recorder.audioFile || isTranscribing) return; const text = await transcribeAudioFile(recorder.audioFile); if (text) setConversationPhase("ready"); }
  async function handleVoiceTurn(file: File) { const text = await transcribeAudioFile(file); if (!text) return; await submitAnswerText(text, true); }

  async function speakQuestionText(text: string, options?: { autoResumeRecording?: boolean }) {
    if (!bailianApiKey || isSpeaking) {
      if (!bailianApiKey) { setIsSettingsOpen(true); setError(locale === "zh" ? "请先在设置里填写百炼 API Key，才能播放 AI 语音。" : "Add your Bailian API key in settings before voice playback."); }
      setConversationPhase("ready");
      return;
    }
    setIsSpeaking(true);
    setConversationPhase("speaking");
    setError("");
    let played = false;
    try {
      const audioUrl = await synthesizeWithBailian({ apiKey: bailianApiKey, endpoint: bailianTtsEndpoint, model: bailianTtsModel, text, voice: ttsVoice, instructions: locale === "zh" ? "用温柔、耐心、适合老人访谈的语气朗读。语速稍慢，停顿自然。" : "Read warmly and patiently for an elder interview. Keep the pace slow and clear." });
      setTtsAudioUrl(audioUrl);
      try { const audio = new Audio(audioUrl); await audio.play(); played = true; } catch (playError) { setError(locale === "zh" ? `音频已生成，但浏览器拦截了自动播放。请先点一次朗读，再继续说。提示：${errorMessage(playError)}` : `Audio is ready, but autoplay was blocked. Tap read aloud once, then continue. Note: ${errorMessage(playError)}`); }
    } catch (caught) { setError(locale === "zh" ? `朗读失败：${errorMessage(caught)}` : `Voice reading failed: ${errorMessage(caught)}`); }
    finally {
      setIsSpeaking(false);
      const shouldAutoResume = Boolean(options?.autoResumeRecording) && isCallActive && !recorder.isRecording && played;
      if (shouldAutoResume) { await startVoiceRecording(); } else { setConversationPhase("ready"); }
    }
  }

  async function handleSpeakQuestion() { await speakQuestionText(latestAgentQuestion); }
  async function stopVoiceRecording() { setConversationPhase("transcribing"); const file = recorder.stop(); if (file) await handleVoiceTurn(file); }
  async function startVoiceRecording() {
    if (!recorder.isSupported) { setConversationPhase("error"); setError(locale === "zh" ? "当前浏览器不支持录音，请换用最新版 Chrome、Edge 或 Safari。" : "This browser does not support recording. Use the latest Chrome, Edge, or Safari."); return; }
    setError(""); setTtsAudioUrl(""); setConversationPhase("recording");
    try { await recorder.start(); } catch (caught) { setConversationPhase("error"); setError(locale === "zh" ? `无法打开麦克风：${errorMessage(caught)}` : `Could not open microphone: ${errorMessage(caught)}`); }
  }

  async function handleCallButton() {
    if (!isCallActive) { setIsCallActive(true); setConversationPhase("ready"); await speakQuestionText(latestAgentQuestion, { autoResumeRecording: true }); return; }
    if (recorder.isRecording) { await stopVoiceRecording(); return; }
    if (isVoiceBusy) return;
    if (!bailianApiKey) { setIsSettingsOpen(true); setError(locale === "zh" ? "请先在设置里填写百炼 API Key，然后就可以像打电话一样对话。" : "Add your Bailian API key first, then the call flow can run voice-to-voice."); return; }
    await startVoiceRecording();
  }

  async function handleSpaceTalkToggle() {
    if (isVoiceBusy) return;
    if (recorder.isRecording) { await stopVoiceRecording(); return; }
    if (!bailianApiKey) { setIsSettingsOpen(true); setError(locale === "zh" ? "请先在设置里填写百炼 API Key，然后就可以按空格开始说话。" : "Add your Bailian API key first, then press Space to speak."); return; }
    if (!isCallActive) setIsCallActive(true);
    await startVoiceRecording();
  }

  async function handleGenerateBook() {
    setIsGenerating(true); setError("");
    try {
      const draft = await generateBook(session);
      setBookDraft(draft); setIsBookOpen(true);
    } catch {
      setBookDraft({ title: t.bookFallbackTitle, subtitle: t.bookFallbackSub, soulSentence: locale === "zh" ? "那些慢慢说出的日子，会被家人记住。" : "The days told slowly can be kept.", chapters: [{ title: t.bookChapter1, summary: elderTurns[0]?.content ?? t.emptyTranscript, contentMarkdown: `# ${t.bookChapter1}\n\n${elderTurns[0]?.content ?? t.emptyTranscript}` }, { title: t.bookChapter2, summary: t.bookWaiting, contentMarkdown: `# ${t.bookChapter2}\n\n${t.bookWaiting}` }], excerpt: elderTurns.map((turn) => turn.content).join("\n\n") || t.emptyTranscript });
      setIsBookOpen(true); setError(t.errBookFallback);
    } finally { setIsGenerating(false); }
  }

  async function handleImportContent(content: string) {
    // 调用后端 AI 解析原始文本，无需分割线格式
    setError("");
    setIsImportOpen(false);
    setIsGenerating(true);

    let turns: InterviewTurn[] = [];
    try {
      const response = await fetch("http://localhost:8787/api/import/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: content }),
      });
      const data = await response.json();
      if (Array.isArray(data.turns) && data.turns.length > 0) {
        turns = data.turns.map((t: { role: "agent" | "elder"; content: string }) => nowTurn(t.role, t.content));
      }
    } catch {
      // 回退：简单按行分割
      const lines = content.split(/\n+/).map((l) => l.trim()).filter(Boolean);
      for (let i = 0; i < lines.length; i++) {
        turns.push(nowTurn(i % 2 === 0 ? "agent" : "elder", lines[i]));
      }
    }

    if (turns.length === 0) {
      setError(locale === "zh" ? "无法解析对话内容" : "Cannot parse conversation content");
      setIsGenerating(false);
      return;
    }

    const importSession: InterviewSession = {
      id: crypto.randomUUID(),
      turns,
      insights: [],
      readiness: 100,
    };

    try {
      const draft = await generateBook(importSession);
      setBookDraft(draft);
      setIsBookOpen(true);
    } catch {
      const fallbackContent = turns.filter((t) => t.role === "elder").map((t) => t.content).join("\n\n");
      setBookDraft({
        title: t.bookFallbackTitle,
        subtitle: t.bookFallbackSub,
        soulSentence: locale === "zh" ? "那些慢慢说出的日子，會被家人記住。" : "The days told slowly can be kept.",
        chapters: [{ title: t.bookChapter1, summary: fallbackContent.slice(0, 100), contentMarkdown: `# ${t.bookChapter1}\n\n${fallbackContent}` }],
        excerpt: fallbackContent,
      });
      setIsBookOpen(true);
      setError(t.errBookFallback);
    } finally {
      setIsGenerating(false);
    }
  }

  useEffect(() => {
    function isTypingTarget(target: EventTarget | null) {
      if (!(target instanceof HTMLElement)) return false;
      if (target.closest("[data-space-talk-button]")) return false;
      return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.code !== "Space" || event.repeat) return;
      if (isTypingTarget(event.target) || isHistoryOpen || isBookOpen || isSettingsOpen) return;
      event.preventDefault();
      void handleSpaceTalkToggle();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  return (
    <main className="relative min-h-screen overflow-hidden px-3 py-3 sm:px-4 lg:h-screen">
      <div className="pointer-events-none absolute left-1/4 top-0 h-80 w-80 -translate-x-1/2 rounded-full bg-primary/8 blur-3xl" />
      <div className="pointer-events-none absolute right-1/4 top-1/4 h-60 w-60 rounded-full bg-accent/8 blur-3xl" />

      <div className="relative mx-auto grid h-full max-w-7xl gap-3 lg:grid-cols-[0.72fr_1.12fr_0.9fr]">
        <StudioLeftPanel
          locale={locale} t={t} session={session} isDark={isDark}
          apiStatus={apiStatus} bailianApiKey={bailianApiKey}
          bailianEndpoint={bailianEndpoint} bailianTtsEndpoint={bailianTtsEndpoint}
          onOpenHistory={() => setIsHistoryOpen(true)} onNewInterview={handleNewInterview}
          onOpenSettings={() => setIsSettingsOpen(true)} onLogout={handleLogout}
          onToggleDark={() => setIsDark((v) => !v)} onImportDialog={() => setIsImportOpen(true)}
        />
        <StudioCenterPanel
          locale={locale} t={t} isCallActive={isCallActive}
          conversationPhase={conversationPhase} latestAgentQuestion={latestAgentQuestion}
          bailianApiKey={bailianApiKey} isSpeaking={isSpeaking} isVoiceBusy={isVoiceBusy}
          phaseCopy={phaseCopy} phaseProgress={phaseProgress} recorder={recorder}
          typedAnswer={typedAnswer} isTranscribing={isTranscribing} isAsking={isAsking}
          onSpeakQuestion={handleSpeakQuestion} onCallButton={handleCallButton}
          onFormSubmit={submitAnswer} onTextChange={setTypedAnswer}
          onFileChange={(file) => recorder.setAudioFile(file)}
          onTranscribe={handleBailianTranscribe} onSubmit={() => void submitAnswerText(answerText, isCallActive)}
        />
        <StudioRightPanel
          locale={locale} t={t} session={session} bookDraft={bookDraft}
          isGenerating={isGenerating} elderTurns={elderTurns} isAsking={isAsking} error={error}
          onGenerateBook={handleGenerateBook} onOpenBook={() => setIsBookOpen(true)}
        />
      </div>

      {isHistoryOpen && <HistoryDialog history={history} locale={locale} onClose={() => setIsHistoryOpen(false)} onLoad={handleLoadHistory} onDelete={handleDeleteHistory} onNew={handleNewInterview} />}
      {bookDraft && isBookOpen && <BookReader book={bookDraft} locale={locale} onClose={() => setIsBookOpen(false)} />}
      {isSettingsOpen && (
        <SettingsDialog
          apiStatus={apiStatus} bailianApiKey={bailianApiKey} bailianEndpoint={bailianEndpoint}
          bailianAsrModel={bailianAsrModel} bailianTtsEndpoint={bailianTtsEndpoint}
          bailianTtsModel={bailianTtsModel} ttsVoice={ttsVoice} isDark={isDark}
          locale={locale} t={t} onClose={() => setIsSettingsOpen(false)}
          onToggleTheme={() => setIsDark((v) => !v)} onToggleLocale={() => setLocale(locale === "zh" ? "en" : "zh")}
          onBailianApiKeyChange={setBailianApiKey} onBailianEndpointChange={setBailianEndpoint}
          onBailianAsrModelChange={setBailianAsrModel} onBailianTtsEndpointChange={setBailianTtsEndpoint}
          onBailianTtsModelChange={setBailianTtsModel} onTtsVoiceChange={setTtsVoice}
          onResetVoiceDefaults={() => { setBailianEndpoint(defaultBailianEndpoint); setBailianAsrModel("fun-asr-realtime-2026-02-28"); setBailianTtsEndpoint(defaultBailianTtsEndpoint); setBailianTtsModel("qwen3-tts-instruct-flash-realtime"); setTtsVoice("Cherry"); }}
        />
      )}
      {isImportOpen && <ImportDialog locale={locale} onClose={() => setIsImportOpen(false)} onImport={handleImportContent} />}
    </main>
  );
}
