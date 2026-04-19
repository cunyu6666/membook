/**
 * [WHO]: 提供 Textarea 组件，用于多行文本输入
 * [FROM]: 依赖React、cn()工具函数
 * [TO]: 被App.tsx消费，用于手动输入长辈回答
 * [HERE]: src/components/ui/Textarea.tsx，UI组件库表单组件
 */
import { type TextareaHTMLAttributes, forwardRef } from "react";
import { cn } from "../../lib/utils";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "min-h-32 w-full resize-none rounded-lg border border-border/85 bg-background/72 px-4 py-3 text-base leading-7 text-foreground outline-none transition-[border-color,box-shadow,background-color] duration-200 placeholder:text-muted-foreground focus:border-primary/70 focus:bg-background/92 focus:ring-4 focus:ring-primary/10",
      className,
    )}
    {...props}
  />
));

Textarea.displayName = "Textarea";
