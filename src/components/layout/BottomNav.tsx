import { Home, Calendar as CalendarIcon, Pill, User, MessageSquare } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

export function BottomNav() {
  const location = useLocation()
  const { t } = useTranslation()

  const navItems = [
    { path: '/', label: t('nav_home'), icon: Home },
    { path: '/calendar', label: t('nav_calendar'), icon: CalendarIcon },
    { path: '/community', label: '커뮤니티', icon: MessageSquare },
    { path: '/pills', label: t('nav_pills'), icon: Pill },
    { path: '/mypage', label: t('nav_mypage'), icon: User },
  ]

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex flex-col items-center pointer-events-none">
      <nav className="h-16 bg-white/60 backdrop-blur-3xl border-t-[1.5px] border-white/90 flex items-center justify-around px-2 w-full max-w-md shadow-[0_-4px_32px_rgba(255,100,0,0.08)] pointer-events-auto">
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
              {isActive && <div className="absolute top-0 w-8 h-[3px] bg-gradient-to-r from-[var(--color-primary)] to-orange-400 rounded-b-full shadow-[0_0_8px_rgba(255,100,0,0.5)]"></div>}
              <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-bold">{item.label}</span>
            </Link>
          )
        })}
      </nav>
      <div
        className="w-full max-w-md bg-white/60 backdrop-blur-3xl pointer-events-none"
        style={{ height: 'env(safe-area-inset-bottom)' }}
      />
    </div>
  )
}
