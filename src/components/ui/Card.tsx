/**
 * [WHO]: 提供 Card 组件，作为带圆角和阴影的容器
 * [FROM]: 依赖React、cn()工具函数
 * [TO]: 被App.tsx消费，用于页面区块容器
 * [HERE]: src/components/ui/Card.tsx，UI组件库容器组件
 */
import { type HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <section
      className={cn(
        "rounded-lg bg-card/92 p-5 text-card-foreground shadow-[0_18px_48px_oklch(var(--foreground)/0.08)] ring-1 ring-foreground/5 backdrop-blur-sm",
        className,
      )}
      {...props}
    />
  );
}
