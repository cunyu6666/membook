/**
 * [WHO]: 访谈录制工作台主页面（状态管理 + 新 Studio UI 组装）
 * [FROM]: 依赖 hooks、lib 模块、BookReader/Settings/Import 对话框
 * [TO]: 被 App.tsx 的路由挂载
 */
import { type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BookReader, SettingsDialog, ImportDialog } from "./components/pages/BookReader";
import logoImage from "./assets/logo.jpg";
import { useAudioRecorder } from "./hooks/useAudioRecorder";
import { createAgentApi, type AgentApi } from "./lib/agentApi";
import { getApiStatus } from "./lib/agentClient";
import { transcribeWithBailian } from "./lib/asrClient";
import { copy, type Locale } from "./lib/i18n";
import { synthesizeWithBailian } from "./lib/ttsClient";
import type { ApiStatus, BookDraft, InterviewSession, InterviewTurn, PhotoMemory } from "./lib/types";
import type { AgentMode } from "./components/pages/LoginPage";
import type { SavedMemoir } from "./lib/session";
import { nowTurn, createInitialSession, readSavedMemoirs, makeHistoryTitle, cloneMemoir } from "./lib/session";
import type { ConversationPhase } from "./lib/phaseCopy";

const defaultBailianEndpoint = "wss://dashscope.aliyuncs.com/api-ws/v1/inference/";
const defaultBailianTtsEndpoint = "wss://dashscope.aliyuncs.com/api-ws/v1/realtime";
const API_BASE = import.meta.env.VITE_API_BASE ?? "";

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
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
  const [isPhotosOpen, setIsPhotosOpen] = useState(false);
  const [isBookOpen, setIsBookOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [typedAnswer, setTypedAnswer] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [conversationPhase, setConversationPhase] = useState<ConversationPhase>("idle");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);
  const [photoQuestionIndex, setPhotoQuestionIndex] = useState(0);
  const [studioNotice, setStudioNotice] = useState("");
  const [elapsedSec, setElapsedSec] = useState(0);
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
  const [agentMode] = useState<AgentMode>(() => (localStorage.getItem("membook.agentMode") as AgentMode) || "local");

  type TurnEditAction =
    | { type: "update"; turnId: string; prevContent: string; newContent: string }
    | { type: "delete"; turn: InterviewTurn; index: number };
  const [editHistory, setEditHistory] = useState<TurnEditAction[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const [agentApi, setAgentApi] = useState<AgentApi>(() => createAgentApi(agentMode, { getToken: () => localStorage.getItem("membook.token") }));

  useEffect(() => {
    setAgentApi(createAgentApi(agentMode, { getToken: () => localStorage.getItem("membook.token") }));
  }, [agentMode]);

  const pendingAgentAbort = useRef<AbortController | null>(null);
  const pendingBookAbort = useRef<AbortController | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);

  const answerText = typedAnswer.trim();
  const elderTurns = useMemo(() => session.turns.filter((turn) => turn.role === "elder"), [session.turns]);
  const photoMemories = useMemo(() => session.photos ?? [], [session.photos]);
  const activePhoto = useMemo(() => photoMemories.find((photo) => photo.id === activePhotoId) ?? null, [activePhotoId, photoMemories]);
  const latestAgentQuestion = [...session.turns].reverse().find((turn) => turn.role === "agent")?.content ?? t.fallbackQuestion;
  const latestElderAnswer = [...session.turns].reverse().find((turn) => turn.role === "elder")?.content ?? "";
  const isVoiceBusy = conversationPhase === "transcribing" || conversationPhase === "thinking" || conversationPhase === "speaking";
  const storyCharacterCount = useMemo(
    () => elderTurns.reduce((sum, turn) => sum + turn.content.length, 0) + photoMemories.reduce((sum, photo) => sum + photo.story.length + photo.description.length, 0),
    [elderTurns, photoMemories],
  );
  const currentTitle = bookDraft?.title ?? makeHistoryTitle(session, locale);
  const phaseInfo = getStudioPhaseInfo(conversationPhase, locale, activePhoto);
  const readiness = Math.max(0, Math.min(100, Math.round(session.readiness)));

  useEffect(() => { document.documentElement.classList.toggle("dark", isDark); }, [isDark]);
  useEffect(() => { localStorage.setItem("membook.history", JSON.stringify(history.slice(0, 20))); }, [history]);
  useEffect(() => { localStorage.setItem("membook.bailianApiKey", bailianApiKey); }, [bailianApiKey]);
  useEffect(() => { localStorage.setItem("membook.bailianAsrEndpoint", bailianEndpoint); }, [bailianEndpoint]);
  useEffect(() => { localStorage.setItem("membook.bailianAsrModel", bailianAsrModel); }, [bailianAsrModel]);
  useEffect(() => { localStorage.setItem("membook.bailianTtsEndpoint", bailianTtsEndpoint); }, [bailianTtsEndpoint]);
  useEffect(() => { localStorage.setItem("membook.bailianTtsModel", bailianTtsModel); }, [bailianTtsModel]);
  useEffect(() => { localStorage.setItem("membook.bailianTtsVoice", ttsVoice); }, [ttsVoice]);

  useEffect(() => {
    if (!isCallActive) {
      setElapsedSec(0);
      return;
    }
    const timer = window.setInterval(() => setElapsedSec((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [isCallActive]);

  useEffect(() => {
    if (!studioNotice) return;
    const timer = window.setTimeout(() => setStudioNotice(""), 5200);
    return () => window.clearTimeout(timer);
  }, [studioNotice]);

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
      if (!first || rest.length > 0 || first.role !== "agent") return current;
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

  const lastSavedRef = useRef<string>("");
  useEffect(() => {
    if (session.turns.length <= 1 && !bookDraft && photoMemories.length === 0) return;
    const serialized = JSON.stringify({ turns: session.turns, insights: session.insights, readiness: session.readiness, photos: session.photos, isPaid: session.isPaid });
    if (serialized === lastSavedRef.current) return;
    lastSavedRef.current = serialized;
    const saved: SavedMemoir = { id: session.id, title: bookDraft?.title ?? makeHistoryTitle(session, locale), updatedAt: new Date().toISOString(), session, bookDraft };
    setHistory((current) => [saved, ...current.filter((item) => item.id !== session.id)].slice(0, 20));
  }, [bookDraft, locale, photoMemories.length, session]);

  function handleLogout() { localStorage.removeItem("membook.auth"); onLogout(); }

  function handleNewInterview() {
    const hasContent = session.turns.length > 1 || bookDraft || photoMemories.length > 0;
    if (hasContent && !window.confirm(locale === "zh"
      ? "当前访谈尚未保存，确定要开始新的访谈吗？"
      : "Current interview is not saved. Start a new one?")) {
      return;
    }
    setSession(createInitialSession(locale));
    setBookDraft(null);
    setTypedAnswer("");
    setTtsAudioUrl("");
    setConversationPhase("idle");
    setIsCallActive(false);
    setActivePhotoId(null);
    setPhotoQuestionIndex(0);
    setEditHistory([]);
    setHistoryIndex(-1);
    setIsHistoryOpen(false);
    setIsPhotosOpen(false);
    setIsTranscriptOpen(false);
  }

  function handleLoadHistory(item: SavedMemoir) {
    setSession({ ...item.session, photos: item.session.photos ?? [], isPaid: item.session.isPaid ?? false });
    setBookDraft(item.bookDraft);
    setIsHistoryOpen(false);
    setIsBookOpen(Boolean(item.bookDraft));
    setTypedAnswer("");
    setConversationPhase("idle");
    setIsCallActive(false);
    setActivePhotoId(null);
    setPhotoQuestionIndex(0);
    setEditHistory([]);
    setHistoryIndex(-1);
  }

  function handleDeleteHistory(id: string) {
    setHistory((current) => current.filter((item) => item.id !== id));
    if (session.id === id) handleNewInterview();
  }

  function handleRenameHistory(id: string, newTitle: string) {
    setHistory((current) => current.map((item) => (item.id === id ? { ...item, title: newTitle } : item)));
  }

  function handleCloneHistory(item: SavedMemoir) {
    const cloned = cloneMemoir(item);
    setHistory((current) => [cloned, ...current].slice(0, 20));
  }

  function handleUpdateTurn(turnId: string, newContent: string) {
    const prevTurn = session.turns.find((turn) => turn.id === turnId);
    if (!prevTurn || prevTurn.content === newContent) return;
    setEditHistory((prev) => [...prev.slice(0, historyIndex + 1), { type: "update", turnId, prevContent: prevTurn.content, newContent }]);
    setHistoryIndex((prev) => prev + 1);
    setSession((prev) => ({
      ...prev,
      turns: prev.turns.map((turn) => (turn.id === turnId ? { ...turn, content: newContent } : turn)),
      readiness: 0,
    }));
  }

  function handleDeleteTurn(turnId: string) {
    const turn = session.turns.find((item) => item.id === turnId);
    const index = session.turns.findIndex((item) => item.id === turnId);
    if (!turn) return;
    setEditHistory((prev) => [...prev.slice(0, historyIndex + 1), { type: "delete", turn, index }]);
    setHistoryIndex((prev) => prev + 1);
    setSession((prev) => ({ ...prev, turns: prev.turns.filter((item) => item.id !== turnId) }));
  }

  function handleUndo() {
    if (historyIndex < 0) return;
    const action = editHistory[historyIndex];
    if (action.type === "update") {
      setSession((prev) => ({ ...prev, turns: prev.turns.map((turn) => turn.id === action.turnId ? { ...turn, content: action.prevContent } : turn) }));
    } else {
      setSession((prev) => {
        const turns = [...prev.turns];
        turns.splice(action.index, 0, action.turn);
        return { ...prev, turns };
      });
    }
    setHistoryIndex((prev) => prev - 1);
  }

  function handleRedo() {
    if (historyIndex >= editHistory.length - 1) return;
    const action = editHistory[historyIndex + 1];
    if (action.type === "update") {
      setSession((prev) => ({ ...prev, turns: prev.turns.map((turn) => turn.id === action.turnId ? { ...turn, content: action.newContent } : turn) }));
    } else {
      setSession((prev) => ({ ...prev, turns: prev.turns.filter((turn) => turn.id !== action.turn.id) }));
    }
    setHistoryIndex((prev) => prev + 1);
  }

  async function submitAnswerText(answer: string, shouldSpeakResponse = false) {
    const cleanAnswer = answer.trim();
    if (!cleanAnswer || isAsking) return;
    if (activePhoto) {
      await submitPhotoAnswer(activePhoto, cleanAnswer, shouldSpeakResponse);
      return;
    }

    pendingAgentAbort.current?.abort();
    const abortCtrl = new AbortController();
    pendingAgentAbort.current = abortCtrl;

    const elderTurn = nowTurn("elder", cleanAnswer);
    const nextSession = { ...session, turns: [...session.turns, elderTurn] };
    setSession(nextSession);
    setTypedAnswer("");
    setIsAsking(true);
    setConversationPhase("thinking");
    setError("");
    let questionToSpeak = "";
    try {
      const response = await agentApi.askAgent(nextSession, cleanAnswer, abortCtrl.signal);
      questionToSpeak = response.question;
      setSession({ ...nextSession, turns: [...nextSession.turns, nowTurn("agent", response.question)], insights: response.insights, readiness: response.readiness });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      questionToSpeak = t.fallbackQuestion;
      setSession({ ...nextSession, turns: [...nextSession.turns, nowTurn("agent", t.fallbackQuestion)], readiness: Math.min(100, nextSession.readiness + 10) });
      setError(t.errAgentFallback);
    } finally { setIsAsking(false); }
    if (shouldSpeakResponse && questionToSpeak) {
      await speakQuestionText(questionToSpeak, { autoResumeRecording: true });
    } else { setConversationPhase("ready"); }
  }

  async function submitPhotoAnswer(photo: PhotoMemory, cleanAnswer: string, shouldSpeakResponse = false) {
    const elderTurn = nowTurn("elder", cleanAnswer);
    const currentQuestion = latestAgentQuestion;
    const nextPhotos = (session.photos ?? []).map((item) => item.id === photo.id
      ? {
          ...item,
          description: item.description || cleanAnswer,
          story: [item.story, `问：${currentQuestion}\n答：${cleanAnswer}`].filter(Boolean).join("\n\n"),
        }
      : item);
    const updatedPhoto = nextPhotos.find((item) => item.id === photo.id) ?? photo;
    const nextSession = {
      ...session,
      photos: nextPhotos,
      turns: [...session.turns, elderTurn],
      readiness: Math.min(100, session.readiness + 6),
    };
    setTypedAnswer("");
    setSession(nextSession);

    if (photoQuestionIndex < 2) {
      const nextIndex = photoQuestionIndex + 1;
      setIsAsking(true);
      setConversationPhase("thinking");
      setError("");
      let nextQuestion = "";
      try {
        const response = await agentApi.askAgent(
          buildPhotoFollowupSession(nextSession, updatedPhoto, locale, nextIndex),
          buildPhotoFollowupAnswer(updatedPhoto, cleanAnswer, locale, nextIndex),
        );
        nextQuestion = normalizeQuestion(response.question) || getPhotoFallbackQuestion(locale, cleanAnswer, nextIndex);
        setSession({
          ...nextSession,
          turns: [...nextSession.turns, nowTurn("agent", nextQuestion)],
          insights: response.insights.length > 0 ? response.insights : nextSession.insights,
          readiness: Math.max(nextSession.readiness, response.readiness),
        });
      } catch {
        nextQuestion = getPhotoFallbackQuestion(locale, cleanAnswer, nextIndex);
        setSession({ ...nextSession, turns: [...nextSession.turns, nowTurn("agent", nextQuestion)] });
      } finally {
        setIsAsking(false);
      }
      setPhotoQuestionIndex(nextIndex);
      setStudioNotice(locale === "zh" ? `继续围绕这张照片追问：第 ${nextIndex + 1} 问 / 3` : `Continuing this photo: question ${nextIndex + 1} of 3`);
      if (shouldSpeakResponse) await speakQuestionText(nextQuestion, { autoResumeRecording: true });
      else setConversationPhase("ready");
      return;
    }

    setActivePhotoId(null);
    setPhotoQuestionIndex(0);
    setStudioNotice(locale === "zh" ? "这张照片的故事已记录，正在回到原来的访谈线索。" : "This photo story has been captured. Returning to the main interview thread.");
    setIsAsking(true);
    setConversationPhase("thinking");
    setError("");
    try {
      const response = await agentApi.askAgent(nextSession, cleanAnswer);
      setSession({ ...nextSession, turns: [...nextSession.turns, nowTurn("agent", response.question)], insights: response.insights, readiness: response.readiness });
      if (shouldSpeakResponse) await speakQuestionText(response.question, { autoResumeRecording: true });
      else setConversationPhase("ready");
    } catch {
      const fallback = locale === "zh" ? "这张照片里的故事很珍贵。我们继续聊聊刚才那段回忆，好吗？" : "That photo story is precious. Shall we continue with the memory we were discussing?";
      setSession({ ...nextSession, turns: [...nextSession.turns, nowTurn("agent", fallback)] });
      setConversationPhase("ready");
    } finally {
      setIsAsking(false);
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
      const text = await transcribeWithBailian({ apiKey: bailianApiKey, endpoint: bailianEndpoint, model: bailianAsrModel, file });
      setTypedAnswer(text);
      return text;
    } catch (caught) {
      setError(locale === "zh" ? `语音转文字失败：${errorMessage(caught)}` : `Speech-to-text failed: ${errorMessage(caught)}`);
      setConversationPhase("error");
      return "";
    } finally { setIsTranscribing(false); }
  }

  async function handleBailianTranscribe() {
    if (!recorder.audioFile || isTranscribing) return;
    const text = await transcribeAudioFile(recorder.audioFile);
    if (text) setConversationPhase("ready");
  }

  async function handleVoiceTurn(file: File) {
    const text = await transcribeAudioFile(file);
    if (!text) return;
    await submitAnswerText(text, true);
  }

  async function speakQuestionText(text: string, options?: { autoResumeRecording?: boolean }) {
    if (!bailianApiKey || isSpeaking) {
      if (!bailianApiKey) {
        setIsSettingsOpen(true);
        setError(locale === "zh" ? "请先在设置里填写百炼 API Key，才能播放 AI 语音。" : "Add your Bailian API key in settings before voice playback.");
      }
      setConversationPhase("ready");
      return;
    }
    setIsSpeaking(true);
    setConversationPhase("speaking");
    setError("");
    let audio: HTMLAudioElement | null = null;
    let played = false;
    try {
      const audioUrl = await synthesizeWithBailian({ apiKey: bailianApiKey, endpoint: bailianTtsEndpoint, model: bailianTtsModel, text, voice: ttsVoice, instructions: locale === "zh" ? "用温柔、耐心、适合老人访谈的语气朗读。语速稍慢，停顿自然。" : "Read warmly and patiently for an elder interview. Keep the pace slow and clear." });
      setTtsAudioUrl(audioUrl);
      audio = new Audio(audioUrl);
      audio.onended = () => { audio = null; };
      await audio.play();
      played = true;
    } catch (caught) {
      const playError = caught;
      try {
        if ("speechSynthesis" in window && text.trim()) {
          const utterance = new SpeechSynthesisUtterance(text.trim());
          utterance.rate = 0.85;
          utterance.pitch = 1.1;
          await new Promise<void>((resolve, reject) => {
            utterance.onend = () => resolve();
            utterance.onerror = () => reject(new Error("Speech synthesis failed"));
            window.speechSynthesis.speak(utterance);
          });
          played = true;
        }
      } catch {
        setError(locale === "zh" ? `朗读失败：${errorMessage(playError)}` : `Voice reading failed: ${errorMessage(playError)}`);
      }
    }
    finally {
      setIsSpeaking(false);
      const shouldAutoResume = Boolean(options?.autoResumeRecording) && isCallActive && !recorder.isRecording && played;
      if (shouldAutoResume) { await startVoiceRecording(); } else { setConversationPhase("ready"); }
    }
  }

  async function handleSpeakQuestion() { await speakQuestionText(latestAgentQuestion); }

  async function stopVoiceRecording() {
    setConversationPhase("transcribing");
    const file = recorder.stop();
    if (file) await handleVoiceTurn(file);
  }

  async function startVoiceRecording() {
    if (!recorder.isSupported) {
      setConversationPhase("error");
      setError(locale === "zh" ? "当前浏览器不支持录音，请换用最新版 Chrome、Edge 或 Safari。" : "This browser does not support recording. Use the latest Chrome, Edge, or Safari.");
      return;
    }
    setError("");
    setTtsAudioUrl("");
    setConversationPhase("recording");
    try { await recorder.start(); } catch (caught) {
      setConversationPhase("error");
      setError(locale === "zh" ? `无法打开麦克风：${errorMessage(caught)}` : `Could not open microphone: ${errorMessage(caught)}`);
    }
  }

  async function handleCallButton() {
    if (!isCallActive) {
      setIsCallActive(true);
      setConversationPhase("ready");
      await speakQuestionText(latestAgentQuestion, { autoResumeRecording: true });
      return;
    }
    if (recorder.isRecording) { await stopVoiceRecording(); return; }
    if (isVoiceBusy) return;
    if (!bailianApiKey) {
      setIsSettingsOpen(true);
      setError(locale === "zh" ? "请先在设置里填写百炼 API Key，然后就可以像打电话一样对话。" : "Add your Bailian API key first, then the call flow can run voice-to-voice.");
      return;
    }
    await startVoiceRecording();
  }

  async function handleSpaceTalkToggle() {
    if (isVoiceBusy) return;
    if (recorder.isRecording) { await stopVoiceRecording(); return; }
    if (!bailianApiKey) {
      setIsSettingsOpen(true);
      setError(locale === "zh" ? "请先在设置里填写百炼 API Key，然后就可以按空格开始说话。" : "Add your Bailian API key first, then press Space to speak.");
      return;
    }
    if (!isCallActive) setIsCallActive(true);
    await startVoiceRecording();
  }

  async function handleGenerateBook() {
    if (!session.isPaid) {
      setIsPaymentOpen(true);
      return;
    }
    await performGenerateBook(session);
  }

  async function performGenerateBook(sourceSession: InterviewSession) {
    pendingBookAbort.current?.abort();
    const abortCtrl = new AbortController();
    pendingBookAbort.current = abortCtrl;

    setIsGenerating(true);
    setError("");
    const materialSession = withPhotoMemoryTurns(sourceSession, locale);
    try {
      const draft = await agentApi.generateBook(materialSession, abortCtrl.signal);
      setBookDraft({ ...draft, coverStyle: draft.coverStyle ?? "linen" });
      setIsBookOpen(true);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setBookDraft({
        title: t.bookFallbackTitle,
        subtitle: t.bookFallbackSub,
        soulSentence: locale === "zh" ? "那些慢慢说出的日子，会被家人记住。" : "The days told slowly can be kept.",
        coverStyle: "linen",
        chapters: [
          { title: t.bookChapter1, summary: elderTurns[0]?.content ?? t.emptyTranscript, contentMarkdown: `# ${t.bookChapter1}\n\n${elderTurns[0]?.content ?? t.emptyTranscript}` },
          { title: t.bookChapter2, summary: t.bookWaiting, contentMarkdown: `# ${t.bookChapter2}\n\n${t.bookWaiting}` },
        ],
        excerpt: elderTurns.map((turn) => turn.content).join("\n\n") || t.emptyTranscript,
      });
      setIsBookOpen(true);
      setError(t.errBookFallback);
    } finally { setIsGenerating(false); }
  }

  async function handlePaymentComplete() {
    const paidSession = { ...session, isPaid: true };
    setSession(paidSession);
    setIsPaymentOpen(false);
    await performGenerateBook(paidSession);
  }

  async function handlePhotoFiles(files: FileList | null) {
    if (!files?.length) return;
    const memories = await Promise.all(Array.from(files).map((file) => createPhotoMemory(file, locale)));
    const firstPhoto = memories[0];
    setActivePhotoId(firstPhoto.id);
    setPhotoQuestionIndex(0);
    setConversationPhase("ready");
    setIsPhotosOpen(false);
    setStudioNotice(locale === "zh"
      ? `已导入 ${memories.length} 张老照片。先围绕“${firstPhoto.fileName}”完成 3 个问题。`
      : `Imported ${memories.length} photo(s). Starting three questions about "${firstPhoto.fileName}".`);
    setSession((current) => ({
      ...current,
      photos: [...(current.photos ?? []), ...memories],
      turns: [...current.turns, nowTurn("agent", getInitialPhotoQuestion(locale))],
    }));
  }

  function handleUpdatePhoto(id: string, patch: Partial<Pick<PhotoMemory, "description" | "story" | "aiObservation">>) {
    setSession((current) => ({
      ...current,
      photos: (current.photos ?? []).map((photo) => photo.id === id ? { ...photo, ...patch } : photo),
    }));
  }

  function handleDeletePhoto(id: string) {
    setSession((current) => ({ ...current, photos: (current.photos ?? []).filter((photo) => photo.id !== id) }));
    if (activePhotoId === id) {
      setActivePhotoId(null);
      setPhotoQuestionIndex(0);
    }
  }

  async function handleImportContent(content: string) {
    setError("");
    setIsImportOpen(false);
    setIsGenerating(true);

    let turns: InterviewTurn[] = [];
    try {
      const response = await fetch(`${API_BASE}/api/import/parse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: content }),
      });
      const data = await response.json();
      if (Array.isArray(data.turns) && data.turns.length > 0) {
        turns = data.turns.map((turn: { role: "agent" | "elder"; content: string }) => nowTurn(turn.role, turn.content));
      }
    } catch {
      const lines = content.split(/\n+/).map((line) => line.trim()).filter(Boolean);
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
      photos: [],
      isPaid: true,
    };

    try {
      const draft = await agentApi.generateBook(importSession);
      setBookDraft({ ...draft, coverStyle: draft.coverStyle ?? "linen" });
      setIsBookOpen(true);
    } catch {
      const fallbackContent = turns.filter((turn) => turn.role === "elder").map((turn) => turn.content).join("\n\n");
      setBookDraft({
        title: t.bookFallbackTitle,
        subtitle: t.bookFallbackSub,
        soulSentence: locale === "zh" ? "那些慢慢说出的日子，会被家人记住。" : "The days told slowly can be kept.",
        coverStyle: "linen",
        chapters: [{ title: t.bookChapter1, summary: fallbackContent.slice(0, 100), contentMarkdown: `# ${t.bookChapter1}\n\n${fallbackContent}` }],
        excerpt: fallbackContent,
      });
      setIsBookOpen(true);
      setError(t.errBookFallback);
    } finally {
      setIsGenerating(false);
    }
  }

  const handlerRef = useRef<(event: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    handlerRef.current = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "z" && !event.shiftKey) {
        if (isHistoryOpen || isBookOpen || isSettingsOpen || isPhotosOpen || isTranscriptOpen || isPaymentOpen) return;
        event.preventDefault();
        handleUndo();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key === "z" && event.shiftKey) {
        if (isHistoryOpen || isBookOpen || isSettingsOpen || isPhotosOpen || isTranscriptOpen || isPaymentOpen) return;
        event.preventDefault();
        handleRedo();
        return;
      }
      if (event.code !== "Space" || event.repeat) return;
      function isTypingTarget(target: EventTarget | null) {
        if (!(target instanceof HTMLElement)) return false;
        if (target.closest("[data-space-talk-button]")) return false;
        return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName);
      }
      if (isTypingTarget(event.target) || isHistoryOpen || isBookOpen || isSettingsOpen || isPhotosOpen || isTranscriptOpen || isPaymentOpen) return;
      event.preventDefault();
      void handleSpaceTalkToggle();
    };
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => handlerRef.current(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  return (
    <main className="membook-studio-shell">
      <input
        ref={photoInputRef}
        className="sr-only"
        type="file"
        accept="image/*"
        multiple
        onChange={(event) => {
          void handlePhotoFiles(event.target.files);
          event.currentTarget.value = "";
        }}
      />
      <input
        ref={audioInputRef}
        className="sr-only"
        type="file"
        accept="audio/*"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) recorder.setAudioFile(file);
          event.currentTarget.value = "";
        }}
      />

      <StudioRibbon
        locale={locale}
        title={currentTitle}
        isDark={isDark}
        onNew={handleNewInterview}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onToggleTheme={() => setIsDark((value) => !value)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onLogout={handleLogout}
      />

      <section className="studio-canvas">
        <aside className="studio-rail studio-rail-left">
          <div>
            <StudioEyebrow>{locale === "zh" ? "档案剪影" : "Archive"}</StudioEyebrow>
            <button className="studio-link-button" type="button" onClick={() => setIsHistoryOpen(true)}>
              {locale === "zh" ? `查看全部 ${history.length} 册` : `View all ${history.length}`}
              <i className="ri-arrow-right-up-line" />
            </button>
          </div>
          <div className="studio-session-list">
            {history.slice(0, 4).map((item) => (
              <button
                key={item.id}
                type="button"
                className={`studio-session-item ${item.id === session.id ? "is-active" : ""}`}
                onClick={() => handleLoadHistory(item)}
              >
                <span>{item.title}</span>
                <small>{formatShortDate(item.updatedAt)} · {getMemoirStatus(item, locale)}</small>
              </button>
            ))}
            {history.length === 0 && (
              <p className="studio-empty-note">{locale === "zh" ? "还没有历史。第一段口述会自动成为新的回忆录档案。" : "No archive yet. Your first answer will start a memoir."}</p>
            )}
          </div>
        </aside>

        <StudioCenterStage
          locale={locale}
          phaseInfo={phaseInfo}
          latestAgentQuestion={latestAgentQuestion}
          activePhoto={activePhoto}
          photoQuestionIndex={activePhoto ? photoQuestionIndex : null}
          isCallActive={isCallActive}
          isVoiceBusy={isVoiceBusy}
          isRecording={recorder.isRecording}
          elapsedSec={elapsedSec}
          error={error}
          notice={studioNotice}
          onSpeakQuestion={handleSpeakQuestion}
          onCallButton={handleCallButton}
        />

        <aside className="studio-rail studio-rail-right">
          <div>
            <StudioEyebrow>{locale === "zh" ? "成书度" : "Book progress"}</StudioEyebrow>
            <div className="studio-compact-progress">
              <span><i style={{ width: `${readiness}%` }} /></span>
              <strong>{readiness}%</strong>
            </div>
          </div>
          <div className="studio-soul-card">
            <StudioEyebrow>{locale === "zh" ? "灵魂句" : "Soul line"}</StudioEyebrow>
            <p>{bookDraft?.soulSentence ?? (locale === "zh" ? "那些慢慢说出的日子，会被家人记住。" : "The days told slowly can be kept.")}</p>
          </div>
          <div className="studio-stats-grid">
            <StudioMetric label={locale === "zh" ? "字数" : "Words"} value={storyCharacterCount.toLocaleString()} />
            <StudioMetric label={locale === "zh" ? "照片" : "Photos"} value={photoMemories.length} />
            <StudioMetric label={locale === "zh" ? "问答" : "Turns"} value={elderTurns.length} />
            <StudioMetric label={locale === "zh" ? "状态" : "Status"} value={session.isPaid ? (locale === "zh" ? "已付" : "Paid") : (locale === "zh" ? "未付" : "Unpaid")} />
          </div>
          <div>
            <StudioEyebrow>{locale === "zh" ? "材料目录" : "Materials"}</StudioEyebrow>
            <div className="studio-chapter-list">
              <div className="studio-chapter-row"><span>I</span><p>{locale === "zh" ? "时间线叙事" : "Timeline interview"}</p></div>
              <div className="studio-chapter-row"><span>II</span><p>{locale === "zh" ? "老照片记忆" : "Old photo memories"}</p></div>
              <div className="studio-chapter-row"><span>III</span><p>{locale === "zh" ? "成书编辑" : "Book editing"}</p></div>
            </div>
          </div>
          <div className="studio-right-actions">
            <button className="studio-secondary-button" type="button" onClick={() => setIsPhotosOpen(true)}>
              <i className="ri-image-line" />
              {locale === "zh" ? "老照片记忆" : "Photo memories"}
            </button>
            <button className="studio-secondary-button" type="button" onClick={() => setIsTranscriptOpen(true)}>
              <i className="ri-file-list-3-line" />
              {locale === "zh" ? "整理逐字稿" : "Transcript"}
            </button>
            <button className="studio-primary-button" type="button" disabled={isGenerating || isAsking} onClick={handleGenerateBook}>
              <i className={isGenerating ? "ri-loader-4-line" : "ri-book-open-line"} />
              {isGenerating ? (locale === "zh" ? "生成中" : "Generating") : (bookDraft ? (locale === "zh" ? "重新成书" : "Regenerate") : (locale === "zh" ? "生成回忆录" : "Create memoir"))}
            </button>
          </div>
        </aside>
      </section>

      <StudioBottomDock
        locale={locale}
        typedAnswer={typedAnswer}
        latestElderAnswer={latestElderAnswer}
        isAsking={isAsking}
        activePhoto={activePhoto}
        onTextChange={setTypedAnswer}
        onSubmit={submitAnswer}
        onOpenTranscript={() => setIsTranscriptOpen(true)}
      />

      <HistorySheet
        locale={locale}
        open={isHistoryOpen}
        history={history}
        activeId={session.id}
        onClose={() => setIsHistoryOpen(false)}
        onNew={handleNewInterview}
        onImport={() => setIsImportOpen(true)}
        onLoad={handleLoadHistory}
        onDelete={handleDeleteHistory}
        onRename={handleRenameHistory}
        onClone={handleCloneHistory}
      />
      <TranscriptSheet
        locale={locale}
        open={isTranscriptOpen}
        turns={session.turns}
        insights={session.insights}
        readiness={readiness}
        canUndo={historyIndex >= 0}
        canRedo={historyIndex < editHistory.length - 1}
        selectedAudioName={recorder.audioFile?.name ?? ""}
        isTranscribing={isTranscribing}
        error={error}
        onClose={() => setIsTranscriptOpen(false)}
        onUpdateTurn={handleUpdateTurn}
        onDeleteTurn={handleDeleteTurn}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onPickAudio={() => audioInputRef.current?.click()}
        onTranscribe={handleBailianTranscribe}
      />
      <PhotoMemorySheet
        locale={locale}
        open={isPhotosOpen}
        photos={photoMemories}
        activePhotoId={activePhotoId}
        onClose={() => setIsPhotosOpen(false)}
        onUpload={() => photoInputRef.current?.click()}
        onFocus={(id) => {
          setActivePhotoId(id);
          setPhotoQuestionIndex(0);
          setIsPhotosOpen(false);
          const focusedPhotoName = photoMemories.find((photo) => photo.id === id)?.fileName;
          setStudioNotice(locale === "zh" ? `正在围绕“${focusedPhotoName ?? "这张照片"}”继续访谈。` : `Continuing the interview around "${focusedPhotoName ?? "this photo"}".`);
          setSession((current) => ({ ...current, turns: [...current.turns, nowTurn("agent", getInitialPhotoQuestion(locale))] }));
        }}
        onUpdate={handleUpdatePhoto}
        onDelete={handleDeletePhoto}
      />

      <AnimatePresence>
        {bookDraft && isBookOpen && <BookReader key="book-reader" book={bookDraft} locale={locale} onClose={() => setIsBookOpen(false)} onChange={setBookDraft} />}
      </AnimatePresence>
      <AnimatePresence>
        {isPaymentOpen && <StudioPaymentDialog key="payment" locale={locale} isGenerating={isGenerating} onClose={() => setIsPaymentOpen(false)} onComplete={handlePaymentComplete} />}
      </AnimatePresence>
      <AnimatePresence>
        {isSettingsOpen && (
          <SettingsDialog
            key="settings"
            apiStatus={apiStatus} bailianApiKey={bailianApiKey} bailianEndpoint={bailianEndpoint}
            bailianAsrModel={bailianAsrModel} bailianTtsEndpoint={bailianTtsEndpoint}
            bailianTtsModel={bailianTtsModel} ttsVoice={ttsVoice} isDark={isDark}
            locale={locale} t={t} onClose={() => setIsSettingsOpen(false)}
            onToggleTheme={() => setIsDark((value) => !value)} onToggleLocale={() => setLocale(locale === "zh" ? "en" : "zh")}
            onBailianApiKeyChange={setBailianApiKey} onBailianEndpointChange={setBailianEndpoint}
            onBailianAsrModelChange={setBailianAsrModel} onBailianTtsEndpointChange={setBailianTtsEndpoint}
            onBailianTtsModelChange={setBailianTtsModel} onTtsVoiceChange={setTtsVoice}
            onResetVoiceDefaults={() => { setBailianEndpoint(defaultBailianEndpoint); setBailianAsrModel("fun-asr-realtime-2026-02-28"); setBailianTtsEndpoint(defaultBailianTtsEndpoint); setBailianTtsModel("qwen3-tts-instruct-flash-realtime"); setTtsVoice("Cherry"); }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isImportOpen && <ImportDialog key="import" locale={locale} onClose={() => setIsImportOpen(false)} onImport={handleImportContent} />}
      </AnimatePresence>
    </main>
  );
}

function StudioRibbon({
  locale,
  title,
  isDark,
  onNew,
  onOpenHistory,
  onToggleTheme,
  onOpenSettings,
  onLogout,
}: {
  locale: Locale;
  title: string;
  isDark: boolean;
  onNew: () => void;
  onOpenHistory: () => void;
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
}) {
  return (
    <header className="studio-ribbon">
      <div className="studio-brand">
        <img className="studio-logo" src={logoImage} alt={locale === "zh" ? "星光回忆录" : "Starlight Memoir"} />
        <div>
          <strong>{locale === "zh" ? "星光回忆录" : "Starlight Memoir"}</strong>
          <StudioEyebrow>Studio</StudioEyebrow>
        </div>
      </div>
      <div className="studio-current-session">
        <span>{title}</span>
      </div>
      <div className="studio-ribbon-actions">
        <StudioIconButton label={locale === "zh" ? "新建" : "New"} icon="ri-add-line" onClick={onNew} />
        <StudioIconButton label={locale === "zh" ? "历史" : "History"} icon="ri-time-line" onClick={onOpenHistory} />
        <StudioIconButton label={locale === "zh" ? "深浅色" : "Theme"} icon={isDark ? "ri-sun-line" : "ri-moon-line"} onClick={onToggleTheme} />
        <StudioIconButton label={locale === "zh" ? "设置" : "Settings"} icon="ri-settings-3-line" onClick={onOpenSettings} />
        <StudioIconButton label={locale === "zh" ? "退出" : "Logout"} icon="ri-logout-box-r-line" onClick={onLogout} />
      </div>
    </header>
  );
}

function StudioCenterStage({
  locale,
  phaseInfo,
  latestAgentQuestion,
  activePhoto,
  photoQuestionIndex,
  isCallActive,
  isVoiceBusy,
  isRecording,
  elapsedSec,
  error,
  notice,
  onSpeakQuestion,
  onCallButton,
}: {
  locale: Locale;
  phaseInfo: { label: string; hint: string };
  latestAgentQuestion: string;
  activePhoto: PhotoMemory | null;
  photoQuestionIndex: number | null;
  isCallActive: boolean;
  isVoiceBusy: boolean;
  isRecording: boolean;
  elapsedSec: number;
  error: string;
  notice: string;
  onSpeakQuestion: () => void;
  onCallButton: () => void;
}) {
  return (
    <section className={`studio-center-stage ${activePhoto ? "has-photo" : ""}`}>
      <div className="studio-chapter-mark">
        <strong>{locale === "zh" ? "第一章 · 序曲" : "Chapter I · Prelude"}</strong>
      </div>
      {activePhoto && (
        <figure className="studio-photo-focus">
          <img src={activePhoto.imageDataUrl} alt={activePhoto.fileName} />
          <figcaption>
            {locale === "zh" ? `照片访谈 ${Number(photoQuestionIndex ?? 0) + 1}/3` : `Photo interview ${Number(photoQuestionIndex ?? 0) + 1}/3`}
            <span>{activePhoto.fileName}</span>
          </figcaption>
        </figure>
      )}
      <div className="studio-question-block">
        <h1>{latestAgentQuestion}</h1>
        <button type="button" onClick={onSpeakQuestion}>
          <i className="ri-volume-up-line" />
          {locale === "zh" ? "朗读这一问" : "Read question"}
        </button>
      </div>
      <div className="studio-orb-wrap">
        {isRecording && <span className="studio-orb-ring" />}
        {isRecording && <span className="studio-orb-ring studio-orb-ring-late" />}
        <button
          className={`studio-call-orb ${isCallActive ? "is-active" : ""}`}
          type="button"
          disabled={isVoiceBusy && !isRecording}
          data-space-talk-button
          onClick={onCallButton}
          aria-label={isRecording ? (locale === "zh" ? "停止录音" : "Stop recording") : (locale === "zh" ? "开始口述" : "Start speaking")}
        >
          <i className={isRecording ? "ri-stop-fill" : "ri-mic-line"} />
        </button>
      </div>
      <p className="studio-stage-hint">
        {error || phaseInfo.hint}
        {isCallActive && elapsedSec > 0 ? ` · ${formatDuration(elapsedSec)}` : ""}
      </p>
      <AnimatePresence>
        {notice && (
          <motion.p
            className="studio-flow-notice"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <i className="ri-checkbox-circle-line" />
            {notice}
          </motion.p>
        )}
      </AnimatePresence>
      <p className="studio-stage-tip">
        <kbd>Space</kbd>
        {locale === "zh" ? "按空格开始/停止口述" : "Press Space to start/stop speaking"}
      </p>
    </section>
  );
}

function StudioBottomDock({
  locale,
  typedAnswer,
  latestElderAnswer,
  isAsking,
  activePhoto,
  onTextChange,
  onSubmit,
  onOpenTranscript,
}: {
  locale: Locale;
  typedAnswer: string;
  latestElderAnswer: string;
  isAsking: boolean;
  activePhoto: PhotoMemory | null;
  onTextChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  onOpenTranscript: () => void;
}) {
  return (
    <footer className="studio-bottom-dock">
      <form onSubmit={onSubmit}>
        <StudioEyebrow>{locale === "zh" ? "也可打字" : "Type"}</StudioEyebrow>
        <input
          value={typedAnswer}
          onChange={(event) => onTextChange(event.target.value)}
          placeholder={activePhoto
            ? (locale === "zh" ? "围绕中间这张照片回答…" : "Answer about the photo in the center...")
            : (locale === "zh" ? "把老人的回答记在这里…" : "Write the answer here...")}
        />
        <button className="studio-send-button" type="submit" disabled={!typedAnswer.trim() || isAsking}>
          {isAsking ? (locale === "zh" ? "整理中" : "Thinking") : (locale === "zh" ? "送出" : "Send")}
        </button>
      </form>
      <button className="studio-last-turn" type="button" onClick={onOpenTranscript}>
        <StudioEyebrow>{locale === "zh" ? "上一句口述" : "Last answer"}</StudioEyebrow>
        <span>{latestElderAnswer || (locale === "zh" ? "上一句口述会出现在这里" : "The latest answer appears here")}</span>
        <small>{locale === "zh" ? "整理" : "Edit"}</small>
      </button>
    </footer>
  );
}

function HistorySheet({
  locale,
  open,
  history,
  activeId,
  onClose,
  onNew,
  onImport,
  onLoad,
  onDelete,
  onRename,
  onClone,
}: {
  locale: Locale;
  open: boolean;
  history: SavedMemoir[];
  activeId: string;
  onClose: () => void;
  onNew: () => void;
  onImport: () => void;
  onLoad: (item: SavedMemoir) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onClone: (item: SavedMemoir) => void;
}) {
  const [editingId, setEditingId] = useState("");
  const [editingTitle, setEditingTitle] = useState("");
  return (
    <StudioSheet
      side="left"
      open={open}
      width="31rem"
      eyebrow={locale === "zh" ? "历史" : "History"}
      title={locale === "zh" ? "回忆录档案" : "Memoir archive"}
      onClose={onClose}
    >
      <div className="studio-sheet-actions">
        <button className="studio-primary-button" type="button" onClick={onNew}>
          <i className="ri-add-line" />
          {locale === "zh" ? "新建" : "New"}
        </button>
        <button className="studio-secondary-button" type="button" onClick={onImport}>
          <i className="ri-import-line" />
          {locale === "zh" ? "导入记录" : "Import"}
        </button>
      </div>
      <div className="studio-history-list">
        {history.length === 0 ? (
          <p className="studio-empty-note">{locale === "zh" ? "还没有历史记录。" : "No saved sessions yet."}</p>
        ) : history.map((item, index) => (
          <article key={item.id}>
            <div className="studio-history-main" onClick={() => onLoad(item)}>
              <span>{toRoman(index + 1)}</span>
              <div>
                {editingId === item.id ? (
                  <input
                    value={editingTitle}
                    onChange={(event) => setEditingTitle(event.target.value)}
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && editingTitle.trim()) {
                        onRename(item.id, editingTitle.trim());
                        setEditingId("");
                      }
                      if (event.key === "Escape") setEditingId("");
                    }}
                    autoFocus
                  />
                ) : (
                  <strong>{item.title}</strong>
                )}
                <div className="studio-history-meta">
                  <small>{formatShortDate(item.updatedAt)} · {item.id === activeId ? (locale === "zh" ? "当前" : "Current") : getMemoirStatus(item, locale)}</small>
                  <span>{locale === "zh" ? `${countElderTurns(item)} 轮问答` : `${countElderTurns(item)} answers`}</span>
                  <span>{locale === "zh" ? `${item.session.photos?.length ?? 0} 张照片` : `${item.session.photos?.length ?? 0} photos`}</span>
                  <span>{item.session.isPaid ? (locale === "zh" ? "已付费" : "Paid") : (locale === "zh" ? "未付费" : "Unpaid")}</span>
                </div>
              </div>
            </div>
            <div className="studio-history-tools">
              <button type="button" onClick={() => { setEditingId(item.id); setEditingTitle(item.title); }} aria-label={locale === "zh" ? "重命名" : "Rename"}>
                <i className="ri-edit-line" />
              </button>
              <button type="button" onClick={() => onClone(item)} aria-label={locale === "zh" ? "复制" : "Clone"}>
                <i className="ri-file-copy-line" />
              </button>
              <button type="button" onClick={() => onDelete(item.id)} aria-label={locale === "zh" ? "删除" : "Delete"}>
                <i className="ri-delete-bin-line" />
              </button>
            </div>
          </article>
        ))}
      </div>
    </StudioSheet>
  );
}

