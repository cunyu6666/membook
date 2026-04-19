/**
 * [WHO]: 提供HTTP API服务器，处理访谈、回忆录生成、ASR/TTS请求，包含本地降级逻辑
 * [FROM]: 依赖Node.js内置模块、ws库、NanoPencilRpcClient、环境变量
 * [TO]: 被前端src/模块通过HTTP /api/*端点消费
 * [HERE]: server/index.ts，服务端主入口，与nanopencil-rpc.ts相邻
 */
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import WebSocket from "ws";
import type { IncomingMessage, ServerResponse } from "node:http";
import { NanoPencilRpcClient } from "./nanopencil-rpc.js";

type Turn = {
  role: "agent" | "elder";
  content: string;
};

type Session = {
  turns: Turn[];
  readiness: number;
};

type BookDraft = {
  title: string;
  subtitle: string;
  soulSentence?: string;
  chapters: Array<{
    title: string;
    summary: string;
    contentMarkdown?: string;
  }>;
  excerpt: string;
  pipeline?: {
    package: string;
    version: string;
    mode: string;
  };
};

const port = Number(process.env.PORT ?? 8787);
const defaultBailianEndpoint =
  "https://dashscope.aliyuncs.com/compatible-mode/v1";
const defaultBailianTtsEndpoint =
  "wss://dashscope.aliyuncs.com/api-ws/v1/realtime";
const bailianModel = "fun-asr-realtime-2026-02-28";
const bailianFiletransModel = "qwen3-asr-flash-filetrans";
const bailianTtsModel = "qwen3-tts-instruct-flash-realtime";
const defaultFunAsrEndpoint = "wss://dashscope.aliyuncs.com/api-ws/v1/inference/";
const defaultNanoPencilCliPath =
  "/Users/cunyu666/Dev/nanoPencil/dist/cli.js";
const memoirSkillPackage = "memoir-book-pipeline-skill";
const memoirSkillVersion = "1.1.0";
const memoirSkillPath = resolve(
  process.cwd(),
  "node_modules/memoir-book-pipeline-skill/SKILL.md",
);
const memoirSkillSource = existsSync(memoirSkillPath)
  ? readFileSync(memoirSkillPath, "utf8")
  : "";
const nanoPencilCliPath =
  process.env.NANOPENCIL_CLI_PATH ?? defaultNanoPencilCliPath;
const nanoPencilRpcEnabled =
  process.env.NANOPENCIL_RPC !== "0" && existsSync(nanoPencilCliPath);
const nanoPencilRpc = nanoPencilRpcEnabled
  ? new NanoPencilRpcClient({
      cliPath: nanoPencilCliPath,
      cwd: resolve(process.env.NANOPENCIL_WORKDIR ?? process.cwd()),
      timeoutMs: Number(process.env.NANOPENCIL_TIMEOUT_MS ?? 120000),
      extraArgs: [
        ...(process.env.NANOPENCIL_MODEL
          ? ["--model", process.env.NANOPENCIL_MODEL]
          : []),
        ...(process.env.NANOPENCIL_PROVIDER
          ? ["--provider", process.env.NANOPENCIL_PROVIDER]
          : []),
        ...(process.env.NANOPENCIL_API_KEY
          ? ["--api-key", process.env.NANOPENCIL_API_KEY]
          : []),
        "--append-system-prompt",
        memoirInterviewSystemPrompt(),
      ],
    })
  : null;

