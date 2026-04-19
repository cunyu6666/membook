# 前端应用模块 (src/)

> P2 | React前端应用 · 入口与主应用逻辑

## 模块概述

前端应用是用户直接交互的界面，实现访谈录制、语音识别、AI问答、回忆录生成等核心功能。

## 成员列表

| 文件 | 类型 | WHO (提供) | TO (使用者) | 说明 |
|------|------|-----------|------------|------|
| `main.tsx` | 入口 | React应用挂载 | 浏览器 | 应用初始化入口 |
| `App.tsx` | 组件 | `App` 主应用组件 | main.tsx | 核心业务逻辑和UI编排 |
| `StudioPage.tsx` | 组件 | `StudioPage` 工作台页面 | App.tsx (路由) | 访谈录制工作台主页面 |
| `styles.css` | 样式 | 全局CSS变量、动画 | 所有组件 | Tailwind配置、主题定义 |
| `vite-env.d.ts` | 类型 | Vite环境类型声明 | TypeScript编译器 | 环境变量类型定义 |

## 依赖关系 (FROM)

- React 19 + React DOM
- Remix Icon (图标库)
- Tailwind CSS 4 (样式框架)
- `src/components/ui/` - UI组件库
- `src/hooks/` - 自定义Hooks
- `src/lib/` - 客户端库

## 下游消费者 (TO)

- 浏览器用户 (最终用户)
- Vite开发服务器 (热更新)

## 模块坐标 (HERE)

位于项目根目录 `src/`，是整个前端应用的核心。与 `server/` 模块通过HTTP API (`/api/*`) 通信。

## 关联文档

- [P1 根文档](../pencil.md)
- [P2-ui UI组件库](./components/ui/AGENTS.md)
- [P2-pages 页面组件](./components/pages/AGENTS.md)
- [P2-hooks 自定义Hooks](./hooks/AGENTS.md)
- [P2-lib 客户端库](./lib/AGENTS.md)

---
*本文档遵循DIP协议，P2模块级文档应放在对应模块目录下*
