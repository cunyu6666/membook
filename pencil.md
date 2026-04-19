# 星光回忆录 (Membook)

> P1 | 项目根文档 · 全局拓扑导航

## 项目概述

AI辅助的口述历史访谈产品，帮助普通用户将长辈的口头回忆整理成家族回忆录。

**技术栈**: React 19 + Vite 6 + Tailwind CSS 4 + TypeScript + Node.js 服务端适配
**字体**: Noto Serif SC (中文衬线) + Figtree (英文无衬线)
**核心功能**:
- 语音/文字双模访谈：通过语音识别(ASR)或手动输入记录长辈回答
- AI智能追问：基于nanoPencil ACP/RPC协议的智能访谈代理
- 语音朗读(TTS)：将访谈问题朗读给长辈听
- 回忆录生成：将访谈内容自动整理成书稿初稿
- 百炼语音服务集成：支持实时ASR和TTS能力

## 目录结构 (P2 模块索引)

| 模块 | 路径 | 说明 | 文档 |
|------|------|------|------|
| 前端应用 | `src/` | React前端应用，包含UI组件、Hooks、客户端 | [P2-src](./docs/p2-src.md) |
| 服务端 | `server/` | Node.js API适配层，nanoPencil RPC客户端 | [P2-server](./docs/p2-server.md) |
| UI组件库 | `src/components/ui/` | shadcn风格的本地UI原语 | [P2-ui](./docs/p2-ui.md) |
| 自定义Hooks | `src/hooks/` | 音频录制、语音识别Hooks | [P2-hooks](./docs/p2-hooks.md) |
| 客户端库 | `src/lib/` | API客户端、国际化、工具函数 | [P2-lib](./docs/p2-lib.md) |
| 脚本 | `scripts/` | E2E测试脚本 | [P2-scripts](./docs/p2-scripts.md) |
| 设计技能 | `.agents/skills/` | 设计系统相关技能 | 见.impeccable.md |

## 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                      浏览器 (前端)                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │ App.tsx  │  │ UI组件   │  │ Hooks    │  │ lib/客户端 │  │
│  │ (主应用) │  │ (展示层) │  │ (录音/   │  │ (API调用)  │  │
│  │          │  │          │  │  识别)   │  │            │  │
│  └────┬─────┘  └──────────┘  └────┬─────┘  └─────┬──────┘  │
│       │                           │               │         │
│       └───────────────────────────┴───────────────┘         │
│                           │                                 │
└───────────────────────────┼─────────────────────────────────┘
                            │ HTTP /api/*
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Node.js 服务端 (8787)                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ server/index.ts (HTTP路由 + 业务逻辑)                 │   │
│  │  - /api/agent/interview → nanoPencil RPC/ACP/本地降级 │   │
│  │  - /api/book/generate   → memoir pipeline/本地草稿   │   │
│  │  - /api/asr/bailian     → 百炼ASR WebSocket/HTTP     │   │
│  │  - /api/tts/bailian     → 百炼TTS WebSocket           │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ server/nanopencil-rpc.ts (nanoPencil RPC客户端)       │   │
│  │  - 子进程管理 · stdin/stdout NDJSON协议               │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
              ┌─────────────────────────┐
              │ 外部服务                 │
              │ - nanoPencil CLI (RPC)  │
              │ - 百炼ASR/TTS (WebSocket)│
              │ - memoir-book-pipeline  │
              └─────────────────────────┘
```

## DIP协议

本项目采用**双相同构文档**(Dual-phase Isomorphic Documentation)体系：

- **P1**: 根文档(本文档)，描述全局拓扑和模块关系
- **P2**: 模块级文档，位于`docs/`目录，包含模块成员列表和关系
- **P3**: 文件头注释，提供WHO/TO/FROM/HERE四要素快速判断

**头阅读协议**:
1. 先读P3头(前5-8行)判断相关性
2. 若当前任务涉及WHO(提供什么)、FROM(依赖什么)、TO(谁使用)、HERE(位置范围) → 继续阅读
3. 若不相关 → 立即停止读取，保存上下文

## 开发指南

### 启动

```bash
npm install
npm run dev:all   # 同时启动前端(5173)和服务端(8787)
```

### 关键环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `NANOPENCIL_CLI_PATH` | nanoPencil CLI路径 | `/Users/cunyu666/Dev/nanoPencil/dist/cli.js` |
| `NANOPENCIL_RPC` | 是否启用RPC(0=禁用) | `1` |
| `NANOPENCIL_MODEL` | 使用的模型 | - |
| `NANOPENCIL_ACP_URL` | ACP桥接URL | - |
| `BAILIAN_ASR_ENDPOINT` | 百炼ASR端点 | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| `MEMOIR_PIPELINE_COMMAND` | 回忆录生成命令 | - |

### 设计原则

详见 `.impeccable.md`：
- C端优先：所有标签使用自然语言，避免技术术语
- 温暖胜过技术：UI中使用"录音"而非"ASR"，"朗读"而非"TTS"
- 星光主题：微妙的星形点缀强化品牌
- 尊重节奏：界面应感觉不匆忙—— generous spacing, soft animations
- 中文优先体验：主要面向中文用户

## 配置与规则

- **代码风格**: 使用ESLint + TypeScript严格模式
- **提交规范**: 小步可验证，每次提交可独立检查
- **文件命名**: 驼峰命名，组件使用PascalCase，hooks使用camelCase
- **禁止**: 使用`cat`/`sed`读取文件(使用Read工具)，`git add -A`(只add自己改动的文件)

---
*本文档遵循DIP协议生成，可根据项目需要修改*
