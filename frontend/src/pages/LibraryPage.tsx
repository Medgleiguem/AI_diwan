import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BookOpen, User, Globe, Feather, ChevronRight, ChevronLeft, RefreshCw, Music, Sparkles, Zap } from 'lucide-react'
import { getEras, getRandomPoem } from '../api'
import { PageLoader, Empty, ErrorBox, PoemCardSkeleton } from '../components/UI'
import type { QafiyahPoem } from '../types'
import allPoets from '../api/all_poets.json'
import metersData from '../api/meters.json'
import themesData from '../api/themes.json'
import rhymesData from '../api/rhymes.json'
import clsx from 'clsx'

type Tab = 'poets' | 'eras' | 'meters' | 'themes' | 'rhymes' | 'random'

const POETS_PER_PAGE = 16

// Helper: extract array from qafiyah response (API may return different shapes)
function extractList<T>(data: unknown): T[] {
  if (!data) return []
  if (Array.isArray(data)) return data as T[]
  const d = data as Record<string, unknown>
  
  // First check if 'data' key is directly an array
  if (Array.isArray(d['data'])) return d['data'] as T[]
  
  // Then try direct keys
  for (const key of ['poets', 'poems', 'eras', 'items', 'results']) {
    if (Array.isArray(d[key])) return d[key] as T[]
  }
  
  // Then check nested in 'data'
  if (d['data'] && typeof d['data'] === 'object') {
    const nested = d['data'] as Record<string, unknown>
    for (const key of ['poets', 'poems', 'eras', 'items', 'results']) {
      if (Array.isArray(nested[key])) return nested[key] as T[]
    }
  }
  
  return []
}

