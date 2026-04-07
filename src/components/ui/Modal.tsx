import { type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  className?: string
}

export function Modal({ isOpen, onClose, title, children, className }: ModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 pb-safe-offset-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Content */}
      <div className={cn("relative w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-[var(--radius-2xl)] shadow-2xl shadow-pink-900/10 overflow-hidden transform transition-all flex flex-col max-h-[85vh]", className)}>
        {title && (
          <div className="flex-none flex items-center justify-between p-4 border-b border-zinc-800 shrink-0">
            <h3 className="text-lg font-bold text-white">{title}</h3>
            <button onClick={onClose} className="p-1 text-zinc-500 hover:text-white rounded-full hover:bg-zinc-800">
              <X size={20} />
            </button>
          </div>
        )}
        <div className="p-5 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  )
}
