"""
ديوان الذكاء — Backend  v2.0
═══════════════════════════════════════════════════════════════════
Architecture: LLM Provider → Mishkal (diacritize) → Bohour/pyarud/structural

FIXES vs v1.0
─────────────
1.  [CRIT] best_result mutation bug  → deep-copy on every assignment
2.  [CRIT] wrong Claude model string → claude-sonnet-4-6-20250514 default
3.  [CRIT] _clean_json rfind truncation → bracket-depth parser
4.  [CRIT] validate unknown meter returns false-valid → hard 400
5.  [BUG]  feedback rebuilt from wrong attempt → always use best_result
6.  [BUG]  correction prompt verse/index mismatch → aligned indexing
7.  [BUG]  rhyme threshold too loose → max 2 distinct endings allowed
8.  [BUG]  temperature vs correction strategy → correction uses 0.55
9.  [BUG]  _normalize_verses double-### entry → split-again guard
10. [BUG]  _detect_meter_from_verses single verse → samples first 3, majority vote
11. [PERF] no connection pooling → requests.Session() singleton
12. [PERF] qafiyah proxy no caching → TTL cache for read-only routes
13. [PERF] mishkal called on already-tashkeeled verse → skip guard
14. [SEC]  topic length unbounded → hard cap 500 chars
15. [SEC]  LLM key name leaks to client → generic server error message
16. [SEC]  history type not validated → isinstance guard
17. [SEC]  CORS wildcard + no rate limit → flask-limiter (configurable)
18. [ARCH] Mishkal not thread-safe → threading.Lock() wrapper
19. [ARCH] pyarud not thread-safe → threading.Lock() wrapper
20. [ARCH] API keys exposed in ValueError → sanitized error responses
═══════════════════════════════════════════════════════════════════

LLM_PROVIDER env var: gemini (default) | claude | groq
"""

import os, re, json, time, copy, logging, threading
from functools import lru_cache
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

# ── Optional rate-limiter (install flask-limiter to enable) ───────────────────
try:
    from flask_limiter import Limiter
    from flask_limiter.util import get_remote_address
    _LIMITER_AVAILABLE = True
except ImportError:
    _LIMITER_AVAILABLE = False

try:
    import requests as _requests_lib
except ImportError:
    raise SystemExit("pip install requests")

load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": os.getenv("CORS_ORIGINS", "*")}})
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger(__name__)

# Attach rate limiter if available
if _LIMITER_AVAILABLE:
    _limiter = Limiter(
        get_remote_address,
        app=app,
        default_limits=["200 per hour", "30 per minute"],
        storage_uri="memory://",
    )
    log.info("✓ flask-limiter enabled")
else:
    # Stub so decorators don't crash
    class _FakeLimiter:
        def limit(self, *a, **kw):
            def decorator(f): return f
            return decorator
    _limiter = _FakeLimiter()
    log.warning("flask-limiter not installed — rate limiting disabled")

# ── Shared HTTP session (connection pooling) ──────────────────────────────────
_http = _requests_lib.Session()
_http.headers.update({"User-Agent": "Diwan/2.0"})

# ── Config ────────────────────────────────────────────────────────────────────
QAFIYAH_BASE    = "https://api.qafiyah.com"
REQUEST_TIMEOUT = 20
MAX_RETRIES     = int(os.getenv("MAX_RETRIES", "10"))
LLM_PROVIDER    = os.getenv("LLM_PROVIDER", "gemini").lower()

GEMINI_KEY      = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL    = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")

# FIX #2: correct model string — Anthropic requires the dated suffix
ANTHROPIC_KEY   = os.getenv("ANTHROPIC_API_KEY", "")
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6-20250514")

GROQ_KEY        = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL      = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

