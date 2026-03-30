import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold uppercase transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
        outline: "text-foreground",
        pending: "border-transparent bg-yellow-500 text-black shadow hover:bg-yellow-500/80 drop-shadow-[0_0_5px_rgba(234,179,8,0.5)]",
        approved: "border-transparent bg-primary text-black shadow hover:bg-primary/80 drop-shadow-[0_0_5px_hsl(var(--primary)/0.5)]",
        rejected: "border-transparent bg-destructive text-white shadow hover:bg-destructive/80 drop-shadow-[0_0_5px_hsl(var(--destructive)/0.5)]",
        suspended: "border-transparent bg-yellow-600/80 text-white shadow hover:bg-yellow-600/60 drop-shadow-[0_0_5px_rgba(161,98,7,0.5)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
