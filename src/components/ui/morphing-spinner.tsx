/**
 * [WHO]: 提供 MorphingSpinner 环形旋转加载动画组件
 * [FROM]: 依赖 lib/utils
 * [TO]: 被 App.tsx 消费
 * [HERE]: src/components/ui/，加载状态指示器
 */
import { cn } from "../../lib/utils";

interface MorphingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function MorphingSpinner({ size = "md", className }: MorphingSpinnerProps) {
  const sizeClasses = {
    sm: "w-5 h-5",
    md: "w-8 h-8",
    lg: "w-12 h-12",
  };
  const borderWidth = { sm: "border-[2px]", md: "border-[3px]", lg: "border-[4px]" };

  return (
    <div
      className={cn(
        "animate-spin rounded-full border-solid border-primary/30 border-t-primary",
        sizeClasses[size],
        borderWidth[size],
        className,
      )}
    />
  );
}
