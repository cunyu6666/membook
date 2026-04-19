# Membook

AI-assisted interview product for turning elders' oral histories into a family memoir.

## Stack

- React + Vite
- Tailwind CSS 4
- Remix Icon
- shadcn-style local UI primitives
- Browser Web Speech API for local ASR/STT fallback
- Node API adapter for nanopencil and `memoir-book-pipeline-skill`

## Run

```bash
npm install
npm run dev:all
```

The Vite app runs on `http://localhost:5173`, and the local API adapter runs on `http://localhost:8787`.

## Connect nanopencil

The frontend only talks to the local API. Keep the agent and book pipeline server-side so browser code never depends on CLI internals.

Local nanoPencil RPC is the default development path. If this file exists, the API server will use it automatically:

```text
/Users/cunyu666/Dev/nanoPencil/dist/cli.js
```

Run:

```bash
npm run dev:api
```

Then verify:

```bash
curl http://localhost:8787/api/status
```

Expected:

```json
{
  "mode": "rpc",
  "cliPath": "/Users/cunyu666/Dev/nanoPencil/dist/cli.js"
}
```

Useful overrides:

```bash
NANOPENCIL_CLI_PATH="/Users/cunyu666/Dev/nanoPencil/dist/cli.js" npm run dev:api
NANOPENCIL_WORKDIR="/Users/cunyu666/Dev/membook" npm run dev:api
NANOPENCIL_MODEL="dashscope-coding/qwen3-coder-plus" npm run dev:api
NANOPENCIL_RPC=0 npm run dev:api
```

The browser calls `/api/agent/interview`; the Node adapter keeps a local `node dist/cli.js --mode rpc` subprocess and sends interview prompts over stdin/stdout.

ACP note: nanoPencil ACP is a stdio NDJSON protocol for editor clients. Browsers cannot call it directly. If you run a separate HTTP ACP bridge, you can still point this adapter at that bridge:

```bash
NANOPENCIL_ACP_URL="http://localhost:PORT/YOUR_ACP_ENDPOINT" npm run dev:api
```

By default the adapter sends a JSON-RPC request:

```json
{
  "jsonrpc": "2.0",
  "id": "uuid",
  "method": "agent.interview",
  "params": {
    "session": {},
    "answer": "raw elder answer"
  }
}
```

Override the ACP method if your local nanopencil service exposes a different method name:

```bash
NANOPENCIL_ACP_METHOD="your.method" npm run dev:api
```

The expected result payload is:

```json
{
  "question": "next follow-up question",
  "readiness": 42,
  "insights": [{ "label": "Key people", "value": "Mother" }]
}
```

Command mode remains available as a fallback:

```bash
NANOPENCIL_COMMAND="nanopencil interview" npm run dev:api
```

The command receives JSON on stdin:

```json
{
  "session": {},
  "answer": "raw elder answer"
}
```

It should return JSON:

```json
{
  "question": "next follow-up question",
  "readiness": 42,
  "insights": [{ "label": "Key people", "value": "Mother" }]
}
```

## Bailian ASR

The UI includes a local-only input for a Bailian API key and an editable ASR endpoint. The API key is stored in browser `localStorage` for development convenience.

Default model:

```text
qwen3-asr-flash-filetrans
```

Default endpoint:

```text
https://dashscope.aliyuncs.com/compatible-mode/v1/audio/transcriptions
```

You can override the default server-side endpoint:

```bash
BAILIAN_ASR_ENDPOINT="https://dashscope.aliyuncs.com/compatible-mode/v1/audio/transcriptions" npm run dev:api
```

## Connect memoir-book-pipeline-skill

Install and expose the pipeline through a CLI command that accepts JSON stdin and returns a book draft JSON object:

```bash
npm i memoir-book-pipeline-skill
MEMOIR_PIPELINE_COMMAND="memoir-book-pipeline generate" npm run dev:api
```

Expected output:

```json
{
  "title": "A Life, Told Slowly",
  "subtitle": "A first draft shaped from oral interviews",
  "chapters": [{ "title": "Chapter 1", "summary": "..." }],
  "excerpt": "..."
}
```

If these environment variables are not set, the API uses local deterministic fallbacks so the product demo remains usable.
