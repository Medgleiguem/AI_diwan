import axios from 'axios'
import type { GenerateRequest, GenerationResponse, ChatHistoryItem, LocalMeter } from '../types'

// ── Backend HTTP client (qafiyah proxy + local meters) ───────────────────────
// When deploying, set VITE_API_URL in the frontend environment (Vercel/Vite):
//   VITE_API_URL=https://your-backend.example.com
const rawBase = (import.meta.env.VITE_API_URL as string | undefined) || '/api'
// Ensure base URL always points to the API root (ends with /api)
const API_BASE = rawBase.endsWith('/api') ? rawBase : rawBase.replace(/\/$/, '') + '/api'
const http = axios.create({
  baseURL: API_BASE,
  timeout: 90_000,
  headers: { 'Content-Type': 'application/json' },
})

http.interceptors.response.use(
  res => res,
  err => {
    const msg = err?.response?.data?.error || err.message || 'خطأ في الاتصال بالخادم'
    return Promise.reject(new Error(msg))
  }
)

// ── Groq config (heavy lifting: poem generation, chat, validation) ──────────
// Add this to frontend/.env:
//   VITE_GROQ_API_KEY=gsk_...
const GROQ_KEY   = import.meta.env.VITE_GROQ_API_KEY as string | undefined
const GROQ_MODEL = 'llama-3.3-70b-versatile'
const GROQ_URL   = 'https://api.groq.com/openai/v1/chat/completions'

const METERS: Record<string, string> = {
  'الطويل':    'فَعُولُنْ مَفَاعِيلُنْ فَعُولُنْ مَفَاعِيلُنْ',
  'البسيط':    'مُسْتَفْعِلُنْ فَاعِلُنْ مُسْتَفْعِلُنْ فَاعِلُنْ',
  'الكامل':    'مُتَفَاعِلُنْ مُتَفَاعِلُنْ مُتَفَاعِلُنْ',
  'الوافر':    'مُفَاعَلَتُنْ مُفَاعَلَتُنْ فَعُولُنْ',
  'الخفيف':    'فَاعِلَاتُنْ مُسْتَفْعِلُنْ فَاعِلَاتُنْ',
  'المتقارب':  'فَعُولُنْ فَعُولُنْ فَعُولُنْ فَعُولُنْ',
  'الرجز':     'مُسْتَفْعِلُنْ مُسْتَفْعِلُنْ مُسْتَفْعِلُنْ',
  'الهزج':     'مَفَاعِيلُنْ مَفَاعِيلُنْ',
  'السريع':    'مُسْتَفْعِلُنْ مُسْتَفْعِلُنْ فَاعِلُنْ',
  'المنسرح':   'مُسْتَفْعِلُنْ مَفْعُولَاتُ مُسْتَفْعِلُنْ',
  'المديد':    'فَاعِلَاتُنْ فَاعِلُنْ فَاعِلَاتُنْ',
  'المجتث':    'مُسْتَفْعِلُنْ فَاعِلَاتُنْ',
}

const POEM_SYSTEM = `
أنت شاعر عربي متمكن وعالم بالعروض على منهج الخليل بن أحمد.

مهمتك إنتاج قصيدة موزونة تمامًا دون أي خطأ عروضي.

⚠️ قواعد صارمة غير قابلة للكسر:

1) التزم بالعربية الفصحى فقط.
2) كل بيت يجب أن يكون:
   الصدر ### العجز
3) الوزن يجب أن يطابق التفعيلة حرفيًا دون أي زيادة أو نقص.
4) القافية موحّدة في جميع الأعجاز.
5) لا تكتب أي تعليق أو شرح خارج JSON.
6) لا تستخدم Markdown.
7) لا تضف مقدمة أو خاتمة.

قبل إخراج النتيجة:
- تحقق داخليًا من الوزن.
- تحقق من توحيد حرف الروي.
- تحقق من عدد الأبيات.

إذا لم يتحقق شرط واحد — أعد الكتابة داخليًا حتى يتحقق.

الإخراج النهائي JSON فقط بهذا الشكل:

{
  "poem": ["...", "..."],
  "meter": "",
  "rhyme_letter": "",
  "rhyme_word_examples": ["", ""],
  "theme": "",
  "explanation": ""
}
`

