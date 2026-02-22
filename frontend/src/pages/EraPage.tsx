import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getEraPoems } from '../api'
import { PageLoader, Empty, ErrorBox } from '../components/UI'
import { ArrowRight, BookOpen, ChevronRight, ChevronLeft, User } from 'lucide-react'
import type { QafiyahPoem } from '../types'
import allPoetsData from '../api/all_poets.json'

type Tab = 'poets' | 'poems'
const POETS_PER_PAGE = 10

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

export default function EraPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { slug } = useParams<{ slug: string }>()
  const [poetPage, setPoetPage] = useState(1)
  const [poemPage, setPoemPage] = useState(1)
  const [tab, setTab] = useState<Tab>('poets')
  const [allPoets, setAllPoets] = useState<Array<{ id: number; name: string; slug: string; eraId: number; poemsCount: number }>>([])
  const [loadingAllPoets, setLoadingAllPoets] = useState(true)
  const [eraTotal, setEraTotal] = useState(0)
  const [eraDetailsName, setEraDetailsName] = useState<string | null>(null)
  const [eraId, setEraId] = useState<number | null>(null)

  // Load poets from JSON based on era ID
  useEffect(() => {
    const loadEraPoets = async () => {
      if (!slug) return
      
      setLoadingAllPoets(true)
      try {
        // Load era details to get era ID
        const eraData = await getEraPoems(slug, 1)
        const eraDetails = (eraData as any)?.data?.eraDetails
        const loadedEraId = eraDetails?.id
        const eraName = eraDetails?.name
        const totalPoemsCount = eraDetails?.poemsCount || 0
        
        if (loadedEraId) {
          setEraId(loadedEraId)
          setEraDetailsName(eraName || null)
          setEraTotal(totalPoemsCount)
          
          // Filter poets from JSON by era ID
          const eraPoets = (allPoetsData as any[]).filter(
            poet => poet.eraId === loadedEraId
          )
          setAllPoets(eraPoets)
        } else {
          setAllPoets([])
        }
      } catch (error) {
        console.error('Failed to load era poets', error)
        setAllPoets([])
      } finally {
        setLoadingAllPoets(false)
      }
    }
    
    loadEraPoets()
  }, [slug])

  // Load poems data (use poemPage)
  const { data: poemsData, isLoading: loadingPoems, error: poemsErr } = useQuery({
    queryKey: ['era-poems', slug, poemPage],
    queryFn:  () => getEraPoems(slug!, poemPage),
    enabled:  !!slug && tab === 'poems',
    placeholderData: prev => prev,
  })

  // Extract poems for current poems page
  const poems: QafiyahPoem[] = extractList(poemsData)

  // Get paginated poets from all poets
  const totalPoetPages = Math.ceil(allPoets.length / POETS_PER_PAGE)
  const pagePoets = allPoets.slice(
    (poetPage - 1) * POETS_PER_PAGE,
    poetPage * POETS_PER_PAGE
  )

  // Get pagination info from current data
  const getPaginationInfo = (data: unknown) => {
    const resp = data as any
    return {
      currentPage: resp?.meta?.pagination?.currentPage || 1,
      totalPages: resp?.meta?.pagination?.totalPages || 1,
      hasNextPage: resp?.meta?.pagination?.hasNextPage || false,
      hasPrevPage: resp?.meta?.pagination?.hasPrevPage || false,
    }
  }

  const poemsPagination = getPaginationInfo(poemsData)
  const eraName = (() => {
    // Prefer Arabic name passed via Link state
    const stateName = (location.state as any)?.name
    if (stateName) return stateName

    // Use eraDetailsName from loaded data
    if (eraDetailsName) return eraDetailsName

    const resp: any = poemsData as any
    
    // Check in data.eraDetails.name (new structure)
    if (resp?.data?.eraDetails?.name) return resp.data.eraDetails.name
    
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
    <div className="min-h-screen bg-gradient-to-b from-parchment-950 to-ink-950" dir="rtl">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs sm:text-sm text-ink-500 mb-10">
          <Link to="/library" className="hover:text-gold-400 transition-colors flex items-center gap-1.5">
            <BookOpen size={14} />
            <span>مكتبة الشعر</span>
          </Link>
          <ArrowRight size={12} className="rotate-180 text-ink-600" />
          <span className="text-ink-400">{eraName}</span>
        </div>

        {/* Era header */}
        <div className="card-parchment p-8 sm:p-10 mb-10 relative overflow-hidden">
          <div className="relative z-10">
            <h1 className="font-arabic text-4xl sm:text-5xl font-bold text-parchment-100 mb-3">عصر {eraName}</h1>
            <p className="text-ink-500 text-base sm:text-lg leading-relaxed">استكشف الشعراء والأعمال الشعرية من هذا العصر الزاهر</p>
            {eraTotal > 0 && (
              <div className="mt-6 flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-gold-400 font-semibold text-lg">{eraTotal}</span>
                  <span className="text-ink-500">قصيدة</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gold-400 font-semibold text-lg">{allPoets.length}</span>
                  <span className="text-ink-500">شاعر</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 sm:gap-6 mb-10 border-b-2 border-ink-800/50">
          <button
            onClick={() => setTab('poets')}
            className={`pb-4 px-1 sm:px-4 font-arabic font-semibold text-base sm:text-lg transition-all flex items-center gap-2.5 relative ${
              tab === 'poets'
                ? 'text-gold-400'
                : 'text-ink-500 hover:text-gold-300'
            }`}
          >
            <User size={18} />
            <span>الشعراء</span>
            {tab === 'poets' && <div className="absolute bottom-[-10px] left-0 right-0 h-1 bg-gradient-to-r from-gold-500 to-gold-400 rounded-t-lg"></div>}
          </button>
          <button
            onClick={() => setTab('poems')}
            className={`pb-4 px-1 sm:px-4 font-arabic font-semibold text-base sm:text-lg transition-all flex items-center gap-2.5 relative ${
              tab === 'poems'
                ? 'text-gold-400'
                : 'text-ink-500 hover:text-gold-300'
            }`}
          >
            <BookOpen size={18} />
            <span>القصائد</span>
            {tab === 'poems' && <div className="absolute bottom-[-10px] left-0 right-0 h-1 bg-gradient-to-r from-gold-500 to-gold-400 rounded-t-lg"></div>}
          </button>
        </div>

        {/* Poets View */}
        {tab === 'poets' && (
          <>
            <div className="flex items-center justify-between mb-8">
              <h2 className="font-arabic text-2xl font-bold text-parchment-100">الشعراء</h2>
              <span className="text-ink-500 text-sm bg-ink-900/50 px-4 py-2 rounded-full">{allPoets.length} شاعراً</span>
            </div>

          {loadingAllPoets && <PageLoader message="جارٍ تحميل الشعراء..." />}
          {!loadingAllPoets && allPoets.length === 0 && <Empty message="لا يوجد شعراء في هذا العصر" />}
          {!loadingAllPoets && pagePoets.length > 0 && (
            <div className="space-y-3">
              {pagePoets.map((poet, idx) => (
                <div
                  key={idx}
                  onClick={() => poet.slug && navigate(`/library/poet/${poet.slug}`)}
                  className="relative p-5 sm:p-6 border border-ink-800/60 rounded-xl hover:border-gold-400/80 
                             bg-gradient-to-br from-ink-900/40 to-ink-950/60 hover:from-ink-900/60 hover:to-ink-950/80
                             transition-all duration-300 cursor-pointer group
                             hover:shadow-xl hover:shadow-gold-500/15 overflow-hidden"
                >
                  {/* Background accent */}
                  <div className="absolute inset-0 bg-gradient-to-r from-gold-500/0 via-transparent to-gold-500/0 
                                opacity-0 group-hover:opacity-5 transition-opacity duration-300"></div>
                  
                  {/* Content */}
                  <div className="relative z-10 flex items-center justify-between gap-3 sm:gap-4">
                    <h3 className="font-arabic text-lg sm:text-xl font-bold text-parchment-100 
                                 group-hover:text-gold-300 transition-colors flex-1">
                      {poet.name}
                    </h3>
                    
                    <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                      <div className="text-center px-3 sm:px-4 py-1.5 sm:py-2 bg-gold-500/15 border border-gold-400/40 rounded-lg
                                    group-hover:bg-gold-500/25 group-hover:border-gold-400/60 transition-all">
                        <p className="text-gold-300 font-arabic font-bold text-sm sm:text-base">
                          {poet.poemsCount}
                        </p>
                        <p className="text-gold-400/70 text-xs mt-0.5">قصيدة</p>
                      </div>
                      <ChevronLeft size={20} className="text-ink-600 group-hover:text-gold-400 
                                                       transition-colors hidden sm:block" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination for Poets */}
          <div className="flex items-center justify-center gap-4 mt-8">
            <button
              onClick={() => setPoetPage(p => Math.max(1, p - 1))}
              disabled={poetPage === 1}
              className="btn-ghost disabled:opacity-30"
            >
              <ChevronRight size={15} />السابق
            </button>
            <span className="text-ink-600 text-sm tabular-nums">صفحة {poetPage} من {totalPoetPages}</span>
            <button
              onClick={() => setPoetPage(p => p + 1)}
              disabled={poetPage >= totalPoetPages}
              className="btn-ghost disabled:opacity-30"
            >
              التالي<ChevronLeft size={15} />
            </button>
          </div>
        </>
      )}

      {/* Poems View */}
      {tab === 'poems' && (
        <>
          <div className="flex items-center justify-between mb-8">
            <h2 className="font-arabic text-2xl font-bold text-parchment-100">القصائد</h2>
            <span className="text-ink-500 text-sm bg-ink-900/50 px-4 py-2 rounded-full">صفحة {poemsPagination.currentPage}</span>
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
                    const poetName = (poem as any).poetName || poem.poet?.name || poem.poet_name

                    return (
                      <div 
                        key={poemSlug || idx}
                        onClick={() => navigate(`/library/poem/${poemSlug}`)}
                        className="poem-container p-6 hover:border-ink-600 transition-all cursor-pointer group">
                        
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
                          {verses.slice(0, 6).map((v, i) => (
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
              )
          )}

          {/* Pagination for Poems */}
          <div className="flex items-center justify-center gap-4 mt-8">
            <button
              onClick={() => setPoemPage(p => Math.max(1, p - 1))}
              disabled={poemsPagination.currentPage === 1}
              className="btn-ghost disabled:opacity-30"
            >
              <ChevronRight size={15} />السابق
            </button>
            <span className="text-ink-600 text-sm tabular-nums">صفحة {poemsPagination.currentPage}</span>
            <button
              onClick={() => setPoemPage(p => p + 1)}
              disabled={!poemsPagination.hasNextPage}
              className="btn-ghost disabled:opacity-30"
            >
              التالي<ChevronLeft size={15} />
            </button>
          </div>
        </>
      )}
      </div>
    </div>
  )
}
