import axios from 'axios'
import type { GenerateRequest, GenerationResponse, ChatHistoryItem, LocalMeter, Validation } from '../types'
import erasData from './eras.json'

// ══════════════════════════════════════════════════════════════════════════════
// Frontend API Client — Poem Generation & Chat with Gemini
// ══════════════════════════════════════════════════════════════════════════════
// This module handles all communication with the backend.
//
// KEY FEATURES:
//   • generatePoem(params) — Create poems with optional user Gemini API key
//   • chatWithPoet(message, history, apiKey?) — Chat with poet using Gemini
//   • validatePoem(verses, meter) — Validate custom poems
//   • All other endpoints for browsing poetry, themes, meters, rhymes, search
//
// USER API KEY SUPPORT:
//   If a user provides their own Gemini API key via the UI, both poems and chat
//   will use that key. If not provided, the backend's default key is used.
//   This allows multiple users to have independent rate limits.
//
// SECURITY:
//   API keys are transmitted over HTTPS only (POST body, not URL params).
//   Keys are never logged or stored on the frontend.
// ══════════════════════════════════════════════════════════════════════════════

// ── Backend HTTP client ───────────────────────────────────────────────────────
const rawBase = (import.meta.env.VITE_API_URL as string | undefined) || '/api'
const API_BASE = rawBase.endsWith('/api') ? rawBase : rawBase.replace(/\/$/, '') + '/api'

const http = axios.create({
  baseURL: API_BASE,
  timeout: 180_000,  // 3 min — generation with up to 10 retries can be slow
  headers: { 'Content-Type': 'application/json' },
})
http.interceptors.response.use(
  res => res,
  err => {
    const msg = err?.response?.data?.error || err.message || 'خطأ في الاتصال بالخادم'
    return Promise.reject(new Error(msg))
  }
)

// ── Poem generation ───────────────────────────────────────────────────────────
// All heavy lifting is in the backend:
//   LLM (Gemini/Claude/Groq) → Mishkal diacritizer → qawafi/pyarud validator
// No API keys needed in the frontend.
export async function generatePoem(body: GenerateRequest): Promise<GenerationResponse> {
  const res = await http.post('/generate', body)
  return res.data
}

// ── Poem validation (check user-written poem) ──────────────────────────────────
/** If meter is omitted or empty, backend will try to auto-detect it (requires pyarud). */
export async function validatePoem(
  verses: string[],
  meter?: string,
): Promise<Validation> {
  const res = await http.post('/validate', { verses, meter: meter || '' })
  return res.data
}

// ── Chat with poet ────────────────────────────────────────────────────────────
/**
 * Chat with the AI poet.
 * @param message - User's message
 * @param history - Chat history up to this point
 * @param gemini_api_key - Optional: user's own Gemini API key (overrides backend's default)
 */
export async function chatWithPoet(
  message: string,
  history: ChatHistoryItem[],
  gemini_api_key?: string,
): Promise<{ response: string }> {
  const res = await http.post('/chat', { message, history, gemini_api_key: gemini_api_key || '' })
  return res.data
}

