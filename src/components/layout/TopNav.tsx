import { Home, Calendar as CalendarIcon, Pill, User } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'

export function TopNav() {
  const location = useLocation()
  
  const navItems = [
    { path: '/', label: '홈', icon: Home },
    { path: '/calendar', label: '달력', icon: CalendarIcon },
    { path: '/pills', label: '영양제', icon: Pill },
    { path: '/mypage', label: '마이페이지', icon: User },
  ]

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 flex justify-center w-full pointer-events-none"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <nav className="h-16 bg-white/60 backdrop-blur-3xl border-b-[1.5px] border-white/90 flex items-center justify-around px-2 w-full max-w-md shadow-[0_4px_32px_rgba(255,100,0,0.08)] pointer-events-auto">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname === item.path
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center w-full h-full gap-1 transition-colors relative",
                isActive ? "text-[var(--color-primary)]" : "text-gray-500 hover:text-gray-700"
              )}
            >
              <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-bold">{item.label}</span>
              {isActive && <div className="absolute bottom-0 w-8 h-[3px] bg-gradient-to-r from-[var(--color-primary)] to-orange-400 rounded-t-full shadow-[0_0_8px_rgba(255,100,0,0.5)]"></div>}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