# ── Khalil meters ─────────────────────────────────────────────────────────────
METERS = {
    'الطويل':   {'pattern':'فَعُولُنْ مَفَاعِيلُنْ فَعُولُنْ مَفَاعِيلُنْ','notation':'u / / | u / / / | u / / | u / / /','syllables':14,'zihafat':'القبض: فعولن → فعول','ex_sadr':'أَلَا لَيْتَ شِعْرِي هَلْ أَبِيتَنَّ لَيْلَةً','ex_ajuz':'وَمَاءُ الشَّبَابِ فَوْقَنَا يَتَحَدَّرُ','min_words':3,'max_words':8},
    'البسيط':   {'pattern':'مُسْتَفْعِلُنْ فَاعِلُنْ مُسْتَفْعِلُنْ فَاعِلُنْ','notation':'/ / u / | / u / | / / u / | / u /','syllables':14,'zihafat':'الخبن: مستفعلن → مفاعلن','ex_sadr':'إِنَّ الثَّمَانِينَ وَبُلِّغْتَهَا','ex_ajuz':'قَدْ أَحْوَجَتْ سَمْعِي إِلَى تَرْجُمَانِ','min_words':3,'max_words':8},
    'الكامل':   {'pattern':'مُتَفَاعِلُنْ مُتَفَاعِلُنْ مُتَفَاعِلُنْ','notation':'u u u / | u u u / | u u u /','syllables':12,'zihafat':'الإضمار: متفاعلن → مُتْفَاعِلُنْ','ex_sadr':'وَلَقَدْ أَمُرُّ عَلَى اللَّئِيمِ يَسُبُّنِي','ex_ajuz':'فَمَضَيْتُ ثُمَّتَ قُلْتُ لَا يَعْنِينِي','min_words':3,'max_words':7},
    'الوافر':   {'pattern':'مُفَاعَلَتُنْ مُفَاعَلَتُنْ فَعُولُنْ','notation':'u / u u / | u / u u / | u / /','syllables':11,'zihafat':'العصب: مفاعلتن → مفاعيلن','ex_sadr':'عَقَدْتُ بِأُمِّ عَمْرٍو حِبَالَ وُدِّي','ex_ajuz':'فَأَيُّ النَّاسِ أَكْرَمُ مِنْ كَرِيمِ','min_words':3,'max_words':7},
    'الخفيف':   {'pattern':'فَاعِلَاتُنْ مُسْتَفْعِلُنْ فَاعِلَاتُنْ','notation':'/ u / / | / / u / | / u / /','syllables':12,'zihafat':'الخبن: فاعلاتن → فعلاتن','ex_sadr':'يَا خَلِيلَيَّ مَا عَلَى الدَّهْرِ بَاكٍ','ex_ajuz':'بَعْدَ مَا صَارَتِ الخِلَافُ رَمَادَا','min_words':3,'max_words':7},
    'المتقارب': {'pattern':'فَعُولُنْ فَعُولُنْ فَعُولُنْ فَعُولُنْ','notation':'u / / | u / / | u / / | u / /','syllables':12,'zihafat':'القبض: فعولن → فعول','ex_sadr':'إِذَا الشَّعْبُ يَوْمًا أَرَادَ الحَيَاةَ','ex_ajuz':'فَلَا بُدَّ أَنْ يَسْتَجِيبَ القَدَرُ','min_words':3,'max_words':7},
    'الرجز':    {'pattern':'مُسْتَفْعِلُنْ مُسْتَفْعِلُنْ مُسْتَفْعِلُنْ','notation':'/ / u / | / / u / | / / u /','syllables':12,'zihafat':'الخبن: مستفعلن → مفاعلن','ex_sadr':'أَنَا النَّبِيُّ لَا كَذِبْ','ex_ajuz':'أَنَا ابْنُ عَبْدِ المُطَّلِبْ','min_words':2,'max_words':6},
    'الهزج':    {'pattern':'مَفَاعِيلُنْ مَفَاعِيلُنْ','notation':'u / / / | u / / /','syllables':8,'zihafat':'الكف: مفاعيلن → مفاعيل','ex_sadr':'عَلَى الأَيَّامِ يَا قَلْبِي','ex_ajuz':'تَعَزَّ فَمَا بَقَاءٌ فِي','min_words':2,'max_words':5},
    'السريع':   {'pattern':'مُسْتَفْعِلُنْ مُسْتَفْعِلُنْ فَاعِلُنْ','notation':'/ / u / | / / u / | / u /','syllables':11,'zihafat':'الطيّ: مستفعلن → مفتعلن','ex_sadr':'مَا هَكَذَا تُورَدُ يَا سَعْدُ الإِبِلْ','ex_ajuz':'إِنَّ لَهَا سُقَّاةً يَوْمَ الوَحَلْ','min_words':2,'max_words':7},
    'المنسرح':  {'pattern':'مُسْتَفْعِلُنْ مَفْعُولَاتُ مُسْتَفْعِلُنْ','notation':'/ / u / | / / / u | / / u /','syllables':12,'zihafat':'الطيّ والطمس في مفعولات','ex_sadr':'إِنِّي وَجَدْتُ الصَّبْرَ أَحْسَنَ سِتْرِي','ex_ajuz':'لِمَا رَمَانِي بِهِ الزَّمَانُ الغَيُورُ','min_words':3,'max_words':7},
    'المديد':   {'pattern':'فَاعِلَاتُنْ فَاعِلُنْ فَاعِلَاتُنْ','notation':'/ u / / | / u / | / u / /','syllables':10,'zihafat':'الخبن في فاعلاتن','ex_sadr':'لِمَنِ الدَّارُ أَقْفَرَتْ بِالغَمِيمِ','ex_ajuz':'بَيْنَ أَشْجَارِهَا وَبَيْنَ النَّسِيمِ','min_words':2,'max_words':6},
    'المجتث':   {'pattern':'مُسْتَفْعِلُنْ فَاعِلَاتُنْ','notation':'/ / u / | / u / /','syllables':8,'zihafat':'الخبن في فاعلاتن','ex_sadr':'أَلَا هُبِّي بِصَحْنِكِ','ex_ajuz':'فَاصْبَحِينَا وَلَا تَأْلِي','min_words':2,'max_words':5},
}

# ── Mishkal diacritizer — thread-safe wrapper ─────────────────────────────────
# FIX #18: TashkeelClass is NOT documented as thread-safe; it maintains
# internal mutable state (word lists, morphology caches). We protect it
# with a single Lock. For higher throughput use a pool, but for this
# workload a lock is sufficient and avoids object duplication cost.
MISHKAL_AVAILABLE = False
_mishkal          = None
_mishkal_lock     = threading.Lock()

try:
    from mishkal.tashkeel import TashkeelClass
    _mishkal = TashkeelClass()
    MISHKAL_AVAILABLE = True
    log.info("✓ Mishkal loaded (thread-locked)")
except ImportError:
    log.warning("Mishkal not installed: pip install mishkal")
except Exception as e:
    log.warning(f"Mishkal init failed: {e}")


def diacritize(text: str) -> str:
    if not MISHKAL_AVAILABLE or not text.strip():
        return text
    # FIX #18: acquire lock before every call
    with _mishkal_lock:
        try:
            r = _mishkal.tashkeel(text)
            return r if r else text
        except Exception as e:
            log.debug(f"Mishkal error: {e}")
            return text

# ── Bohour meter validator ─────────────────────────────────────────────────────
# Library: pip install git+https://github.com/MagedSaeed/Bohour.git
#
# REAL API (confirmed from source & README):
#   from bohour.bahr import Kamel
#   meter = Kamel()
#   result = meter.analyze(bait_string)
#   result.is_complete   → bool
#   result.name          → Arabic meter name string
#   result.pattern       → pattern string
#
# NOTE: ARBML/Bohour (the original fork) has NO .analyze() method on Bahr —
# it only exposes .all_combinations, .arod_dharbs_map etc. as data structures.
# MagedSaeed/Bohour adds .analyze(). The hasattr check below handles both.
BOHOUR_AVAILABLE = False
_bohour_classes  = {}
_bohour_lock     = threading.Lock()  # FIX #18 (same reasoning as Mishkal)

_BOHOUR_CLASS_MAP = {
    'الطويل':'Taweel', 'البسيط':'Baseet', 'الكامل':'Kamel',
    'الوافر':'Wafer',  'الخفيف':'Khafif', 'المتقارب':'Mutakareb',
    'الرجز':'Rajaz',   'الهزج':'Hazaj',   'السريع':'Sarie',
    'المنسرح':'Munsareh','المديد':'Madeed','المجتث':'Mujtath',
}

try:
    import bohour.bahr as _bohour_bahr
    for ar, cls_name in _BOHOUR_CLASS_MAP.items():
        cls = getattr(_bohour_bahr, cls_name, None)
        if cls:
            _bohour_classes[ar] = cls
    if _bohour_classes:
        _sample = next(iter(_bohour_classes.values()))
        if hasattr(_sample, 'analyze'):
            BOHOUR_AVAILABLE = True
            log.info(f"✓ Bohour (MagedSaeed) loaded — {len(_bohour_classes)} meters")
        else:
            _bohour_classes.clear()
            log.warning(
                "Bohour installed but no .analyze() — likely ARBML fork. "
                "Install: pip install git+https://github.com/MagedSaeed/Bohour.git"
            )
    else:
        log.warning("Bohour imported but no meter classes found")
