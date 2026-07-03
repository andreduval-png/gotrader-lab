import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[0.7rem] font-medium leading-5",
  {
    variants: {
      variant: {
        default: "border-primary/25 bg-primary/10 text-primary",
        secondary: "border-white/10 bg-white/[0.04] text-secondary-foreground",
        success: "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300",
        warning: "border-amber-400/20 bg-amber-400/[0.08] text-amber-200",
        danger: "border-rose-400/20 bg-rose-400/[0.08] text-rose-300",
        muted: "border-white/[0.07] bg-transparent text-muted-foreground"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant, className }))} {...props} />;
}
