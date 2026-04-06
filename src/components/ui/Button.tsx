import { type ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'solid' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'solid', size = 'md', ...props }, ref) => {
    const variants = {
      solid: "bg-[var(--color-primary)] text-white hover:opacity-90 active:scale-95",
      outline: "border-2 border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-orange-50 active:scale-95",
      ghost: "text-gray-600 hover:bg-gray-100 active:scale-95",
    }
    const sizes = {
      sm: "px-3 py-1.5 text-sm",
      md: "px-4 py-2 font-medium",
      lg: "px-6 py-3 text-lg font-bold w-full",
    }
    
    return (
      <button
        ref={ref}
        className={cn(
          "rounded-full transition-all inline-flex items-center justify-center flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"
