import axios from 'axios'
import type { GenerateRequest, GenerationResponse, ChatHistoryItem, LocalMeter } from '../types'

const http = axios.create({
  baseURL: '/api',
  timeout: 90_000,   // 90 s — generation can take a while with retries
  headers: { 'Content-Type': 'application/json' },
})

// Intercept errors and normalize message
http.interceptors.response.use(
  res => res,
  err => {
    const msg = err?.response?.data?.error || err.message || 'خطأ في الاتصال بالخادم'
    return Promise.reject(new Error(msg))
  }
)

// ── Generation & Chat ────────────────────────────────────────────────────────
export const generatePoem = (body: GenerateRequest): Promise<GenerationResponse> =>
  http.post('/generate', body).then(r => r.data)

export const chatWithPoet = (message: string, history: ChatHistoryItem[]): Promise<{ response: string }> =>
  http.post('/chat', { message, history }).then(r => r.data)

// ── Local meters list ────────────────────────────────────────────────────────
export const getLocalMeters = (): Promise<{ meters: LocalMeter[] }> =>
  http.get('/meters').then(r => r.data)

// ── Qafiyah — Poets ─────────────────────────────────────────────────────────
export const getPoetsPage = (page: number) =>
  http.get(`/poets/page/${page}`).then(r => r.data)

export const getPoetBySlug = (slug: string) =>
  http.get(`/poets/slug/${slug}`).then(r => r.data)

export const getPoetPoems = (slug: string, page: number) =>
  http.get(`/poets/${slug}/page/${page}`).then(r => r.data)

// ── Qafiyah — Poems ─────────────────────────────────────────────────────────
export const getRandomPoem = () =>
  http.get('/poems/random').then(r => r.data)

export const getPoemBySlug = (slug: string) =>
  http.get(`/poems/slug/${slug}`).then(r => r.data)

// ── Qafiyah — Eras ──────────────────────────────────────────────────────────
export const getEras = () =>
  http.get('/eras').then(r => r.data)

export const getEraPoems = (slug: string, page: number) =>
  http.get(`/eras/${slug}/page/${page}`).then(r => r.data)

// ── Qafiyah — Meters ────────────────────────────────────────────────────────
export const getQafiyahMeters = () =>
  http.get('/qafiyah/meters').then(r => r.data)

export const getMeterPoems = (slug: string, page: number) =>
  http.get(`/qafiyah/meters/${slug}/page/${page}`).then(r => r.data)

// ── Qafiyah — Rhymes ────────────────────────────────────────────────────────
export const getRhymes = () =>
  http.get('/rhymes').then(r => r.data)

export const getRhymePoems = (slug: string, page: number) =>
  http.get(`/rhymes/${slug}/page/${page}`).then(r => r.data)

// ── Qafiyah — Themes ────────────────────────────────────────────────────────
export const getThemes = () =>
  http.get('/themes').then(r => r.data)

export const getThemePoems = (slug: string, page: number) =>
  http.get(`/themes/${slug}/page/${page}`).then(r => r.data)

// ── Qafiyah — Search ────────────────────────────────────────────────────────
export interface SearchParams {
  q: string
  search_type?: 'poems' | 'poets'
  page?: number
  match_type?: 'exact' | 'all' | 'any'
}
export const searchPoetry = (params: SearchParams) =>
  http.get('/search', { params }).then(r => r.data)

// ── Health ───────────────────────────────────────────────────────────────────
export const getHealth = () =>
  http.get('/health').then(r => r.data)
