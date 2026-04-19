/**
 * [WHO]: 提供 cn 类名合并函数
 * [FROM]: 依赖 clsx, tailwind-merge
 * [TO]: 被所有 UI 组件和 App.tsx 消费
 * [HERE]: src/lib/，基础工具函数模块
 */
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
