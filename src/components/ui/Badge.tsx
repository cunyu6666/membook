/**
 * [WHO]: 提供 Badge 组件，用于标签和分类标记
 * [FROM]: 依赖React、cn()工具函数
 * [TO]: 被App.tsx消费，用于区块标题和状态标记
 * [HERE]: src/components/ui/Badge.tsx，UI组件库标签组件
 */
import { type HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
