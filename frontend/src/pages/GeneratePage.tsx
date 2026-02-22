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
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10" dir="rtl">
      {/* ── Header ── */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-lg bg-gold-900/30 border border-gold-700/30
                           flex items-center justify-center">
            <Sparkles size={15} className="text-gold-400" />
          </div>
          <h1 className="font-arabic text-3xl font-bold text-parchment-100">أنشئ قصيدتك</h1>
        </div>
        <p className="text-ink-500 text-sm mr-11">
          حدد الموضوع والبحر وسيُولّد الذكاء الاصطناعي قصيدة محققة الوزن
        </p>
      </div>

      {/* ── Form ── */}
      <div className="card-parchment p-5 mb-6 space-y-5">
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

        {/* Meter hint */}
        {selectedMeter && (
          <div className="bg-ink-950 rounded-xl p-3 border border-ink-800 text-sm">
            <span className="text-ink-600">التفعيلة: </span>
            <span className="font-arabic text-gold-400">{selectedMeter.pattern}</span>
          </div>
        )}

        {/* Submit */}
        <button onClick={submit} disabled={isLoading || !form.topic.trim()}
                className="btn-gold w-full py-3.5 text-base">
          {isLoading
            ? <><RefreshCw size={17} className="animate-spin" />جارٍ الإبداع...</>
            : <><Sparkles size={17} />أنشئ القصيدة</>}
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
                className="w-full flex items-center justify-between px-5 py-3.5
                           text-sm text-ink-500 hover:text-ink-300 transition-colors"
              >
                <span>سجل محاولات التصحيح ({result.attempt_history.length})</span>
                {showHistory ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
              </button>

              {showHistory && (
                <div className="border-t border-ink-800 divide-y divide-ink-800/50">
                  {result.attempt_history.map(h => (
                    <div key={h.attempt} className="px-5 py-4 space-y-2 opacity-70">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-ink-600">المحاولة {h.attempt}</span>
                        <ValidationBadge validation={h.validation} />
                      </div>
                      {h.validation.feedback && (
                        <pre className="text-xs text-ink-500 bg-ink-950 rounded-lg p-3
                                         whitespace-pre-wrap font-ui leading-relaxed">
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
          <button onClick={submit} className="btn-ghost w-full justify-center">
            <RefreshCw size={15} />
            أعد الإنشاء بنفس الإعدادات
          </button>
        </div>
      )}
    </div>
  )
}
