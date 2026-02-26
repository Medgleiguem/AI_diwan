import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Sparkles, BookOpen, Search, MessageCircle, Home, Menu, X } from 'lucide-react'
import clsx from 'clsx'


const NAV = [
  { to: '/',         label: 'الرئيسية',       icon: Home,          exact: true },
  { to: '/library',  label: 'مكتبة الشعر',    icon: BookOpen },
  { to: '/search',   label: 'بحث',            icon: Search },
  { to: '/chat',     label: 'حوار الشاعر',    icon: MessageCircle },
    { to: '/generate', label: 'أنشئ قصيدة',     icon: Sparkles },

]

export default function Layout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 border-b border-ink-800 bg-ink-950/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 flex items-center justify-between h-14 sm:h-16">
          {/* Logo */}
          <NavLink to="/" className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-gradient-to-br from-gold-400 to-gold-700
                            flex items-center justify-center text-ink-950 font-bold text-sm sm:text-lg shadow-md flex-shrink-0">
              د
            </div>
            <div className="hidden sm:block leading-tight">
              <div className="font-arabic text-base sm:text-lg font-bold text-gold-300">الديوان الذكي</div>
              <div className="text-xs text-ink-500">منصة الشعر العربي</div>
            </div>
          </NavLink>

          {/* Desktop nav */}
          <nav className="hidden md:flex gap-1">
            {NAV.map(n => (
              <NavLink key={n.to} to={n.to} end={n.exact}
                className={({ isActive }) => clsx(
                  'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-gold-600/20 text-gold-400 border border-gold-600/30'
                    : 'text-parchment-300 hover:text-parchment-100 hover:bg-ink-800'
                )}>
                <n.icon size={15} />
                {n.label}
              </NavLink>
            ))}
          </nav>

          {/* Mobile toggle */}
          <button className="md:hidden p-2 text-ink-400 hover:text-gold-300 transition-colors flex-shrink-0"
                  onClick={() => setOpen(o => !o)}>
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile nav */}
        {open && (
          <nav className="md:hidden border-t border-ink-800 bg-ink-950/95 px-3 sm:px-4 py-3 flex flex-col gap-1">
            {NAV.map(n => (
              <NavLink key={n.to} to={n.to} end={n.exact}
                onClick={() => setOpen(false)}
                className={({ isActive }) => clsx(
                  'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all',
                  isActive
                    ? 'bg-gold-800/30 text-gold-300 border border-gold-700/30'
                    : 'text-ink-400 hover:text-ink-200 hover:bg-ink-800'
                )}>
                <n.icon size={16} />
                {n.label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      {/* ── Content ── */}
      <main className="flex-1">{children}</main>

      {/* ── Footer ── */}
      <footer className="border-t border-ink-800 mt-16 sm:mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col sm:flex-row
                        items-center justify-between gap-4 text-xs sm:text-sm text-ink-600">
          <span className="font-arabic text-ink-500 text-center sm:text-left">الديوان الذكي ✦ شعر عربي بالذكاء الاصطناعي</span>
          <p className="text-center text-gold-500/80 sm:text-right">Mohamed Gleiguem</p>
        </div>
      </footer>
    </div>
  )
}
