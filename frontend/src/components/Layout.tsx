import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Sparkles, BookOpen, Search, MessageCircle, Home, Menu, X } from 'lucide-react'
import clsx from 'clsx'

const NAV = [
  { to: '/',         label: 'الرئيسية',       icon: Home,          exact: true },
  { to: '/generate', label: 'أنشئ قصيدة',     icon: Sparkles },
  { to: '/library',  label: 'مكتبة الشعر',    icon: BookOpen },
  { to: '/search',   label: 'بحث',            icon: Search },
  { to: '/chat',     label: 'حوار الشاعر',    icon: MessageCircle },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 border-b border-ink-800 bg-ink-950/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          {/* Logo */}
          <NavLink to="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gold-400 to-gold-700
                            flex items-center justify-center text-ink-950 font-bold text-lg shadow-md">
              د
            </div>
            <div className="hidden sm:block leading-tight">
              <div className="font-arabic text-lg font-bold text-gold-300">ديوان الذكاء</div>
              <div className="text-xs text-ink-500">منصة الشعر العربي</div>
            </div>
          </NavLink>

          {/* Desktop nav */}
          <nav className="hidden md:flex gap-1">
            {NAV.map(n => (
              <NavLink key={n.to} to={n.to} end={n.exact}
                className={({ isActive }) => clsx(
                  'flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-200',
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
          <button className="md:hidden p-2 text-ink-400 hover:text-gold-300"
                  onClick={() => setOpen(o => !o)}>
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {/* Mobile nav */}
        {open && (
          <nav className="md:hidden border-t border-ink-800 bg-ink-950/95 px-4 py-3 flex flex-col gap-1">
            {NAV.map(n => (
              <NavLink key={n.to} to={n.to} end={n.exact}
                onClick={() => setOpen(false)}
                className={({ isActive }) => clsx(
                  'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all',
                  isActive
                    ? 'bg-gold-800/30 text-gold-300 border border-gold-700/30'
                    : 'text-ink-400 hover:text-ink-200 hover:bg-ink-800'
                )}>
                <n.icon size={18} />
                {n.label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      {/* ── Content ── */}
      <main className="flex-1">{children}</main>

      {/* ── Footer ── */}
      <footer className="border-t border-ink-800 mt-20">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col sm:flex-row
                        items-center justify-between gap-3 text-sm text-ink-600">
          <span className="font-arabic text-ink-500">ديوان الذكاء ✦ شعر عربي بالذكاء الاصطناعي</span>
          {/* <div className="flex gap-4">
            <a href="https://qafiyah.com"                      target="_blank" rel="noopener noreferrer"
               className="hover:text-gold-500 transition-colors">قافية</a>
            <a href="https://github.com/ARBML/qawafi"          target="_blank" rel="noopener noreferrer"
               className="hover:text-gold-500 transition-colors">قوافي</a>
            <a href="https://github.com/alwalxed/qafiyah"      target="_blank" rel="noopener noreferrer"
               className="hover:text-gold-500 transition-colors">GitHub</a>
          </div> */}
          <p>med gleiguem</p>
        </div>
      </footer>
    </div>
  )
}