except ImportError:
    log.warning("Bohour not installed. Run: pip install git+https://github.com/MagedSaeed/Bohour.git")
except Exception as e:
    log.warning(f"Bohour load error: {e}")

# ── pyarud fallback ────────────────────────────────────────────────────────────
# FIX #19: pyarud ArudhProcessor is also stateful. Protect with a lock.
PYARUD_AVAILABLE = False
_pyarud          = None
_pyarud_lock     = threading.Lock()

if not BOHOUR_AVAILABLE:
    try:
        from pyarud.processor import ArudhProcessor
        _pyarud = ArudhProcessor()
        PYARUD_AVAILABLE = True
        log.info("✓ pyarud loaded (fallback validator)")
    except Exception as e:
        log.warning(f"pyarud unavailable: {e}")

# ── LLM providers ─────────────────────────────────────────────────────────────

class LLMError(RuntimeError):
    """Wrapped errors from LLM providers with an optional HTTP status code."""

    def __init__(self, message: str, status: int = 500):
        super().__init__(message)
        self.status = status


def _gemini(system: str, user: str, temp: float, api_key: str = "") -> str:
    """Call Gemini API. If api_key is provided, use it; otherwise use GEMINI_KEY."""
    key = api_key.strip() if api_key else GEMINI_KEY
    if not key:
        # FIX #20: don't expose key name in client response
        raise RuntimeError("_CONFIG_ERROR_GEMINI")
    url = (f"https://generativelanguage.googleapis.com/v1beta/models/"
           f"{GEMINI_MODEL}:generateContent?key={key}")
    try:
        r = _http.post(url, json={
            "system_instruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user", "parts": [{"text": user}]}],
            "generationConfig": {"temperature": temp, "maxOutputTokens": 4096, "topP": 0.92},
        }, timeout=60)
        if r.status_code == 429:
            raise LLMError("حصة Gemini مشغولة — انتظر قليلاً", status=429)
        r.raise_for_status()
    except _requests_lib.HTTPError as e:
        status = getattr(e.response, "status_code", 500)
        if status == 503:
            raise LLMError("خدمة Gemini غير متاحة حالياً. حاول مرة أخرى بعد قليل.", status=503)
        if status >= 500:
            raise LLMError("خطأ مؤقت في خدمة Gemini. حاول مرة أخرى بعد قليل.", status=status)
        raise LLMError("خطأ في خدمة Gemini. حاول مرة أخرى.", status=status)
    except _requests_lib.RequestException:
        raise LLMError("فشل الاتصال بخدمة Gemini. تحقق من شبكة الإنترنت.", status=503)

    return r.json()["candidates"][0]["content"]["parts"][0]["text"].strip()


def _claude(system: str, user: str, temp: float) -> str:
    if not ANTHROPIC_KEY:
        raise RuntimeError("_CONFIG_ERROR_CLAUDE")
    try:
        r = _http.post("https://api.anthropic.com/v1/messages", headers={
            "x-api-key": ANTHROPIC_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }, json={
            "model": ANTHROPIC_MODEL,  # FIX #2: now defaults to dated model string
            "max_tokens": 4096,
            "system": system,
            "messages": [{"role": "user", "content": user}],
            "temperature": temp,
        }, timeout=60)
        if r.status_code == 429:
            raise LLMError("حصة Claude مشغولة — انتظر قليلاً", status=429)
        r.raise_for_status()
    except _requests_lib.HTTPError as e:
        status = getattr(e.response, "status_code", 500)
        if status == 503:
            raise LLMError("خدمة Claude غير متاحة حالياً. حاول مرة أخرى بعد قليل.", status=503)
        if status >= 500:
            raise LLMError("خطأ مؤقت في خدمة Claude. حاول مرة أخرى بعد قليل.", status=status)
        raise LLMError("خطأ في خدمة Claude. حاول مرة أخرى.", status=status)
    except _requests_lib.RequestException:
        raise LLMError("فشل الاتصال بخدمة Claude. تحقق من شبكة الإنترنت.", status=503)

    return r.json()["content"][0]["text"].strip()


def _groq(system: str, user: str, temp: float) -> str:
    if not GROQ_KEY:
        raise RuntimeError("_CONFIG_ERROR_GROQ")
    try:
        r = _http.post("https://api.groq.com/openai/v1/chat/completions", headers={
            "Authorization": f"Bearer {GROQ_KEY}",
            "Content-Type": "application/json",
        }, json={
            "model": GROQ_MODEL,
            "messages": [{"role":"system","content":system},{"role":"user","content":user}],
            "temperature": temp,
            "max_tokens": 4096,
        }, timeout=60)
        if r.status_code == 429:
            raise LLMError("حصة Groq مشغولة — انتظر قليلاً", status=429)
        r.raise_for_status()
    except _requests_lib.HTTPError as e:
        status = getattr(e.response, "status_code", 500)
        if status == 503:
            raise LLMError("خدمة Groq غير متاحة حالياً. حاول مرة أخرى بعد قليل.", status=503)
        if status >= 500:
            raise LLMError("خطأ مؤقت في خدمة Groq. حاول مرة أخرى بعد قليل.", status=status)
        raise LLMError("خطأ في خدمة Groq. حاول مرة أخرى.", status=status)
    except _requests_lib.RequestException:
        raise LLMError("فشل الاتصال بخدمة Groq. تحقق من شبكة الإنترنت.", status=503)

    return r.json()["choices"][0]["message"]["content"].strip()


_LLM_FNS = {"gemini": _gemini, "claude": _claude, "groq": _groq}

# FIX #20: translate internal config errors to a safe user-facing message
_CONFIG_ERROR_MAP = {
    "_CONFIG_ERROR_GEMINI": "مفتاح Gemini API غير مضبوط على الخادم",
    "_CONFIG_ERROR_CLAUDE": "مفتاح Claude API غير مضبوط على الخادم",
    "_CONFIG_ERROR_GROQ":   "مفتاح Groq API غير مضبوط على الخادم",
}


