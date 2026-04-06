import { Home, Calendar as CalendarIcon, Pill, Settings } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'

export function BottomNav() {
  const location = useLocation()
  
  const navItems = [
    { path: '/', label: '홈', icon: Home },
    { path: '/calendar', label: '달력', icon: CalendarIcon },
    { path: '/pills', label: '영양제', icon: Pill },
    { path: '/settings', label: '설정', icon: Settings },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-gray-100 flex items-center justify-around px-2 pb-safe">
      {navItems.map((item) => {
        const Icon = item.icon
        const isActive = location.pathname === item.path
        return (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              "flex flex-col items-center justify-center w-full h-full gap-1 transition-colors",
              isActive ? "text-[var(--color-primary)]" : "text-gray-400 hover:text-gray-600"
            )}
          >
            <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
            <span className="text-[10px] font-medium">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
