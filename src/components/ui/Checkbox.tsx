import { type InputHTMLAttributes, forwardRef } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export const Checkbox = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, checked, ...props }, ref) => (
    <div className="relative inline-flex items-center justify-center">
      <input
        type="checkbox"
        ref={ref}
        checked={checked}
        className="peer sr-only"
        {...props}
      />
      <div
        className={cn(
          "w-6 h-6 rounded-full border-2 border-[var(--color-primary)] bg-white transition-all flex items-center justify-center",
          "peer-checked:bg-[var(--color-primary)]",
          !checked && "border-gray-300",
          className
        )}
      >
        <Check size={16} strokeWidth={3} className={cn("text-white opacity-0 peer-checked:opacity-100 transition-opacity")} />
      </div>
    </div>
  )
)
Checkbox.displayName = "Checkbox"
