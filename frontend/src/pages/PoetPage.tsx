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
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-8 sm:py-10" dir="rtl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs sm:text-sm text-ink-600 mb-6 sm:mb-8 flex-wrap">
        <Link to="/library" className="hover:text-gold-400 transition-colors flex items-center gap-1">
          <BookOpen size={12} className="sm:w-4 sm:h-4" />
          <span className="hidden sm:inline">مكتبة الشعر</span>
          <span className="sm:hidden">المكتبة</span>
        </Link>
        <ArrowRight size={10} className="rotate-180 flex-shrink-0" />
        <span className="text-ink-400 truncate">{name}</span>
      </div>

      {/* Poet header */}
      <div className="card-parchment p-4 sm:p-6 lg:p-8 mb-6 sm:mb-8">
        <div className="flex items-start gap-3 sm:gap-5">
          <div className="w-14 h-14 sm:w-16 sm:h-16 lg:w-20 lg:h-20 rounded-full flex-shrink-0
                           bg-gradient-to-br from-gold-800/20 to-gold-900/20
                           border-2 border-gold-800/40 flex items-center justify-center">
            <span className="font-arabic text-gold-400 font-bold text-2xl sm:text-3xl">{name[0]}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-arabic text-xl sm:text-2xl lg:text-3xl font-bold text-parchment-100 mb-1.5 sm:mb-2 break-words">{name}</h1>
            <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-2.5 sm:mb-3">
              {era   && <span className="badge-gold text-xs sm:text-sm">{typeof era === 'string' ? era : era?.name}</span>}
              {birth && <span className="badge text-xs sm:text-sm">ولادة: {birth}</span>}
              {death && <span className="badge text-xs sm:text-sm">وفاة: {death}</span>}
            </div>
            {bio && <p className="text-ink-400 text-xs sm:text-sm leading-relaxed line-clamp-2 sm:line-clamp-none">{bio}</p>}
          </div>
        </div>
      </div>

      {/* Poems */}
      <div className="flex items-center justify-between mb-4 sm:mb-5">
        <h2 className="font-arabic text-lg sm:text-xl font-bold text-parchment-200">قصائد الشاعر</h2>
        <span className="text-ink-600 text-xs sm:text-sm">صفحة {page}</span>
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
              const poemSlug = poem.slug || poem.id

              return (
                <div 
                  key={poemSlug || idx}
                  onClick={() => navigate(`/library/poem/${poemSlug}`)}
                  className="poem-container p-4 sm:p-6 hover:border-ink-600 transition-all cursor-pointer group">
                  
                  {/* Title and Meter Row */}
                  <div className="flex items-start justify-between gap-3 sm:gap-4 mb-5 sm:mb-6">
                    {title && (
                      <h3 className="font-arabic font-bold text-base sm:text-lg text-parchment-200 
                                     group-hover:text-gold-300 transition-colors flex-1">
                        {title}
                      </h3>
                    )}
                    {meter && <span className="badge whitespace-nowrap text-xs sm:text-sm">بحر {meter}</span>}
                  </div>

                  {/* Verses */}
                  <div className="space-y-2 mb-5 sm:mb-6">
                    {verses.slice(0, 6).map((v, i) => (
                      <div key={i} className="font-arabic text-base sm:text-lg lg:text-xl text-parchment-100
                                               text-center leading-loose">
                        {v}
                      </div>
                    ))}
                    {verses.length > 6 && (
                      <p className="text-center text-xs text-ink-700 mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-ink-800">
                        ... و{verses.length - 6} أبيات أخرى
                      </p>
                    )}
                  </div>

                  {/* Poet Name at Bottom */}
                  {/* <div className="pt-4 sm:pt-5 border-t border-ink-800">
                    <p className="text-gold-400 font-arabic text-sm text-right">
                      للشاعر: <span className="font-semibold">{name}</span>
                    </p>
                  </div> */}
                </div>
              )
            })}
          </div>
        )
      }

      {/* Pagination */}
      <div className="flex items-center justify-center gap-2 sm:gap-4 mt-6 sm:mt-8">
        <button onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1} className="btn-ghost disabled:opacity-30 text-xs sm:text-sm px-2 sm:px-4">
          <ChevronRight size={14} />
          <span className="hidden sm:inline">السابق</span>
        </button>
        <span className="text-ink-600 text-xs sm:text-sm tabular-nums whitespace-nowrap">صفحة {page}</span>
        <button onClick={() => setPage(p => p + 1)}
                disabled={poems.length === 0} className="btn-ghost disabled:opacity-30 text-xs sm:text-sm px-2 sm:px-4">
          <span className="hidden sm:inline">التالي</span>
          <ChevronLeft size={14} />
        </button>
      </div>
    </div>
  )
}
