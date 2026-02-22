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
  { text: 'الخَيْلُ وَاللّيْلُ وَالبَيْداءُ تَعرِفُني // وَالسّيفُ وَالرّمحُ وَالقِرْطاسُ وَالقَلَمُ', poet: 'المتنبي' },
  { text: 'إِذا الشَّعْبُ يَوْمًا أَرادَ الْحَيَاةَ // فَلا بُدَّ أَنْ يَسْتَجِيبَ الْقَدَرُ', poet: 'أبو القاسم الشابي' },
  { text: 'أَلَا كُلُّ شَيْءٍ مَا خَلَا اللَّهَ بَاطِلُ // وَكُلُّ نَعِيمٍ لَا مَحَالَةَ زَائِلُ', poet: 'لبيد بن ربيعة' },
  { text: 'قِفَا نَبْكِ مِنْ ذِكْرَى حَبِيبٍ وَمَنْزِلِ // بِسِقْطِ اللِّوَى بَيْنَ الدَّخُولِ فَحَوْمَلِ', poet: 'امرؤ القيس' },
  { text: 'وَمَنْ هَابَ أَسْبَابَ المَنَايَا يَنَلْنَهُ // وَإِنْ يَرْقَ أَسْبَابَ السَّمَاءِ بِسُلَّمِ', poet: 'زهير بن أبي سلمى' },
  { text: 'أَمِنْ تذكُّرِ جيرانٍ بذي سَلَمِ // مَزَجْتَ دَمْعاً جَرَى مِنْ مُقْلَةٍ بِدَمِ', poet: 'البوصيري' },
  { text: 'إِذا رَأَيْتَ نُيُوبَ اللّيْثِ بارِزَةً // فَلا تَظُنَّنَّ أَنَّ اللّيْثَ يَبْتَسِمُ', poet: 'المتنبي' },
  { text: 'نَصِيبُكَ فِي حَيَاتِكَ مِنْ حَبِيبٍ // نَصِيبُكَ فِي مَنَامِكَ مِنْ خَيَالِ', poet: 'المتنبي' },
  { text: 'وَمَا نَيْلُ المَطَالِبِ بِالتَّمَنِّي // وَلَكِنْ تُؤْخَذُ الدُّنْيَا غِلَابَا', poet: 'أحمد شوقي' },
  { text: 'دَعِ الأَيَّامَ تَفْعَلُ مَا تَشَاءُ // وَطِبْ نَفْسًا إِذَا حَكَمَ القَضَاءُ', poet: 'الإمام الشافعي' },
  { text: 'لِسَانُ الفَتَى نِصْفٌ وَنِصْفٌ فُؤَادُهُ // فَلَمْ يَبْقَ إِلَّا صُورَةُ اللَّحْمِ وَالدَّمِ', poet: 'زهير بن أبي سلمى' },
  { text: 'عَلَى قَدْرِ أَهْلِ العَزْمِ تَأْتِي العَزَائِمُ // وَتَأْتِي عَلَى قَدْرِ الكِرَامِ المَكَارِمُ', poet: 'المتنبي' },
  { text: 'أَعزُّ مَكانٍ في الدُنى سَرجُ سابِحٍ // وَخَيرُ جَليسٍ في الزَمانِ كِتابُ', poet: 'المتنبي' },
  { text: 'وَمَا المَرْءُ إِلَّا كَالشِّهَابِ وَضَوْئِهِ // يَحُورُ رَمَاداً بَعْدَ إِذْ هُوَ سَاطِعُ', poet: 'لبيد بن ربيعة' },
  { text: 'يَا مَنْ يَعِزُّ عَلَيْنَا أَنْ نُفَارِقَهُمْ // وِجْدَانُنَا كُلَّ شَيْءٍ بَعْدَكُمْ عَدَمُ', poet: 'المتنبي' },
  { text: 'قُم لِلمُعَلِّمِ وَفِّهِ التَبجيلا // كادَ المُعَلِّمُ أَن يَكونَ رَسولا', poet: 'أحمد شوقي' },
  { text: 'إِنَّما الأُمَمُ الأَخلاقُ ما بَقِيَت // فَإِن هُمُ ذَهَبَت أَخلاقُهُم ذَهَبوا', poet: 'أحمد شوقي' },
  { text: 'أَلا لَيْتَ الشَّبَابَ يَعُودُ يَوْمًا // فَأُخْبِرَهُ بِمَا فَعَلَ المَشِيبُ', poet: 'أبو العتاهية' },
  { text: 'إِذا غامَرتَ في شَرَفٍ مَرومٍ // فَلا تَقنَع بِما دونَ النُجومِ', poet: 'المتنبي' },
];
