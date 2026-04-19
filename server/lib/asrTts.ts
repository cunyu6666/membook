/**
 * [WHO]: 提供 transcribeWithBailian 和 synthesizeWithBailian 函数，封装百炼ASR/TTS WebSocket和HTTP协议
 * [FROM]: 依赖Node.js ws库、百炼API (WebSocket/HTTP)
 * [TO]: 被server/index.ts消费，用于语音识别和语音合成
 * [HERE]: server/lib/asrTts.ts，百炼语音服务桥接层
 */
import WebSocket from "ws";

const bailianFiletransModel = "qwen3-asr-flash-filetrans";

/**
 * 指数退避重试封装
 * 当操作失败时自动重试，最多重试 maxAttempts 次
 * 适用于 WebSocket 连接等瞬态失败
 * @param shouldRetry - 可选回调，判断错误是否应该重试（返回true则重试）
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  options: { initialDelay: number; maxDelay: number; maxAttempts: number },
  shouldRetry?: (err: Error) => boolean
): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt < options.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (err) {
      lastError = err as Error;
      // 如果明确不应该重试，立即抛出
      if (shouldRetry && !shouldRetry(lastError)) {
        throw lastError;
      }
      if (attempt < options.maxAttempts - 1) {
        const delay = Math.min(
          options.initialDelay * Math.pow(2, attempt),
          options.maxDelay
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError!;
}
const bailianTtsModel = "qwen3-tts-instruct-flash-realtime";
const defaultBailianEndpoint = "https://dashscope.aliyuncs.com/compatible-mode/v1";
const defaultBailianTtsEndpoint = "wss://dashscope.aliyuncs.com/api-ws/v1/realtime";
const defaultFunAsrEndpoint = "wss://dashscope.aliyuncs.com/api-ws/v1/inference/";

export async function transcribeWithBailian(input: {
  apiKey: string;
  endpoint?: string;
  model?: string;
  fileUrl?: string;
  fileName: string;
  mimeType: string;
  audioBase64: string;
}) {
  if (!input.apiKey) throw new Error("Bailian API key is required");
  const model = input.model || "fun-asr-realtime-2026-02-28";
  if (model.startsWith("fun-asr-realtime")) return transcribeWithFunAsrRealtime(input);
  if (model === bailianFiletransModel && input.fileUrl) {
    return transcribeFileUrlWithBailian(input.apiKey, input.endpoint, input.fileUrl);
  }

  const baseUrl = input.endpoint || process.env.BAILIAN_ASR_ENDPOINT || defaultBailianEndpoint;
  const endpoint = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
  const dataUri = `data:${input.mimeType || "audio/webm"};base64,${input.audioBase64}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${input.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: model === bailianFiletransModel ? "fun-asr-realtime-2026-02-28" : model,
      messages: [{ role: "user", content: [{ type: "input_audio", input_audio: { data: dataUri } }] }],
      stream: false,
      asr_options: { enable_itn: true },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Bailian ASR failed: ${response.status} ${detail}`);
  }

  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return { text: data.choices?.[0]?.message?.content ?? "", raw: data };
}

async function transcribeFileUrlWithBailian(apiKey: string, endpoint: string | undefined, fileUrl: string) {
  const baseUrl = endpoint?.includes("/api/v1") ? endpoint : "https://dashscope.aliyuncs.com/api/v1";
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/services/audio/asr/transcription`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "X-DashScope-Async": "enable" },
    body: JSON.stringify({
      model: bailianFiletransModel,
      input: { file_url: fileUrl },
      parameters: { channel_id: [0], enable_itn: true },
    }),
  });

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
  const model = input.model || "fun-asr-realtime-2026-02-28";
  const audio = Buffer.from(input.audioBase64, "base64");
  const textParts: string[] = [];

  // 判断是否应该重试：超时错误不重试，其他错误重试
  const shouldRetry = (err: Error) => !err.message.includes("timed out");

  await withRetry(async () => {
    return new Promise<void>((resolvePromise, reject) => {
      const ws = new WebSocket(endpoint, {
        headers: { Authorization: `Bearer ${input.apiKey}`, "X-DashScope-DataInspection": "enable" },
      });
      const taskId = `task_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      let started = false;
      let finished = false;
      let closed = false;
      const timer = setTimeout(() => { ws.close(); reject(new Error("Bailian Fun-ASR timed out")); }, 60000);

      function cleanup() {
        if (!closed) { closed = true; try { ws.close(); } catch { /* already closed */ } }
        clearTimeout(timer);
      }

      ws.on("open", () => {
        ws.send(JSON.stringify({
          header: { action: "run-task", task_id: taskId, streaming: "duplex" },
          payload: { task_group: "audio", task: "asr", function: "recognition", model, parameters: { format: "wav", sample_rate: 16000 }, input: {} },
        }));
      });

      ws.on("message", (raw, isBinary) => {
        if (isBinary) return;
        try {
          const event = JSON.parse(raw.toString()) as {
            header?: { event?: string; error_message?: string; code?: string };
            payload?: { output?: { sentence?: { text?: string }; sentences?: Array<{ text?: string }> } };
          };
          if (event.header?.error_message) throw new Error(`${event.header.code ?? "ASR_ERROR"}: ${event.header.error_message}`);
          if (event.header?.event === "task-started") {
            started = true;
            for (let offset = 0; offset < audio.length; offset += 3200) {
              ws.send(audio.subarray(offset, Math.min(offset + 3200, audio.length)));
            }
            ws.send(JSON.stringify({ header: { action: "finish-task", task_id: taskId, streaming: "duplex" }, payload: { input: {} } }));
            return;
          }

          const sentence = event.payload?.output?.sentence?.text;
          if (sentence) textParts.push(sentence);
          const sentences = event.payload?.output?.sentences;
          if (Array.isArray(sentences)) for (const item of sentences) if (item.text) textParts.push(item.text);

          if (event.header?.event === "task-finished") { finished = true; cleanup(); resolvePromise(); }
        } catch (error) { cleanup(); reject(error); }
      });

      ws.on("close", () => {
        cleanup();
        if (!started) reject(new Error("Bailian Fun-ASR closed before task-started"));
        else if (!finished) resolvePromise();
      });
      ws.on("error", () => { cleanup(); reject(new Error("Bailian Fun-ASR websocket failed")); });
    });
  }, { initialDelay: 1000, maxDelay: 10000, maxAttempts: 3 }, shouldRetry);

  return { text: mergeIncrementalText(textParts).trim(), raw: { model, endpoint } };
}

