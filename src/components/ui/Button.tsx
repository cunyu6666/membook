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
  "inline-flex items-center justify-center gap-2 rounded-full text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground shadow-[0_16px_40px_hsl(var(--primary)/0.24)] hover:translate-y-[-1px]",
        secondary:
          "border border-border bg-card/72 text-foreground backdrop-blur hover:bg-muted/40",
        ghost: "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
      },
      size: {
        sm: "h-9 px-4",
        md: "h-11 px-5",
        lg: "h-14 px-7 text-base",
        icon: "h-11 w-11",
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
