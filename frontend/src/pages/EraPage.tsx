import { useState } from 'react'
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getEraPoems } from '../api'
import { PageLoader, Empty, ErrorBox } from '../components/UI'
import { ArrowRight, BookOpen, ChevronRight, ChevronLeft } from 'lucide-react'
import type { QafiyahPoem } from '../types'

function extractList<T>(data: unknown): T[] {
  if (!data) return []
  if (Array.isArray(data)) return data as T[]
  const d = data as Record<string, unknown>
  
  // First check if 'data' key is directly an array
  if (Array.isArray(d['data'])) return d['data'] as T[]
  
  // Then try direct keys
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

export default function EraPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { slug } = useParams<{ slug: string }>()
  const [page, setPage] = useState(1)

  const { data: poemsData, isLoading: loadingPoems, error: poemsErr } = useQuery({
    queryKey: ['era-poems', slug, page],
    queryFn:  () => getEraPoems(slug!, page),
    enabled:  !!slug,
    placeholderData: prev => prev,
  })

  const poems: QafiyahPoem[] = extractList(poemsData)
  const eraName = (() => {
    // Prefer Arabic name passed via Link state
    const stateName = (location.state as any)?.name
    if (stateName) return stateName

    const resp: any = poemsData as any
    const dataObj = resp?.data ?? resp

    const eraObj = dataObj?.era ?? dataObj?.meta?.era ?? null
    if (eraObj) {
      if (typeof eraObj === 'string') return eraObj
      if (typeof eraObj === 'object') return eraObj.name || eraObj.title || eraObj.slug
    }

    if (dataObj?.name) return dataObj.name

    if (slug) return decodeURIComponent(slug.replace(/-/g, ' '))
    return 'عصر'
  })()

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10" dir="rtl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-ink-600 mb-8">
        <Link to="/library" className="hover:text-gold-400 transition-colors flex items-center gap-1">
          <BookOpen size={13} />مكتبة الشعر
        </Link>
        <ArrowRight size={11} className="rotate-180" />
        <span className="text-ink-400">{eraName}</span>
      </div>

      {/* Era header */}
      <div className="card-parchment p-6 sm:p-8 mb-8">
        <h1 className="font-arabic text-3xl font-bold text-parchment-100 mb-2">عصر {eraName}</h1>
        <p className="text-ink-400 text-sm">استكشف الأعمال الشعرية من هذا العصر الزاهر</p>
      </div>

      {/* Poems */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-arabic text-xl font-bold text-parchment-200">القصائد</h2>
        <span className="text-ink-600 text-sm">صفحة {page}</span>
      </div>

      {loadingPoems && <PageLoader message="جارٍ تحميل القصائد..." />}
      {poemsErr && <ErrorBox message="تعذر تحميل القصائد" />}
      {!loadingPoems && !poemsErr && (
        poems.length === 0
          ? <Empty message="لا توجد قصائد في هذا العصر" />
          : (
            <div className="space-y-5">
              {poems.map((poem, idx) => {
                const title   = poem.title
                const verses  = poem.verses || (poem.text ? [poem.text] : [])
                const meter   = poem.meter
                const poemSlug = poem.slug || poem.id
                const poetName = poem.poet?.name || poem.poet_name

                return (
                  <div 
                    key={poemSlug || idx}
                    onClick={() => navigate(`/library/poem/${poemSlug}`)}
                    className="poem-container p-5 hover:border-ink-600 transition-all cursor-pointer group">
                    {/* Poem meta */}
                    {(poetName || title || meter) && (
                      <div className="flex flex-wrap items-center gap-2 mb-4">
                        {poetName && <span className="text-gold-500 font-arabic text-sm">— {poetName}</span>}
                        {title && <span className="font-arabic font-bold text-parchment-200 group-hover:text-gold-300
                                                     transition-colors">{title}</span>}
                        {meter && <span className="badge">{meter}</span>}
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
      )}

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