const CHAT_SYSTEM = `أنت شاعر عربي متمكّن ومرجع في علم العروض والقوافي. معرفتك شاملة بكل شعراء العرب عبر العصور:
الجاهلي (امرؤ القيس، زهير، عنترة)، الأموي (جرير، الفرزدق)، العباسي (المتنبي، أبو تمام، البحتري)، والحديث (شوقي، درويش، قباني).

قواعد:
١. تكلم بالعربية الفصحى دائماً.
٢. كن معلماً صبوراً في شرح العروض والبلاغة.
٣. اذكر أمثلة شعرية من التراث عند الشرح.
٤. إذا طُلب منك إنشاء بيت شعري، فالتزم بالوزن والقافية.`

// ── Groq request helper ────────────────────────────────────────────────────────
async function groqRequest(
  systemInstruction: string,
  messages: { role: string; content: string }[],
  temperature = 0.85
): Promise<string> {
  if (!GROQ_KEY) {
    throw new Error(
      'مفتاح Groq غير موجود. أضف VITE_GROQ_API_KEY في ملف frontend/.env'
    )
  }

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: systemInstruction },
        ...messages,
      ],
      temperature,
      max_tokens: 3000,
      top_p: 0.95,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const msg: string = err?.error?.message || `خطأ ${res.status}`
    if (res.status === 429) throw new Error('الحصة المجانية مشغولة — انتظر قليلاً وأعد المحاولة')
    if (res.status === 404) throw new Error('النموذج غير موجود')
    throw new Error(msg)
  }

  const data = await res.json()
  const text: string | undefined = data?.choices?.[0]?.message?.content
  if (!text) throw new Error('لم يرد أي نص من Groq')
  return text
}

// ── Groq validation helper (check khalile meters & Arabic poetry rules) ────
async function validateAndRefinePoem(poemJson: string, expectedMeterName: string, tafaila: string): Promise<string> {
  if (!GROQ_KEY) return poemJson // Skip if no Groq key

  try {
    const validationPrompt = `
أنت مدقق عروضي صارم.

حلل القصيدة التالية بيتًا بيتًا:

${poemJson}

المطلوب:

1) افحص كل شطر واذكر إن كان مطابقًا للتفعيلة: ${tafaila}
2) افحص حرف الروي في كل عجز
3) إن وجد خلل — أعد كتابة البيت كاملاً بوزن صحيح
4) لا تغيّر المعنى العام

أخرج JSON صحيح فقط بنفس البنية الأصلية.
`
    const refined = await groqRequest(
      'أنت خبير في العروض والقوافي العربية. قم بالتحقق والتصحيح.',
      [{ role: 'user', content: validationPrompt }],
      0.3
    )
    return cleanJson(refined)
  } catch {
    return poemJson // Fallback to original if validation fails
  }
}
// ── JSON cleaner (strip markdown fences) ─────────────────────────────────────
function cleanJson(raw: string): string {
  let t = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  const start = t.indexOf('{')
  const end   = t.lastIndexOf('}')
  if (start !== -1 && end !== -1) t = t.slice(start, end + 1)
  return t.trim()
}