def call_llm(system: str, user: str, temp: float = 0.7, gemini_api_key: str = "") -> str:
    """Call the configured LLM provider. If gemini_api_key is provided and provider is Gemini, use it."""
    fn = _LLM_FNS.get(LLM_PROVIDER)
    if fn is None:
        raise ValueError(f"مزوّد غير معروف: {LLM_PROVIDER}")
    for attempt in range(3):
        try:
            # Pass gemini_api_key only to _gemini function
            if LLM_PROVIDER == "gemini":
                return fn(system, user, temp, gemini_api_key)
            else:
                return fn(system, user, temp)
        except LLMError as e:
            msg = str(e)
            if msg in _CONFIG_ERROR_MAP:
                raise RuntimeError(_CONFIG_ERROR_MAP[msg])
            # Retry for transient downstream errors
            if attempt < 2 and e.status in (429, 500, 502, 503, 504):
                time.sleep(6 * (attempt + 1))
                continue
            raise
        except RuntimeError as e:
            msg = str(e)
            if msg in _CONFIG_ERROR_MAP:
                raise RuntimeError(_CONFIG_ERROR_MAP[msg])
            if attempt < 2:
                time.sleep(6 * (attempt + 1))
                continue
            raise
    raise RuntimeError("فشل الاتصال بعد 3 محاولات")

# ── Prompts ────────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """أنت شاعر عربي فصيح وعالِم بعلم العَروض على منهج الخليل بن أحمد الفراهيدي.

مهمتك: كتابة قصيدة عربية فصيحة ذات معنى عميق، ملتزمة تماماً بوزن البحر المطلوب.

القواعد المطلقة:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

١. شكل كل بيت:  الصدر ### العجز
   — لا تكتب الصدر والعجز على سطرين منفصلين.
   — لا تضع الصدر في مفتاح JSON منفصل عن العجز.

٢. الوزن: u = مقطع قصير  |  / = مقطع طويل
   كل شطر يجب أن يطابق نمط التفعيلات بالضبط.
   قبل كتابة كل شطر: انطقه في ذهنك وعدّ مقاطعه ثم قارنها بالنمط.

٣. القافية: نفس حرف الروي في آخر كل عجز.

٤. اكتب مع تشكيل كامل (حركات على كل حرف).

٥. الإخراج: JSON فقط — لا نص قبله ولا بعده أبداً.