function TranscriptSheet({
  locale,
  open,
  turns,
  insights,
  readiness,
  canUndo,
  canRedo,
  selectedAudioName,
  isTranscribing,
  error,
  onClose,
  onUpdateTurn,
  onDeleteTurn,
  onUndo,
  onRedo,
  onPickAudio,
  onTranscribe,
}: {
  locale: Locale;
  open: boolean;
  turns: InterviewTurn[];
  insights: InterviewSession["insights"];
  readiness: number;
  canUndo: boolean;
  canRedo: boolean;
  selectedAudioName: string;
  isTranscribing: boolean;
  error: string;
  onClose: () => void;
  onUpdateTurn: (turnId: string, newContent: string) => void;
  onDeleteTurn: (turnId: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onPickAudio: () => void;
  onTranscribe: () => void;
}) {
  return (
    <StudioSheet
      side="right"
      open={open}
      width="39rem"
      eyebrow={locale === "zh" ? "逐字稿" : "Transcript"}
      title={locale === "zh" ? "对话与订正" : "Conversation edits"}
      onClose={onClose}
      footer={(
        <div className="studio-transcript-footer">
          <button className="studio-secondary-button" type="button" onClick={onPickAudio}>
            <i className="ri-upload-cloud-2-line" />
            <span>{selectedAudioName || (locale === "zh" ? "选择音频" : "Choose audio")}</span>
          </button>
          <button className="studio-secondary-button" type="button" onClick={onUndo} disabled={!canUndo}>
            <i className="ri-arrow-go-back-line" />
          </button>
          <button className="studio-primary-button" type="button" onClick={onTranscribe} disabled={!selectedAudioName || isTranscribing}>
            <i className={isTranscribing ? "ri-loader-4-line" : "ri-file-text-line"} />
            {isTranscribing ? (locale === "zh" ? "识别中" : "Transcribing") : (locale === "zh" ? "转写" : "Transcribe")}
          </button>
          <button className="studio-secondary-button" type="button" onClick={onRedo} disabled={!canRedo}>
            <i className="ri-arrow-go-forward-line" />
          </button>
        </div>
      )}
    >
      <div className="studio-insight-grid">
        {insights.slice(0, 4).map((insight) => (
          <div key={`${insight.label}-${insight.value}`}>
            <StudioEyebrow>{insight.label}</StudioEyebrow>
            <p>{insight.value}</p>
          </div>
        ))}
      </div>
      <div className="studio-readiness-inline">
        <StudioEyebrow>{locale === "zh" ? "成书度" : "Progress"}</StudioEyebrow>
        <span><i style={{ width: `${readiness}%` }} /></span>
        <strong>{readiness}%</strong>
      </div>
      {error && <p className="studio-error-note">{error}</p>}
      <div className="studio-turn-list">
        {turns.map((turn) => (
          <article key={turn.id} className={turn.role === "agent" ? "is-agent" : "is-elder"}>
            <header>
              <StudioEyebrow>{turn.role === "agent" ? (locale === "zh" ? "AI 提问" : "Guide") : (locale === "zh" ? "老人回答" : "Answer")}</StudioEyebrow>
              <span>{formatTurnTime(turn.createdAt)}</span>
            </header>
            {turn.role === "elder" ? (
              <textarea
                value={turn.content}
                onChange={(event) => onUpdateTurn(turn.id, event.target.value)}
                aria-label={locale === "zh" ? "编辑回答" : "Edit answer"}
              />
            ) : (
              <p>{turn.content}</p>
            )}
            {turn.role === "elder" && (
              <button className="studio-plain-action" type="button" onClick={() => onDeleteTurn(turn.id)}>
                <i className="ri-delete-bin-line" />
                <span>{locale === "zh" ? "删除" : "Delete"}</span>
              </button>
            )}
          </article>
        ))}
      </div>
    </StudioSheet>
  );
}

function PhotoMemorySheet({
  locale,
  open,
  photos,
  activePhotoId,
  onClose,
  onUpload,
  onFocus,
  onUpdate,
  onDelete,
}: {
  locale: Locale;
  open: boolean;
  photos: PhotoMemory[];
  activePhotoId: string | null;
  onClose: () => void;
  onUpload: () => void;
  onFocus: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Pick<PhotoMemory, "description" | "story" | "aiObservation">>) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <StudioSheet
      side="right"
      open={open}
      width="42rem"
      eyebrow={locale === "zh" ? "老照片记忆" : "Photo memories"}
      title={locale === "zh" ? "围绕照片补齐故事" : "Complete stories from photos"}
      onClose={onClose}
    >
      <div className="studio-sheet-actions">
        <button className="studio-primary-button" type="button" onClick={onUpload}>
          <i className="ri-image-add-line" />
          {locale === "zh" ? "上传照片" : "Upload photos"}
        </button>
        <button className="studio-secondary-button" type="button" onClick={onClose}>
          {locale === "zh" ? "回到访谈" : "Back to interview"}
        </button>
      </div>
      {photos.length === 0 ? (
        <p className="studio-empty-note">
          {locale === "zh" ? "上传老照片后，照片会出现在中间舞台，AI 会围绕这张照片追问 3 个问题，然后回到原来的访谈链路。" : "Upload a photo and it will appear in the center. The guide will ask three photo questions, then return to the normal interview."}
        </p>
      ) : (
        <div className="studio-photo-list">
          {photos.map((photo) => (
            <article key={photo.id} className={photo.id === activePhotoId ? "is-active" : ""}>
              <button className="studio-photo-thumb" type="button" onClick={() => onFocus(photo.id)}>
                <img src={photo.imageDataUrl} alt={photo.fileName} />
              </button>
              <div>
                <header>
                  <strong>{photo.fileName}</strong>
                  {photo.id === activePhotoId && (
                    <span>{locale === "zh" ? "访谈中" : "Active"}</span>
                  )}
                  <button type="button" onClick={() => onDelete(photo.id)} aria-label={locale === "zh" ? "删除照片" : "Delete photo"}>
                    <i className="ri-delete-bin-line" />
                  </button>
                </header>
                <p>{photo.aiObservation}</p>
                <textarea
                  value={photo.description}
                  onChange={(event) => onUpdate(photo.id, { description: event.target.value })}
                  placeholder={locale === "zh" ? "照片里的人、地点、时间…" : "People, place, time..."}
                />
                <textarea
                  value={photo.story}
                  onChange={(event) => onUpdate(photo.id, { story: event.target.value })}
                  placeholder={locale === "zh" ? "这张照片背后的故事…" : "The story behind this photo..."}
                />
              </div>
            </article>
          ))}
        </div>
      )}
    </StudioSheet>
  );
}

