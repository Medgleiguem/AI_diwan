import { useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Sparkles, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import toast from 'react-hot-toast'
import { generatePoem, getLocalMeters } from '../api'
import { POEM_STYLES, VERSE_COUNTS, type GenerationResponse, type GenerateRequest } from '../types'
import { PoemDisplay, PoetryLoader, ErrorBox, ValidationBadge } from '../components/UI'
import clsx from 'clsx'

export default function GeneratePage() {
  const [params] = useSearchParams()
  const [isLoading, setIsLoading]   = useState(false)
  const [result, setResult]         = useState<GenerationResponse | null>(null)
  const [error, setError]           = useState('')
  const [attempt, setAttempt]       = useState(0)
  const [showHistory, setShowHistory] = useState(false)
  const resultRef = useRef<HTMLDivElement>(null)

  const [form, setForm] = useState<GenerateRequest>({
    topic:       '',
    meter:       params.get('meter') || 'الطويل',
    num_verses:  6,
    style:       'كلاسيكي',
    gemini_api_key: '',
  })

  const { data: metersData } = useQuery({
    queryKey: ['local-meters'],
    queryFn:  getLocalMeters,
  })

  const set = (k: keyof GenerateRequest, v: string | number) =>
    setForm(f => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.topic.trim()) { toast.error('يرجى إدخال موضوع القصيدة'); return }
    setIsLoading(true)
    setResult(null)
    setError('')
    setAttempt(0)

    // Simulate attempt counter incrementing visually
    const ticker = setInterval(() => setAttempt(a => Math.min(a + 1, 4)), 4000)

    try {
      const res = await generatePoem(form)
      setResult(res)
      if (res.success) {
        toast.success(`✓ قصيدة صحيحة في ${res.attempts} ${res.attempts === 1 ? 'محاولة' : 'محاولات'}`)
      } else {
        toast('تم التوليد مع تحفظات على الوزن', { icon: '⚠️' })
      }
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    } catch (e: any) {
      setError(e.message || 'خطأ غير متوقع')
      toast.error('فشل التوليد')
    } finally {
      clearInterval(ticker)
      setIsLoading(false)
      setAttempt(0)
    }
  }

  const selectedMeter = metersData?.meters.find(m => m.name === form.meter)

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10" dir="rtl">
      {/* ── Header ── */}
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-7 sm:w-8 h-7 sm:h-8 rounded-lg bg-gold-900/30 border border-gold-700/30
                           flex items-center justify-center flex-shrink-0">
            <Sparkles size={14} className="text-gold-400 sm:w-4 sm:h-4" />
          </div>
          <h1 className="font-arabic text-2xl sm:text-3xl font-bold text-parchment-100">أنشئ قصيدتك  <span className='text-red-600'>  ( هذه الخاصية ماتزال قيد التحسين)</span></h1>

        </div>
        <p className="text-ink-500 text-xs sm:text-sm mr-10 sm:mr-11">
          حدد الموضوع والبحر وسيُولّد الذكاء الاصطناعي قصيدة محققة الوزن
        </p>
      </div>

      {/* ── Form ── */}
      <div className="card-parchment p-4 sm:p-5 mb-6 space-y-4 sm:space-y-5">
        {/* Topic */}
        <div>
          <label className="block text-ink-400 text-sm mb-1.5">
            موضوع القصيدة <span className="text-gold-500">*</span>
          </label>
          <input
            className="input-arabic"
            placeholder="مثال: الحنين إلى الوطن، مدح الفروسية، جمال الربيع..."
            value={form.topic}
            onChange={e => set('topic', e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Meter */}
          <div>
            <label className="block text-ink-400 text-sm mb-1.5">البحر الشعري</label>
            <select className="select-arabic" value={form.meter}
                    onChange={e => set('meter', e.target.value)}>
              {(metersData?.meters ?? []).map(m => (
                <option key={m.name} value={m.name}>{m.name}</option>
              ))}
            </select>
          </div>

          {/* Verse count */}
          <div>
            <label className="block text-ink-400 text-sm mb-1.5">عدد الأبيات</label>
            <select className="select-arabic" value={form.num_verses}
                    onChange={e => set('num_verses', Number(e.target.value))}>
              {VERSE_COUNTS.map(n => (
                <option key={n} value={n}>{n} أبيات</option>
              ))}
            </select>
          </div>

          {/* Style */}
          <div>
            <label className="block text-ink-400 text-sm mb-1.5">الغرض</label>
            <select className="select-arabic" value={form.style}
                    onChange={e => set('style', e.target.value)}>
              {POEM_STYLES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Gemini API Key (optional) */}
        <div>
          <label className="block text-ink-400 text-sm mb-1.5">
            مفتاح Gemini API <span className='text-gold-400'> (اختياري)</span>
          </label>
          <input
            type="password"
            className="input-arabic text-xs font-mono"
            placeholder="اتركها فارغة لاستخدام المفتاح الافتراضي... (أو أدخل مفتاحك الخاص من Google AI)"
            value={form.gemini_api_key || ''}
            onChange={e => set('gemini_api_key', e.target.value)}
          />
          <p className="text-ink-600 text-xs mt-1.5">
            احصل على مفتاح مجاني من: <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-gold-400 hover:text-gold-300">aistudio.google.com</a>
          </p>
        </div>

        {/* Meter hint */}
        {selectedMeter && (
          <div className="bg-ink-950 rounded-xl p-3 border border-ink-800 text-sm">
            <span className="text-ink-600">التفعيلة: </span>
            <span className="font-arabic text-gold-400">{selectedMeter.pattern}</span>
          </div>
        )}

        {/* Submit */}
        <button onClick={submit} disabled={isLoading || !form.topic.trim()}
                className="btn-gold w-full py-3 sm:py-3.5 text-sm sm:text-base">
          {isLoading
            ? <><RefreshCw size={16} className="animate-spin" />جارٍ الإبداع...</>
            : <><Sparkles size={16} />أنشئ القصيدة</>}
        </button>
      </div>

      {/* ── Error ── */}
      {error && <ErrorBox message={error} />}

      {/* ── Loading ── */}
      {isLoading && (
        <div className="card-parchment mb-6">
          <PoetryLoader attempt={attempt} max={5} />
        </div>
      )}

      {/* ── Result ── */}
      {result && !isLoading && (
        <div ref={resultRef} className="space-y-4 animate-fade-up">
          <PoemDisplay poem={result.poem} validation={result.validation} attempts={result.attempts} />

          {/* Attempt history toggle */}
          {result.attempt_history.length > 1 && (
            <div className="card-parchment overflow-hidden">
              <button
                onClick={() => setShowHistory(v => !v)}
                className="w-full flex items-center justify-between px-4 sm:px-5 py-3 sm:py-3.5
                           text-xs sm:text-sm text-ink-500 hover:text-ink-300 transition-colors"
              >
                <span>سجل محاولات التصحيح ({result.attempt_history.length})</span>
                {showHistory ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
              </button>

              {showHistory && (
                <div className="border-t border-ink-800 divide-y divide-ink-800/50">
                  {result.attempt_history.map(h => (
                    <div key={h.attempt} className="px-4 sm:px-5 py-3 sm:py-4 space-y-2 opacity-70">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-ink-600">المحاولة {h.attempt}</span>
                        <ValidationBadge validation={h.validation} />
                      </div>
                      {h.validation.feedback && (
                        <pre className="text-xs sm:text-xs text-ink-500 bg-ink-950 rounded-lg p-2 sm:p-3
                                         whitespace-pre-wrap font-ui leading-relaxed max-h-32 sm:max-h-48 overflow-auto">
                          {h.validation.feedback}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Regenerate */}
          <button onClick={submit} className="btn-ghost w-full justify-center text-sm sm:text-base">
            <RefreshCw size={16} />
            أعد الإنشاء بنفس الإعدادات
          </button>
        </div>
      )}
    </div>
  )
}
