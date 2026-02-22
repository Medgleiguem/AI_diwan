import { useState } from 'react'
import { Copy, CheckCheck, ChevronDown, ChevronUp, Info, ShieldCheck, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import type { PoemData, Validation } from '../types'

// ── Spinner ──────────────────────────────────────────────────────────────────
export function Spinner({ className }: { className?: string }) {
  return (
    <div className={clsx('w-6 h-6 rounded-full border-2 border-ink-700 border-t-gold-400 animate-spin', className)} />
  )
}

export function PageLoader({ message = 'جارٍ التحميل...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <Spinner className="w-10 h-10 border-3" />
      <p className="text-ink-500 text-sm animate-pulse">{message}</p>
    </div>
  )
}

// ── Poetry Generation Loader ──────────────────────────────────────────────────
const LOADING_MSGS = [
  'يُفكر الشاعر في المطلع...',
  'يختار الكلمات بعناية...',
  'يضبط الأوزان والتفعيلات...',
  'يراجع القافية والروي...',
  'اللمسات الأخيرة على القصيدة...',
]

export function PoetryLoader({ attempt = 0, max = 5 }: { attempt?: number; max?: number }) {
  const msg = LOADING_MSGS[Math.min(attempt, LOADING_MSGS.length - 1)]
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-6">
      {/* Orbital ornament */}
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full border border-gold-800 animate-spin-slow" />
        <div className="absolute inset-2 rounded-full border border-gold-700/50 animate-spin-slow"
             style={{ animationDirection: 'reverse', animationDuration: '2.5s' }} />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-3 h-3 rounded-full bg-gold-500 animate-pulse-slow" />
        </div>
      </div>

      <div className="text-center space-y-1">
        <p className="font-arabic text-parchment-200 text-lg animate-pulse">{msg}</p>
        {attempt > 0 && (
          <p className="text-ink-600 text-xs">
            المحاولة {attempt} من {max}
          </p>
        )}
      </div>

      {/* Dots */}
      <div className="flex gap-2">
        {Array.from({ length: max }).map((_, i) => (
          <div key={i} className={clsx(
            'w-2 h-2 rounded-full transition-all duration-500',
            i < attempt ? 'bg-gold-500 scale-110' : 'bg-ink-800'
          )} />
        ))}
      </div>
    </div>
  )
}

// ── Validation Badge ──────────────────────────────────────────────────────────
export function ValidationBadge({ validation, attempts }: { validation: Validation; attempts?: number }) {
  if (!validation) return null
  return (
    <div className={clsx(
      'flex items-center gap-2 px-3 py-2 rounded-xl border text-sm',
      validation.valid
        ? 'bg-emerald-900/20 border-emerald-800/50 text-emerald-400'
        : 'bg-amber-900/20 border-amber-800/50 text-amber-400'
    )}>
      {validation.valid
        ? <ShieldCheck size={15} />
        : <AlertTriangle size={15} />}
      <span>
        {validation.valid ? 'صحيح الوزن والقافية' : 'وزن تقريبي — مراجعة موصى بها'}
      </span>
      {attempts != null && (
        <span className="text-xs opacity-60 mr-auto">
          · المحقق: {validation.validator} · {attempts} {attempts === 1 ? 'محاولة' : 'محاولات'}
        </span>
      )}
    </div>
  )
}

// ── Poem Display ─────────────────────────────────────────────────────────────
interface PoemDisplayProps {
  poem: PoemData
  validation?: Validation
  attempts?: number
}

