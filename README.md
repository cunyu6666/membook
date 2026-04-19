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

For a handoff-friendly startup checklist, give [`AI_START_HERE.md`](./AI_START_HERE.md) to the AI or developer taking over this repo.

```bash
npm install
npm run dev:all
```

The Vite app runs on `http://localhost:5173`, and the local API adapter runs on `http://localhost:8787`.

## Connect nanopencil

The frontend only talks to the local API. Keep the agent and book pipeline server-side so browser code never depends on CLI internals.

Local nanoPencil RPC is the default development path. The API server looks for nanoPencil in this order:

1. `NANOPENCIL_CLI_PATH`, when you explicitly set it.
2. `node_modules/.bin/nanopencil` or `node_modules/.bin/nano-pencil`, if this project installs a local CLI package.
3. `nanopencil` or `nano-pencil` on `PATH`.
4. Local fallback mode, so the project still starts even when nanoPencil is not installed.

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
  "cliPath": "nanopencil"
}
```

Useful overrides:

```bash
NANOPENCIL_CLI_PATH="./node_modules/.bin/nanopencil" npm run dev:api
NANOPENCIL_WORKDIR="$PWD" npm run dev:api
NANOPENCIL_MODEL="dashscope-coding/qwen3-coder-plus" npm run dev:api
NANOPENCIL_RPC=0 npm run dev:api
```

The browser calls `/api/agent/interview`; the Node adapter keeps a local `nanopencil --mode rpc` subprocess and sends interview prompts over stdin/stdout. If `NANOPENCIL_CLI_PATH` points at a `.js`, `.mjs`, or `.cjs` file, the adapter runs it through the current Node executable.

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
