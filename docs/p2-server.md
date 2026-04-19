# 服务端模块 (server/)

> P2 | Node.js API适配层 · 外部服务桥接

## 模块概述

服务端模块是前后端之间的适配层，负责将浏览器请求转发到nanoPencil CLI、百炼语音服务等外部系统，并提供本地降级逻辑。

## 成员列表

| 文件 | 类型 | WHO (提供) | TO (使用者) | 说明 |
|------|------|-----------|------------|------|
| `index.ts` | 服务 | HTTP API服务器 | 前端应用 | 路由分发、业务逻辑、降级处理 |
| `nanopencil-rpc.ts` | 类 | `NanoPencilRpcClient` 类 | index.ts | nanoPencil子进程管理、NDJSON协议通信 |

## API端点

| 端点 | 方法 | 说明 | 降级策略 |
|------|------|------|----------|
| `/api/status` | GET | 服务状态检查 | 返回本地模式状态 |
| `/api/agent/interview` | POST | 访谈AI追问 | 本地规则引擎生成追问 |
| `/api/book/generate` | POST | 回忆录生成 | 本地模板生成草稿 |
| `/api/asr/bailian` | POST | 百炼语音识别 | 无降级(需API Key) |
| `/api/tts/bailian` | POST | 百炼语音合成 | 无降级(需API Key) |

## 依赖关系 (FROM)

- Node.js 内置模块: `http`, `child_process`, `fs`, `path`
- `ws` - WebSocket客户端(用于百炼服务)
- nanoPencil CLI (外部进程)
- 百炼ASR/TTS服务 (外部WebSocket/HTTP)

## 下游消费者 (TO)

- `src/` 前端模块 (通过HTTP API消费)
- nanoPencil CLI (通过stdin/stdout通信)
- 百炼云服务 (通过WebSocket/HTTP)

## 模块坐标 (HERE)

位于项目根目录 `server/`，是前端与外部服务之间的桥梁。与 `src/` 模块通过HTTP API连接，与外部nanoPencil CLI通过子进程NDJSON协议通信，与百炼服务通过WebSocket连接。

## 关键设计决策

1. **浏览器不直接调用CLI**: nanoPencil ACP是stdio NDJSON协议，浏览器无法直接调用，必须通过Node.js适配
2. **本地降级优先**: 所有AI功能都有本地降级，保证产品demo可用
3. **多模式支持**: 支持RPC、ACP、Command三种nanoPencil调用模式
4. **密钥存储**: 百炼API Key存储在浏览器localStorage，仅用于开发便利