// ── Local meters (mirrors backend METERS dict, no network call) ───────────────
const _METERS = {
  'الطويل':   { pattern: 'فَعُولُنْ مَفَاعِيلُنْ فَعُولُنْ مَفَاعِيلُنْ', hemistich_pattern: 'u / / | u / / / | u / / | u / / /', syllable_count: 14, zihafat: 'القبض: فعولن → فعول', example_sadr: 'أَلَا لَيْتَ شِعْرِي هَلْ أَبِيتَنَّ لَيْلَةً', example_ajuz: 'وَمَاءُ الشَّبَابِ فَوْقَنَا يَتَحَدَّرُ' },
  'البسيط':   { pattern: 'مُسْتَفْعِلُنْ فَاعِلُنْ مُسْتَفْعِلُنْ فَاعِلُنْ', hemistich_pattern: '/ / u / | / u / | / / u / | / u /', syllable_count: 14, zihafat: 'الخبن: مستفعلن → مفاعلن', example_sadr: 'إِنَّ الثَّمَانِينَ وَبُلِّغْتَهَا', example_ajuz: 'قَدْ أَحْوَجَتْ سَمْعِي إِلَى تَرْجُمَانِ' },
  'الكامل':   { pattern: 'مُتَفَاعِلُنْ مُتَفَاعِلُنْ مُتَفَاعِلُنْ', hemistich_pattern: 'u u u / | u u u / | u u u /', syllable_count: 12, zihafat: 'الإضمار: متفاعلن → مُتْفَاعِلُنْ', example_sadr: 'وَلَقَدْ أَمُرُّ عَلَى اللَّئِيمِ يَسُبُّنِي', example_ajuz: 'فَمَضَيْتُ ثُمَّتَ قُلْتُ لَا يَعْنِينِي' },
  'الوافر':   { pattern: 'مُفَاعَلَتُنْ مُفَاعَلَتُنْ فَعُولُنْ', hemistich_pattern: 'u / u u / | u / u u / | u / /', syllable_count: 11, zihafat: 'العصب: مفاعلتن → مفاعيلن', example_sadr: 'عَقَدْتُ بِأُمِّ عَمْرٍو حِبَالَ وُدِّي', example_ajuz: 'فَأَيُّ النَّاسِ أَكْرَمُ مِنْ كَرِيمِ' },
  'الخفيف':   { pattern: 'فَاعِلَاتُنْ مُسْتَفْعِلُنْ فَاعِلَاتُنْ', hemistich_pattern: '/ u / / | / / u / | / u / /', syllable_count: 12, zihafat: 'الخبن: فاعلاتن → فعلاتن', example_sadr: 'يَا خَلِيلَيَّ مَا عَلَى الدَّهْرِ بَاكٍ', example_ajuz: 'بَعْدَ مَا صَارَتِ الخِلَافُ رَمَادَا' },
  'المتقارب': { pattern: 'فَعُولُنْ فَعُولُنْ فَعُولُنْ فَعُولُنْ', hemistich_pattern: 'u / / | u / / | u / / | u / /', syllable_count: 12, zihafat: 'القبض: فعولن → فعول', example_sadr: 'إِذَا الشَّعْبُ يَوْمًا أَرَادَ الحَيَاةَ', example_ajuz: 'فَلَا بُدَّ أَنْ يَسْتَجِيبَ القَدَرُ' },
  'الرجز':    { pattern: 'مُسْتَفْعِلُنْ مُسْتَفْعِلُنْ مُسْتَفْعِلُنْ', hemistich_pattern: '/ / u / | / / u / | / / u /', syllable_count: 12, zihafat: 'الخبن: مستفعلن → مفاعلن', example_sadr: 'أَنَا النَّبِيُّ لَا كَذِبْ', example_ajuz: 'أَنَا ابْنُ عَبْدِ المُطَّلِبْ' },
  'الهزج':    { pattern: 'مَفَاعِيلُنْ مَفَاعِيلُنْ', hemistich_pattern: 'u / / / | u / / /', syllable_count: 8, zihafat: 'الكف: مفاعيلن → مفاعيل', example_sadr: 'عَلَى الأَيَّامِ يَا قَلْبِي', example_ajuz: 'تَعَزَّ فَمَا بَقَاءٌ فِي' },
  'السريع':   { pattern: 'مُسْتَفْعِلُنْ مُسْتَفْعِلُنْ فَاعِلُنْ', hemistich_pattern: '/ / u / | / / u / | / u /', syllable_count: 11, zihafat: 'الطيّ: مستفعلن → مفتعلن', example_sadr: 'مَا هَكَذَا تُورَدُ يَا سَعْدُ الإِبِلْ', example_ajuz: 'إِنَّ لَهَا سُقَّاةً يَوْمَ الوَحَلْ' },
  'المنسرح':  { pattern: 'مُسْتَفْعِلُنْ مَفْعُولَاتُ مُسْتَفْعِلُنْ', hemistich_pattern: '/ / u / | / / / u | / / u /', syllable_count: 12, zihafat: 'الطيّ والطمس في مفعولات', example_sadr: 'إِنِّي وَجَدْتُ الصَّبْرَ أَحْسَنَ سِتْرِي', example_ajuz: 'لِمَا رَمَانِي بِهِ الزَّمَانُ الغَيُورُ' },
  'المديد':   { pattern: 'فَاعِلَاتُنْ فَاعِلُنْ فَاعِلَاتُنْ', hemistich_pattern: '/ u / / | / u / | / u / /', syllable_count: 10, zihafat: 'الخبن في فاعلاتن', example_sadr: 'لِمَنِ الدَّارُ أَقْفَرَتْ بِالغَمِيمِ', example_ajuz: 'بَيْنَ أَشْجَارِهَا وَبَيْنَ النَّسِيمِ' },
  'المجتث':   { pattern: 'مُسْتَفْعِلُنْ فَاعِلَاتُنْ', hemistich_pattern: '/ / u / | / u / /', syllable_count: 8, zihafat: 'الخبن في فاعلاتن', example_sadr: 'أَلَا هُبِّي بِصَحْنِكِ', example_ajuz: 'فَاصْبَحِينَا وَلَا تَأْلِي' },
}

export const getLocalMeters = (): Promise<{ meters: LocalMeter[] }> => {
  const meters = Object.entries(_METERS).map(([name, v]) => ({
    name,
    pattern: v.pattern,
    feet: v.pattern.split(' ').length,
  }))
  return Promise.resolve({ meters })
}

// ── Qafiyah proxy ─────────────────────────────────────────────────────────────
export const getPoetsPage    = (page: number)            => http.get(`/poets/page/${page}`).then(r => r.data)
export const getPoetBySlug   = (slug: string)            => http.get(`/poets/slug/${slug}`).then(r => r.data)
export const getPoetPoems    = (slug: string, p: number) => http.get(`/poets/${slug}/page/${p}`).then(r => r.data)
export const getRandomPoem   = ()                        => http.get('/poems/random').then(r => r.data)
export const getPoemBySlug   = (slug: string)            => http.get(`/poems/slug/${slug}`).then(r => r.data)
export const getEras         = ()                        => Promise.resolve(erasData.data)
export const getEraDetails   = (slug: string) => {
  const era = erasData.data.find((e: any) => e.slug === slug)
  return Promise.resolve(era || null)
}
export const getEraPoems     = (slug: string, p: number) => http.get(`/eras/${slug}/page/${p}`).then(r => r.data)
export const getQafiyahMeters = ()                       => http.get('/qafiyah/meters').then(r => r.data)
export const getMeterPoems   = (slug: string, p: number) => http.get(`/qafiyah/meters/${slug}/page/${p}`).then(r => r.data)
export const getRhymes       = ()                        => http.get('/rhymes').then(r => r.data)
export const getRhymePoems   = (slug: string, p: number) => http.get(`/rhymes/${slug}/page/${p}`).then(r => r.data)
export const getThemes       = ()                        => http.get('/themes').then(r => r.data)
export const getThemePoems   = (slug: string, p: number) => http.get(`/themes/${slug}/page/${p}`).then(r => r.data)

export interface SearchParams {
  q: string
  search_type?: 'poems' | 'poets'
  page?: number
  match_type?: 'exact' | 'all' | 'any'
}
export const searchPoetry = (params: SearchParams) => http.get('/search', { params }).then(r => r.data)
export const getHealth    = ()                     => http.get('/health').then(r => r.data)