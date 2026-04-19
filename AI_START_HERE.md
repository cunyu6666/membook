# AI 一键启动指南

这份文档给接手本仓库的 AI 或开发者使用。目标是：克隆项目后，不依赖任何个人电脑上的绝对路径，也能把前端、后端和可选的 nanoPencil 接起来。

## 1. 环境要求

- Node.js 20 或更高版本
- npm
- 可选：`nanopencil` 或 `nano-pencil` CLI
- 可选：百炼 API Key，用于语音识别和朗读

## 2. 首次安装

在项目根目录执行：

```bash
npm install
```

## 3. 一键启动

默认启动前端和本地 API：

```bash
npm run dev:all
```

启动后访问：

```text
http://localhost:5173
```

登录账号：

```text
admin / 12345678
```

## 4. 验证后端状态

另开一个终端：

```bash
curl http://localhost:8787/api/status
```

常见返回：

```json
{
  "mode": "rpc",
  "cliPath": "nanopencil",
  "memoirPipeline": "memoir-book-pipeline-skill@1.1.0"
}
```

如果本机没有 nanoPencil，也应该能启动，只是会返回：

```json
{
  "mode": "local"
}
```

`local` 是可运行的本地降级模式，能让页面和流程先跑起来。

## 5. nanoPencil 连接规则

服务端不会读取任何个人电脑的绝对路径。启动时按下面顺序寻找 nanoPencil：

1. `NANOPENCIL_CLI_PATH`
2. `./node_modules/.bin/nanopencil`
3. `./node_modules/.bin/nano-pencil`
4. PATH 里的 `nanopencil`
5. PATH 里的 `nano-pencil`
6. 找不到则自动进入 `local` 降级模式

如果你有本地 nanoPencil CLI，可以这样显式指定：

```bash
NANOPENCIL_CLI_PATH="/absolute/path/to/nanopencil-or-cli.js" npm run dev:api
```

如果指定的是 `.js`、`.mjs`、`.cjs` 文件，服务端会用当前 Node 运行它；如果指定的是可执行命令，会直接执行。

强制不用 nanoPencil：

```bash
NANOPENCIL_RPC=0 npm run dev:all
```

## 6. 百炼语音配置

页面右上角打开设置，填写百炼 API Key。前端会把 key 存在浏览器 `localStorage`，仅用于本地开发。

默认语音相关模型和端点已经在代码中配置：

- ASR: `fun-asr-realtime-2026-02-28`
- File ASR: `qwen3-asr-flash-filetrans`
- TTS: `qwen3-tts-instruct-flash-realtime`

## 7. 端口说明

默认端口：

- 前端 Vite: `5173`
- 本地 API: `8787`

Vite 开发代理固定把 `/api` 转到 `http://localhost:8787`。如果改 API 端口，需要同时给前端指定 API 地址：

```bash
PORT=8790 npm run dev:api
VITE_API_BASE="http://localhost:8790" npm run dev
```

## 8. 常用命令

```bash
npm run dev:all      # 前端 + 后端
npm run dev          # 只启动前端
npm run dev:api      # 只启动后端
npm run lint         # ESLint
npm run build        # TypeScript + Vite 生产构建
npm run test:e2e     # 语音代理端到端脚本
```

## 9. 排查顺序

1. `npm install` 是否成功。
2. `npm run dev:api` 是否打印 `Membook API listening on http://localhost:8787`。
3. `curl http://localhost:8787/api/status` 是否返回 JSON。
4. `npm run dev` 是否打印 Vite 地址。
5. 页面设置里是否填写百炼 API Key。
6. 如果 `mode` 是 `local`，说明没有发现 nanoPencil；这不是启动失败。
7. 如果要使用 nanoPencil，先确认 `which nanopencil` 或 `which nano-pencil` 能找到命令，或者设置 `NANOPENCIL_CLI_PATH`。

## 10. 给 AI 的注意事项

- 不要把 `/Users/...`、`/home/...` 这类个人机器路径写进代码默认值。
- 不要要求用户先安装 nanoPencil 才能启动页面；没有 nanoPencil 时项目必须能进入 `local` 模式。
- 修改启动逻辑后，至少运行：

```bash
npm run lint
npm run build
```

