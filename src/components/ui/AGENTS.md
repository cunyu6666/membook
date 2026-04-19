# UI组件库模块 (src/components/ui/)

> P2 | shadcn风格本地UI原语 · 基础组件

## 模块概述

提供可复用的基础UI组件，采用shadcn设计理念，使用class-variance-authority实现变体系统。

## 成员列表

| 文件 | 类型 | WHO (提供) | TO (使用者) | 说明 |
|------|------|-----------|------------|------|
| `Button.tsx` | 组件 | `Button`, `ButtonProps`, `buttonVariants` | App.tsx | 按钮组件，支持primary/secondary/ghost变体 |
| `Card.tsx` | 组件 | `Card` | App.tsx | 卡片容器，带圆角和阴影 |
| `Badge.tsx` | 组件 | `Badge` | App.tsx | 标签组件，用于分类标记 |
| `Textarea.tsx` | 组件 | `Textarea` | App.tsx | 多行文本输入框 |
| `LandingCarousel.tsx` | 组件 | `LandingCarousel` | pages/LandingPage.tsx | 落地页图片轮播组件 |
| `MorphingSpinner.tsx` | 组件 | `MorphingSpinner` | App.tsx | 变形旋转加载动画 |
| `shimmering-text.tsx` | 组件 | `ShimmeringText` | App.tsx | 闪烁文字效果组件 |
| `RealtimeTranscriber.tsx` | 组件 | `RealtimeTranscriber` | App.tsx | 实时语音转写组件 |

## 依赖关系 (FROM)

- React 19
- `class-variance-authority` - 变体系统
- `clsx` - 条件类名合并
- `tailwind-merge` - Tailwind类名智能合并
- `src/lib/utils.ts` - `cn()` 工具函数

## 下游消费者 (TO)

- `src/App.tsx` (主要消费者)
- `src/components/pages/` (页面组件)

## 模块坐标 (HERE)

位于 `src/components/ui/`，是UI层的基础设施。

## 设计系统

### 变体规范

**Button**:
- `variant`: primary | secondary | ghost
- `size`: sm | md | lg | icon

### 样式约定

- 所有组件使用圆角设计 (`rounded-full`, `rounded-3xl`, `rounded-[2rem]`)
- 支持毛玻璃效果 (`backdrop-blur`)
- 暗色模式通过 `.dark` 类切换
- 使用CSS变量定义颜色系统

## 关联文档

- [P2-src 前端应用](../../src/AGENTS.md)

---
*本文档遵循DIP协议*
