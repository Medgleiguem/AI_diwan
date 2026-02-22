// ── Generation ──────────────────────────────────────────────────────────────
export interface GenerateRequest {
  topic: string
  meter: string
  num_verses: number
  style: string
}

export interface PoemData {
  poem: string[]          // each element: "صدر ### عجز"
  meter: string
  rhyme_letter: string
  rhyme_word_examples?: string[]
  theme: string
  explanation: string
}

export interface VerseValidation {
  verse: number
  valid: boolean
  issues?: string[]
  detected_meter?: string
  arudi_style?: string
  error?: string
}

export interface Validation {
  valid: boolean
  validator: 'qawafi' | 'rule-based'
  results: VerseValidation[]
  feedback: string | null
  rhyme_endings?: string[]
}

export interface GenerationAttempt {
  attempt: number
  poem: string[]
  validation: Validation
}

export interface GenerationResponse {
  success: boolean
  poem: PoemData
  validation: Validation
  attempts: number
  attempt_history: GenerationAttempt[]
  warning?: string
  error?: string
}

// ── Chat ────────────────────────────────────────────────────────────────────
export interface ChatHistoryItem {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatMessage extends ChatHistoryItem {
  id: string
  timestamp: Date
}

// ── Qafiyah API shapes (approximate — adjust if API differs) ────────────────
export interface QafiyahPoet {
  id?: number | string
  name: string
  slug: string
  era?: string
  bio?: string
  poem_count?: number
  birth_year?: string | number
  death_year?: string | number
}

export interface QafiyahPoem {
  id?: number | string
  slug?: string
  title?: string
  poet?: QafiyahPoet
  poet_name?: string
  verses?: string[]
  meter?: string
  rhyme?: string
  era?: string
  theme?: string
  text?: string
}

export interface QafiyahListResponse<T> {
  data?: T[]
  items?: T[]
  results?: T[]
  total?: number
  page?: number
  has_next?: boolean
  has_prev?: boolean
  [key: string]: unknown
}

export interface LocalMeter {
  name: string
  pattern: string
  feet: number
}

// ── UI Constants ─────────────────────────────────────────────────────────────
export const POEM_STYLES = [
  { value: 'كلاسيكي',    label: 'كلاسيكي' },
  { value: 'رومانسي',    label: 'رومانسي' },
  { value: 'صوفي',       label: 'صوفي' },
  { value: 'وطني',       label: 'وطني' },
  { value: 'رثاء',       label: 'رثاء' },
  { value: 'مدح',        label: 'مدح' },
  { value: 'هجاء',       label: 'هجاء ساخر' },
  { value: 'حكمة',       label: 'حكمة وفلسفة' },
  { value: 'وصف طبيعة', label: 'وصف الطبيعة' },
  { value: 'غزل',        label: 'غزل' },
]

export const VERSE_COUNTS = [4, 6, 8, 10, 12, 14, 16]

export const FALLBACK_VERSES = [
  { text: 'أَنَا الَّذِي نَظَرَ الأَعْمَى إِلَى أَدَبِي // وَأَسْمَعَتْ كَلِمَاتِي مَنْ بِهِ صَمَمُ', poet: 'المتنبي' },
  { text: 'وَمَا الدَّهْرُ إِلَّا مِنْ رُوَاةٍ وَنَاقِلٍ // وَمَا الشِّعْرُ إِلَّا صَادِقٌ وَمُعَلِّمُ', poet: 'أبو تمام' },
  { text: 'لَكُلِّ امْرِئٍ مِنْ دَهْرِهِ مَا تَعَوَّدَا # وَعَادَةُ سَيْفِ الدَّوْلَةِ الطَّعْنُ فِي الْعِدَا', poet: 'المتنبي' },
  { text: 'أَلَا كُلُّ شَيْءٍ مَا خَلَا اللَّهَ بَاطِلُ // وَكُلُّ نَعِيمٍ لَا مَحَالَةَ زَائِلُ', poet: 'لبيد بن ربيعة' },
  { text: 'قِفَا نَبْكِ مِنْ ذِكْرَى حَبِيبٍ وَمَنْزِلِ // بِسِقْطِ اللِّوَى بَيْنَ الدَّخُولِ فَحَوْمَلِ', poet: 'امرؤ القيس' },
]
