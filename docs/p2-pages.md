# 页面组件模块 (src/components/pages/)

> P2 | 页面级组件 · 路由页面入口

## 模块概述

页面级组件，对应路由入口，处理完整的页面布局和业务编排。

## 成员列表

| 文件 | 类型 | WHO (提供) | TO (使用者) | 说明 |
|------|------|-----------|------------|------|
| `LoginPage.tsx` | 组件 | `LoginPage` 登录页面 | App.tsx (路由) | 管理员登录页面 |
| `LandingPage.tsx` | 组件 | `LandingPage` 落地页 | App.tsx (路由) | 首页/引导页 |
| `BookReader.tsx` | 组件 | `BookReader` 阅读器 | App.tsx (路由) | 回忆录阅读器核心组件 |
| `BookReaderPage.tsx` | 组件 | `BookReaderPage` 阅读页面 | App.tsx (路由) | 回忆录阅读页面包装 |

## 依赖关系 (FROM)

- React Router (react-router-dom)
- UI 组件库 (src/components/ui/)
- lib 客户端 (src/lib/)
- hooks (src/hooks/)

## 关系说明

- 被 App.tsx 中的路由配置引用
- 依赖 UI 组件进行页面布局
- 通过 lib/ 与后端服务通信