const server = createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    sendJson(response, 204, {});
    return;
  }

  try {
    if (request.method === "GET" && request.url === "/api/status") {
      sendJson(response, 200, {
        mode: process.env.NANOPENCIL_ACP_URL
          ? "acp"
          : nanoPencilRpc
            ? "rpc"
          : process.env.NANOPENCIL_COMMAND
            ? "command"
            : "local",
        acpUrl: process.env.NANOPENCIL_ACP_URL,
        cliPath: nanoPencilRpc ? nanoPencilCliPath : undefined,
        asrModel: bailianModel,
        asrFiletransModel: bailianFiletransModel,
        asrEndpoint: process.env.BAILIAN_ASR_ENDPOINT ?? defaultFunAsrEndpoint,
        ttsModel: bailianTtsModel,
        ttsEndpoint: process.env.BAILIAN_TTS_ENDPOINT ?? defaultBailianTtsEndpoint,
        memoirPipeline: memoirSkillSource
          ? `${memoirSkillPackage}@${memoirSkillVersion}`
          : undefined,
      });
      return;
    }

    if (request.method === "POST" && request.url === "/api/agent/interview") {
      const body = await readJson<{ session: Session; answer: string }>(request);
      const result = process.env.NANOPENCIL_ACP_URL
        ? await callNanopencilAcp(process.env.NANOPENCIL_ACP_URL, body)
        : nanoPencilRpc
          ? await callNanoPencilRpc(body.session, body.answer)
        : process.env.NANOPENCIL_COMMAND
          ? await runCommand(process.env.NANOPENCIL_COMMAND, body)
          : localInterview(body.session, body.answer);
      sendJson(response, 200, result);
      return;
    }

    if (request.method === "POST" && request.url === "/api/book/generate") {
      const body = await readJson<{ session: Session }>(request);
      const result = process.env.MEMOIR_PIPELINE_COMMAND
        ? await runCommand(process.env.MEMOIR_PIPELINE_COMMAND, body)
        : await generateMemoirBook(body.session);
      sendJson(response, 200, result);
      return;
    }

    if (request.method === "POST" && request.url === "/api/asr/bailian") {
      const body = await readJson<{
        apiKey: string;
        endpoint?: string;
        model?: string;
        fileUrl?: string;
        fileName: string;
        mimeType: string;
        audioBase64: string;
      }>(request);
      const result = await transcribeWithBailian(body);
      sendJson(response, 200, result);
      return;
    }

    if (request.method === "POST" && request.url === "/api/tts/bailian") {
      const body = await readJson<{
        apiKey: string;
        endpoint?: string;
        model?: string;
        text: string;
        voice?: string;
        instructions?: string;
      }>(request);
      const result = await synthesizeWithBailian(body);
      sendJson(response, 200, result);
      return;
    }

    sendJson(response, 404, { error: "Not found" });
  } catch (error) {
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : "Unknown server error",
    });
  }
});

server.listen(port, () => {
  console.log(`Membook API listening on http://localhost:${port}`);
});

process.on("SIGINT", () => {
  void nanoPencilRpc?.stop().finally(() => process.exit(0));
});

process.on("SIGTERM", () => {
  void nanoPencilRpc?.stop().finally(() => process.exit(0));
});

function readJson<T>(request: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let raw = "";
    request.on("data", (chunk) => {
      raw += chunk;
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(raw || "{}") as T);
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

async function callNanopencilAcp(url: string, payload: unknown) {
  const method = process.env.NANOPENCIL_ACP_METHOD ?? "agent.interview";
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method,
      params: payload,
    }),
  });

  if (!response.ok) {
    throw new Error(`nanopencil ACP failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    result?: unknown;
    error?: { message?: string };
  };
  if (data.error) {
    throw new Error(data.error.message ?? "nanopencil ACP returned an error");
  }

  return data.result ?? data;
}

async function callNanoPencilRpc(session: Session, answer: string) {
  if (!nanoPencilRpc) {
    throw new Error("nanoPencil RPC is not available");
  }

  const prompt = buildInterviewPrompt(session, answer);
  const text = await nanoPencilRpc.promptAndWait(prompt);
  const parsed = parseAgentJson(text);
  const hasChinese = /[\u4e00-\u9fff]/.test(answer);

  return {
    question:
      parsed.question ??
      parsed.nextQuestion ??
      text.trim() ??
      (hasChinese
        ? "这段经历里，您最想让家人记住的细节是什么？"
        : "What detail from this memory should your family remember?"),
    readiness: clampReadiness(parsed.readiness, session.readiness),
    insights: normalizeInsights(parsed.insights, hasChinese),
  };
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
    const child = spawn(binary, args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `${command} exited with code ${code}`));
        return;
      }

      try {
        resolve(JSON.parse(stdout));
      } catch {
        resolve({ output: stdout.trim() });
      }
    });
    child.stdin.end(JSON.stringify(payload));
  });
}

async function transcribeWithBailian(input: {
  apiKey: string;
  endpoint?: string;
  model?: string;
  fileUrl?: string;
  fileName: string;
  mimeType: string;
  audioBase64: string;
}) {
  if (!input.apiKey) {
    throw new Error("Bailian API key is required");
  }

  const model = input.model || bailianModel;
  if (model.startsWith("fun-asr-realtime")) {
    return transcribeWithFunAsrRealtime(input);
  }
  if (model === bailianFiletransModel && input.fileUrl) {
    return transcribeFileUrlWithBailian(input.apiKey, input.endpoint, input.fileUrl);
  }

  const baseUrl =
    input.endpoint || process.env.BAILIAN_ASR_ENDPOINT || defaultBailianEndpoint;
  const endpoint = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
  const dataUri = `data:${input.mimeType || "audio/webm"};base64,${input.audioBase64}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: model === bailianFiletransModel ? bailianModel : model,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "input_audio",
              input_audio: {
                data: dataUri,
              },
            },
          ],
        },
      ],
      stream: false,
      asr_options: {
        enable_itn: true,
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Bailian ASR failed: ${response.status} ${detail}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return {
    text: data.choices?.[0]?.message?.content ?? "",
    raw: data,
  };
}

