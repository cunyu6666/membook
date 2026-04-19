/**
 * [WHO]: 提供 cn() 工具函数，用于合并Tailwind CSS类名
 * [FROM]: 依赖 clsx 和 tailwind-merge 库
 * [TO]: 被所有UI组件和App.tsx消费
 * [HERE]: src/lib/utils.ts，UI组件库的基础依赖
 */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
