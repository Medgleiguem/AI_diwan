import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getPoetBySlug, getPoetPoems } from '../api'
import { PageLoader, Empty, ErrorBox } from '../components/UI'
import { ArrowRight, BookOpen, ChevronRight, ChevronLeft } from 'lucide-react'
import type { QafiyahPoem } from '../types'

function extractList<T>(data: unknown): T[] {
  if (!data) return []
  if (Array.isArray(data)) return data as T[]
  const d = data as Record<string, unknown>
  
  // First try direct keys
  for (const key of ['poems', 'items', 'results']) {
    if (Array.isArray(d[key])) return d[key] as T[]
  }
  
  // Then check nested in 'data'
  if (d['data'] && typeof d['data'] === 'object') {
    const nested = d['data'] as Record<string, unknown>
    for (const key of ['poems', 'items', 'results']) {
      if (Array.isArray(nested[key])) return nested[key] as T[]
    }
  }
  
  return []
}

export default function PoetPage() {
  const navigate = useNavigate()
  const { slug } = useParams<{ slug: string }>()
  const [page, setPage] = useState(1)

  const { data: poet, isLoading: loadingPoet, error: poetErr } = useQuery({
    queryKey: ['poet', slug],
    queryFn:  () => getPoetBySlug(slug!),
    enabled:  !!slug,
  })

  const { data: poemsData, isLoading: loadingPoems } = useQuery({
    queryKey: ['poet-poems', slug, page],
    queryFn:  () => getPoetPoems(slug!, page),
    enabled:  !!slug,
    placeholderData: prev => prev,
  })

  const poems: QafiyahPoem[] = extractList(poemsData)

  if (loadingPoet) return <PageLoader message="جارٍ تحميل بيانات الشاعر..." />
  if (poetErr)    return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <ErrorBox message="تعذر تحميل الشاعر — تأكد من صحة الرابط وتشغيل الخادم" />
    </div>
  )

  const poetData = poet?.data?.poet || poet?.data || poet
  const name  = poetData?.name || 'شاعر'
  const era   = poetData?.era
  const bio   = poetData?.bio || poetData?.description
  const birth = poetData?.birth_year
  const death = poetData?.death_year

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10" dir="rtl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-ink-600 mb-8">
        <Link to="/library" className="hover:text-gold-400 transition-colors flex items-center gap-1">
          <BookOpen size={13} />مكتبة الشعر
        </Link>
        <ArrowRight size={11} className="rotate-180" />
        <span className="text-ink-400">{name}</span>
      </div>

      {/* Poet header */}
      <div className="card-parchment p-6 sm:p-8 mb-8">
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex-shrink-0
                           bg-gradient-to-br from-gold-800/20 to-gold-900/20
                           border-2 border-gold-800/40 flex items-center justify-center">
            <span className="font-arabic text-gold-400 font-bold text-3xl">{name[0]}</span>
          </div>
          <div className="flex-1">
            <h1 className="font-arabic text-2xl sm:text-3xl font-bold text-parchment-100 mb-2">{name}</h1>
            <div className="flex flex-wrap gap-2 mb-3">
              {era   && <span className="badge-gold">{typeof era === 'string' ? era : era?.name}</span>}
              {birth && <span className="badge">ولادة: {birth}</span>}
              {death && <span className="badge">وفاة: {death}</span>}
            </div>
            {bio && <p className="text-ink-400 text-sm leading-relaxed">{bio}</p>}
          </div>
        </div>
      </div>

      {/* Poems */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-arabic text-xl font-bold text-parchment-200">قصائد الشاعر</h2>
        <span className="text-ink-600 text-sm">صفحة {page}</span>
      </div>

      {loadingPoems
        ? <PageLoader message="جارٍ تحميل القصائد..." />
        : poems.length === 0
        ? <Empty message="لا توجد قصائد في هذه الصفحة" />
        : (
          <div className="space-y-5">
            {poems.map((poem, idx) => {
              const title   = poem.title
              const verses  = poem.verses || (poem.text ? [poem.text] : [])
              const meter   = poem.meter
              const rhyme   = poem.rhyme
              const poemSlug = poem.slug || poem.id

              return (
                <div 
                  key={poemSlug || idx}
                  onClick={() => navigate(`/library/poem/${poemSlug}`)}
                  className="poem-container p-5 hover:border-ink-600 transition-all cursor-pointer group">
                  {/* Poem meta */}
                  {(title || meter || rhyme) && (
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                      {title && <span className="font-arabic font-bold text-parchment-200 group-hover:text-gold-300
                                                   transition-colors">{title}</span>}
                      {meter && <span className="badge">بحر {meter}</span>}
                      {rhyme && <span className="badge">روي: {rhyme}</span>}
                    </div>
                  )}

                  {/* Verses */}
                  <div className="space-y-1.5">
                    {verses.slice(0, 6).map((v, i) => (
                      <div key={i} className="font-arabic text-lg sm:text-xl text-parchment-100
                                               text-center leading-loose">
                        {v}
                      </div>
                    ))}
                    {verses.length > 6 && (
                      <p className="text-center text-xs text-ink-700 mt-2 pt-2 border-t border-ink-800">
                        ... و{verses.length - 6} أبيات أخرى
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )
      }

      {/* Pagination */}
      <div className="flex items-center justify-center gap-4 mt-8">
        <button onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1} className="btn-ghost disabled:opacity-30">
          <ChevronRight size={15} />السابق
        </button>
        <span className="text-ink-600 text-sm tabular-nums">صفحة {page}</span>
        <button onClick={() => setPage(p => p + 1)}
                disabled={poems.length === 0} className="btn-ghost disabled:opacity-30">
          التالي<ChevronLeft size={15} />
        </button>
      </div>
    </div>
  )
}
