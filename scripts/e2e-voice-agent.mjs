import { spawn } from "node:child_process";

const apiKey = process.env.BAILIAN_API_KEY;
if (!apiKey) {
  console.error("BAILIAN_API_KEY is required");
  process.exit(1);
}

const port = Number(process.env.PORT ?? 8899);
const baseUrl = `http://localhost:${port}`;

const server = spawn("npm", ["run", "dev:api"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PORT: String(port),
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let stderr = "";
server.stderr.on("data", (chunk) => {
  stderr += chunk.toString();
});

try {
  await waitForServer(baseUrl);

  const status = await getJson(`${baseUrl}/api/status`);
  assert(status.mode === "rpc", `expected rpc mode, got ${status.mode}`);
  assert(status.asrModel === "fun-asr-realtime-2026-02-28", `unexpected asrModel ${status.asrModel}`);
  assert(status.ttsModel === "qwen3-tts-instruct-flash-realtime", `unexpected ttsModel ${status.ttsModel}`);
  console.log("status ok", {
    mode: status.mode,
    asrModel: status.asrModel,
    ttsModel: status.ttsModel,
  });

  const tts = await postJson(`${baseUrl}/api/tts/bailian`, {
    apiKey,
    endpoint: status.ttsEndpoint,
    model: status.ttsModel,
    voice: "Cherry",
    text: "您好，我们开始今天的人生回忆访谈。",
    instructions: "用温柔清晰的中文朗读。",
  });
  assert(tts.mimeType === "audio/wav", `unexpected tts mimeType ${tts.mimeType}`);
  assert(typeof tts.audioBase64 === "string" && tts.audioBase64.length > 1000, "tts audio missing");
  console.log("tts ok", { audioBase64Length: tts.audioBase64.length });

  const asr = await postJson(`${baseUrl}/api/asr/bailian`, {
    apiKey,
    endpoint: status.asrEndpoint,
    model: status.asrModel,
    fileName: "tts-roundtrip.wav",
    mimeType: "audio/wav",
    audioBase64: tts.audioBase64,
  });
  assert(String(asr.text).includes("人生回忆访谈"), `unexpected asr text ${asr.text}`);
  console.log("asr ok", { text: asr.text });

  const session = {
    turns: [
      {
        role: "agent",
        content: "我们从哪里开始？请讲讲您小时候住过的地方，那里是什么样子？",
      },
    ],
    readiness: 12,
  };
  const interview = await postJson(`${baseUrl}/api/agent/interview`, {
    session,
    answer: "我小时候住在杭州的老房子里，门口有一棵大香樟树，夏天妈妈会在树下给我摇蒲扇。",
  });
  assert(typeof interview.question === "string" && interview.question.length > 4, "interview question missing");
  assert(Array.isArray(interview.insights), "interview insights missing");
  console.log("interview ok", {
    question: interview.question,
    readiness: interview.readiness,
  });

  const book = await postJson(`${baseUrl}/api/book/generate`, {
    session: {
      turns: [
        ...session.turns,
        {
          role: "elder",
          content: asr.text,
        },
        {
          role: "agent",
          content: interview.question,
        },
      ],
      readiness: interview.readiness,
    },
  });
  assert(typeof book.title === "string" && book.title.length > 0, "book title missing");
  assert(Array.isArray(book.chapters) && book.chapters.length > 0, "book chapters missing");
  console.log("book ok", { title: book.title, chapters: book.chapters.length });

  console.log("e2e ok");
} finally {
  server.kill("SIGTERM");
}

async function waitForServer(baseUrl) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 30000) {
    try {
      await getJson(`${baseUrl}/api/status`);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error(`server did not start. stderr: ${stderr}`);
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`${url} failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