async function transcribeFileUrlWithBailian(
  apiKey: string,
  endpoint: string | undefined,
  fileUrl: string,
) {
  const baseUrl = endpoint?.includes("/api/v1")
    ? endpoint
    : "https://dashscope.aliyuncs.com/api/v1";
  const response = await fetch(
    `${baseUrl.replace(/\/$/, "")}/services/audio/asr/transcription`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-DashScope-Async": "enable",
      },
      body: JSON.stringify({
        model: bailianFiletransModel,
        input: { file_url: fileUrl },
        parameters: {
          channel_id: [0],
          enable_itn: true,
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Bailian filetrans submit failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

async function transcribeWithFunAsrRealtime(input: {
  apiKey: string;
  endpoint?: string;
  model?: string;
  fileName: string;
  mimeType: string;
  audioBase64: string;
}) {
  const endpoint =
    input.endpoint?.startsWith("wss://") || input.endpoint?.startsWith("ws://")
      ? input.endpoint
      : defaultFunAsrEndpoint;
  const model = input.model || bailianModel;
  const audio = Buffer.from(input.audioBase64, "base64");
  const textParts: string[] = [];

  await new Promise<void>((resolvePromise, reject) => {
    const ws = new WebSocket(endpoint, {
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "X-DashScope-DataInspection": "enable",
      },
    });
    const taskId = `task_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    let started = false;
    let finished = false;
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error("Bailian Fun-ASR timed out"));
    }, 60000);

    ws.on("open", () => {
      ws.send(
        JSON.stringify({
          header: {
            action: "run-task",
            task_id: taskId,
            streaming: "duplex",
          },
          payload: {
            task_group: "audio",
            task: "asr",
            function: "recognition",
            model,
            parameters: {
              format: "wav",
              sample_rate: 16000,
            },
            input: {},
          },
        }),
      );
    });

    ws.on("message", (raw, isBinary) => {
      if (isBinary) return;
      try {
        const event = JSON.parse(raw.toString()) as {
          header?: {
            event?: string;
            error_message?: string;
            code?: string;
          };
          payload?: {
            output?: {
              sentence?: {
                text?: string;
              };
              sentences?: Array<{ text?: string }>;
            };
          };
        };
        const eventName = event.header?.event;
        if (event.header?.error_message) {
          throw new Error(
            `${event.header.code ?? "ASR_ERROR"}: ${event.header.error_message}`,
          );
        }

        if (eventName === "task-started") {
          started = true;
          for (let offset = 0; offset < audio.length; offset += 3200) {
            ws.send(audio.subarray(offset, Math.min(offset + 3200, audio.length)));
          }
          ws.send(
            JSON.stringify({
              header: {
                action: "finish-task",
                task_id: taskId,
                streaming: "duplex",
              },
              payload: {
                input: {},
              },
            }),
          );
          return;
        }

        const sentence = event.payload?.output?.sentence?.text;
        if (sentence) {
          textParts.push(sentence);
        }
        const sentences = event.payload?.output?.sentences;
        if (Array.isArray(sentences)) {
          for (const item of sentences) {
            if (item.text) textParts.push(item.text);
          }
        }

        if (eventName === "task-finished") {
          finished = true;
          clearTimeout(timer);
          ws.close();
          resolvePromise();
        }
      } catch (error) {
        clearTimeout(timer);
        ws.close();
        reject(error);
      }
    });

    ws.on("close", () => {
      if (!started) {
        clearTimeout(timer);
        reject(new Error("Bailian Fun-ASR closed before task-started"));
      } else if (!finished) {
        clearTimeout(timer);
        resolvePromise();
      }
    });

    ws.on("error", () => {
      clearTimeout(timer);
      reject(new Error("Bailian Fun-ASR websocket failed"));
    });
  });

  return {
    text: mergeIncrementalText(textParts).trim(),
    raw: { model, endpoint },
  };
}

async function synthesizeWithBailian(input: {
  apiKey: string;
  endpoint?: string;
  model?: string;
  text: string;
  voice?: string;
  instructions?: string;
}) {
  if (!input.apiKey) {
    throw new Error("Bailian API key is required");
  }
  if (!input.text.trim()) {
    throw new Error("TTS text is required");
  }

  const endpoint = input.endpoint || process.env.BAILIAN_TTS_ENDPOINT || defaultBailianTtsEndpoint;
  const model = input.model || bailianTtsModel;
  const url = `${endpoint.replace(/\?.*$/, "")}?model=${encodeURIComponent(model)}`;
  const audioChunks: Buffer[] = [];

  await new Promise<void>((resolvePromise, reject) => {
    const ws = new WebSocket(url, {
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "OpenAI-Beta": "realtime=v1",
      },
    });
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error("Bailian TTS timed out"));
    }, 60000);

    ws.on("open", () => {
      sendTtsEvent(ws, {
        type: "session.update",
        session: {
          mode: "server_commit",
          voice: input.voice || "Cherry",
          language_type: "Auto",
          response_format: "pcm",
          sample_rate: 24000,
          instructions:
            input.instructions ||
            "用温柔、清晰、适合老人访谈的语气朗读。语速稍慢，停顿自然。",
          optimize_instructions: true,
        },
      });
      sendTtsEvent(ws, { type: "input_text_buffer.append", text: input.text });
      sendTtsEvent(ws, { type: "input_text_buffer.commit" });
      sendTtsEvent(ws, { type: "session.finish" });
    });

    ws.on("message", (event) => {
      try {
        const data = JSON.parse(event.toString()) as {
          type?: string;
          delta?: string;
          error?: { message?: string };
        };
        if (data.type === "response.audio.delta" && data.delta) {
          audioChunks.push(Buffer.from(data.delta, "base64"));
        }
        if (data.type === "error") {
          throw new Error(data.error?.message ?? "Bailian TTS returned an error");
        }
        if (data.type === "session.finished" || data.type === "response.done") {
          clearTimeout(timer);
          ws.close();
          resolvePromise();
        }
      } catch (error) {
        clearTimeout(timer);
        ws.close();
        reject(error);
      }
    });

    ws.on("error", () => {
      clearTimeout(timer);
      reject(new Error("Bailian TTS websocket failed"));
    });
  });

  const wav = pcm16ToWav(Buffer.concat(audioChunks), 24000, 1);
  return {
    mimeType: "audio/wav",
    audioBase64: wav.toString("base64"),
  };
}

function sendTtsEvent(ws: WebSocket, event: Record<string, unknown>) {
  ws.send(
    JSON.stringify({
      ...event,
      event_id: `event_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    }),
  );
}

function pcm16ToWav(pcm: Buffer, sampleRate: number, channels: number) {
  const header = Buffer.alloc(44);
  const byteRate = sampleRate * channels * 2;
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(channels * 2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

function localInterview(session: Session, answer: string) {
  const readiness = Math.min(100, (session.readiness ?? 10) + 14);
  const hasChinese = /[\u4e00-\u9fff]/.test(answer);
  const peopleHint = extractAfter(answer, hasChinese ? ["妈妈", "爸爸", "老师", "朋友", "爷爷", "奶奶"] : ["mother", "father", "teacher", "friend", "grandfather", "grandmother"]);
  const placeHint = extractPlace(answer, hasChinese);
  const question = hasChinese
    ? "这段记忆里有没有一个具体的画面、声音或气味？请慢慢讲给我听。"
    : "Is there a specific image, sound, or smell in this memory? Please tell me slowly.";

  return {
    question,
    readiness,
    insights: [
      { label: hasChinese ? "重要人物" : "Key people", value: peopleHint },
      { label: hasChinese ? "重要地点" : "Key places", value: placeHint },
      {
        label: hasChinese ? "情感线索" : "Emotional arc",
        value: hasChinese ? "怀旧、亲密、细节待加深" : "Nostalgic, intimate, needs richer detail",
      },
    ],
  };
}

async function generateMemoirBook(session: Session): Promise<BookDraft> {
  if (!nanoPencilRpc || !memoirSkillSource) {
    return localBookDraft(session, nanoPencilRpc ? "local-fallback-no-skill" : "local-fallback-no-agent");
  }

  try {
    const text = await nanoPencilRpc.promptAndWait(buildMemoirPipelinePrompt(session));
    return normalizeBookDraft(parseBookJson(text), session, "nanopencil-rpc");
  } catch {
    return localBookDraft(session, "local-fallback-agent-error");
  }
}

function memoirInterviewSystemPrompt() {
  return [
    "You are the interview agent for Membook, a life memoir product for elders.",
    "Your job is not coding in this context.",
    "Interview gently, ask one concise follow-up question at a time, and preserve concrete details.",
    "When asked by the API adapter, return strict JSON matching: {\"question\": string, \"readiness\": number, \"insights\": [{\"label\": string, \"value\": string}]}",
  ].join("\n");
}

function buildMemoirPipelinePrompt(session: Session) {
  const transcript = session.turns
    .map((turn) => `${turn.role === "agent" ? "访谈助手" : "长辈"}：${turn.content}`)
    .join("\n");
  const elderText = session.turns
    .filter((turn) => turn.role === "elder")
    .map((turn) => turn.content)
    .join("\n\n");
  const hasChinese = /[\u4e00-\u9fff]/.test(transcript);

  return [
    "你现在要执行 npm 包 memoir-book-pipeline-skill 的回忆录成书流水线。",
    "必须遵守该技能的核心顺序：原始访谈 -> story-extractor 记忆碎片 -> narrative-architect 全书骨架 -> prose-writer 逐章第一人称散文 -> book-renderer 可读书稿。",
    "不要跳过碎片提取；不要编造访谈中没有的具体事实；素材不足时诚实写成素描版。",
    "以下是已安装技能包的说明节选，作为生成规范：",
    memoirSkillSource.slice(0, 5200),
    "",
    "请基于下面的原始访谈，输出严格 JSON，不要 Markdown 围栏，不要额外说明。",
    "JSON schema:",
    JSON.stringify({
      title: hasChinese ? "书名" : "Book title",
      subtitle: hasChinese ? "副标题" : "Subtitle",
      soulSentence: hasChinese ? "只属于这位长辈的一句话" : "A sentence unique to this person",
      chapters: [
        {
          title: hasChinese ? "章节标题" : "Chapter title",
          summary: hasChinese ? "章节摘要" : "Chapter summary",
          contentMarkdown: hasChinese
            ? "# 章节标题\n\n第一人称散文正文。"
            : "# Chapter title\n\nFirst-person prose.",
        },
      ],
      excerpt: hasChinese ? "全书摘录" : "Book excerpt",
    }),
    "",
    "约束：章节数 3-6 章；每章必须有 contentMarkdown；正文用第一人称“我”；尽量保留口述质感；如果语料很少，每章 150-500 字即可。",
    "",
    "原始访谈：",
    transcript || elderText || "(empty)",
  ].join("\n");
}

function buildInterviewPrompt(session: Session, answer: string) {
  const transcript = session.turns
    .slice(-10)
    .map((turn) => `${turn.role === "agent" ? "Interviewer" : "Elder"}: ${turn.content}`)
    .join("\n");

  return [
    "You are conducting an oral-history interview with an elder to help create a family memoir.",
    "Use the same language as the elder's latest answer.",
    "Ask exactly one warm, specific follow-up question.",
    "Do not write the book yet.",
    "Return only valid JSON with this schema:",
    "{\"question\":\"...\",\"readiness\":0,\"insights\":[{\"label\":\"重要人物/Key people\",\"value\":\"...\"},{\"label\":\"重要地点/Key places\",\"value\":\"...\"},{\"label\":\"情感线索/Emotional arc\",\"value\":\"...\"}]}",
    "",
    "Recent transcript:",
    transcript || "(empty)",
    "",
    `Latest elder answer: ${answer}`,
  ].join("\n");
}

function parseAgentJson(text: string) {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");

  try {
    return JSON.parse(cleaned) as {
      question?: string;
      nextQuestion?: string;
      readiness?: unknown;
      insights?: unknown;
    };
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return {};
    try {
      return JSON.parse(match[0]) as {
        question?: string;
        nextQuestion?: string;
        readiness?: unknown;
        insights?: unknown;
      };
    } catch {
      return {};
    }
  }
}

function parseBookJson(text: string) {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");

  try {
    return JSON.parse(cleaned) as unknown;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return {};
    try {
      return JSON.parse(match[0]) as unknown;
    } catch {
      return {};
    }
  }
}

function normalizeBookDraft(value: unknown, session: Session, mode: string): BookDraft {
  const fallback = localBookDraft(session, mode);
  if (!value || typeof value !== "object") {
    return fallback;
  }

  const record = value as {
    title?: unknown;
    book_title?: unknown;
    subtitle?: unknown;
    book_subtitle?: unknown;
    soulSentence?: unknown;
    soul_sentence?: unknown;
    excerpt?: unknown;
    chapters?: unknown;
  };
  const chapters = Array.isArray(record.chapters)
    ? record.chapters
        .filter((chapter) => chapter && typeof chapter === "object")
        .map((chapter, index) => {
          const item = chapter as {
            title?: unknown;
            summary?: unknown;
            contentMarkdown?: unknown;
            content_markdown?: unknown;
          };
          const title = String(item.title ?? `${index + 1}`);
          const contentMarkdown = String(
            item.contentMarkdown ?? item.content_markdown ?? item.summary ?? "",
          ).trim();
          return {
            title,
            summary: String(item.summary ?? contentMarkdown.slice(0, 180) ?? ""),
            contentMarkdown,
          };
        })
        .filter((chapter) => chapter.title && (chapter.summary || chapter.contentMarkdown))
        .slice(0, 8)
    : [];

  return {
    title: String(record.title ?? record.book_title ?? fallback.title),
    subtitle: String(record.subtitle ?? record.book_subtitle ?? fallback.subtitle),
    soulSentence: String(
      record.soulSentence ?? record.soul_sentence ?? fallback.soulSentence ?? "",
    ),
    chapters: chapters.length > 0 ? chapters : fallback.chapters,
    excerpt: String(record.excerpt ?? fallback.excerpt),
    pipeline: {
      package: memoirSkillPackage,
      version: memoirSkillVersion,
      mode,
    },
  };
}

function clampReadiness(value: unknown, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  const minimum = Math.min(100, (fallback ?? 10) + 8);
  if (!Number.isFinite(parsed)) {
    return Math.min(100, (fallback ?? 10) + 14);
  }
  return Math.max(minimum, Math.min(100, Math.round(parsed)));
}

function normalizeInsights(value: unknown, hasChinese: boolean) {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item && typeof item === "object")
      .map((item) => {
        const record = item as { label?: unknown; value?: unknown };
        return {
          label: String(record.label ?? ""),
          value: String(record.value ?? ""),
        };
      })
      .filter((item) => item.label && item.value)
      .slice(0, 3);
  }

  return [
    { label: hasChinese ? "重要人物" : "Key people", value: hasChinese ? "继续追问" : "Needs follow-up" },
    { label: hasChinese ? "重要地点" : "Key places", value: hasChinese ? "继续追问" : "Needs follow-up" },
    { label: hasChinese ? "情感线索" : "Emotional arc", value: hasChinese ? "温和回忆" : "Gentle reminiscence" },
  ];
}

function mergeIncrementalText(parts: string[]) {
  const cleaned = parts.map((part) => part.trim()).filter(Boolean);
  const longest = cleaned.reduce(
    (best, part) => (part.length > best.length ? part : best),
    "",
  );
  if (longest) {
    return longest.replace(/^([嗯啊呃呐]\s*)+/, "");
  }

  let output = "";
  for (const current of cleaned) {
    if (!current) continue;
    if (!output) {
      output = current;
      continue;
    }
    if (current === output || output.endsWith(current)) {
      continue;
    }
    if (current.startsWith(output) || current.includes(output)) {
      output = current;
      continue;
    }

    let overlap = 0;
    const maxOverlap = Math.min(output.length, current.length);
    for (let size = maxOverlap; size > 0; size -= 1) {
      if (output.endsWith(current.slice(0, size))) {
        overlap = size;
        break;
      }
    }
    output += current.slice(overlap);
  }
  return output;
}

function localBookDraft(session: Session, mode = "local-fallback"): BookDraft {
  const elderText = session.turns
    .filter((turn) => turn.role === "elder")
    .map((turn) => turn.content);
  const hasChinese = elderText.some((text) => /[\u4e00-\u9fff]/.test(text));
  const firstMemory = elderText[0] ?? (hasChinese ? "等待更多语料。" : "More source material needed.");
  const secondMemory = elderText[1] ?? (hasChinese ? "将在后续访谈中补全。" : "To be completed in later interviews.");
  const thirdMemory = elderText[2] ?? (hasChinese ? "等待老人讲述。" : "Awaiting the elder's words.");

  return {
    title: hasChinese ? "我的一生，慢慢说给你听" : "A Life, Told Slowly",
    subtitle: hasChinese ? "基于口述访谈整理的初稿" : "A first draft shaped from oral interviews",
    soulSentence: hasChinese
      ? "那些被慢慢说出的日子，会成为家里最温柔的灯。"
      : "The days told slowly become a light the family can keep.",
    chapters: [
      {
        title: hasChinese ? "第一章：最初的家" : "Chapter 1: The First Home",
        summary: firstMemory,
        contentMarkdown: `${hasChinese ? "# 第一章：最初的家" : "# Chapter 1: The First Home"}\n\n${firstMemory}`,
      },
      {
        title: hasChinese ? "第二章：那些重要的人" : "Chapter 2: The People Who Mattered",
        summary: secondMemory,
        contentMarkdown: `${hasChinese ? "# 第二章：那些重要的人" : "# Chapter 2: The People Who Mattered"}\n\n${secondMemory}`,
      },
      {
        title: hasChinese ? "第三章：留给家人的话" : "Chapter 3: What I Leave With You",
        summary: thirdMemory,
        contentMarkdown: `${hasChinese ? "# 第三章：留给家人的话" : "# Chapter 3: What I Leave With You"}\n\n${thirdMemory}`,
      },
    ],
    excerpt: elderText.join("\n\n"),
    pipeline: {
      package: memoirSkillPackage,
      version: memoirSkillVersion,
      mode,
    },
  };
}

function extractAfter(text: string, needles: string[]) {
  const found = needles.find((needle) => text.toLowerCase().includes(needle.toLowerCase()));
  return found ?? (/[\u4e00-\u9fff]/.test(text) ? "已出现家庭/关系线索" : "Family or relationship clues present");
}

function extractPlace(text: string, hasChinese: boolean) {
  const match = hasChinese
    ? text.match(/[^\s，。,.]{1,8}(村|镇|城|市|县|街|路|学校|家)/)
    : text.match(/\b(home|school|village|town|city|street|farm|house)\b/i);
  return match?.[0] ?? (hasChinese ? "地点线索待追问" : "Place details need follow-up");
}