export async function synthesizeWithBailian(input: {
  apiKey: string;
  endpoint?: string;
  model?: string;
  text: string;
  voice?: string;
  instructions?: string;
}) {
  if (!input.apiKey) throw new Error("Bailian API key is required");
  if (!input.text.trim()) throw new Error("TTS text is required");

  const endpoint = input.endpoint || process.env.BAILIAN_TTS_ENDPOINT || defaultBailianTtsEndpoint;
  const model = input.model || bailianTtsModel;
  const url = `${endpoint.replace(/\?.*$/, "")}?model=${encodeURIComponent(model)}`;
  const audioChunks: Buffer[] = [];

  // 判断是否应该重试：超时错误不重试，其他错误重试
  const shouldRetry = (err: Error) => !err.message.includes("timed out");

  await withRetry(async () => {
    return new Promise<void>((resolvePromise, reject) => {
      const ws = new WebSocket(url, { headers: { Authorization: `Bearer ${input.apiKey}`, "OpenAI-Beta": "realtime=v1" } });
      let closed = false;
      const timer = setTimeout(() => { try { ws.close(); } catch {} reject(new Error("Bailian TTS timed out")); }, 60000);

      function cleanup() {
        if (!closed) { closed = true; try { ws.close(); } catch { /* already closed */ } }
        clearTimeout(timer);
      }

      ws.on("open", () => {
        sendTtsEvent(ws, { type: "session.update", session: { mode: "server_commit", voice: input.voice || "Cherry", language_type: "Auto", response_format: "pcm", sample_rate: 24000, instructions: input.instructions || "用温柔、清晰、适合老人访谈的语气朗读。语速稍慢，停顿自然。", optimize_instructions: true } });
        sendTtsEvent(ws, { type: "input_text_buffer.append", text: input.text });
        sendTtsEvent(ws, { type: "input_text_buffer.commit" });
        sendTtsEvent(ws, { type: "session.finish" });
      });

      ws.on("message", (event) => {
        try {
          const data = JSON.parse(event.toString()) as { type?: string; delta?: string; error?: { message?: string } };
          if (data.type === "response.audio.delta" && data.delta) audioChunks.push(Buffer.from(data.delta, "base64"));
          if (data.type === "error") throw new Error(data.error?.message ?? "Bailian TTS returned an error");
          if (data.type === "session.finished" || data.type === "response.done") { cleanup(); resolvePromise(); }
        } catch (error) { cleanup(); reject(error); }
      });
      ws.on("error", () => { cleanup(); reject(new Error("Bailian TTS websocket failed")); });
    });
  }, { initialDelay: 1000, maxDelay: 10000, maxAttempts: 3 }, shouldRetry);

  const wav = pcm16ToWav(Buffer.concat(audioChunks), 24000, 1);
  return { mimeType: "audio/wav", audioBase64: wav.toString("base64") };
}

function sendTtsEvent(ws: WebSocket, event: Record<string, unknown>) {
  ws.send(JSON.stringify({ ...event, event_id: `event_${Date.now()}_${Math.random().toString(16).slice(2)}` }));
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

function mergeIncrementalText(parts: string[]) {
  const cleaned = parts.map((part) => part.trim()).filter(Boolean);
  const longest = cleaned.reduce((best, part) => (part.length > best.length ? part : best), "");
  if (longest) return longest.replace(/^([嗯啊呃呐]\s*)+/, "");

  let output = "";
  for (const current of cleaned) {
    if (!current) continue;
    if (!output) { output = current; continue; }
    if (current === output || output.endsWith(current)) continue;
    if (current.startsWith(output) || current.includes(output)) { output = current; continue; }

    let overlap = 0;
    const maxOverlap = Math.min(output.length, current.length);
    for (let size = maxOverlap; size > 0; size -= 1) {
      if (output.endsWith(current.slice(0, size))) { overlap = size; break; }
    }
    output += current.slice(overlap);
  }
  return output;
}
