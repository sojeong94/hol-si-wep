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
      <nav className="h-16 bg-zinc-950/95 backdrop-blur-xl border-t border-zinc-800 flex items-center justify-around px-1 w-full max-w-md shadow-[0_-1px_0_rgba(255,255,255,0.04)] pointer-events-auto">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname === item.path
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center w-full h-full gap-1 transition-all relative rounded-xl mx-0.5 active:scale-90",
                isActive ? "text-[var(--color-primary)]" : "text-zinc-500"
              )}
            >
              {isActive && (
                <div className="absolute inset-0 bg-[var(--color-primary)]/8 rounded-xl" />
              )}
              <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
              <span className={cn("text-[10px]", isActive ? "font-bold" : "font-medium")}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </nav>
      <div
        className="w-full max-w-md bg-zinc-950/95 pointer-events-none"
        style={{ height: 'env(safe-area-inset-bottom)' }}
      />
    </div>
  )
}
