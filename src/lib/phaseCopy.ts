/**
 * [WHO]: 提供 getPhaseCopy, getPhaseProgress, getPhaseRhythm, type ConversationPhase
 * [FROM]: 依赖 i18n
 * [TO]: 被 App.tsx 消费
 * [HERE]: src/lib/，对话阶段状态管理
 */
import type { Locale } from "./i18n";

export type ConversationPhase =
  | "idle"
  | "ready"
  | "recording"
  | "transcribing"
  | "thinking"
  | "speaking"
  | "error";

export function getPhaseCopy(
  phase: ConversationPhase,
  locale: Locale,
): { badge: string; status: string; action: string; title: string; description: string } {
  const zh: Record<ConversationPhase, { badge: string; status: string; action: string; title: string; description: string }> = {
    idle: {
      badge: "语音通话", status: "等待开始", action: "开始通话",
      title: "像打电话一样聊回忆", description: "点击电话按钮后，AI 会先把问题读给老人听。",
    },
    ready: {
      badge: "轮到您说", status: "可以说话", action: "开始录音",
      title: "现在轮到您说", description: "点一下麦克风，或按空格开始说；讲完再点一次或再按空格，系统会自动识别、追问并继续衔接。",
    },
    recording: {
      badge: "正在听", status: "正在听你说", action: "停止录音",
      title: "我在听，慢慢说", description: "讲完这一段后点停止，或再按一次空格，不需要再点转文字或发送。",
    },
    transcribing: {
      badge: "识别中", status: "正在转成文字", action: "正在识别",
      title: "正在整理刚才的话", description: "识别完成后会自动继续，不需要再点发送。",
    },
    thinking: {
      badge: "思考中", status: "AI 正在思考下一问", action: "正在思考",
      title: "正在想一个更贴近的追问", description: "系统会先整理追问，再自动朗读，接着继续听您说。",
    },
    speaking: {
      badge: "朗读中", status: "正在朗读回复", action: "正在朗读",
      title: "AI 正在说话", description: "请听完这一句。朗读结束后会自动继续听您说；若浏览器拦截自动播放，请先点一次朗读。",
    },
    error: {
      badge: "需要处理", status: "刚才这步失败了", action: "重新开始",
      title: "这一步没有走通", description: "检查设置里的 API Key、麦克风权限或网络后，可以重新录一段。",
    },
  };

  const en: typeof zh = {
    idle: {
      badge: "Voice call", status: "Waiting to start", action: "Start call",
      title: "Talk like a phone call", description: "Tap the phone button and the guide will read the first question aloud.",
    },
    ready: {
      badge: "Your turn", status: "Ready for your voice", action: "Start recording",
      title: "Your turn to speak", description: "Tap the mic or press Space to speak, then tap again or press Space once more for the next step.",
    },
    recording: {
      badge: "Listening", status: "Listening to you", action: "Stop recording",
      title: "I am listening", description: "When this memory is complete, stop recording or press Space again. No send step is needed.",
    },
    transcribing: {
      badge: "Transcribing", status: "Converting speech to text", action: "Transcribing",
      title: "Turning voice into text", description: "The answer will continue automatically after recognition finishes.",
    },
    thinking: {
      badge: "Thinking", status: "AI is preparing the next question", action: "Thinking",
      title: "Preparing a better follow-up", description: "The guide prepares a follow-up, reads it aloud, then continues listening.",
    },
    speaking: {
      badge: "Speaking", status: "Reading the response", action: "Speaking",
      title: "The guide is speaking", description: "Listen first. Recording resumes automatically after reading unless autoplay is blocked.",
    },
    error: {
      badge: "Needs attention", status: "The last step failed", action: "Try again",
      title: "This step did not complete", description: "Check the API key, microphone permission, or network, then record again.",
    },
  };

  return locale === "zh" ? zh[phase] : en[phase];
}

export function getPhaseProgress(phase: ConversationPhase): number {
  const progress: Record<ConversationPhase, number> = {
    idle: 0, ready: 18, recording: 38, transcribing: 58,
    thinking: 78, speaking: 92, error: 100,
  };
  return progress[phase];
}

export function getCallSteps(locale: Locale) {
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

export function getRhythmItems(locale: Locale, elderTurnCount: number, readiness: number) {
  if (locale === "zh") {
    return [
      { label: "已收集片段", value: elderTurnCount > 0 ? `${elderTurnCount} 段` : "等待开讲" },
      { label: "下一步", value: readiness >= 70 ? "适合成书" : "继续追问" },
      { label: "当前氛围", value: readiness >= 40 ? "故事展开中" : "温和开场" },
    ];
  }
  return [
    { label: "Collected", value: elderTurnCount > 0 ? `${elderTurnCount} parts` : "Waiting" },
    { label: "Next", value: readiness >= 70 ? "Draft ready" : "Keep asking" },
    { label: "Tone", value: readiness >= 40 ? "Opening up" : "Gentle start" },
  ];
}
