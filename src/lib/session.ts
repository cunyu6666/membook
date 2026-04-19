/**
 * [WHO]: 提供 createInitialSession, readSavedMemoirs, nowTurn, makeHistoryTitle 函数和 SavedMemoir 类型
 * [FROM]: 依赖 devSeed 开发种子数据、i18n国际化、types类型定义
 * [TO]: 被 App.tsx 和 StudioPage.tsx 消费，用于会话创建和持久化
 * [HERE]: src/lib/session.ts，会话管理与本地存储层
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

export function cloneMemoir(memoir: SavedMemoir): SavedMemoir {
  return {
    ...memoir,
    id: crypto.randomUUID(),
    title: `${memoir.title} (copy)`,
    updatedAt: new Date().toISOString(),
    session: {
      ...memoir.session,
      id: crypto.randomUUID(),
      turns: memoir.session.turns.map((turn) => ({ ...turn, id: crypto.randomUUID() })),
    },
  };
}
