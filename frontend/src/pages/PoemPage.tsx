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
    <div className="max-w-3xl mx-auto px-3 sm:px-6 py-8 sm:py-10" dir="rtl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs sm:text-sm text-ink-600 mb-6 sm:mb-8 flex-wrap">
        <Link to="/library" className="hover:text-gold-400 transition-colors flex items-center gap-1">
          <BookOpen size={12} className="flex-shrink-0 sm:w-4 sm:h-4" />
          <span className="hidden sm:inline">مكتبة الشعر</span>
          <span className="sm:hidden">المكتبة</span>
        </Link>
        <ArrowRight size={10} className="rotate-180 flex-shrink-0" />
        {poetSlug && (
          <>
            <Link to={`/library/poet/${poetSlug}`} className="hover:text-gold-400 transition-colors truncate">
              {poetName || 'شاعر'}
            </Link>
            <ArrowRight size={10} className="rotate-180 flex-shrink-0" />
          </>
        )}
        <span className="text-ink-400 truncate">{title || 'قصيدة'}</span>
      </div>

      {/* Poem header */}
      <div className="card-parchment p-3 sm:p-6 lg:p-8 mb-6 sm:mb-8">
        {/* Title */}
        {title && (
          <h1 className="font-arabic text-xl sm:text-3xl lg:text-4xl font-bold text-parchment-100 mb-3 sm:mb-5 break-words">
            {title}
          </h1>
        )}
        
        {/* Poet Section */}
        {poetName && (
          <div className="mb-4 sm:mb-5 pb-4 sm:pb-5 border-b border-parchment-600 border-opacity-30">
            <label className="text-xs font-semibold text-ink-500 uppercase tracking-wide block mb-1.5">الشاعر</label>
            <div className="flex items-center gap-2">
              <Feather size={14} className="text-gold-600 flex-shrink-0 sm:w-5 sm:h-5" />
              <span className="font-arabic text-parchment-200 text-sm sm:text-lg">
                {poetSlug
                  ? <Link to={`/library/poet/${poetSlug}`} className="hover:text-gold-400 transition-colors">
                      {poetName}
                    </Link>
                  : poetName
                }
              </span>
            </div>
          </div>
        )}
        
        {/* Metadata Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
          {meter && (
            <div>
              <label className="text-xs font-semibold text-ink-500 uppercase tracking-wide block mb-1.5">البحر</label>
              <div className="flex items-center gap-1.5">
                <Music size={12} className="text-gold-600 flex-shrink-0 sm:w-4 sm:h-4" />
                <span className="font-arabic text-parchment-300 text-xs sm:text-base">{meter}</span>
              </div>
            </div>
          )}
          {eraName && (
            <div>
              <label className="text-xs font-semibold text-ink-500 uppercase tracking-wide block mb-1.5">العصر</label>
              <span className="font-arabic text-parchment-300 text-xs sm:text-base block">{eraName}</span>
            </div>
          )}
          {theme && (
            <div>
              <label className="text-xs font-semibold text-ink-500 uppercase tracking-wide block mb-1.5">الموضوع</label>
              <span className="font-arabic text-parchment-300 text-xs sm:text-base block">{theme}</span>
            </div>
          )}
        </div>
      </div>

      {/* Poem verses */}
      {verses.length > 0 ? (
        <div className="poem-container p-4 sm:p-6 lg:p-10 space-y-2 sm:space-y-4">
          {versePairs.map((pair: any, idx: number) => (
            <div key={idx} className="verse-pair">
              {pair.map((line: string, lineIdx: number) => (
                <div key={lineIdx} className="font-arabic text-base sm:text-lg lg:text-2xl text-parchment-100 text-center leading-relaxed sm:leading-loose py-1.5 sm:py-2">
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
      <div className="flex items-center justify-center gap-3 sm:gap-6 mt-6 sm:mt-8 text-ink-500 text-xs sm:text-sm">
        <div className="text-center">
          <div className="text-ink-400 font-bold">{versePairs.length}</div>
          <div>بيت شعري</div>
        </div>
      </div>

      {/* Related poems */}
      {related.length > 0 && (
        <div className="mt-8 sm:mt-10">
          <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-5">
            <BookOpen size={16} className="text-gold-600 flex-shrink-0 sm:w-5 sm:h-5" />
            <h2 className="font-arabic text-lg sm:text-xl font-bold text-parchment-100">قصائد مرتبطة</h2>
            <span className="text-xs text-ink-500 ml-auto">{related.length}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
            {related.map((relatedPoem: any) => (
              <div 
                key={relatedPoem.poem_slug}
                onClick={() => navigate(`/library/poem/${relatedPoem.poem_slug}`)}
                className="card-parchment p-3 hover:shadow-sm hover:border-gold-500 hover:border-opacity-60 transition-all duration-200 cursor-pointer group">
                <div className="font-arabic font-bold text-parchment-100 group-hover:text-gold-300 transition-colors mb-1.5 line-clamp-2 text-sm sm:text-base leading-tight">
                  {relatedPoem.poem_title}
                </div>
                <div className="border-t border-parchment-600 border-opacity-30 pt-2 space-y-1">
                  <div className="flex items-start gap-1.5">
                    <Feather size={11} className="text-gold-600 flex-shrink-0 mt-0.5 sm:w-3 sm:h-3" />
                    <span className="text-xs text-parchment-300 leading-tight">{relatedPoem.poet_name}</span>
                  </div>
                  {relatedPoem.meter_name && (
                    <div className="flex items-start gap-1.5">
                      <Music size={11} className="text-gold-600 flex-shrink-0 mt-0.5 sm:w-3 sm:h-3" />
                      <span className="text-xs text-parchment-300 leading-tight">{relatedPoem.meter_name}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