export function PoemDisplay({ poem, validation, attempts }: PoemDisplayProps) {
  const [copied, setCopied]     = useState(false)
  const [showInfo, setShowInfo] = useState(false)

  const copyText = () => {
    const text = poem.poem.map(v => v.replace('###', '\n')).join('\n\n')
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      toast.success('تم نسخ القصيدة')
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="poem-container">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-ink-800/60 flex items-start justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap gap-2">
            <span className="badge-gold">بحر {poem.meter}</span>
            {poem.rhyme_letter && <span className="badge-gold">روي: {poem.rhyme_letter}</span>}
            {poem.theme && <span className="badge">{poem.theme}</span>}
          </div>
          {validation && (
            <ValidationBadge validation={validation} attempts={attempts} />
          )}
        </div>
        <button onClick={copyText} className="btn-ghost text-sm flex-shrink-0">
          {copied ? <CheckCheck size={14} className="text-emerald-400" /> : <Copy size={14} />}
          <span className="hidden sm:inline">{copied ? 'تم' : 'نسخ'}</span>
        </button>
      </div>

      {/* Verses */}
      <div className="px-4 sm:px-10 py-8 space-y-5">
        {poem.poem.map((verse, i) => {
          const [sadr, ajuz] = verse.includes('###')
            ? verse.split('###').map(s => s.trim())
            : [verse.trim(), '']

          const vResult = validation?.results?.[i]
          const vValid  = !vResult || vResult.valid

          return (
            <div key={i} className="relative group">
              {/* verse number */}
              <span className="absolute -right-5 top-1/2 -translate-y-1/2 text-xs text-ink-800
                               group-hover:text-gold-700 transition-colors select-none font-mono">
                {i + 1}
              </span>

              <div className={clsx(
                'verse-appear flex flex-col sm:flex-row items-center justify-center gap-0 sm:gap-1',
                !vValid && 'text-amber-200/80'
              )}>
                <span className="flex-1 sm:text-right px-3">{sadr}</span>
                {ajuz && (
                  <>
                    <span className="hidden sm:block w-px h-6 bg-gradient-to-b from-transparent via-gold-800 to-transparent" />
                    <span className="sm:hidden text-ink-700 text-xs my-0.5">✦</span>
                    <span className="flex-1 sm:text-left px-3">{ajuz}</span>
                  </>
                )}
              </div>

              {/* per-verse issue */}
              {vResult && !vResult.valid && (vResult.issues?.length || vResult.error) && (
                <p className="text-center text-xs text-amber-600/70 mt-1">
                  {vResult.issues?.join(' · ') || vResult.error}
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* Signature */}
      <p className="text-center pb-4 text-sm text-ink-700 font-arabic italic">
        — الشاعر الرقمي
      </p>

      {/* Explanation toggle */}
      {poem.explanation && (
        <div className="border-t border-ink-800/60">
          <button
            onClick={() => setShowInfo(v => !v)}
            className="w-full flex items-center justify-between px-5 py-3 text-sm
                       text-ink-500 hover:text-ink-300 transition-colors"
          >
            <span className="flex items-center gap-2"><Info size={13} />شرح وتحليل</span>
            {showInfo ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          {showInfo && (
            <div className="px-5 pb-5 text-ink-400 text-sm leading-relaxed
                            border-t border-ink-800/40 pt-4 font-arabic">
              {poem.explanation}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Skeleton loaders ──────────────────────────────────────────────────────────
export function PoetCardSkeleton() {
  return (
    <div className="card-parchment p-4 space-y-3">
      <div className="flex gap-3">
        <div className="skeleton w-10 h-10 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-4 w-28 rounded" />
          <div className="skeleton h-3 w-16 rounded" />
        </div>
      </div>
    </div>
  )
}

export function PoemCardSkeleton() {
  return (
    <div className="card-parchment p-5 space-y-3">
      <div className="skeleton h-4 w-40 rounded mx-auto" />
      <div className="skeleton h-4 w-56 rounded mx-auto" />
      <div className="skeleton h-4 w-48 rounded mx-auto" />
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────
export function Empty({ message = 'لا توجد نتائج' }: { message?: string }) {
  return (
    <div className="text-center py-16 text-ink-600">
      <div className="text-4xl mb-3">✦</div>
      <p>{message}</p>
    </div>
  )
}

// ── Error state ───────────────────────────────────────────────────────────────
export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="card-parchment border-red-900/50 bg-red-900/10 p-4 text-red-400 text-sm flex items-start gap-2">
      <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
      <span>{message}</span>
    </div>
  )
}
