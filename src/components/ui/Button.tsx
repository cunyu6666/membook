/**
 * [WHO]: 提供 Button 组件及 buttonVariants 变体系统，支持primary/secondary/ghost变体和sm/md/lg/icon尺寸
 * [FROM]: 依赖React、class-variance-authority、cn()工具函数
 * [TO]: 被App.tsx消费，用于所有按钮交互元素
 * [HERE]: src/components/ui/Button.tsx，UI组件库核心成员
 */
import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground shadow-[0_10px_24px_oklch(var(--primary)/0.18)] hover:-translate-y-0.5 hover:shadow-[0_14px_30px_oklch(var(--primary)/0.2)]",
        secondary:
          "border border-border/80 bg-card/82 text-foreground shadow-[0_1px_0_oklch(var(--foreground)/0.04)] hover:border-primary/35 hover:bg-muted/42",
        ghost: "text-muted-foreground hover:bg-muted/42 hover:text-foreground",
      },
      size: {
        sm: "h-9 px-3.5",
        md: "h-10 px-4",
        lg: "h-12 px-5 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      ref={ref}
      {...props}
    />
  ),
);

Button.displayName = "Button";
