import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, User, Feather, ChevronLeft, ChevronRight } from 'lucide-react'
import { searchPoetry } from '../api'
import { PageLoader, Empty, ErrorBox } from '../components/UI'
import allPoetsData from '../api/all_poets.json'
import clsx from 'clsx'

type SearchType = 'poems' | 'poets'
type MatchType  = 'exact' | 'all' | 'any'

function extractList<T>(data: unknown): T[] {
  if (!data) return []
  if (Array.isArray(data)) return data as T[]
  const d = data as Record<string, unknown>
  for (const key of ['data', 'results', 'poems', 'poets', 'items']) {
    if (Array.isArray(d[key])) return d[key] as T[]
  }
  return []
}

export default function SearchPage() {
  const navigate = useNavigate()
  const [q, setQ]                     = useState('')
  const [searchType, setSearchType]   = useState<SearchType>('poems')
  const [matchType, setMatchType]     = useState<MatchType>('all')
  const [page, setPage]               = useState(1)
  const [results, setResults]         = useState<any[]>([])
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')
  const [searched, setSearched]       = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const doSearch = async (p = 1) => {
    if (!q.trim()) return
    setLoading(true)
    setError('')
    setPage(p)
    try {
      const response = await searchPoetry({ q: q.trim(), search_type: searchType, match_type: matchType, page: p })
      const data = response?.data?.results || extractList(response)
      setResults(data)
      setSearched(true)
    } catch (e: any) {
      setError(e.message || 'خطأ في البحث')
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') doSearch(1)
  }

  const handleSearchTypeChange = (type: SearchType) => {
    setSearchType(type)
    setResults([])
    setSearched(false)
    setPage(1)
    setError('')
    setLoading(false)
  }

  // Clear results when search type changes
  useEffect(() => {
    setResults([])
    setSearched(false)
    setPage(1)
    setError('')
  }, [searchType])

  return (
    <div className="min-h-screen bg-gradient-to-b from-parchment-950 to-ink-950" dir="rtl">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 sm:gap-3 mb-2">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-purple-900/20 border border-purple-800/30
                           flex items-center justify-center flex-shrink-0">
            <Search size={14} className="text-purple-400" />
          </div>
          <h1 className="font-arabic text-2xl sm:text-3xl font-bold text-parchment-100">بحث في الشعر</h1>
        </div>
        <p className="text-ink-500 text-xs sm:text-sm ml-7 sm:ml-11">ابحث في أكثر من 944,000 بيت شعري</p>
      </div>

      {/* Search bar */}
      <div className="card-parchment p-4 sm:p-6 mb-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2
                                          text-ink-600 pointer-events-none" />
            <input ref={inputRef}
                   className="input-arabic pr-9 text-sm"
                   placeholder="أدخل كلمة أو مقطع شعري..."
                   value={q}
                   onChange={e => setQ(e.target.value)}
                   onKeyDown={onKey} />
          </div>
          <button onClick={() => doSearch(1)} disabled={loading || !q.trim()}
                  className="btn-gold px-4 sm:px-6 text-sm whitespace-nowrap">
            بحث
          </button>
        </div>

        {/* Options */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <div className="flex gap-1 flex-wrap">
            {([['poems', 'أبيات', Feather], ['poets', 'شعراء', User]] as const).map(([t, label, Icon]) => (
              <button key={t} onClick={() => handleSearchTypeChange(t)}
                      className={clsx(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm transition-all',
                        searchType === t
                          ? 'bg-gold-800/30 text-gold-300 border border-gold-700/30'
                          : 'text-ink-500 hover:text-ink-300 border border-ink-800'
                      )}>
                <Icon size={13} />{label}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {([['all', 'جميع'], ['any', 'أي'], ['exact', 'كامل']] as const).map(([t, label]) => (
              <button key={t} onClick={() => setMatchType(t)}
                      className={clsx(
                        'px-3 py-1.5 rounded-lg text-sm transition-all border',
                        matchType === t
                          ? 'bg-ink-800 text-ink-200 border-ink-600'
                          : 'text-ink-600 border-ink-800 hover:text-ink-400'
                      )}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && <ErrorBox message={error} />}

      {/* Loading */}
      {loading && <PageLoader message="جارٍ البحث..." />}

      {/* Results */}
      {!loading && searched && (
        results.length === 0
          ? <Empty message="لا توجد نتائج — جرب كلمات مختلفة" />
          : (
            <div className="space-y-4">
              <p className="text-ink-600 text-sm">{results.length} نتيجة</p>

              {results.map((item, i) => {
                const isPoet  = searchType === 'poets'
                const name    = item.name || item.poet_name || item.poet?.name
                const slug    = item.slug || item.poem_slug || item.poet_slug || item.id
                const verses  = item.verses || (item.poem_snippet ? item.poem_snippet.split('*').slice(1, -1) : item.text ? [item.text] : [])
                const title   = item.title || item.poem_title
                const meter   = item.meter || item.poem_meter

                // Get poem count from all_poets.json for poets
                const poetData = isPoet ? (allPoetsData as any[]).find(p => p.slug === slug || p.name === name) : null
                const poemsCount = poetData?.poemsCount || 0

                if (isPoet) return (
                  <div
                    key={slug || i}
                    onClick={() => slug && navigate(`/library/poet/${slug}`)}
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
                        {name}
                      </h3>
                      
                      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                        <div className="text-center px-3 sm:px-4 py-1.5 sm:py-2 bg-gold-500/15 border border-gold-400/40 rounded-lg
                                      group-hover:bg-gold-500/25 group-hover:border-gold-400/60 transition-all">
                          <p className="text-gold-300 font-arabic font-bold text-sm sm:text-base">
                            {poemsCount}
                          </p>
                          <p className="text-gold-400/70 text-xs mt-0.5">قصيدة</p>
                        </div>
                        <ChevronLeft size={20} className="text-ink-600 group-hover:text-gold-400 
                                                         transition-colors hidden sm:block" />
                      </div>
                    </div>
                  </div>
                )

                return (
                  <div key={slug || i} className="poem-container p-5 hover:border-ink-600 transition-all cursor-pointer"
                       onClick={() => navigate(`/library/poem/${slug}`)}>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {name  && <span className="text-gold-500 font-arabic text-sm">— {name}</span>}
                      {title && <span className="font-arabic text-parchment-300 text-sm">{title}</span>}
                      {meter && <span className="badge">{meter}</span>}
                    </div>
                    {verses.length > 0 ? (
                      verses.slice(0, 4).map((v: string, j: number) => (
                        <div key={j} className="font-arabic text-lg text-parchment-100 text-center leading-loose py-0.5">
                          <span dangerouslySetInnerHTML={{ __html: v.replace(/<mark>(.*?)<\/mark>/g, '<mark style="color: #ef4444; background-color: transparent;">$1</mark>') }} />
                        </div>
                      ))
                    ) : (
                      <div className="font-arabic text-lg text-parchment-100 text-center leading-loose py-0.5">
                        <span dangerouslySetInnerHTML={{ __html: item.poem_snippet.replace(/<mark>(.*?)<\/mark>/g, '<mark style="color: #ef4444; background-color: transparent;">$1</mark>') }} />
                      </div>
                    )}
                    {verses.length > 4 && (
                      <p className="text-center text-xs text-ink-700 mt-2">... و{verses.length - 4} أبيات</p>
                    )}
                  </div>
                )
              })}

              {/* Pagination */}
              <div className="flex items-center justify-center gap-4 pt-4">
                <button onClick={() => doSearch(page - 1)} disabled={page === 1}
                        className="btn-ghost disabled:opacity-30">
                  <ChevronRight size={15} />السابق
                </button>
                <span className="text-ink-600 text-sm tabular-nums">صفحة {page}</span>
                <button onClick={() => doSearch(page + 1)} disabled={results.length === 0}
                        className="btn-ghost disabled:opacity-30">
                  التالي<ChevronLeft size={15} />
                </button>
              </div>
            </div>
          )
      )}

      {/* Placeholder */}
      {!searched && !loading && (
        <div className="text-center py-20 text-ink-700">
          <Search size={40} className="mx-auto mb-4 opacity-20" />
          <p>اكتب كلمة أو مقطعاً شعرياً للبحث</p>
        </div>
      )}
      </div>
    </div>
  )
}
