import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

const VARIANTS = {
  default: "bg-secondary text-secondary-foreground",
  primary: "bg-primary/10 text-primary",
  warning: "bg-warning/20 text-warning-foreground",
  destructive: "bg-destructive/10 text-destructive",
  outline: "border border-border text-muted-foreground",
} as const;

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: keyof typeof VARIANTS;
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        VARIANTS[variant],
        className
      )}
      {...props}
    />
  );
}