// ── Rule-based validator (no backend needed) ──────────────────────────────────
function validatePoem(lines: string[], expectedMeter: string) {
  const results: { verse: number; valid: boolean; issues: string[] }[] = []
  const allIssues: string[] = []
  const rhymeEndings: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const issues: string[] = []

    if (!line.includes('###')) {
      issues.push('يجب الفصل بين الشطرين بـ ###')
    } else {
      const [sadr, ajuz] = line.split('###').map(s => s.trim())
      if (!sadr || sadr.split(' ').length < 2) issues.push('الصدر قصير')
      if (!ajuz || ajuz.split(' ').length < 2) issues.push('العجز قصير')
      const words = ajuz?.split(' ') ?? []
      if (words.length) {
        const last = words[words.length - 1].replace(/[.,،؟!:]/g, '')
        rhymeEndings.push(last.length >= 2 ? last.slice(-2) : last)
      }
    }

    const valid = issues.length === 0
    if (!valid) allIssues.push(...issues.map(iss => `البيت ${i + 1}: ${iss}`))
    results.push({ verse: i + 1, valid, issues })
  }

  if (rhymeEndings.length >= 3) {
    const unique = new Set(rhymeEndings)
    if (unique.size > Math.max(2, Math.floor(rhymeEndings.length / 3))) {
      allIssues.push(`القافية غير منتظمة: ${[...unique].join('، ')}`)
    }
  }

  return {
    valid: allIssues.length === 0,
    validator: 'rule-based' as const,
    results,
    feedback: allIssues.length ? allIssues.join('\n') : null,
    rhyme_endings: rhymeEndings,
  }
}

// ── generatePoem — retry until valid poem respecting khalile meters ──────────
export async function generatePoem(body: GenerateRequest): Promise<GenerationResponse> {
  const { topic, meter, num_verses, style } = body
  const pattern = METERS[meter] ?? ''
  const MAX_RETRIES = 5 // Keep trying until valid, with safety limit
  const attemptHistory: GenerationResponse['attempt_history'] = []
  let feedback = ''

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const feedbackBlock = feedback
      ? `ملاحظات على المحاولة السابقة - صححها:\n${feedback}\n---\n`
      : ''

    const prompt = `${feedbackBlock}
    اكتب قصيدة عربية بهذه المواصفات الدقيقة:

الموضوع: ${topic}
البحر: ${meter}
التفعيلة الأساسية: ${pattern}
عدد الأبيات: ${num_verses}
الأسلوب: ${style}

تعليمات الوزن:
- كل شطر يجب أن يطابق التفعيلة كاملة.
- لا تستخدم الزحافات إلا إن كانت جائزة عروضياً.
- لا تغيّر بنية البحر.
- كل بيت مستقل نحويًا.

تعليمات القافية:
- نفس حرف الروي في كل الأعجاز.
- لا تغيّر الحركة الأخيرة.

تأكد من:
- عدد الأبيات صحيح.
- كل بيت يحتوي "###".
- لا يوجد أي نص خارج JSON.

إذا أخطأت في الوزن أو القافية — أعد المحاولة داخليًا قبل الإخراج.
`

    let poemData: GenerationResponse['poem']
    try {
      const raw = await groqRequest(
        POEM_SYSTEM,
        [{ role: 'user', content: prompt }],
        0.85
      )
      // Validate and refine with Groq using khalile meter rules
      const refined = await validateAndRefinePoem(raw, meter, pattern)
      poemData = JSON.parse(cleanJson(refined))
    } catch (e: any) {
      // Propagate quota/auth errors immediately — no point retrying
      if (
        e.message?.includes('مفتاح') ||
        e.message?.includes('الحصة') ||
        e.message?.includes('النموذج')
      ) throw e
      feedback = 'الإخراج لم يكن JSON صحيحاً. استخدم JSON فقط فقط'
      continue
    }

    const lines = poemData?.poem ?? []
    if (!lines.length) { 
      feedback = 'القصيدة فارغة. اكتب القصيدة كاملة.' 
      continue 
    }

    const validation = validatePoem(lines, meter)
    attemptHistory.push({ attempt, poem: lines, validation })

    // SUCCESS: Poem is valid - return immediately
    if (validation.valid) {
      return { 
        success: true, 
        poem: poemData, 
        validation, 
        attempts: attempt, 
        attempt_history: attemptHistory 
      }
    }

    // FAILURE: Provide detailed feedback for next iteration
    feedback = validation.feedback ?? 'أعد الكتابة مع التركيز على الوزن والقافية.'
    
    // If we still have retries, continue with feedback
    if (attempt < MAX_RETRIES) {
      console.log(`محاولة ${attempt}/${MAX_RETRIES}: ${feedback}`)
    }
  }

  // Return best attempt even if not fully valid (after exhausting retries)
  const last = attemptHistory[attemptHistory.length - 1]
  return {
    success: false,
    poem: last?.poem as any ?? {},
    validation: last?.validation as any ?? { valid: false, validator: 'rule-based', results: [], feedback: null },
    attempts: MAX_RETRIES,
    attempt_history: attemptHistory,
    warning: `لم تجتز القصيدة بعد ${MAX_RETRIES} محاولات. هذه أفضل محاولة حققت. يرجى مراجعة الملاحظات.`,
  }
}