export default function LibraryPage() {
  const [tab, setTab]           = useState<Tab>('poets')
  const [page, setPage]         = useState(1)
  const [randomPoem, setRandom] = useState<QafiyahPoem | null>(null)
  const [randomLoading, setRL]  = useState(false)

  // Eras
  const { data: erasData, isLoading: loadingEras, error: erasErr } = useQuery({
    queryKey: ['eras'],
    queryFn:  getEras,
    enabled:  tab === 'eras',
  })

  const eras: any[] = extractList(erasData)

  // Extract meters from imported JSON
  const meters: any[] = metersData?.data ? (Array.isArray(metersData.data) ? metersData.data : []) : []

  // Extract themes from imported JSON
  const themes: any[] = themesData?.data ? (Array.isArray(themesData.data) ? themesData.data : []) : []

  // Extract rhymes from imported JSON
  const rhymes: any[] = rhymesData?.data ? (Array.isArray(rhymesData.data) ? rhymesData.data : []) : []

  // Create mapping from eraId to era name
  const eraMap = useMemo(() => {
    const map: Record<number | string, string> = {}
    eras.forEach((era: any) => {
      if (era?.id) map[era.id] = era.name || era.slug
    })
    return map
  }, [eras])

  // Client-side pagination for poets
  const totalPoets = allPoets.length
  const startIdx = (page - 1) * POETS_PER_PAGE
  const endIdx = startIdx + POETS_PER_PAGE
  const poets = allPoets.slice(startIdx, endIdx).map((p: any) => ({
    ...p,
    era: eraMap[p.eraId] || undefined,
    poem_count: p.poemsCount,
  }))

  const loadRandom = async () => {
    setRL(true)
    setTab('random')
    try {
      const p = await getRandomPoem()
      // normalize response: API may return { data: { ... } } or the poem directly
      const poem = (p && (p.data || p.poem)) ? (p.data || p.poem) : p
      setRandom(poem)
    } catch { setRandom(null) }
    finally { setRL(false) }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-parchment-950 to-ink-950" dir="rtl">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 sm:gap-3 mb-2">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-900/20 border border-blue-800/30
                           flex items-center justify-center flex-shrink-0">
            <BookOpen size={14} className="text-blue-400" />
          </div>
          <h1 className="font-arabic text-2xl sm:text-3xl font-bold text-parchment-100">مكتبة الشعر</h1>
        </div>
        <p className="text-ink-500 text-xs sm:text-sm ml-7 sm:ml-11">
          +944,000 بيت لـ 932 شاعراً · {' '}
          {/* <a href="https://qafiyah.com" target="_blank" rel="noopener noreferrer"
             className="text-gold-500 hover:text-gold-400 transition-colors">قافية</a> */}
        </p>
      </div>

      {/* Random button */}
      <div className="mb-6">
        <button onClick={loadRandom} disabled={randomLoading}
                className="btn-ghost text-sm">
          {randomLoading
            ? <RefreshCw size={15} className="animate-spin" />
            : <Feather size={15} />}
          بيت عشوائي
        </button>
      </div>

      {/* Random poem */}
      {tab === 'random' && (
        <div className="poem-container mb-8 px-6 sm:px-10 py-8 text-center animate-fade-up">
          {randomLoading
            ? <PoemCardSkeleton />
            : randomPoem
            ? (
              <>
                <p className="text-xs text-ink-600 mb-5">بيت عشوائي</p>
                {(() => {
                  const rp: any = randomPoem as any
                  let lines: string[] = Array.isArray(rp?.verses) ? rp.verses : []
                  let poetName: string | null = rp?.poet?.name || rp?.poet_name || null

                  if ((!lines || lines.length === 0) && rp?.text) {
                    const all = (rp.text as string).split(/\r?\n/).map(s => s.trim())
                    const nonEmpty = all.filter(Boolean)
                    if (nonEmpty.length >= 3) {
                      poetName = poetName || nonEmpty[nonEmpty.length - 1]
                      lines = nonEmpty.slice(0, nonEmpty.length - 1)
                    } else {
                      lines = nonEmpty
                    }
                  }

                  // Prepare display items: render first two hemistichs as a paired row
                  // to avoid HTML collapsing spaces — use flex gap for spacing.
                  type DisplayItem = { pair?: [string, string]; line?: string }
                  let displayItems: DisplayItem[] = []
                  if (lines.length >= 2) {
                    displayItems.push({ pair: [lines[0], lines[1]] })
                    displayItems.push(...lines.slice(2).map(l => ({ line: l })))
                  } else {
                    displayItems = lines.map(l => ({ line: l }))
                  }

                  return (
                    <>
                      <div className="space-y-4">
                        {displayItems.map((it, i) => (
                          it.pair
                            ? (
                              <div key={i} className="flex items-center justify-center gap-12">
                                <div className="font-arabic text-xl sm:text-2xl text-parchment-100 leading-relaxed">{it.pair[0]}</div>
                                <div className="text-parchment-400 text-lg font-bold"></div>
                                <div className="font-arabic text-xl sm:text-2xl text-parchment-100 leading-relaxed">{it.pair[1]}</div>
                              </div>
                            )
                            : (
                              <div key={i} className="font-arabic text-xl sm:text-2xl text-parchment-100 leading-relaxed">
                                {it.line}
                              </div>
                            )
                        ))}
                      </div>

                      {/* Poet name placed under the poem */}
                      <div className="mt-6 text-center">
                        {poetName && (
                          <div className="text-gold-500 font-arabic text-sm">— {poetName}</div>
                        )}
                        {rp?.meter && <span className="badge ml-2">{rp.meter}</span>}
                      </div>
                    </>
                  )
                })()}
              </>
            )
            : <Empty message="تعذر تحميل البيت العشوائي" />}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b-2 border-ink-800/50 mb-8">
        {([['poets', 'الشعراء', User], ['eras', 'العصور', Globe], ['meters', 'البحور', Music], ['themes', 'الموضاعات', Sparkles], ['rhymes', 'القوافي', Zap]] as const).map(([t, label, Icon]) => (
          <button key={t} onClick={() => { setTab(t); setPage(1) }}
                  className={clsx(
                    'flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium whitespace-nowrap',
                    'border-b-2 -mb-px transition-all duration-300',
                    tab === t
                      ? 'border-gold-500 text-gold-400'
                      : 'border-transparent text-ink-500 hover:text-ink-300'
                  )}>
            <Icon size={15} />
            <span>{label}</span>
          </button>
        ))}
      </div>

    {/* Poets grid */}
{tab === 'poets' && (
  <>
    {poets.length === 0 && page > 1 ? (
      <Empty message="لا يوجد شعراء في هذه الصفحة" />
    ) : poets.length === 0 ? (
      <Empty message="لا يوجد شعراء" />
    ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
          {poets.map(poet => (
            <Link
              key={poet.slug || poet.id}
              to={`/library/poet/${poet.slug || poet.id}`}
              className="card-parchment p-4 sm:p-5 hover:border-gold-400/50 hover:shadow-lg 
                         transition-all duration-300 group hover:-translate-y-0.5 cursor-pointer">
              
              <div className="flex flex-col gap-3 h-full">
                {/* Top row: Avatar + Name + Poem count */}
                <div className="flex items-start gap-3">
                  {/* Initial Avatar */}
                  <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full flex-shrink-0
                                  bg-gradient-to-br from-gold-800/30 to-gold-900/20
                                  border border-gold-700/40 flex items-center justify-center
                                  transition-all duration-300 group-hover:from-gold-700/40 group-hover:to-gold-800/30
                                  group-hover:shadow-md group-hover:shadow-gold-900/20">
                    <span className="font-arabic text-gold-400 font-semibold text-base sm:text-lg">
                      {(poet.name || '؟')[0]}
                    </span>
                  </div>

                  {/* Poet Name + Poem count */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-arabic font-bold text-parchment-100 
                                   group-hover:text-gold-300 transition-colors text-sm sm:text-base leading-tight">
                      {poet.name}
                    </h3>
                    {poet.poem_count != null && (
                      <span className="text-xs sm:text-xs text-gold-500/80 group-hover:text-gold-400 
                                       transition-colors font-medium">
                        {poet.poem_count} قصيدة
                      </span>
                    )}
                  </div>
                </div>

                {/* Era badge */}
                {poet.era && (
                  <div className="mt-auto">
                    <span className="inline-block text-xs text-ink-500 dark:text-ink-400 
                                     bg-ink-800/30 rounded-lg px-2.5 py-1.5">
                      {poet.era}
                    </span>
                  </div>
                )}
              </div>

              {/* Hover indicator */}
              <ChevronRight
                size={14}
                className="absolute top-4 left-4 sm:left-5 text-ink-600 dark:text-ink-500 
                           group-hover:text-gold-400 group-hover:translate-x-0.5
                           transition-all duration-300 opacity-0 group-hover:opacity-100 rotate-180"
              />
            </Link>
          ))}
        </div>
      )}

    {/* Pagination */}
    <div className="flex items-center justify-center gap-2 sm:gap-4 mt-8">
      <button
        onClick={() => setPage(p => Math.max(1, p - 1))}
        disabled={page === 1}
        className="btn-ghost disabled:opacity-30 flex items-center gap-1 text-xs sm:text-sm">
        <ChevronRight size={15} /><span className="hidden sm:inline">السابق</span>
      </button>
      <span className="text-ink-600 dark:text-ink-400 text-xs sm:text-sm tabular-nums">صفحة {page}</span>
      <button
        onClick={() => setPage(p => (endIdx < totalPoets ? p + 1 : p))}
        disabled={endIdx >= totalPoets}
        className="btn-ghost disabled:opacity-30 flex items-center gap-1 text-xs sm:text-sm">
        <span className="hidden sm:inline">التالي</span><ChevronLeft size={15} />
      </button>
    </div>
  </>
)}

      {/* Eras list */}
      {tab === 'eras' && (
        <>
          {loadingEras && <PageLoader message="جارٍ تحميل العصور..." />}
          {erasErr && <ErrorBox message="تعذر تحميل العصور" />}
          {!loadingEras && !erasErr && (
            eras.length === 0
              ? <Empty message="لا يوجد بيانات العصور" />
              : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
                  {eras.map((era: any) => {
                    const name  = era?.name || era?.slug
                    const slug  = era?.slug || era?.name
                    const poemsCount = era?.poemsCount
                    const poetsCount = era?.poetsCount
                    return (
                          <Link key={slug} to={`/library/era/${slug}`} state={{ name }}
                            className="card-parchment p-5 hover:border-ink-600 transition-all group">
                        <Globe size={16} className="text-gold-600 mb-2 group-hover:text-gold-400 transition-colors" />
                        <div className="font-arabic font-bold text-parchment-200 mb-1 group-hover:text-gold-300 transition-colors">{name}</div>
                        <div className="text-xs text-ink-600">
                          {poemsCount != null && <div>{poemsCount} قصيدة</div>}
                          {poetsCount != null && <div>{poetsCount} شاعر</div>}
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )
          )}
        </>
      )}

      {/* Meters list */}
      {tab === 'meters' && (
        <>
          {meters.length === 0
            ? <Empty message="لا يوجد بيانات البحور" />
            : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
                {meters.map((meter: any) => {
                  const name  = meter?.name || meter?.slug
                  const slug  = meter?.slug || meter?.name
                  const poemsCount = meter?.poemsCount
                  const poetsCount = meter?.poetsCount
                  return (
                    <Link key={slug} to={`/library/meter/${slug}`} state={{ name }}
                      className="card-parchment p-5 hover:border-ink-600 transition-all group">
                      <Music size={16} className="text-gold-600 mb-2 group-hover:text-gold-400 transition-colors" />
                      <div className="font-arabic font-bold text-parchment-200 mb-1 group-hover:text-gold-300 transition-colors">{name}</div>
                      <div className="text-xs text-ink-600">
                        {poemsCount != null && <div>{poemsCount} قصيدة</div>}
                        {poetsCount != null && <div>{poetsCount} شاعر</div>}
                      </div>
                    </Link>
                  )
                })}
              </div>
            )
        }
        </>
      )}

      {/* Themes list */}
      {tab === 'themes' && (
        <>
          {themes.length === 0
            ? <Empty message="لا يوجد بيانات المواضيع" />
            : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
                {themes.map((theme: any) => {
                  const name  = theme?.name || theme?.slug
                  const slug  = theme?.slug || theme?.name
                  const poemsCount = theme?.poemsCount
                  const poetsCount = theme?.poetsCount
                  return (
                    <Link key={slug} to={`/library/theme/${slug}`} state={{ name }}
                      className="card-parchment p-5 hover:border-ink-600 transition-all group">
                      <Sparkles size={16} className="text-gold-600 mb-2 group-hover:text-gold-400 transition-colors" />
                      <div className="font-arabic font-bold text-parchment-200 mb-1 group-hover:text-gold-300 transition-colors">{name}</div>
                      <div className="text-xs text-ink-600">
                        {poemsCount != null && <div>{poemsCount} قصيدة</div>}
                        {poetsCount != null && <div>{poetsCount} شاعر</div>}
                      </div>
                    </Link>
                  )
                })}
              </div>
            )
        }
        </>
      )}

      {/* Rhymes list */}
      {tab === 'rhymes' && (
        <>
          {rhymes.length === 0
            ? <Empty message="لا يوجد بيانات القوافي" />
            : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
                {rhymes.map((rhyme: any) => {
                  const name  = rhyme?.name || rhyme?.slug
                  const slug  = rhyme?.slug || rhyme?.name
                  const poemsCount = rhyme?.poemsCount
                  const poetsCount = rhyme?.poetsCount
                  return (
                    <Link key={slug} to={`/library/rhyme/${slug}`} state={{ name }}
                      className="card-parchment p-5 hover:border-ink-600 transition-all group">
                      <Zap size={16} className="text-gold-600 mb-2 group-hover:text-gold-400 transition-colors" />
                      <div className="font-arabic font-bold text-parchment-200 mb-1 group-hover:text-gold-300 transition-colors">{name}</div>
                      <div className="text-xs text-ink-600">
                        {poemsCount != null && <div>{poemsCount} قصيدة</div>}
                        {poetsCount != null && <div>{poetsCount} شاعر</div>}
                      </div>
                    </Link>
                  )
                })}
              </div>
            )
        }
        </>
      )}
      </div>
    </div>
  )
}
