import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ShieldCheck, AlertTriangle, Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { validatePoem, getLocalMeters } from '../api'
import { ValidationBadge, ErrorBox } from '../components/UI'
import type { Validation } from '../types'
import clsx from 'clsx'

type VerseRow = { sadr: string; ajuz: string }

const INITIAL_VERSE: VerseRow = { sadr: '', ajuz: '' }

function buildVersesPayload(rows: VerseRow[]): string[] {
  return rows
    .filter((v) => v.sadr.trim() || v.ajuz.trim())
    .map((v) => `${v.sadr.trim()} ### ${v.ajuz.trim()}`)
}

export default function CheckPage() {
  const [verses, setVerses] = useState<VerseRow[]>([{ ...INITIAL_VERSE }])
  const [meter, setMeter] = useState('')
  const [result, setResult] = useState<Validation | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const { data: metersData } = useQuery({
    queryKey: ['local-meters'],
    queryFn: getLocalMeters,
  })

  const updateVerse = (index: number, field: 'sadr' | 'ajuz', value: string) => {
    setVerses((prev) =>
      prev.map((v, i) => (i === index ? { ...v, [field]: value } : v))
    )
    setResult(null)
    setError('')
  }

  const addVerse = () => {
    setVerses((prev) => [...prev, { ...INITIAL_VERSE }])
    setResult(null)
  }

  const removeVerse = (index: number) => {
    if (verses.length <= 1) return
    setVerses((prev) => prev.filter((_, i) => i !== index))
    setResult(null)
  }

  const submit = async () => {
    const payload = buildVersesPayload(verses)
    if (payload.length === 0) {
      toast.error('أدخل على الأقل صدراً وعجزاً لبيت واحد')
      return
    }

    setIsLoading(true)
    setResult(null)
    setError('')

    try {
      const validation = await validatePoem(payload, meter || undefined)
      setResult(validation)
      if (validation.valid) {
        toast.success('✓ القصيدة صحيحة الوزن والقافية')
      } else {
        toast('تم التحقق — بعض الأبيات تحتاج مراجعة', { icon: '⚠️' })
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'فشل التحقق'
      setError(msg)
      toast.error('فشل التحقق')
    } finally {
      setIsLoading(false)
    }
  }

  const submittedVerses = buildVersesPayload(verses)

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10" dir="rtl">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-7 sm:w-8 h-7 sm:h-8 rounded-lg bg-gold-900/30 border border-gold-700/30 flex items-center justify-center flex-shrink-0">
            <ShieldCheck size={14} className="text-gold-400 sm:w-4 sm:h-4" />
          </div>
          <h1 className="font-arabic text-2xl sm:text-3xl font-bold text-parchment-100">
            تحقق من قصيدتك
          </h1>
        </div>
        <p className="text-ink-500 text-xs sm:text-sm mr-10 sm:mr-11">
          اكتب كل بيت في حقلَي الصدر والعجز واضغط تحقق — يمكننا اكتشاف البحر تلقائياً أو اختياره يدوياً
        </p>
      </div>

      {/* Form: verses */}
      <div className="card-parchment p-4 sm:p-5 mb-4 space-y-5">
        <div>
          <p className="text-ink-400 text-sm font-medium">الأبيات</p>
          <p className="text-ink-600 text-xs mt-1">
            الصدر والعجز في حقلين منفصلين. وضع التشكيل يزيد دقة التحقق.
          </p>
        </div>

        {verses.map((row, index) => (
          <div
            key={index}
            className="rounded-xl border border-ink-800 bg-ink-950/50 p-4 space-y-3"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gold-500/90 font-medium">
                بيت {index + 1}
              </span>
              {verses.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeVerse(index)}
                  className="p-1.5 rounded-lg text-ink-500 hover:text-red-400 hover:bg-red-900/20 transition-colors"
                  title="حذف البيت"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-ink-500 text-xs font-medium">
                  الصدر
                </label>
                <input
                  type="text"
                  className="input-arabic w-full font-arabic text-base"
                  placeholder="الشطر الأول من البيت..."
                  value={row.sadr}
                  onChange={(e) => updateVerse(index, 'sadr', e.target.value)}
                  dir="rtl"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-ink-500 text-xs font-medium">
                  العجز
                </label>
                <input
                  type="text"
                  className="input-arabic w-full font-arabic text-base"
                  placeholder="الشطر الثاني من البيت..."
                  value={row.ajuz}
                  onChange={(e) => updateVerse(index, 'ajuz', e.target.value)}
                  dir="rtl"
                />
              </div>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addVerse}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-ink-700 text-ink-500 hover:border-gold-700/50 hover:text-gold-400 hover:bg-gold-900/10 transition-colors text-sm"
        >
          <Plus size={18} />
          أضف بيتاً
        </button>
      </div>

      {/* Meter + Submit */}
      <div className="card-parchment p-4 sm:p-5 mb-6 space-y-4">
        <div>
          <label className="block text-ink-400 text-sm mb-1.5">
            البحر الشعري <span className="text-ink-600 font-normal">(اختياري)</span>
          </label>
          <select
            className="select-arabic w-full"
            value={meter}
            onChange={(e) => setMeter(e.target.value)}
          >
            <option value="">اكتشف البحر تلقائياً</option>
            {(metersData?.meters ?? []).map((m) => (
              <option key={m.name} value={m.name}>
                {m.name}
              </option>
            ))}
          </select>
          <p className="text-ink-600 text-xs mt-1">
            إن لم تختر بحراً، نحاول اكتشافه من البيت الأول (يفضّل وضع التشكيل).
          </p>
        </div>

        <button
          onClick={submit}
          disabled={isLoading || submittedVerses.length === 0}
          className="btn-gold w-full py-3 sm:py-3.5 text-sm sm:text-base"
        >
          {isLoading ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-ink-700 border-t-gold-400 rounded-full animate-spin ml-2" />
              جارٍ التحقق...
            </>
          ) : (
            <>
              <ShieldCheck size={16} />
              تحقق من القصيدة
            </>
          )}
        </button>
      </div>

      {error && <ErrorBox message={error} />}

      {/* Result */}
      {result && !isLoading && submittedVerses.length > 0 && (
        <div className="space-y-4 animate-fade-up">
          <div className="card-parchment overflow-hidden">
            <div className="px-4 sm:px-5 py-4 border-b border-ink-800/60">
              <ValidationBadge validation={result} />
              {result.detected_meter && (
                <p className="text-gold-400/90 text-sm mt-2 font-arabic">
                  {result.auto_detected ? 'البحر المكتشف: ' : 'البحر: '}
                  <span className="font-bold">{result.detected_meter}</span>
                </p>
              )}
              <p className="text-ink-500 text-xs mt-2">
                المحقق: {result.validator}
              </p>
            </div>

            <div className="px-4 sm:px-6 py-6 space-y-5">
              {submittedVerses.map((verseStr, i) => {
                const [sadr, ajuz] = verseStr.includes('###')
                  ? verseStr.split('###').map((s) => s.trim())
                  : [verseStr.trim(), '']
                const r = result.results?.[i]
                const valid = !r || r.valid

                return (
                  <div key={i} className="relative group">
                    <span className="absolute -right-5 top-1/2 -translate-y-1/2 text-xs text-ink-800 font-mono select-none">
                      {i + 1}
                    </span>
                    <div
                      className={clsx(
                        'flex flex-col sm:flex-row items-center justify-center gap-0 sm:gap-1 font-arabic',
                        !valid && 'text-amber-200/90'
                      )}
                    >
                      <span className="flex-1 px-3 text-right">{sadr}</span>
                      {ajuz && (
                        <>
                          <span className="hidden sm:block w-px h-6 bg-gradient-to-b from-transparent via-gold-800 to-transparent" />
                          <span className="sm:hidden text-ink-700 text-xs">✦</span>
                          <span className="flex-1 px-3 text-left">{ajuz}</span>
                        </>
                      )}
                    </div>
                    {r && !r.valid && (r.issues?.length || r.error) && (
                      <div className="flex items-start gap-2 mt-2 text-amber-500/90 text-sm">
                        <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                        <span>{r.issues?.join(' · ') || r.error}</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {result.feedback && !result.valid && (
              <div className="border-t border-ink-800/60 px-4 sm:px-5 py-4">
                <p className="text-ink-500 text-xs font-medium mb-2">تفاصيل:</p>
                <pre className="text-xs text-ink-400 whitespace-pre-wrap font-ui leading-relaxed">
                  {result.feedback}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
