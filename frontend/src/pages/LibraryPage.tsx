import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BookOpen, User, Globe, Feather, ChevronRight, ChevronLeft, RefreshCw } from 'lucide-react'
import { getPoetsPage, getEras, getRandomPoem } from '../api'
import { PageLoader, Empty, ErrorBox, PoemCardSkeleton } from '../components/UI'
import type { QafiyahPoet, QafiyahPoem } from '../types'
import clsx from 'clsx'

type Tab = 'poets' | 'eras' | 'random'

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

  // Poets
  const { data: poetsData, isLoading: loadingPoets, error: poetsErr } = useQuery({
    queryKey: ['poets', page],
    queryFn:  () => getPoetsPage(page),
    enabled:  tab === 'poets',
    placeholderData: prev => prev,
  })

  // Eras
  const { data: erasData, isLoading: loadingEras, error: erasErr } = useQuery({
    queryKey: ['eras'],
    queryFn:  getEras,
    enabled:  tab === 'eras',
  })

  const poets: QafiyahPoet[] = extractList(poetsData)
  const eras: any[]            = extractList(erasData)

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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10" dir="rtl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-lg bg-blue-900/20 border border-blue-800/30
                           flex items-center justify-center">
            <BookOpen size={15} className="text-blue-400" />
          </div>
          <h1 className="font-arabic text-3xl font-bold text-parchment-100">مكتبة الشعر</h1>
        </div>
        <p className="text-ink-500 text-sm mr-11">
          +944,000 بيت لـ 932 شاعراً · البيانات من{' '}
          <a href="https://qafiyah.com" target="_blank" rel="noopener noreferrer"
             className="text-gold-500 hover:text-gold-400 transition-colors">قافية</a>
        </p>
      </div>

      {/* Random button */}
      <div className="mb-6">
        <button onClick={loadRandom} disabled={randomLoading}
                className="btn-ghost">
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
      <div className="flex gap-1 border-b border-ink-800 mb-6">
        {([['poets', 'الشعراء', User], ['eras', 'العصور', Globe]] as const).map(([t, label, Icon]) => (
          <button key={t} onClick={() => { setTab(t); setPage(1) }}
                  className={clsx(
                    'flex items-center gap-2 px-4 py-2.5 text-sm font-medium',
                    'border-b-2 -mb-px transition-colors',
                    tab === t
                      ? 'border-gold-500 text-gold-400'
                      : 'border-transparent text-ink-500 hover:text-ink-300'
                  )}>
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

    {/* Poets grid */}
{tab === 'poets' && (
  <>
    {loadingPoets && <PageLoader message="جارٍ تحميل الشعراء..." />}
    {poetsErr && <ErrorBox message="تعذر تحميل الشعراء — تأكد من تشغيل الخادم الخلفي" />}
    {!loadingPoets && !poetsErr && (
      poets.length === 0 ? (
        <Empty message="لا يوجد شعراء في هذه الصفحة" />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {poets.map(poet => (
            <Link
              key={poet.slug || poet.id}
              to={`/library/poet/${poet.slug || poet.id}`}
              className="bg-parchment-50 dark:bg-ink-900 border border-transparent 
                         rounded-xl p-4 shadow-md hover:shadow-xl transition-all duration-300
                         group hover:-translate-y-1 hover:scale-105">
              
              <div className="flex items-center gap-4">
                {/* Initial Avatar */}
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gold-800/20 to-gold-900/10
                                border border-gold-700/30 flex items-center justify-center flex-shrink-0
                                transition-all duration-300 group-hover:ring-2 group-hover:ring-gold-400">
                  <span className="font-arabic text-gold-500 font-semibold text-lg">
                    {(poet.name || '؟')[0]}
                  </span>
                </div>

                {/* Poet Info */}
                <div className="flex-1 min-w-0">
                  <div className="font-arabic font-bold text-parchment-800 dark:text-parchment-200
                                  group-hover:text-gold-400 transition-colors truncate text-base">
                    {poet.name}
                  </div>
                  {poet.era && (
                    <div className="text-xs text-ink-500 dark:text-ink-400 mt-1">
                      {poet.era}
                    </div>
                  )}
                  {poet.poem_count != null && (
                    <div className="mt-1">
                      <span className="inline-block bg-gold-50 text-gold-600 text-xs px-2 py-0.5 rounded-full">
                        {poet.poem_count} قصيدة
                      </span>
                    </div>
                  )}
                </div>

                {/* Chevron */}
                <ChevronRight
                  size={16}
                  className="text-ink-500 dark:text-ink-400 group-hover:text-gold-400
                             transition-transform duration-300 rotate-180"
                />
              </div>
            </Link>
          ))}
        </div>
      )
    )}

    {/* Pagination */}
    <div className="flex items-center justify-center gap-4 mt-8">
      <button
        onClick={() => setPage(p => Math.max(1, p - 1))}
        disabled={page === 1}
        className="btn-ghost disabled:opacity-30 flex items-center gap-1">
        <ChevronRight size={15} />السابق
      </button>
      <span className="text-ink-600 dark:text-ink-400 text-sm tabular-nums">صفحة {page}</span>
      <button
        onClick={() => setPage(p => p + 1)}
        disabled={poets.length === 0}
        className="btn-ghost disabled:opacity-30 flex items-center gap-1">
        التالي<ChevronLeft size={15} />
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
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
    </div>
  )
}
