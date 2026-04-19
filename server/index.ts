/**
 * [WHO]: 提供HTTP API服务器，处理访谈、回忆录生成、ASR/TTS请求
 * [FROM]: 依赖Node.js内置模块、ws库、NanoPencilRpcClient、lib子模块
 * [TO]: 被前端src/模块通过HTTP /api/*端点消费
 */
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { NanoPencilRpcClient } from "./nanopencil-rpc.js";
import { resolveNanoPencilLaunch } from "./lib/nanopencilLauncher.js";
import { transcribeWithBailian, synthesizeWithBailian } from "./lib/asrTts.js";
import { memoirInterviewSystemPrompt, localInterview, generateMemoirBook, processRpcResponse, memoirSkillSource } from "./lib/interviewAgent.js";

type Turn = { role: "agent" | "elder"; content: string };
type Session = { turns: Turn[]; readiness: number };

const port = Number(process.env.PORT ?? 8787);
const bailianModel = "fun-asr-realtime-2026-02-28";
const bailianFiletransModel = "qwen3-asr-flash-filetrans";
const bailianTtsModel = "qwen3-tts-instruct-flash-realtime";
const defaultFunAsrEndpoint = "wss://dashscope.aliyuncs.com/api-ws/v1/inference/";
const defaultBailianTtsEndpoint = "wss://dashscope.aliyuncs.com/api-ws/v1/realtime";

// 云端后端地址（Spring Boot + Runtime-Service）
const cloudBackendUrl = process.env.CLOUD_BACKEND_URL ?? "http://localhost:8080";

const nanoPencilLaunch = process.env.NANOPENCIL_RPC === "0" ? null : resolveNanoPencilLaunch();
const nanoPencilRpc = nanoPencilLaunch
  ? new NanoPencilRpcClient({
      command: nanoPencilLaunch.command,
      cliPath: nanoPencilLaunch.cliPath,
      useNode: nanoPencilLaunch.useNode,
      displayName: nanoPencilLaunch.displayName,
      cwd: resolve(process.env.NANOPENCIL_WORKDIR ?? process.cwd()),
      timeoutMs: Number(process.env.NANOPENCIL_TIMEOUT_MS ?? 120000),
      extraArgs: [
        ...(process.env.NANOPENCIL_MODEL ? ["--model", process.env.NANOPENCIL_MODEL] : []),
        ...(process.env.NANOPENCIL_PROVIDER ? ["--provider", process.env.NANOPENCIL_PROVIDER] : []),
        ...(process.env.NANOPENCIL_API_KEY ? ["--api-key", process.env.NANOPENCIL_API_KEY] : []),
        "--append-system-prompt", memoirInterviewSystemPrompt(),
      ],
    })
  : null;

