/**
 * [WHO]: 提供AI访谈和回忆录生成的API抽象层（遵循DIP依赖倒置原则）
 * [FROM]: 依赖 ./types.ts 的类型定义，浏览器fetch API
 * [TO]: 被 StudioPage.tsx 消费，高层模块依赖此抽象接口
 * [HERE]: src/lib/agentApi.ts，AI服务接口层
 */
import type {
  AgentInterviewResponse,
  BookDraft,
  InterviewSession,
} from "./types";

/**
 * AgentApi 抽象接口 - 高层模块依赖此抽象，而非具体实现
 * 本地模式和云端模式都实现此接口，符合DIP原则
 */
export interface AgentApi {
  /**
   * 提交用户回答，获取AI追问
   */
  askAgent(session: InterviewSession, answer: string, signal?: AbortSignal): Promise<AgentInterviewResponse>;

  /**
   * 生成回忆录书稿
   */
  generateBook(session: InterviewSession, signal?: AbortSignal): Promise<BookDraft>;
}

/**
 * 本地模式 AgentApi 实现 - 直接调用本地 API 服务器
 */
export class LocalAgentApi implements AgentApi {
  private readonly baseUrl: string;

  constructor(baseUrl: string = "") {
    this.baseUrl = baseUrl;
  }

  async askAgent(session: InterviewSession, answer: string, signal?: AbortSignal): Promise<AgentInterviewResponse> {
    const response = await fetch(`${this.baseUrl}/api/agent/interview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session, answer }),
      signal,
    });

    if (!response.ok) {
      throw new Error(`Agent request failed: ${response.status}`);
    }

    return response.json();
  }

  async generateBook(session: InterviewSession, signal?: AbortSignal): Promise<BookDraft> {
    const response = await fetch(`${this.baseUrl}/api/book/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session }),
      signal,
    });

    if (!response.ok) {
      throw new Error(`Book generation failed: ${response.status}`);
    }

    return response.json();
  }
}

/**
 * 云端模式 AgentApi 实现 - 通过 server(8787) 代理到 Spring Boot(8080) → Runtime-Service(9090)
 * 符合 Runtime 接入指南：所有请求走 Backend 中转，session 由 PostgreSQL 管理
 */
export class CloudAgentApi implements AgentApi {
  private readonly proxyUrl: string;
  private readonly getToken: () => string | null;
  private sessionId: string | null = null;

  constructor(options: { proxyUrl?: string; getToken: () => string | null }) {
    this.proxyUrl = options.proxyUrl ?? "/api/cloud";
    this.getToken = options.getToken;
  }

  async askAgent(session: InterviewSession, answer: string, signal?: AbortSignal): Promise<AgentInterviewResponse> {
    // 1. Session 发现：先找已有未完成的 session
    if (!this.sessionId) {
      this.sessionId = await this.discoverSession();
    }

    // 2. 提交对话轮次 — 只传 user_text（云端 session 由 backend 管理）
    const turn = await this.submitTurn(this.sessionId, answer, signal);

    // 3. 映射为前端期望的 AgentInterviewResponse 格式
    //    云端返回 {assistant_text, assistant_audio_url}
    return {
      question: turn.assistant_text ?? "",
      insights: [],  // 云端暂不支持 insights 抽取
      readiness: Math.min(100, session.readiness + 5),
    };
  }

  async generateBook(session: InterviewSession, signal?: AbortSignal): Promise<BookDraft> {
    // 1. 触发书籍渲染（异步操作）
    await this.triggerRender(signal);

    // 2. 获取完整书籍
    const bookData = await this.fetchCompleteBook(signal);

    // 3. 映射为 BookDraft 格式
    return this.mapBookDraft(bookData, session);
  }

  // ─── Session Discovery ───

  private async discoverSession(): Promise<string> {
    const token = this.getToken();
    try {
      const res = await fetch(`${this.proxyUrl}/sessions/latest`, {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (res.ok) {
        const data = await res.json() as { id?: string };
        if (data?.id) return data.id;
      }
    } catch {
      // no existing session, create new one
    }
    return this.createSession();
  }

  private async createSession(): Promise<string> {
    const token = this.getToken();
    const res = await fetch(`${this.proxyUrl}/sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token ?? ""}`,
      },
      body: JSON.stringify({ topic_code: "elder_memoir" }),
    });
    if (!res.ok) throw new Error(`Failed to create cloud session: ${res.status}`);
    const data = await res.json() as { id?: string };
    if (!data?.id) throw new Error("Cloud session creation returned no ID");
    return data.id;
  }

