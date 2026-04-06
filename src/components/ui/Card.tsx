import { type HTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "bg-[#18181A] backdrop-blur-md rounded-[var(--radius-xl)] shadow-xl border border-zinc-800 p-4", 
        className
      )}
      {...props}
    />
  )
)
Card.displayName = "Card"
