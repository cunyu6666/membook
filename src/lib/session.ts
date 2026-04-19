/**
 * [WHO]: 提供 createSession, readSavedMemoirs, type SavedMemoir
 * [FROM]: 依赖 devSeed, i18n, types
 * [TO]: 被 App.tsx 消费
 * [HERE]: src/lib/，会话管理工具模块
 */
import { seedMockMemoir } from "./devSeed";
import { copy, type Locale } from "./i18n";
import type { BookDraft, InterviewSession, InterviewTurn } from "./types";

export type SavedMemoir = {
  id: string;
  title: string;
  updatedAt: string;
  session: InterviewSession;
  bookDraft: BookDraft | null;
};

export function nowTurn(role: InterviewTurn["role"], content: string): InterviewTurn {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    createdAt: new Date().toISOString(),
  };
}

export function createInitialSession(locale: Locale): InterviewSession {
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

export function readSavedMemoirs(): SavedMemoir[] {
  if (import.meta.env.DEV) {
    seedMockMemoir();
  }
  try {
    const raw = localStorage.getItem("membook.history");
    return raw ? (JSON.parse(raw) as SavedMemoir[]) : [];
  } catch {
    return [];
  }
}

export function makeHistoryTitle(session: InterviewSession, locale: Locale): string {
  const firstAnswer = session.turns.find((turn) => turn.role === "elder")?.content;
  if (!firstAnswer) {
    return locale === "zh" ? "新的访谈" : "New interview";
  }
  return firstAnswer.slice(0, 18) + (firstAnswer.length > 18 ? "..." : "");
}