  // ─── Turn Submission ───

  private async submitTurn(sessionId: string, userText: string, signal?: AbortSignal) {
    const token = this.getToken();
    const res = await fetch(`${this.proxyUrl}/sessions/${sessionId}/turns`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token ?? ""}`,
      },
      body: JSON.stringify({ user_text: userText }),
      signal,
    });
    if (!res.ok) throw new Error(`Cloud turn submission failed: ${res.status}`);
    return res.json() as Promise<{ assistant_text?: string; assistant_audio_url?: string }>;
  }

  // ─── Book Generation ───

  private async triggerRender(signal?: AbortSignal) {
    const token = this.getToken();
    const res = await fetch(`${this.proxyUrl}/booklets/current/render`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token ?? ""}`,
      },
      signal,
    });
    if (!res.ok) throw new Error(`Cloud book render trigger failed: ${res.status}`);
  }

  private async fetchCompleteBook(signal?: AbortSignal) {
    const token = this.getToken();
    const res = await fetch(`${this.proxyUrl}/complete-books/current`, {
      headers: { Authorization: `Bearer ${token ?? ""}` },
      signal,
    });
    if (!res.ok) throw new Error(`Cloud book fetch failed: ${res.status}`);
    return res.json() as Promise<Record<string, unknown>>;
  }

  private mapBookDraft(cloudData: Record<string, unknown>, session: InterviewSession): BookDraft {
    // 尝试从云端数据映射为 BookDraft
    const title = String(cloudData.title ?? "星光回忆录");
    const subtitle = String(cloudData.subtitle ?? "");
    const soulSentence = String(cloudData.soulSentence ?? "");

    const chapters = Array.isArray(cloudData.chapters)
      ? cloudData.chapters
          .filter((c): c is Record<string, unknown> => c !== null && typeof c === "object")
          .map((ch) => ({
            title: String(ch.title ?? ""),
            summary: String(ch.summary ?? ch.content ?? ""),
            contentMarkdown: String(ch.contentMarkdown ?? ch.content ?? ""),
          }))
      : [];

    // 如果云端返回数据不完整，用本地 fallback
    if (chapters.length === 0) {
      const elderTexts = session.turns
        .filter((t) => t.role === "elder")
        .map((t) => t.content);
      const hasChinese = elderTexts.some((t) => /[\u4e00-\u9fff]/.test(t));
      return {
        title: hasChinese ? "我的一生，慢慢说给你听" : "A Life, Told Slowly",
        subtitle: hasChinese ? "基于口述访谈整理的初稿" : "A first draft shaped from oral interviews",
        soulSentence: hasChinese ? "那些被慢慢说出的日子，会成为家里最温柔的灯。" : "The days told slowly become a light the family can keep.",
        chapters: [
          { title: hasChinese ? "第一章：最初的家" : "Chapter 1: The First Home", summary: elderTexts[0] ?? "", contentMarkdown: `# 第一章\n\n${elderTexts[0] ?? ""}` },
        ],
        excerpt: elderTexts.join("\n\n"),
      };
    }

    const excerpt = chapters.map((ch) => ch.contentMarkdown).join("\n\n");

    return {
      title,
      subtitle,
      soulSentence,
      chapters,
      excerpt,
      pipeline: { package: "cloud-runtime", version: "1.0.0", mode: "cloud" },
    };
  }
}

/**
 * 根据模式创建对应的 AgentApi 实例（工厂函数）
 * 遵循DIP：调用方依赖抽象接口，而非具体类
 */
export function createAgentApi(mode: "local" | "cloud", options?: { getToken?: () => string | null }): AgentApi {
  if (mode === "cloud") {
    return new CloudAgentApi({ getToken: options?.getToken ?? (() => null) });
  }
  return new LocalAgentApi();
}
