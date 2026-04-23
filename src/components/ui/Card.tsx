import { type HTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, style, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "bg-[#18181A] backdrop-blur-md rounded-[var(--radius-xl)] shadow-xl border border-zinc-800 p-4 liquid-glass",
        className
      )}
      style={{
        ...style,
        background: 'linear-gradient(var(--glass-angle, 135deg), rgba(255,255,255,calc(0.06 + var(--glass-intensity, 0) * 0.08)) 0%, rgba(24,24,26,0.95) 60%)',
        borderColor: 'rgba(255,255,255,calc(0.08 + var(--glass-intensity, 0) * 0.12))',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,calc(0.1 + var(--glass-y, 0) * 0.08)), 0 4px 24px rgba(0,0,0,0.4)',
      }}
      {...props}
    />
  )
)
Card.displayName = "Card"
