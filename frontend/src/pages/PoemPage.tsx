import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getPoemBySlug } from '../api'
import { PageLoader, Empty, ErrorBox } from '../components/UI'
import { ArrowRight, BookOpen, Music, Feather } from 'lucide-react'
import type { QafiyahPoem } from '../types'

export default function PoemPage() {
  const navigate = useNavigate()
  const { slug } = useParams<{ slug: string }>()

  const { data: poemData, isLoading, error } = useQuery({
    queryKey: ['poem', slug],
    queryFn:  () => getPoemBySlug(slug!),
    enabled:  !!slug,
  })

  if (isLoading) return <PageLoader message="جارٍ تحميل القصيدة..." />
  if (error)    return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <ErrorBox message="تعذر تحميل القصيدة — تأكد من صحة الرابط وتشغيل الخادم" />
    </div>
  )

  // Extract poem from nested response structure
  const data = poemData?.data
  
  if (!data) return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <Empty message="لم يتم العثور على القصيدة" />
    </div>
  )

  const title    = data.clearTitle
  const metadata = data.metadata || {}
  const content  = data.processedContent || {}
  
  // verses is array of arrays [[sadr, ajuz], ...]
  const versePairs = content.verses || []
  // Flatten to single array of lines
  const verses = versePairs.flatMap((pair: any) => Array.isArray(pair) ? pair : [pair]).filter(Boolean)
  
  const meter    = metadata.meter_name
  const theme    = metadata.theme_name
  const eraName  = metadata.era_name
  const eraSlug  = metadata.era_slug
  const poetName = metadata.poet_name
  const poetSlug = metadata.poet_slug
  const related  = data.relatedPoems || []

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10" dir="rtl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-ink-600 mb-8">
        <Link to="/library" className="hover:text-gold-400 transition-colors flex items-center gap-1">
          <BookOpen size={13} />
          مكتبة الشعر
        </Link>
        <ArrowRight size={11} className="rotate-180" />
        {poetSlug && (
          <>
            <Link to={`/library/poet/${poetSlug}`} className="hover:text-gold-400 transition-colors">
              {poetName || 'شاعر'}
            </Link>
            <ArrowRight size={11} className="rotate-180" />
          </>
        )}
        <span className="text-ink-400">{title || 'قصيدة'}</span>
      </div>

      {/* Poem header */}
      <div className="card-parchment p-6 sm:p-8 mb-8">
        {title && (
          <h1 className="font-arabic text-2xl sm:text-3xl font-bold text-parchment-100 mb-4">
            {title}
          </h1>
        )}
        
        <div className="flex flex-col gap-4 mb-6">
          {poetName && (
            <div className="flex items-center gap-2">
              <Feather size={16} className="text-gold-600" />
              <span className="font-arabic text-parchment-300">
                {poetSlug
                  ? <Link to={`/library/poet/${poetSlug}`} className="hover:text-gold-400 transition-colors">
                      {poetName}
                    </Link>
                  : poetName
                }
              </span>
            </div>
          )}
          
          <div className="flex flex-wrap gap-2">
            {meter && (
              <span className="badge flex items-center gap-1.5">
                <Music size={12} />
                {meter}
              </span>
            )}
            {eraName && <span className="badge-gold">{eraName}</span>}
            {theme && <span className="badge">{theme}</span>}
          </div>
        </div>
      </div>

      {/* Poem verses */}
      {verses.length > 0 ? (
        <div className="poem-container p-6 sm:p-10 space-y-4">
          {versePairs.map((pair: any, idx: number) => (
            <div key={idx} className="verse-pair">
              {pair.map((line: string, lineIdx: number) => (
                <div key={lineIdx} className="font-arabic text-lg sm:text-2xl text-parchment-100 text-center leading-loose py-2">
                  {line}
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <Empty message="لا توجد أبيات في هذه القصيدة" />
      )}

      {/* Stats */}
      <div className="flex items-center justify-center gap-6 mt-8 text-ink-500 text-sm">
        <div className="text-center">
          <div className="text-ink-400 font-bold">{versePairs.length}</div>
          <div>بيت شعري</div>
        </div>
      </div>

      {/* Related poems */}
      {related.length > 0 && (
        <div className="mt-12">
          <h2 className="font-arabic text-xl font-bold text-parchment-200 mb-6">قصائد مرتبطة</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {related.map((relatedPoem: any) => (
              <div 
                key={relatedPoem.poem_slug}
                onClick={() => navigate(`/library/poem/${relatedPoem.poem_slug}`)}
                className="card-parchment p-4 hover:border-ink-600 transition-all cursor-pointer group">
                <div className="font-arabic font-bold text-parchment-200 group-hover:text-gold-300 transition-colors mb-2 line-clamp-2">
                  {relatedPoem.poem_title}
                </div>
                <div className="text-xs text-ink-600 mb-2">{relatedPoem.poet_name}</div>
                <div className="badge text-xs">{relatedPoem.meter_name}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
