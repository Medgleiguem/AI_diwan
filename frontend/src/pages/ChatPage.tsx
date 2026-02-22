import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Trash2, MessageCircle } from 'lucide-react'
import { chatWithPoet } from '../api'
import type { ChatMessage } from '../types'
import { Spinner, ErrorBox } from '../components/UI'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const WELCOME: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: `أهلاً وسهلاً أيها المحب للشعر!

أنا شاعر رقمي مُتشبّع بتراث الشعر العربي من جاهليته إلى حداثته. أعرف المتنبي وامرأ القيس وأبا تمام والبحتري، وأحفظ من دواوينهم ما يملأ القلب.

يسعدني أن:
• أعلّمك علم العروض والأوزان الشعرية
• أشرح لك الصور البلاغية والبديع
• أحكي لك تاريخ الشعراء وعصورهم
• أساعدك في كتابة شعرك الخاص

فبأيّ شيء تستأنس؟`,
  timestamp: new Date(),
}

const SUGGESTIONS = [
  'علّمني بحر الطويل وتفعيلاته',
  'من هو المتنبي وما أشهر قصائده؟',
  'ما الفرق بين الشعر الجاهلي والعباسي؟',
  'كيف أكتب بيتاً على بحر الكامل؟',
  'ما هي القصيدة العربية وأركانها؟',
  'أنشدني بيتاً في الحكمة',
]

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const endRef   = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async (text?: string) => {
    const msg = (text || input).trim()
    if (!msg || loading) return

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: msg,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)
    setError('')

    // Build history for API (exclude welcome, exclude just-added user msg)
    const history = messages
      .filter(m => m.id !== 'welcome')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

    try {
      const { response } = await chatWithPoet(msg, history)
      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, botMsg])
    } catch (e: any) {
      setError(e.message || 'خطأ في الاتصال')
      // Remove the user message we optimistically added
      setMessages(prev => prev.filter(m => m.id !== userMsg.id))
      toast.error('تعذر الاتصال بالشاعر')
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const clearChat = () => {
    setMessages([{ ...WELCOME, timestamp: new Date() }])
    setError('')
  }

  const showSuggestions = messages.length === 1

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-6 py-4 sm:py-6 flex flex-col h-[calc(100vh-56px)] sm:h-[calc(100vh-64px)]" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 sm:mb-4 flex-shrink-0 gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-7 sm:w-8 h-7 sm:h-8 rounded-lg bg-purple-900/20 border border-purple-800/30
                           flex items-center justify-center flex-shrink-0">
            <MessageCircle size={14} className="text-purple-400 sm:w-4 sm:h-4" />
          </div>
          <div className="min-w-0">
            <h1 className="font-arabic text-lg sm:text-xl font-bold text-parchment-100 leading-tight truncate">
              حوار مع الشاعر
            </h1>
            <p className="text-ink-600 text-xs leading-tight">شاعر رقمي متمكن</p>
          </div>
        </div>
        {messages.length > 1 && (
          <button onClick={clearChat} className="btn-danger text-xs py-1.5 px-2 sm:px-3 flex-shrink-0">
            <Trash2 size={12} className="sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">مسح</span>
          </button>
        )}
      </div>

      {/* Suggestions */}
      {showSuggestions && (
        <div className="grid grid-cols-2 gap-2 mb-3 sm:mb-4 flex-shrink-0">
          {SUGGESTIONS.map(s => (
            <button key={s} onClick={() => send(s)}
                    className="text-right px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-xl card-parchment
                               hover:border-ink-600 text-ink-400 hover:text-ink-200
                               transition-all text-xs sm:text-sm leading-snug">
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto card-parchment mb-3 sm:mb-4 min-h-0">
        <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
          {messages.map(m => (
            <div key={m.id}
                 className={clsx('flex gap-2 sm:gap-3', m.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
              {/* Avatar */}
              <div className={clsx(
                'w-7 sm:w-8 h-7 sm:h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
                m.role === 'user'
                  ? 'bg-gold-900/30 border border-gold-800/40'
                  : 'bg-purple-900/30 border border-purple-800/40'
              )}>
                {m.role === 'user'
                  ? <User size={13} className="text-gold-400 sm:w-4 sm:h-4" />
                  : <Bot  size={13} className="text-purple-400 sm:w-4 sm:h-4" />}
              </div>

              {/* Bubble */}
              <div className={clsx(
                'max-w-[85%] sm:max-w-[82%] rounded-2xl px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm leading-relaxed font-arabic whitespace-pre-wrap',
                m.role === 'user'
                  ? 'bg-gold-900/20 border border-gold-800/30 text-parchment-100 rounded-tr-sm'
                  : 'bg-ink-900 border border-ink-800 text-ink-300 rounded-tl-sm'
              )}>
                {m.content}
                <div className={clsx(
                  'text-xs mt-1.5 opacity-40',
                  m.role === 'user' ? 'text-left' : 'text-right'
                )}>
                  {m.timestamp.toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))}

          {/* Loading dots */}
          {loading && (
            <div className="flex gap-2 sm:gap-3">
              <div className="w-7 sm:w-8 h-7 sm:h-8 rounded-full bg-purple-900/30 border border-purple-800/40
                               flex items-center justify-center flex-shrink-0">
                <Bot size={13} className="text-purple-400 sm:w-4 sm:h-4" />
              </div>
              <div className="bg-ink-900 border border-ink-800 rounded-2xl rounded-tl-sm px-3 sm:px-4 py-2 sm:py-3">
                <div className="flex gap-1 items-center h-5">
                  {[0, 1, 2].map(i => (
                    <div key={i}
                         className="w-1.5 h-1.5 rounded-full bg-ink-600 animate-bounce"
                         style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            </div>
          )}

          <div ref={endRef} />
        </div>
      </div>

      {/* Error */}
      {error && <div className="mb-2 sm:mb-3 flex-shrink-0"><ErrorBox message={error} /></div>}

      {/* Input */}
      <div className="card-parchment p-2.5 sm:p-3 flex-shrink-0 gap-3 sm:gap-4">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            className="input-arabic flex-1 resize-none min-h-[44px] max-h-24 sm:max-h-28 py-2 sm:py-2.5 px-3 text-sm leading-relaxed"
            placeholder="اكتب سؤالك..."
            rows={1}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <button onClick={() => send()} disabled={loading || !input.trim()}
                  className="btn-gold px-3 sm:px-4 py-2.5 sm:py-3 flex-shrink-0">
            {loading ? <Spinner className="w-4 h-4" /> : <Send size={16} />}
          </button>
        </div>
        <p className="text-xs text-ink-700 text-center mt-1.5">
          <span className="hidden sm:inline">Enter للإرسال · Shift+Enter لسطر جديد</span>
          <span className="sm:hidden">للإرسال: Enter</span>
        </p>
      </div>
    </div>
  )
}