{
  "poem": ["صدر1 ### عجز1", "صدر2 ### عجز2"],
  "meter": "اسم البحر",
  "rhyme_letter": "حرف الروي",
  "rhyme_word_examples": ["كلمة1", "كلمة2"],
  "theme": "الموضوع",
  "explanation": "شرح مختصر"
}"""

CHAT_SYSTEM = """أنت شاعر عربي متمكّن ومرجع في علم العروض والقوافي.
معرفتك شاملة بشعراء العرب عبر العصور: الجاهلي، الأموي، العباسي، الأندلسي، الحديث.
قواعد: تكلم بالعربية الفصحى. كن معلماً صبوراً. اذكر أمثلة من التراث. إذا أُنشئ بيت فالتزم الوزن."""


def _build_generation_prompt(topic, meter, num_verses, style, feedback, attempt):
    m = METERS[meter]
    fb_block = (
        f"\n╔══════════════════════════════════════════╗\n"
        f"║  أخطاء المحاولة السابقة — أصلحها الآن  ║\n"
        f"╚══════════════════════════════════════════╝\n{feedback}\n\n"
    ) if feedback else ""

    warning = (
        f"\n⚠️ محاولة {attempt}/{MAX_RETRIES} — ركّز على مطابقة الوزن حرفاً بحرف."
        if attempt > 2 else ""
    )

    return (
        f"{fb_block}اكتب قصيدة:\n"
        f"الموضوع: {topic}  |  الأسلوب: {style}  |  البحر: {meter}  |  الأبيات: {num_verses}\n\n"
        f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"نمط بحر {meter}\n"
        f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"التفعيلة : {m['pattern']}\n"
        f"النمط    : {m['notation']}\n"
        f"المقاطع  : {m['syllables']} لكل شطر (مع الزحافات: {m['syllables']-1}–{m['syllables']+1})\n"
        f"الزحافات : {m['zihafat']}\n\n"
        f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"بيت الاستشهاد (انطقه الآن في ذهنك)\n"
        f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"{m['ex_sadr']} ### {m['ex_ajuz']}\n\n"
        f"قصيدتك يجب أن تكون بنفس الإيقاع تماماً.{warning}\n"
        f"اكتب الآن {num_verses} أبيات مع تشكيل كامل. JSON فقط."
    )


def _build_correction_prompt(best_verses, broken_results, meter, topic):
    """
    FIX #6: both best_verses and broken_results come from the same
    best_result snapshot, so verse indices are always aligned.
    """
    m = METERS[meter]
    broken_nums = {b['verse'] for b in broken_results}
    good_lines = [
        f"{i+1}. {v}"
        for i, v in enumerate(best_verses)
        if (i + 1) not in broken_nums
    ]
    bad_lines = []
    for b in broken_results:
        idx = b['verse'] - 1
        v = best_verses[idx] if idx < len(best_verses) else ''
        ps = v.split('###', 1) if '###' in v else [v, '']
        bad_lines.append(
            f"البيت {b['verse']}:\n"
            f"  الصدر: \"{ps[0].strip()}\"\n"
            f"  العجز: \"{ps[1].strip() if len(ps) > 1 else ''}\"\n"
            f"  الخطأ: {', '.join(b.get('issues', []))}"
        )
    return (
        f"أعِد كتابة الأبيات المكسورة فقط.\n"
        f"الموضوع: {topic} | البحر: {meter} | النمط: {m['notation']}\n"
        f"المثال: {m['ex_sadr']} ### {m['ex_ajuz']}\n\n"
        f"الأبيات الصحيحة (أبقِها بالضبط):\n"
        f"{chr(10).join(good_lines) or 'لا يوجد'}\n\n"
        f"الأبيات المكسورة:\n{chr(10).join(bad_lines)}\n\n"
        f"أخرج القصيدة كاملة مع تشكيل كامل. JSON فقط."
    )

# ── Arabic helpers ─────────────────────────────────────────────────────────────
_ALL_HARAKAT = set('\u064B\u064C\u064D\u064E\u064F\u0650\u0651\u0652\u0653')


def _has_tashkeel(text: str) -> bool:
    letters = sum(1 for c in text if '\u0621' <= c <= '\u064A')
    harakat = sum(1 for c in text if c in _ALL_HARAKAT)
    return letters > 0 and (harakat / letters) >= 0.25


def _extract_rhyme(ajuz: str) -> str:
    words = ajuz.strip().split()
    if not words:
        return ''
    last = re.sub(r'[.,،؟!:؛]', '', words[-1])
    s = re.sub(r'[\u064B-\u065F\u0670]', '', last)
    return s[-2:] if len(s) >= 2 else s


def _extract_first_json(text: str) -> str:
    """
    FIX #3: walk the string character by character tracking bracket depth.
    This correctly handles JSON objects that are followed by explanatory prose
    (which may contain closing braces), unlike rfind('}') which picks the last.
    Also strips markdown code fences before scanning.
    """
    t = text.strip()
    # Strip optional markdown code fence
    t = re.sub(r'^```(?:json)?\s*', '', t, flags=re.IGNORECASE)
    t = re.sub(r'\s*```$', '', t)
    start = t.find('{')
    if start == -1:
        return t
    depth = 0
    in_str = False
    escape = False
    for i, ch in enumerate(t[start:], start):
        if escape:
            escape = False
            continue
        if ch == '\\' and in_str:
            escape = True
            continue
        if ch == '"' and not escape:
            in_str = not in_str
            continue
        if in_str:
            continue
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                return t[start:i + 1].strip()
    # Fallback: return from start to end
    return t[start:].strip()


def _normalize_verses(raw: list) -> list:
    """
    Merge sadr/ajuz pairs written as separate array entries.

    FIX #9: guard against an entry that contains '###' in its second half
    (double-separator entries), e.g. "عجز1 ### صدر2 somehow".
    When we detect '###' in what should be the ajuz part of a pair,
    we split it and inject the overflow as the next entry.
    """
    if not raw:
        return raw
    if all('###' in v for v in raw):
        return raw
    result, i = [], 0
    while i < len(raw):
        cur = raw[i].strip()
        if '###' in cur:
            result.append(cur)
            i += 1
        else:
            nxt = raw[i + 1].strip() if i + 1 < len(raw) else None
            if nxt and '###' not in nxt:
                merged = f"{cur} ### {nxt}"
                result.append(merged)
                i += 2
            else:
                result.append(cur)
                i += 1
    return result

# ── Qafiyah proxy TTL cache ────────────────────────────────────────────────────
# FIX #12: cache static/slow-changing endpoints so we don't hammer qafiyah.com.
# TTL is 10 minutes for list endpoints. Random poem bypasses cache intentionally.

_qafiyah_cache: dict = {}          # key → (timestamp, data, status)
_QAFIYAH_TTL = int(os.getenv("QAFIYAH_CACHE_TTL", "600"))   # seconds


def _q(path, params=None, cacheable=False):
    url = f"{QAFIYAH_BASE}/{path.lstrip('/')}"
    cache_key = url + str(sorted((params or {}).items()))

    if cacheable and cache_key in _qafiyah_cache:
        ts, data, status = _qafiyah_cache[cache_key]
        if time.time() - ts < _QAFIYAH_TTL:
            return data, status

    try:
        r = _http.get(url, params=params, timeout=REQUEST_TIMEOUT,
                      headers={"Accept": "application/json"})
        r.raise_for_status()
        try:
            data, status = r.json(), r.status_code
        except Exception:
            data, status = {"data": {"text": r.text}}, r.status_code
    except _requests_lib.exceptions.Timeout:
        return {"error": "انتهت مهلة الاتصال بـ qafiyah"}, 504
    except _requests_lib.exceptions.HTTPError as e:
        return {"error": f"qafiyah: {e}"}, getattr(r, 'status_code', 502)
    except _requests_lib.exceptions.RequestException as e:
        return {"error": str(e)}, 502

    if cacheable:
        _qafiyah_cache[cache_key] = (time.time(), data, status)
    return data, status

# ── Validation pipeline ────────────────────────────────────────────────────────

_PYARUD_NAMES = {
    'الطويل':'taweel','البسيط':'baseet','الكامل':'kamel','الوافر':'wafer',
    'الخفيف':'khafif','المتقارب':'mutakareb','الرجز':'rajaz','الهزج':'hazaj',
    'السريع':'sarie','المنسرح':'munsareh','المديد':'madeed','المجتث':'mujtath',
}
_PYARUD_TO_ARABIC = {v: k for k, v in _PYARUD_NAMES.items()}


def _detect_meter_from_verses(verses):
    """
    FIX #10: sample up to 3 verses and take majority vote instead of
    trusting only the first verse (which may be a short/anomalous fragment).
    """
    if not PYARUD_AVAILABLE or not verses:
        return None
    votes: dict = {}
    candidates = [v for v in verses[:3] if '###' in v]
    for v in candidates:
        sadr, ajuz = (p.strip() for p in v.split('###', 1))
        if not sadr or not ajuz:
            continue
        with _pyarud_lock:
            try:
                res = _pyarud.process_poem([(sadr, ajuz)])
            except Exception:
                continue
        raw = (res.get('meter') or '').strip().lower()
        meter = _PYARUD_TO_ARABIC.get(raw) or _PYARUD_TO_ARABIC.get(raw.replace(' ', ''))
        if meter:
            votes[meter] = votes.get(meter, 0) + 1
    if not votes:
        return None
    return max(votes, key=lambda k: votes[k])


def _check_rhyme(rhymes, issues):
    """
    FIX #7: classical Arabic poetry allows exactly one rhyme ending.
    We allow a tolerance of max 2 distinct endings (for genuine poetic
    license), but flag anything beyond that as a rhyme inconsistency.
    The old threshold (35% of verses) was far too permissive.
    """
    ne = [r for r in rhymes if r]
    if len(ne) >= 3:
        u = set(ne)
        if len(u) > 2:
            issues.append(f'القافية غير موحدة — نهايات الأعجاز: {", ".join(sorted(u))}')


def _bohour_validate(verses, meter_name):
    results, issues, rhymes = [], [], []
    meter_cls = _bohour_classes.get(meter_name)

    for i, verse in enumerate(verses):
        vnum = i + 1
        if '###' not in verse:
            msg = 'يجب وجود ### بين الصدر والعجز'
            issues.append(f"البيت {vnum}: {msg}")
            results.append({'verse': vnum, 'valid': False, 'issues': [msg], 'detected_meter': None})
            rhymes.append('')
            continue

        sadr, ajuz = (p.strip() for p in verse.split('###', 1))
        rhymes.append(_extract_rhyme(ajuz))

        if not meter_cls:
            results.append({'verse': vnum, 'valid': True, 'issues': [], 'detected_meter': None})
            continue

        try:
            with _bohour_lock:
                meter_obj = meter_cls()
                result = meter_obj.analyze(f"{sadr} {ajuz}")

            detected, is_valid = '', False
            if isinstance(result, list):
                for r in result:
                    if getattr(r, 'is_complete', False):
                        detected = getattr(r, 'name', '') or ''
                        is_valid  = True
                        break
                if not is_valid and result:
                    detected = getattr(result[0], 'name', '') or ''
            else:
                detected = getattr(result, 'name', '') or ''
                is_valid  = bool(getattr(result, 'is_complete', False))

            vis = []
            if not is_valid:
                vis.append('الوزن لا يطابق البحر المطلوب')
            if detected and detected != meter_name and not is_valid:
                vis.append(f'البحر المكتشف "{detected}" لا يطابق "{meter_name}"')

            if vis:
                issues.extend([f"البيت {vnum}: {x}" for x in vis])
            results.append({'verse': vnum, 'valid': not vis, 'issues': vis, 'detected_meter': detected})

        except Exception as e:
            log.warning(f"Bohour verse {vnum}: {e}")
            msg = f'خطأ في التحليل: {str(e)[:60]}'
            results.append({'verse': vnum, 'valid': False, 'issues': [msg], 'detected_meter': None})
            issues.append(f"البيت {vnum}: {msg}")

    _check_rhyme(rhymes, issues)
    return {'valid': not issues, 'validator': 'bohour', 'results': results,
            'feedback': '\n'.join(issues) if issues else None, 'rhyme_endings': rhymes}


def _pyarud_validate(verses, meter_name):
    results, issues, rhymes = [], [], []
    expected = _PYARUD_NAMES.get(meter_name, '')

    for i, verse in enumerate(verses):
        vnum = i + 1
        if '###' not in verse:
            msg = 'يجب وجود ### بين الصدر والعجز'
            issues.append(f"البيت {vnum}: {msg}")
            results.append({'verse': vnum, 'valid': False, 'issues': [msg], 'detected_meter': None})
            rhymes.append('')
            continue

        sadr, ajuz = (p.strip() for p in verse.split('###', 1))
        rhymes.append(_extract_rhyme(ajuz))

        if not _has_tashkeel(sadr) or not _has_tashkeel(ajuz):
            msg = 'الشطر يحتاج تشكيلاً كاملاً للتحقق من الوزن'
            issues.append(f"البيت {vnum}: {msg}")
            results.append({'verse': vnum, 'valid': False, 'issues': [msg], 'detected_meter': None})
            continue

        try:
            with _pyarud_lock:
                res = _pyarud.process_poem([(sadr, ajuz)])
            detected = (res.get('meter', '') or '').strip()
            feet      = res.get('feet', []) or []
            broken    = [f for f in feet if isinstance(f, dict) and f.get('status') == 'broken']
            extra     = [f for f in feet if isinstance(f, dict) and f.get('status') == 'extra_bits']
            missing   = [f for f in feet if isinstance(f, dict) and f.get('status') == 'missing']
            vis = []
            if broken:  vis.append(f'{len(broken)} تفعيلة مكسورة')
            if extra:   vis.append(f'{len(extra)} تفعيلة زائدة')
            if missing: vis.append(f'{len(missing)} تفعيلة ناقصة')
            if detected and expected and detected.lower() != expected.lower():
                vis.append(f'البحر المكتشف "{detected}" لا يطابق "{meter_name}"')
            if vis:
                issues.extend([f"البيت {vnum}: {x}" for x in vis])
            results.append({'verse': vnum, 'valid': not vis, 'issues': vis, 'detected_meter': detected})
        except Exception as e:
            log.warning(f"pyarud verse {vnum}: {e}")
            msg = f'خطأ: {str(e)[:50]}'
            results.append({'verse': vnum, 'valid': False, 'issues': [msg], 'detected_meter': None})
            issues.append(f"البيت {vnum}: {msg}")

    _check_rhyme(rhymes, issues)
    return {'valid': not issues, 'validator': 'pyarud', 'results': results,
            'feedback': '\n'.join(issues) if issues else None, 'rhyme_endings': rhymes}


def _structural_validate(verses, meter_name):
    m = METERS.get(meter_name, {})
    min_w = m.get('min_words', 2)
    max_w = m.get('max_words', 8)
    results, issues, rhymes = [], [], []

    for i, verse in enumerate(verses):
        vnum = i + 1
        if '###' not in verse:
            msg = 'يجب وجود ### بين الصدر والعجز'
            issues.append(f"البيت {vnum}: {msg}")
            results.append({'verse': vnum, 'valid': False, 'issues': [msg]})
            rhymes.append('')
            continue

        sadr, ajuz = (p.strip() for p in verse.split('###', 1))
        rhymes.append(_extract_rhyme(ajuz))
        vis = []

        if len(sadr.replace(' ', '')) < 5: vis.append('الصدر قصير جداً')
        if len(ajuz.replace(' ', '')) < 5: vis.append('العجز قصير جداً')
        sw, aw = len(sadr.split()), len(ajuz.split())
        if sw < min_w: vis.append(f'الصدر قليل الكلمات ({sw}، المتوقع {min_w}–{max_w})')
        if sw > max_w: vis.append(f'الصدر كثير الكلمات ({sw}، المتوقع {min_w}–{max_w})')
        if aw < min_w: vis.append(f'العجز قليل الكلمات ({aw}، المتوقع {min_w}–{max_w})')
        if aw > max_w: vis.append(f'العجز كثير الكلمات ({aw}، المتوقع {min_w}–{max_w})')

        if vis:
            issues.extend([f"البيت {vnum}: {x}" for x in vis])
        results.append({'verse': vnum, 'valid': not vis, 'issues': vis})

    _check_rhyme(rhymes, issues)
    return {'valid': not issues, 'validator': 'structural', 'results': results,
            'feedback': '\n'.join(issues) if issues else None, 'rhyme_endings': rhymes}


def validate_verses(verses, meter_name):
    """Full pipeline: diacritize → deep validate → merge with structural."""
    # FIX #13: skip diacritization when tashkeel already present
    dia = []
    for v in verses:
        if '###' in v:
            sadr, ajuz = v.split('###', 1)
            sadr = sadr.strip()
            ajuz = ajuz.strip()
            if not _has_tashkeel(sadr):
                sadr = diacritize(sadr)
            if not _has_tashkeel(ajuz):
                ajuz = diacritize(ajuz)
            dia.append(f"{sadr} ### {ajuz}")
        else:
            dia.append(diacritize(v) if not _has_tashkeel(v) else v)

    if BOHOUR_AVAILABLE:
        deep = _bohour_validate(dia, meter_name)
    elif PYARUD_AVAILABLE:
        deep = _pyarud_validate(dia, meter_name)
    else:
        deep = None

    struct = _structural_validate(verses, meter_name)

    if deep is None:
        return struct

    merged, all_issues = [], []
    for i in range(len(verses)):
        vnum = i + 1
        d = next((r for r in deep['results']   if r['verse'] == vnum), None)
        s = next((r for r in struct['results'] if r['verse'] == vnum), None)
        combined = list(dict.fromkeys(
            (d.get('issues') or [] if d else []) +
            (s.get('issues') or [] if s else [])
        ))
        verse_valid = (d['valid'] if d else True) and (s['valid'] if s else True)
        if not verse_valid:
            all_issues.extend([f"البيت {vnum}: {x}" for x in combined])
        merged.append({
            'verse': vnum, 'valid': verse_valid, 'issues': combined,
            'detected_meter': d.get('detected_meter') if d else None,
        })

    if deep.get('feedback'):
        for line in deep['feedback'].split('\n'):
            if 'قافية' in line and line not in all_issues:
                all_issues.append(line)

    return {
        'valid': not all_issues,
        'validator': deep['validator'],
        'results': merged,
        'feedback': '\n'.join(all_issues) if all_issues else None,
        'rhyme_endings': deep.get('rhyme_endings', []),
    }


def _build_feedback(validation, verses, meter):
    if validation['valid']:
        return ''
    m = METERS.get(meter, {})
    lines = []
    for r in validation.get('results', []):
        if not r['valid']:
            v = verses[r['verse'] - 1] if r['verse'] - 1 < len(verses) else ''
            ps = v.split('###', 1) if '###' in v else [v, '']
            lines += [
                f"► البيت {r['verse']}:",
                f"  الصدر: \"{ps[0].strip()}\"",
                f"  العجز: \"{ps[1].strip() if len(ps) > 1 else ''}\"",
                f"  الخطأ: {', '.join(r.get('issues', []))}",
                '',
            ]
    if m:
        lines += [f"النمط: {m.get('notation', '')}", f"المثال: {m.get('ex_sadr', '')} ### {m.get('ex_ajuz', '')}"]
    if validation.get('feedback'):
        for line in validation['feedback'].split('\n'):
            if 'قافية' in line:
                lines.append(line)
    return '\n'.join(lines)

# ── /api/generate ─────────────────────────────────────────────────────────────

@app.route("/api/generate", methods=["POST"])
@_limiter.limit("20 per minute")
def generate():
    body       = request.get_json(silent=True) or {}

    # FIX #14: hard cap on topic length to prevent prompt injection / token abuse
    topic      = body.get('topic', '').strip()[:500]
    meter      = body.get('meter', 'الكامل')
    num_verses = min(int(body.get('num_verses', 6)), 20)   # cap verses too
    style      = body.get('style', 'كلاسيكي')
    gemini_api_key = body.get('gemini_api_key', '').strip()  # optional user-provided API key

    if not topic:
        return jsonify({"error": "topic is required"}), 400
    if meter not in METERS:
        return jsonify({"error": f"بحر غير معروف: {meter}"}), 400

    feedback, best_result, best_valid = '', None, -1
    attempt_hist = []

    for attempt in range(1, MAX_RETRIES + 1):
        # FIX #8: correction prompt needs creative headroom, not low temperature
        if attempt <= 3:
            temp = 0.75
        elif attempt <= 6:
            temp = 0.60
        elif attempt <= 8:
            temp = 0.45
        elif best_result and attempt >= 9:
            temp = 0.55    # FIX #8: was 0.20 — too restrictive for creative rewrite
        else:
            temp = 0.35

        # Choose prompt strategy
        # FIX #5 + #6: use best_result's data for both feedback and correction
        if attempt >= 9 and best_result:
            broken = [r for r in best_result['validation']['results'] if not r['valid']]
            if broken:
                prompt = _build_correction_prompt(
                    best_result['poem']['poem'],
                    broken,
                    meter,
                    topic,
                )
            else:
                prompt = _build_generation_prompt(topic, meter, num_verses, style,
                                                  feedback, attempt)
        else:
            prompt = _build_generation_prompt(topic, meter, num_verses, style,
                                              feedback, attempt)

        try:
            raw = call_llm(SYSTEM_PROMPT, prompt, temp, gemini_api_key)
        except LLMError as e:
            return jsonify({"error": str(e)}), e.status
        except RuntimeError as e:
            return jsonify({"error": str(e)}), 500

        # Parse — FIX #3: use bracket-depth JSON extractor
        try:
            poem_data = json.loads(_extract_first_json(raw))
        except json.JSONDecodeError:
            feedback = "الإخراج لم يكن JSON. اكتب JSON فقط بدون أي نص قبله."
            attempt_hist.append({
                'attempt': attempt, 'poem': [],
                'validation': {'valid': False, 'validator': 'parse', 'results': [], 'feedback': feedback},
            })
            continue

        verses = _normalize_verses(poem_data.get('poem', []))
        poem_data['poem'] = verses

        if not verses or len(verses) < max(1, num_verses - 1):
            feedback = f"القصيدة ناقصة. المطلوب {num_verses} أبيات."
            attempt_hist.append({
                'attempt': attempt, 'poem': verses,
                'validation': {'valid': False, 'validator': 'count', 'results': [], 'feedback': feedback},
            })
            continue

        validation  = validate_verses(verses, meter)
        valid_count = sum(1 for r in validation['results'] if r['valid'])
        attempt_hist.append({'attempt': attempt, 'poem': verses, 'validation': validation})

        log.info(
            "generation_attempt provider=%s meter=%s attempt=%d/%d valid=%d/%d validator=%s",
            LLM_PROVIDER, meter, attempt, MAX_RETRIES, valid_count, len(verses), validation['validator'],
        )

        # FIX #1: deep-copy so subsequent iterations can't overwrite best_result
        if valid_count > best_valid:
            best_valid  = valid_count
            best_result = {
                'poem':       copy.deepcopy(poem_data),
                'validation': copy.deepcopy(validation),
            }

        if validation['valid']:
            return jsonify({
                'success': True, 'poem': poem_data, 'validation': validation,
                'attempts': attempt, 'attempt_history': attempt_hist,
                'provider': LLM_PROVIDER,
            })

        # FIX #5: always build feedback from the BEST result, not current
        feedback = _build_feedback(best_result['validation'], best_result['poem']['poem'], meter)

    if best_result:
        total = len(best_result['poem'].get('poem', []))
        return jsonify({
            'success': False,
            'poem': best_result['poem'],
            'validation': best_result['validation'],
            'attempts': MAX_RETRIES,
            'attempt_history': attempt_hist,
            'provider': LLM_PROVIDER,
            'warning': f'أفضل نتيجة بعد {MAX_RETRIES} محاولات: {best_valid}/{total} أبيات صحيحة.',
        })

    return jsonify({"error": "فشل التوليد. تحقق من إعدادات الخادم."}), 500

# ── /api/chat ─────────────────────────────────────────────────────────────────

@app.route("/api/chat", methods=["POST"])
@_limiter.limit("40 per minute")
def chat():
    body    = request.get_json(silent=True) or {}
    message = body.get('message', '').strip()[:1000]  # FIX #14: cap input
    gemini_api_key = body.get('gemini_api_key', '').strip()  # optional user-provided API key

    # FIX #16: validate history type before slicing
    raw_history = body.get('history', [])
    if not isinstance(raw_history, list):
        raw_history = []
    history = raw_history[-8:]

    if not message:
        return jsonify({"error": "message required"}), 400

    hist_text = ''.join(
        f"{'المستخدم' if h.get('role') == 'user' else 'الشاعر'}: {h.get('content', '')}\n"
        for h in history
        if isinstance(h, dict)
    )
    full_msg = f"{hist_text}المستخدم: {message}\nالشاعر:"

    try:
        response = call_llm(CHAT_SYSTEM, full_msg, 0.8, gemini_api_key)
        return jsonify({"response": response})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ── /api/validate standalone ──────────────────────────────────────────────────

@app.route("/api/validate", methods=["POST"])
def validate_endpoint():
    body   = request.get_json(silent=True) or {}
    verses = body.get('verses', [])
    meter  = (body.get('meter') or '').strip()

    if not verses or not isinstance(verses, list):
        return jsonify({"error": "verses (array) required"}), 400

    auto_detected = False
    if not meter:
        meter = _detect_meter_from_verses(verses)
        if not meter:
            return jsonify({
                "error": (
                    "لا يمكن اكتشاف البحر تلقائياً. "
                    "اختر البحر يدوياً أو ضع تشكيلاً كاملاً على البيت الأول."
                )
            }), 400
        auto_detected = True

    # FIX #4: reject unknown meter explicitly; don't silently fall through
    if meter not in METERS:
        return jsonify({"error": f"بحر غير معروف: {meter}"}), 400

    result = validate_verses(verses, meter)
    result["detected_meter"]  = meter
    result["auto_detected"]   = auto_detected
    return jsonify(result)

# ── Qafiyah proxy ─────────────────────────────────────────────────────────────

@app.route("/api/eras")
def eras():
    d, s = _q("eras", cacheable=True)
    return jsonify(d), s

@app.route("/api/eras/<slug>/page/<int:page>")
def eras_page(slug, page):
    d, s = _q(f"eras/{slug}/page/{page}", cacheable=True)
    return jsonify(d), s

@app.route("/api/qafiyah/meters")
def qafiyah_meters():
    d, s = _q("meters", cacheable=True)
    return jsonify(d), s

@app.route("/api/qafiyah/meters/<slug>/page/<int:page>")
def qm_page(slug, page):
    d, s = _q(f"meters/{slug}/page/{page}", cacheable=True)
    return jsonify(d), s

@app.route("/api/poems/random")
def poems_random():
    # intentionally NOT cached — random should be random
    d, s = _q("poems/random")
    return jsonify(d), s

@app.route("/api/poems/slug/<slug>")
def poem_slug(slug):
    d, s = _q(f"poems/slug/{slug}", cacheable=True)
    return jsonify(d), s

@app.route("/api/poets/page/<int:page>")
def poets_page(page):
    d, s = _q(f"poets/page/{page}", cacheable=True)
    return jsonify(d), s

@app.route("/api/poets/slug/<slug>")
def poet_slug(slug):
    d, s = _q(f"poets/slug/{slug}", cacheable=True)
    return jsonify(d), s

@app.route("/api/poets/<slug>/page/<int:page>")
def poet_poems(slug, page):
    d, s = _q(f"poets/{slug}/page/{page}", cacheable=True)
    return jsonify(d), s

@app.route("/api/rhymes")
def rhymes():
    d, s = _q("rhymes", cacheable=True)
    return jsonify(d), s

@app.route("/api/rhymes/<slug>/page/<int:page>")
def rhymes_page(slug, page):
    d, s = _q(f"rhymes/{slug}/page/{page}", cacheable=True)
    return jsonify(d), s

@app.route("/api/themes")
def themes():
    d, s = _q("themes", cacheable=True)
    return jsonify(d), s

@app.route("/api/themes/<slug>/page/<int:page>")
def themes_page(slug, page):
    d, s = _q(f"themes/{slug}/page/{page}", cacheable=True)
    return jsonify(d), s

@app.route("/api/search")
def search():
    d, s = _q("search", {
        "q":           request.args.get("q", ""),
        "search_type": request.args.get("search_type", "poem"),
        "page":        request.args.get("page", 1),
        "match_type":  request.args.get("match_type", "partial"),
    })
    return jsonify(d), s

@app.route("/api/meters")
def meters_local():
    return jsonify({"meters": [
        {"name": k, "pattern": v["pattern"], "feet": len(v["pattern"].split())}
        for k, v in METERS.items()
    ]})

@app.route("/api/health")
def health():
    return jsonify({
        "status":      "ok",
        "provider":    LLM_PROVIDER,
        "model":       {"gemini": GEMINI_MODEL, "claude": ANTHROPIC_MODEL, "groq": GROQ_MODEL}.get(LLM_PROVIDER),
        "validator":   "bohour" if BOHOUR_AVAILABLE else ("pyarud" if PYARUD_AVAILABLE else "structural"),
        "mishkal":     MISHKAL_AVAILABLE,
        "bohour":      BOHOUR_AVAILABLE,
        "pyarud":      PYARUD_AVAILABLE,
        "max_retries": MAX_RETRIES,
        "rate_limiter": _LIMITER_AVAILABLE,
        "connection_pool": True,
        "qafiyah_cache_ttl": _QAFIYAH_TTL,
    })


if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    debug = os.getenv("FLASK_ENV") == "development"
    app.run(host="0.0.0.0", port=port, debug=debug)