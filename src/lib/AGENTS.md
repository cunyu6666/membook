# 客户端库模块 (src/lib/)

> P2 | API客户端、国际化、类型定义 · 共享工具层

## 模块概述

提供前端应用共享的类型定义、API客户端、国际化文案和工具函数。

## 成员列表

| 文件 | 类型 | WHO (提供) | TO (使用者) | 说明 |
|------|------|-----------|------------|------|
| `types.ts` | 类型 | 核心业务类型定义 | App.tsx, agentClient.ts | InterviewSession, BookDraft, ApiStatus等 |
| `utils.ts` | 函数 | `cn()` 类名合并函数 | UI组件, App.tsx | 基于clsx + tailwind-merge |
| `i18n.ts` | 常量 | 国际化文案对象 `copy` | App.tsx | 中英文双语支持 |
| `agentClient.ts` | 函数 | API客户端函数 | App.tsx | askAgent, generateBook, getApiStatus |
| `asrClient.ts` | 函数 | ASR客户端函数 | App.tsx | transcribeWithBailian |
| `ttsClient.ts` | 函数 | TTS客户端函数 | App.tsx | synthesizeWithBailian |
| `devSeed.ts` | 函数 | `seedMockMemoir()` | App.tsx (开发模式) | 开发环境模拟数据种子 |
| `bookFormat.ts` | 函数 | 书稿格式化函数 | BookReader.tsx | 回忆录内容格式化 |
| `phaseCopy.ts` | 函数 | 阶段文案函数 | StudioPage.tsx | 对话阶段状态文案 |
| `session.ts` | 函数 | 会话管理函数 | App.tsx | 创建/管理访谈会话 |

## 类型定义 (types.ts)

### 核心类型

```typescript
InterviewTurn       // 访谈轮次: role, content, timestamp
InterviewInsight    // 访谈洞察: label, value
InterviewSession    // 访谈会话: turns[], insights[], readiness
AgentInterviewResponse // AI追问响应: question, insights, readiness
BookDraft           // 书稿草稿: title, subtitle, chapters[], excerpt
ApiStatus           // API状态: mode, endpoints, models
```

## API客户端 (agentClient.ts)

### 导出函数

| 函数 | 说明 | 端点 |
|------|------|------|
| `askAgent(session, answer)` | 发送回答，获取AI追问 | POST `/api/agent/interview` |
| `generateBook(session)` | 生成回忆录书稿 | POST `/api/book/generate` |
| `getApiStatus()` | 获取服务状态 | GET `/api/status` |

## 国际化 (i18n.ts)

### 结构

```typescript
type Locale = "zh" | "en"
const copy: { zh: {...}, en: {...} }
```

包含所有UI文案的中英文对照，通过 `copy[locale]` 访问。

## 依赖关系 (FROM)

- `clsx` + `tailwind-merge` (utils.ts)
- 浏览器 `fetch` API (客户端文件)
- TypeScript (类型系统)

## 下游消费者 (TO)

- `src/App.tsx` (主要消费者)
- `src/StudioPage.tsx` (工作台页面)
- `src/components/ui/` (通过 utils.ts)

## 模块坐标 (HERE)

位于 `src/lib/`，是前端应用的共享工具层。

## 环境变量

- `VITE_API_BASE`: API基础路径，开发模式下通过Vite代理到 `http://localhost:8787`

## 关联文档

- [P2-src 前端应用](../../src/AGENTS.md)

---
*本文档遵循DIP协议*