function StudioSheet({
  side,
  open,
  width,
  eyebrow,
  title,
  children,
  footer,
  onClose,
}: {
  side: "left" | "right";
  open: boolean;
  width: string;
  eyebrow: string;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
}) {
  return (
    <>
      <motion.div
        className={`studio-sheet-backdrop ${open ? "is-open" : ""}`}
        initial={false}
        animate={{ opacity: open ? 1 : 0 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        onClick={onClose}
      />
      <motion.aside
        className={`studio-sheet studio-sheet-${side}`}
        initial={false}
        animate={{ x: open ? 0 : side === "left" ? "-100%" : "100%" }}
        transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
        style={{ width, pointerEvents: open ? "auto" : "none" }}
      >
        <header>
          <div>
            <StudioEyebrow>{eyebrow}</StudioEyebrow>
            <h2>{title}</h2>
          </div>
          <StudioIconButton label="Close" icon="ri-close-line" onClick={onClose} />
        </header>
        <div className="studio-sheet-body">{children}</div>
        {footer && <footer>{footer}</footer>}
      </motion.aside>
    </>
  );
}

function StudioPaymentDialog({
  locale,
  isGenerating,
  onClose,
  onComplete,
}: {
  locale: Locale;
  isGenerating: boolean;
  onClose: () => void;
  onComplete: () => void;
}) {
  return (
    <motion.div
      className="studio-payment-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.section
        className="studio-payment-card"
        initial={{ opacity: 0, y: 18, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.985 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      >
        <header>
          <div>
            <StudioEyebrow>{locale === "zh" ? "成书付费" : "Payment"}</StudioEyebrow>
            <h2>{locale === "zh" ? "付费完成后生成电子版" : "Pay to create the book"}</h2>
          </div>
          <StudioIconButton label={locale === "zh" ? "关闭" : "Close"} icon="ri-close-line" onClick={onClose} />
        </header>
        <div className="studio-payment-grid">
          <div>
            <div className="studio-mock-qr studio-mock-qr-alipay">
              <span className="qr-pixel-field" />
              <span className="qr-corner qr-corner-tl" />
              <span className="qr-corner qr-corner-tr" />
              <span className="qr-corner qr-corner-bl" />
              <i className="ri-alipay-line" />
            </div>
            <strong>支付宝</strong>
          </div>
          <div>
            <div className="studio-mock-qr studio-mock-qr-wechat">
              <span className="qr-pixel-field" />
              <span className="qr-corner qr-corner-tl" />
              <span className="qr-corner qr-corner-tr" />
              <span className="qr-corner qr-corner-bl" />
              <i className="ri-wechat-pay-line" />
            </div>
            <strong>微信支付</strong>
          </div>
        </div>
        <p>{locale === "zh" ? "当前为 Mock 支付二维码。点击下方按钮模拟支付成功，并继续生成回忆录。" : "These are mock QR codes. Confirm to continue generating the memoir."}</p>
        <button className="studio-primary-button" type="button" disabled={isGenerating} onClick={onComplete}>
          <i className={isGenerating ? "ri-loader-4-line" : "ri-checkbox-circle-line"} />
          {isGenerating ? (locale === "zh" ? "生成中" : "Generating") : (locale === "zh" ? "我已完成支付" : "Payment completed")}
        </button>
      </motion.section>
    </motion.div>
  );
}

function StudioMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="studio-metric">
      <StudioEyebrow>{label}</StudioEyebrow>
      <strong>{value}</strong>
    </div>
  );
}

function StudioIconButton({ label, icon, onClick }: { label: string; icon: string; onClick: () => void }) {
  return (
    <button className="studio-icon-button" type="button" title={label} aria-label={label} onClick={onClick}>
      <i className={icon} />
    </button>
  );
}

function StudioEyebrow({ children }: { children: ReactNode }) {
  return <span className="studio-eyebrow">{children}</span>;
}

function getStudioPhaseInfo(phase: ConversationPhase, locale: Locale, activePhoto: PhotoMemory | null) {
  if (activePhoto) {
    return {
      label: locale === "zh" ? "老照片追问" : "Photo prompt",
      hint: locale === "zh" ? "围绕中间这张照片回答，三问结束后会继续原来的访谈。" : "Answer about the photo. After three questions, the interview will continue.",
    };
  }
  const zh: Record<ConversationPhase, { label: string; hint: string }> = {
    idle: { label: "等待开场", hint: "点击中央按钮开始像通话一样的访谈，也可以在底部打字。" },
    ready: { label: "准备倾听", hint: "可以继续口述，也可以直接输入文字回答。" },
    recording: { label: "正在记录", hint: "讲完后再次点击中间按钮，AI 会整理并继续追问。" },
    transcribing: { label: "语音识别", hint: "正在把语音转成文字。" },
    thinking: { label: "整理问题", hint: "正在根据刚才的回答生成下一问。" },
    speaking: { label: "温柔朗读", hint: "AI 正在朗读这一问。" },
    error: { label: "需要处理", hint: "请根据提示处理后继续访谈。" },
  };
  const en: Record<ConversationPhase, { label: string; hint: string }> = {
    idle: { label: "Opening", hint: "Tap the center button to start a call-like interview, or type below." },
    ready: { label: "Ready", hint: "Keep speaking, or type the answer directly." },
    recording: { label: "Recording", hint: "Tap the center button again when finished." },
    transcribing: { label: "Transcribing", hint: "Turning the audio into text." },
    thinking: { label: "Thinking", hint: "Preparing the next question." },
    speaking: { label: "Reading", hint: "The guide is reading this question." },
    error: { label: "Needs attention", hint: "Resolve the note and continue." },
  };
  return (locale === "zh" ? zh : en)[phase];
}

function withPhotoMemoryTurns(session: InterviewSession, locale: Locale): InterviewSession {
  const photoTurns = (session.photos ?? [])
    .map((photo) => {
      const detail = [photo.description, photo.aiObservation, photo.story].filter(Boolean).join("\n");
      return detail.trim()
        ? nowTurn("elder", locale === "zh" ? `老照片记忆：${detail}` : `Old photo memory: ${detail}`)
        : null;
    })
    .filter((turn): turn is InterviewTurn => Boolean(turn));
  return { ...session, turns: [...session.turns, ...photoTurns] };
}

function getInitialPhotoQuestion(locale: Locale) {
  return locale === "zh"
    ? "我们先看这张照片。请您先描述一下照片里有什么：都有谁、在哪里、他们在做什么？"
    : "Let's look at this photo first. Could you describe what is in it: who is there, where they are, and what they are doing?";
}

function buildPhotoFollowupSession(session: InterviewSession, photo: PhotoMemory, locale: Locale, nextIndex: number): InterviewSession {
  const instruction = locale === "zh"
    ? [
        "照片访谈上下文：你正在围绕一张老照片采访长辈。",
        `接下来要提出第 ${nextIndex + 1} 个照片问题。`,
        "必须根据长辈刚才的回答继续追问，不要使用固定模板问题。",
        "只问一个温和、具体、容易回答的问题；优先追问人物关系、拍摄时间地点、当天发生的小事、情绪或照片之外的细节。",
      ].join("\n")
    : [
        "Photo interview context: you are interviewing an elder about one old photo.",
        `Next, ask photo question ${nextIndex + 1}.`,
        "Base the question on the elder's latest answer; do not use a fixed template.",
        "Ask exactly one warm, specific, easy-to-answer follow-up about relationships, time, place, what happened that day, emotions, or details outside the frame.",
      ].join("\n");
  const photoContext = [
    photo.fileName,
    photo.description,
    photo.aiObservation,
    photo.story,
  ].filter(Boolean).join("\n");

  return {
    ...session,
    turns: [
      ...session.turns,
      nowTurn("agent", instruction),
      nowTurn("elder", locale === "zh" ? `这张老照片目前的信息：\n${photoContext || "暂无补充信息"}` : `Current information about this old photo:\n${photoContext || "No extra notes yet"}`),
    ],
  };
}

function buildPhotoFollowupAnswer(photo: PhotoMemory, latestAnswer: string, locale: Locale, nextIndex: number) {
  return locale === "zh"
    ? [
        "[PHOTO_FOLLOWUP]",
        `照片文件：${photo.fileName}`,
        `这是第 ${nextIndex + 1} 个照片追问。`,
        `长辈刚才回答：${latestAnswer}`,
        "请根据这段回答生成一个自然的下一问，只输出问题本身。",
      ].join("\n")
    : [
        "[PHOTO_FOLLOWUP]",
        `Photo file: ${photo.fileName}`,
        `This is photo follow-up question ${nextIndex + 1}.`,
        `The elder just answered: ${latestAnswer}`,
        "Generate one natural next question based on that answer. Output only the question.",
      ].join("\n");
}

function normalizeQuestion(value: string) {
  return value
    .trim()
    .replace(/^["“”]+|["“”]+$/g, "")
    .split(/\n+/)
    .find((line) => line.trim().length > 0)
    ?.trim() ?? "";
}

function getPhotoFallbackQuestion(locale: Locale, answer: string, nextIndex: number) {
  const hasPeople = /妈妈|爸爸|父亲|母亲|爷爷|奶奶|外公|外婆|老师|同学|朋友|哥哥|姐姐|弟弟|妹妹|叔叔|阿姨|mother|father|grand|teacher|friend|brother|sister/i.test(answer);
  const hasPlace = /家|学校|村|镇|城|厂|店|河|山|院|街|北京|上海|广州|place|home|school|village|town|city|factory|street/i.test(answer);
  if (locale === "zh") {
    if (nextIndex === 1) {
      if (hasPeople) return "您刚才提到照片里的人，您和他们当时是什么关系？那时候最常一起做什么？";
      if (hasPlace) return "您刚才提到这个地方，那时那里平常是什么样子？这张照片为什么会在那里拍？";
      return "听起来这张照片里有不少细节。您还记得拍照前后发生了什么小事吗？";
    }
    return "如果让家人多年以后看这张照片，您最希望他们记住照片背后的哪一个细节？";
  }
  if (nextIndex === 1) {
    if (hasPeople) return "You mentioned the people in the photo. What was your relationship with them then, and what did you often do together?";
    if (hasPlace) return "You mentioned that place. What was it usually like then, and why was this photo taken there?";
    return "There seem to be many details in this photo. Do you remember what happened just before or after it was taken?";
  }
  return "When your family looks at this photo years from now, what detail behind it do you most want them to remember?";
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function createPhotoMemory(file: File, locale: Locale): Promise<PhotoMemory> {
  const imageDataUrl = await fileToDataUrl(file);
  const baseName = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
  return {
    id: crypto.randomUUID(),
    imageDataUrl,
    fileName: file.name,
    description: "",
    aiObservation: locale === "zh"
      ? `已导入“${baseName || "老照片"}”。接下来会围绕这张照片问几个问题。`
      : `Imported "${baseName || "old photo"}". The next few questions will focus on this photo.`,
    story: "",
    createdAt: new Date().toISOString(),
  };
}

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatTurnTime(value: string) {
  return new Date(value).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, "0");
  const secs = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

function toRoman(value: number) {
  const numerals = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
  return numerals[value - 1] ?? String(value).padStart(2, "0");
}

function countElderTurns(item: SavedMemoir) {
  return item.session.turns.filter((turn) => turn.role === "elder").length;
}

function getMemoirStatus(item: SavedMemoir, locale: Locale) {
  if (item.bookDraft) return locale === "zh" ? "已成书" : "Book ready";
  if ((item.session.photos?.length ?? 0) > 0) return locale === "zh" ? "采集中 · 有照片" : "Collecting · photos";
  if (countElderTurns(item) > 0) return locale === "zh" ? "采集中" : "Collecting";
  return locale === "zh" ? "未开始" : "Not started";
}
