/**
 * [WHO]: 提供AI访谈和回忆录生成的API客户端函数：askAgent, generateBook, getApiStatus
 * [FROM]: 依赖 ./types.ts 的类型定义，浏览器fetch API
 * [TO]: 被App.tsx消费，用于与服务端/api/端点通信
 * [HERE]: src/lib/agentClient.ts，前端与后端API的桥接层
 */
import type {
  ApiStatus,
  AgentInterviewResponse,
  BookDraft,
  InterviewSession,
} from "./types";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export async function askAgent(
  session: InterviewSession,
  answer: string,
): Promise<AgentInterviewResponse> {
  const response = await fetch(`${API_BASE}/api/agent/interview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session, answer }),
  });

  if (!response.ok) {
    throw new Error(`Agent request failed: ${response.status}`);
  }

  return response.json();
}

export async function generateBook(
  session: InterviewSession,
): Promise<BookDraft> {
  const response = await fetch(`${API_BASE}/api/book/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session }),
  });

  if (!response.ok) {
    throw new Error(`Book generation failed: ${response.status}`);
  }

  return response.json();
}

export async function getApiStatus(): Promise<ApiStatus> {
  const response = await fetch(`${API_BASE}/api/status`);

  if (!response.ok) {
    throw new Error(`Status request failed: ${response.status}`);
  }

  return response.json();
}
