/**
 * [WHO]: 提供API状态查询函数：getApiStatus
 * [FROM]: 依赖 ./types.ts 的类型定义，浏览器fetch API
 * [TO]: 被 StudioPage.tsx 消费，用于获取服务端状态
 * [HERE]: src/lib/agentClient.ts，API状态查询层
 */
import type { ApiStatus } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export async function getApiStatus(): Promise<ApiStatus> {
  const response = await fetch(`${API_BASE}/api/status`);

  if (!response.ok) {
    throw new Error(`Status request failed: ${response.status}`);
  }

  return response.json();
}