const server = createServer(async (request, response) => {
  if (request.method === "OPTIONS") { sendJson(response, 204, {}); return; }

  try {
    if (request.method === "GET" && request.url === "/api/status") {
      sendJson(response, 200, {
        mode: process.env.NANOPENCIL_ACP_URL ? "acp" : nanoPencilRpc ? "rpc" : process.env.NANOPENCIL_COMMAND ? "command" : "local",
        acpUrl: process.env.NANOPENCIL_ACP_URL,
        cliPath: nanoPencilLaunch?.displayName,
        asrModel: bailianModel,
        asrFiletransModel: bailianFiletransModel,
        asrEndpoint: process.env.BAILIAN_ASR_ENDPOINT ?? defaultFunAsrEndpoint,
        ttsModel: bailianTtsModel,
        ttsEndpoint: process.env.BAILIAN_TTS_ENDPOINT ?? defaultBailianTtsEndpoint,
        memoirPipeline: memoirSkillSource ? `memoir-book-pipeline-skill@1.1.0` : undefined,
      });
      return;
    }

    if (request.method === "POST" && request.url === "/api/agent/interview") {
      const body = await readJson<{ session: Session; answer: string }>(request);
      const result = process.env.NANOPENCIL_ACP_URL
        ? await callNanopencilAcp(process.env.NANOPENCIL_ACP_URL, body)
        : nanoPencilRpc ? await callNanoPencilRpc(body.session, body.answer)
        : process.env.NANOPENCIL_COMMAND ? await runCommand(process.env.NANOPENCIL_COMMAND, body)
        : localInterview(body.session, body.answer);
      sendJson(response, 200, result);
      return;
    }

    if (request.method === "POST" && request.url === "/api/book/generate") {
      const body = await readJson<{ session: Session }>(request);
      const result = process.env.MEMOIR_PIPELINE_COMMAND
        ? await runCommand(process.env.MEMOIR_PIPELINE_COMMAND, body)
        : await generateMemoirBook(body.session, nanoPencilRpc);
      sendJson(response, 200, result);
      return;
    }

    if (request.method === "POST" && request.url === "/api/asr/bailian") {
      const body = await readJson<{ apiKey: string; endpoint?: string; model?: string; fileUrl?: string; fileName: string; mimeType: string; audioBase64: string }>(request);
      sendJson(response, 200, await transcribeWithBailian(body));
      return;
    }

    if (request.method === "POST" && request.url === "/api/tts/bailian") {
      const body = await readJson<{ apiKey: string; endpoint?: string; model?: string; text: string; voice?: string; instructions?: string }>(request);
      sendJson(response, 200, await synthesizeWithBailian(body));
      return;
    }

    if (request.method === "POST" && request.url === "/api/import/parse") {
      const body = await readJson<{ text: string }>(request);
      const result = nanoPencilRpc
        ? await parseImportWithNanoPencil(body.text)
        : localImportParse(body.text);
      sendJson(response, 200, result);
      return;
    }

    // ─── 云端代理模式路由 ───
    // 将请求转发到 Spring Boot 后端，再由后端调用 Runtime-Service
    // 这样避免前端直接暴露 API Key，保证安全性

    if (request.method === "POST" && request.url === "/api/cloud/agent/interview") {
      const token = extractAuthToken(request);
      const body = await readJson<{ user_text: string }>(request);
      const result = await proxyToCloud("/api/v1/sessions/-/turns", body, "POST", token);
      sendJson(response, 200, result);
      return;
    }

    if (request.method === "POST" && request.url === "/api/cloud/book/generate") {
      const token = extractAuthToken(request);
      // 先触发渲染
      await proxyToCloud("/api/v1/booklets/current/render", undefined, "POST", token);
      // 再获取完整书籍
      const result = await proxyToCloud("/api/v1/complete-books/current", undefined, "GET", token);
      sendJson(response, 200, result);
      return;
    }

    if (request.method === "GET" && request.url === "/api/cloud/sessions/latest") {
      const token = extractAuthToken(request);
      const result = await proxyToCloud("/api/v1/sessions/latest-unfinished", undefined, "GET", token);
      sendJson(response, 200, result);
      return;
    }

    if (request.method === "POST" && request.url?.startsWith("/api/cloud/sessions/")) {
      // POST /api/cloud/sessions -> 创建新会话
      const match = request.url.match(/^\/api\/cloud\/sessions$/);
      if (match) {
        const token = extractAuthToken(request);
        const body = await readJson<{ topic_code?: string }>(request);
        const result = await proxyToCloud("/api/v1/sessions", body, "POST", token);
        sendJson(response, 200, result);
        return;
      }
      // POST /api/cloud/sessions/:id/turns -> 提交对话轮次
      const turnMatch = request.url.match(/^\/api\/cloud\/sessions\/([^/]+)\/turns$/);
      if (turnMatch) {
        const sessionId = turnMatch[1];
        const token = extractAuthToken(request);
        const body = await readJson<{ user_text: string }>(request);
        const result = await proxyToCloud(`/api/v1/sessions/${sessionId}/turns`, body, "POST", token);
        sendJson(response, 200, result);
        return;
      }
    }

    sendJson(response, 404, { error: "Not found" });
  } catch (error) {
    sendJson(response, 500, { error: error instanceof Error ? error.message : "Unknown server error" });
  }
});

server.listen(port, () => console.log(`Membook API listening on http://localhost:${port}`));
process.on("SIGINT", () => { void nanoPencilRpc?.stop().finally(() => process.exit(0)); });
process.on("SIGTERM", () => {
  const forceExit = setTimeout(() => process.exit(1), 5000);
  void nanoPencilRpc?.stop().finally(() => { clearTimeout(forceExit); process.exit(0); });
});

/* ─── Helpers ─── */

function readJson<T>(request: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let raw = "";
    request.on("data", (chunk) => { raw += chunk; });
    request.on("end", () => { try { resolve(JSON.parse(raw || "{}") as T); } catch (error) { reject(error); } });
    request.on("error", reject);
  });
}

async function callNanopencilAcp(url: string, payload: unknown) {
  const method = process.env.NANOPENCIL_ACP_METHOD ?? "agent.interview";
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: crypto.randomUUID(), method, params: payload }),
  });
  if (!response.ok) throw new Error(`nanopencil ACP failed: ${response.status}`);
  const data = (await response.json()) as { result?: unknown; error?: { message?: string } };
  if (data.error) throw new Error(data.error.message ?? "nanopencil ACP returned an error");
  return data.result ?? data;
}

async function callNanoPencilRpc(session: Session, answer: string) {
  if (!nanoPencilRpc) throw new Error("nanoPencil RPC is not available");
  const prompt = buildInterviewPrompt(session, answer);
  const text = await nanoPencilRpc.promptAndWait(prompt);
  return processRpcResponse(text, session, answer);
}

