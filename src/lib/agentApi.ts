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
 * 云端模式 AgentApi 实现 - 通过后端代理调用云端 Runtime-Service
 */
export class CloudAgentApi implements AgentApi {
  private readonly proxyUrl: string;

  constructor(proxyUrl: string = "/api/cloud") {
    this.proxyUrl = proxyUrl;
  }

  async askAgent(session: InterviewSession, answer: string, signal?: AbortSignal): Promise<AgentInterviewResponse> {
    const response = await fetch(`${this.proxyUrl}/agent/interview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session, answer }),
      signal,
    });

    if (!response.ok) {
      throw new Error(`Cloud agent request failed: ${response.status}`);
    }

    return response.json();
  }

  async generateBook(session: InterviewSession, signal?: AbortSignal): Promise<BookDraft> {
    const response = await fetch(`${this.proxyUrl}/book/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session }),
      signal,
    });

    if (!response.ok) {
      throw new Error(`Cloud book generation failed: ${response.status}`);
    }

    return response.json();
  }
}

/**
 * 根据模式创建对应的 AgentApi 实例（工厂函数）
 * 遵循DIP：调用方依赖抽象接口，而非具体类
 */
export function createAgentApi(mode: "local" | "cloud"): AgentApi {
  return mode === "cloud" ? new CloudAgentApi() : new LocalAgentApi();
}
