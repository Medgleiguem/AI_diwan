import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getRhymePoems } from '../api'
import { PageLoader, Empty, ErrorBox } from '../components/UI'
import { ArrowRight, BookOpen, ChevronRight, ChevronLeft, Zap } from 'lucide-react'
import type { QafiyahPoem } from '../types'
import rhymesData from '../api/rhymes.json'

function extractList<T>(data: unknown): T[] {
  if (!data) return []
  if (Array.isArray(data)) return data as T[]
  const d = data as Record<string, unknown>
  
  // Handle the specific structure: { success, data: { poems: [...] }, meta: {...} }
  if (d['data'] && typeof d['data'] === 'object') {
    const nested = d['data'] as Record<string, unknown>
    // Check for poems array in data object
    if (Array.isArray(nested['poems'])) return nested['poems'] as T[]
    // Check for other possible array keys
    for (const key of ['items', 'results']) {
      if (Array.isArray(nested[key])) return nested[key] as T[]
    }
    // If data itself is an array, return it
    if (Array.isArray(nested)) return nested as T[]
  }
  
  // Fallback: check direct keys
  for (const key of ['data', 'poems', 'items', 'results']) {
    if (Array.isArray(d[key])) return d[key] as T[]
  }
  
  return []
}

export default function RhymePage() {
  const navigate = useNavigate()
  const { slug } = useParams<{ slug: string }>()
  const [page, setPage] = useState(1)

  // Get rhyme details from local data
  const rhymeDetails = (rhymesData?.data || []).find(
    (r: any) => r.slug === slug
  )
  const rhymeName = rhymeDetails?.name || slug || 'القافية'
  const rhymePoemsCount = rhymeDetails?.poemsCount || 0
  const rhymePoetsCount = rhymeDetails?.poetsCount || 0

  // Load poems for this rhyme
  const { data: poemsData, isLoading: loadingPoems, error: poemsErr } = useQuery({
    queryKey: ['rhyme-poems', slug, page],
    queryFn:  () => getRhymePoems(slug!, page),
    enabled:  !!slug,
    placeholderData: prev => prev,
  })

  const poems: QafiyahPoem[] = extractList(poemsData)

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 py-8 sm:py-10" dir="rtl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs sm:text-sm text-ink-600 mb-6 sm:mb-8 flex-wrap">
        <Link to="/library" className="hover:text-gold-400 transition-colors flex items-center gap-1">
          <BookOpen size={12} className="sm:w-4 sm:h-4" />
          <span className="hidden sm:inline">مكتبة الشعر</span>
          <span className="sm:hidden">المكتبة</span>
        </Link>
        <ArrowRight size={10} className="rotate-180 flex-shrink-0" />
        <span className="text-ink-400 truncate">{rhymeName}</span>
      </div>

      {/* Rhyme header */}
      <div className="card-parchment p-4 sm:p-6 lg:p-8 mb-6 sm:mb-8">
        <div className="flex items-start gap-3 sm:gap-5">
          <div className="w-14 h-14 sm:w-16 sm:h-16 lg:w-20 lg:h-20 rounded-full flex-shrink-0
                           bg-gradient-to-br from-gold-800/20 to-gold-900/20
                           border-2 border-gold-800/40 flex items-center justify-center">
            <Zap className="text-gold-400 w-7 h-7 sm:w-8 sm:h-8" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-arabic text-xl sm:text-2xl lg:text-3xl font-bold text-parchment-100 mb-1.5 sm:mb-2 break-words">
              {rhymeName}
            </h1>
            <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-2.5 sm:mb-3">
              <span className="badge-gold text-xs sm:text-sm">{rhymePoemsCount} قصيدة</span>
              <span className="badge text-xs sm:text-sm">{rhymePoetsCount} شاعر</span>
            </div>
            <p className="text-ink-400 text-xs sm:text-sm leading-relaxed">
              اكتشف جميع القصائد المقفاة بـ {rhymeName}
            </p>
          </div>
        </div>
      </div>

      {/* Poems section */}
      <div className="flex items-center justify-between mb-8">
        <h2 className="font-arabic text-2xl font-bold text-parchment-100">القصائد</h2>
        <span className="text-ink-500 text-sm bg-ink-900/50 px-4 py-2 rounded-full">صفحة {page}</span>
      </div>

      {loadingPoems && <PageLoader message="جارٍ تحميل القصائد..." />}
      {poemsErr && <ErrorBox message="تعذر تحميل القصائد — تأكد من تشغيل الخادم" />}

      {!loadingPoems && !poemsErr && (
        <>
          {poems.length === 0 ? (
            <Empty message="لا توجد قصائد لهذه القافية" />
          ) : (
            <div className="space-y-5 mb-8">
              {poems.map((poem: QafiyahPoem, idx: number) => {
                const title = poem.title
                const verses = poem.verses || (poem.text ? [poem.text] : [])
                const meter = poem.meter
                const poemSlug = poem.slug || poem.id
                const poetName = (poem as any).poetName || poem.poet?.name || poem.poet_name

                return (
                  <div
                    key={poemSlug || idx}
                    onClick={() => navigate(`/library/poem/${poemSlug}`)}
                    className="poem-container p-6 hover:border-ink-600 transition-all cursor-pointer group"
                  >
                    {/* Title and Meter Row */}
                    <div className="flex items-start justify-between gap-4 mb-6">
                      {title && (
                        <h3 className="font-arabic font-bold text-lg sm:text-xl text-parchment-200 
                                     group-hover:text-gold-300 transition-colors flex-1">
                          {title}
                        </h3>
                      )}
                      {meter && <span className="badge whitespace-nowrap text-xs">{meter}</span>}
                    </div>

                    {/* Verses */}
                    <div className="space-y-2 mb-6">
                      {verses.slice(0, 6).map((v: string, i: number) => (
                        <div key={i} className="font-arabic text-lg sm:text-xl text-parchment-100
                                               text-center leading-loose">
                          {v}
                        </div>
                      ))}
                      {verses.length > 6 && (
                        <p className="text-center text-xs text-ink-700 mt-3 pt-3 border-t border-ink-800">
                          ... و{verses.length - 6} أبيات أخرى
                        </p>
                      )}
                    </div>

                    {/* Poet Name at Bottom */}
                    {poetName && (
                      <div className="pt-4 border-t border-ink-800">
                        <p className="text-gold-400 font-arabic text-sm text-right">
                          للشاعر: <span className="font-semibold">{poetName}</span>
                        </p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Pagination */}
          {poems.length > 0 && (
            <div className="flex items-center justify-center gap-4 mt-8">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-ghost disabled:opacity-30"
              >
                <ChevronRight size={15} />السابق
              </button>
              <span className="text-ink-600 text-sm tabular-nums">صفحة {page}</span>
              <button
                onClick={() => setPage(p => p + 1)}
                className="btn-ghost disabled:opacity-30"
              >
                التالي<ChevronLeft size={15} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