/**
 * 云端代理 - 将请求转发到 Spring Boot 后端
 * 遵循 Runtime 接入指南的架构：server -> backend -> runtime-service
 * 透传前端请求的 Authorization token 到 backend
 */
async function proxyToCloud<T = unknown>(path: string, body?: unknown, method: "GET" | "POST" = "POST", authToken?: string): Promise<T> {
  const url = `${cloudBackendUrl}${path}`;
  // 优先使用前端传来的 token，其次使用服务端配置的 token
  const token = authToken || process.env.CLOUD_BACKEND_TOKEN || "";

  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body && method === "POST" ? { body: JSON.stringify(body) } : {}),
  });

  if (!response.ok) {
    throw new Error(`Cloud backend proxy failed: ${response.status} for ${path}`);
  }

  return response.json() as Promise<T>;
}

/**
 * 从请求中提取 Authorization header
 */
function extractAuthToken(request: import("node:http").IncomingMessage): string | undefined {
  return request.headers.authorization;
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown) {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(statusCode === 204 ? undefined : JSON.stringify(payload));
}

function runCommand(command: string, payload: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const [binary, ...args] = command.split(" ");
    const child = spawn(binary, args, { stdio: ["pipe", "pipe", "pipe"], env: process.env });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) { reject(new Error(stderr || `${command} exited with code ${code}`)); return; }
      try { resolve(JSON.parse(stdout)); } catch { resolve({ output: stdout.trim() }); }
    });
    child.stdin.end(JSON.stringify(payload));
  });
}

function buildInterviewPrompt(session: Session, answer: string) {
  const transcript = session.turns.slice(-10).map((turn) => `${turn.role === "agent" ? "Interviewer" : "Elder"}: ${turn.content}`).join("\n");
  return [
    "You are conducting an oral-history interview with an elder to help create a family memoir.",
    "Use the same language as the elder's latest answer.",
    "Ask exactly one warm, specific follow-up question.",
    "Do not write the book yet.",
    'Return only valid JSON with this schema: {"question":"...","readiness":0,"insights":[{"label":"重要人物/Key people","value":"..."},{"label":"重要地点/Key places","value":"..."},{"label":"情感线索/Emotional arc","value":"..."}]}',
    "",
    "Recent transcript:",
    transcript || "(empty)",
    "",
    `Latest elder answer: ${answer}`,
  ].join("\n");
}

function buildImportParsePrompt(text: string) {
  return [
    "You are a transcript analyzer for an oral-history interview product. Given raw conversation text (which may be from WeChat chat, a recorded interview, or any informal conversation), your job is to identify who is the interviewer/questioner and who is the elder/storyteller, and extract each speaker's turns.",
    'Return ONLY valid JSON with this schema: {"turns": [{"role": "agent" or "elder", "content": "the spoken text"}]}',
    'Rules: "agent" is the person asking questions or guiding the conversation. "elder" is the person sharing memories/stories.',
    "Preserve the original language and tone of each turn. Do not summarize or rewrite.",
    "If the text is not a conversation or is empty, return {\"turns\": []}.",
    "",
    "Raw text to parse:",
    "=== BEGIN ===",
    text.slice(0, 8000),
    "=== END ===",
  ].join("\n");
}

async function parseImportWithNanoPencil(text: string) {
  if (!nanoPencilRpc) throw new Error("nanoPencil RPC is not available");
  const prompt = buildImportParsePrompt(text);
  const rawText = await nanoPencilRpc.promptAndWait(prompt);
  const cleaned = rawText.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "");
  try {
    const parsed = JSON.parse(cleaned) as { turns?: Array<{ role?: string; content?: string }> };
    if (Array.isArray(parsed.turns) && parsed.turns.length > 0) {
      const turns = parsed.turns
        .filter((t) => t.content?.trim())
        .map((t) => ({ role: (t.role === "agent" || t.role === "elder") ? t.role : "elder", content: t.content!.trim() }));
      return { turns };
    }
  } catch { /* ignore */ }
  return localImportParse(text);
}

function localImportParse(text: string) {
  // 简单启发式：按空行分段，含问号/疑段为agent，其余为elder
  const segments = text.split(/\n\s*\n/).map((s) => s.replace(/\n/g, " ").trim()).filter(Boolean);
  if (segments.length === 0) return { turns: [] };

  const turns: Array<{ role: "agent" | "elder"; content: string }> = [];
  for (const seg of segments) {
    const hasQuestion = /[？?]$/.test(seg) || /^(谁|什么|怎么|哪里|为什么|何时|which|what|how|where|when|why)\b/i.test(seg);
    const hasAnswerMarker = /^(我|我记得|那时候|后来|是的|对)/i.test(seg);
    if (hasQuestion && !hasAnswerMarker) {
      turns.push({ role: "agent", content: seg });
    } else {
      turns.push({ role: "elder", content: seg });
    }
  }
  return { turns };
}