// ── chatWithPoet — calls Gemini directly ─────────────────────────────────────
export async function chatWithPoet(
  message: string,
  history: ChatHistoryItem[]
): Promise<{ response: string }> {
  // Build Groq conversation: previous turns + new user message
  const contents = [
    ...history.map(h => ({
      role: h.role === 'user' ? 'user' : 'assistant',
      content: h.content,
    })),
    { role: 'user', content: message },
  ]

  const text = await groqRequest(CHAT_SYSTEM, contents, 0.8)
  return { response: text }
}

// ── Local meters list (still from backend — backend serves METERS dict) ───────
export const getLocalMeters = (): Promise<{ meters: LocalMeter[] }> => {
  const meters = Object.entries(METERS).map(([name, pattern]) => ({
    name,
    pattern,
    feet: pattern.split(' ').length,
  }))
  return Promise.resolve({ meters })
}

// ── Qafiyah — Poets ──────────────────────────────────────────────────────────
export const getPoetsPage = (page: number) =>
  http.get(`/poets/page/${page}`).then(r => r.data)

export const getPoetBySlug = (slug: string) =>
  http.get(`/poets/slug/${slug}`).then(r => r.data)

export const getPoetPoems = (slug: string, page: number) =>
  http.get(`/poets/${slug}/page/${page}`).then(r => r.data)

// ── Qafiyah — Poems ──────────────────────────────────────────────────────────
export const getRandomPoem = () =>
  http.get('/poems/random').then(r => r.data)

export const getPoemBySlug = (slug: string) =>
  http.get(`/poems/slug/${slug}`).then(r => r.data)

// ── Qafiyah — Eras ───────────────────────────────────────────────────────────
export const getEras = () =>
  http.get('/eras').then(r => r.data)

export const getEraPoems = (slug: string, page: number) =>
  http.get(`/eras/${slug}/page/${page}`).then(r => r.data)

// ── Qafiyah — Meters ─────────────────────────────────────────────────────────
export const getQafiyahMeters = () =>
  http.get('/qafiyah/meters').then(r => r.data)

export const getMeterPoems = (slug: string, page: number) =>
  http.get(`/qafiyah/meters/${slug}/page/${page}`).then(r => r.data)

// ── Qafiyah — Rhymes ─────────────────────────────────────────────────────────
export const getRhymes = () =>
  http.get('/rhymes').then(r => r.data)

export const getRhymePoems = (slug: string, page: number) =>
  http.get(`/rhymes/${slug}/page/${page}`).then(r => r.data)

// ── Qafiyah — Themes ─────────────────────────────────────────────────────────
export const getThemes = () =>
  http.get('/themes').then(r => r.data)

export const getThemePoems = (slug: string, page: number) =>
  http.get(`/themes/${slug}/page/${page}`).then(r => r.data)

// ── Qafiyah — Search ─────────────────────────────────────────────────────────
export interface SearchParams {
  q: string
  search_type?: 'poems' | 'poets'
  page?: number
  match_type?: 'exact' | 'all' | 'any'
}

export const searchPoetry = (params: SearchParams) =>
  http.get('/search', { params }).then(r => r.data)

// ── Health ────────────────────────────────────────────────────────────────────
export const getHealth = () =>
  http.get('/health').then(r => r.data)