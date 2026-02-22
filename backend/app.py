"""
ديوان الذكاء — Arabic Poetry Platform
Backend: Flask + Gemini 1.5 Flash (google-genai new SDK)
Free tier optimized: auto-retry with backoff on 429 errors
"""

import os, json, time, re, logging
from typing import Optional
from flask import Flask, request, jsonify
from flask_cors import CORS
from google import genai
from google.genai import types
import requests
from dotenv import load_dotenv

load_dotenv()

# ── App ────────────────────────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger(__name__)

# ── Config ─────────────────────────────────────────────────────────────────────
GEMINI_API_KEY  = os.getenv("GEMINI_API_KEY", "")
QAFIYAH_BASE    = "https://api.qafiyah.com"
MAX_RETRIES     = int(os.getenv("MAX_RETRIES", "3"))
REQUEST_TIMEOUT = 15

# gemini-1.5-flash: best free tier limits (15 RPM, 1500 RPD)
# gemini-2.0-flash: newer but stricter limits on new accounts (10 RPM)
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash-latest")

# Free tier rate limit: wait this many seconds between API calls
# gemini-1.5-flash free = 15 req/min → 1 req every 4 seconds is safe
API_CALL_DELAY = float(os.getenv("API_CALL_DELAY", "4"))

if not GEMINI_API_KEY:
    log.warning("⚠  GEMINI_API_KEY not set — generation endpoints will return 503")
    client = None
else:
    client = genai.Client(api_key=GEMINI_API_KEY)

# ── Arabic Meters ──────────────────────────────────────────────────────────────
METERS = {
    "الطويل":    {"pattern": "فَعُولُنْ مَفَاعِيلُنْ فَعُولُنْ مَفَاعِيلُنْ", "feet": 4},
    "البسيط":    {"pattern": "مُسْتَفْعِلُنْ فَاعِلُنْ مُسْتَفْعِلُنْ فَاعِلُنْ", "feet": 4},
    "الكامل":    {"pattern": "مُتَفَاعِلُنْ مُتَفَاعِلُنْ مُتَفَاعِلُنْ", "feet": 3},
    "الوافر":    {"pattern": "مُفَاعَلَتُنْ مُفَاعَلَتُنْ فَعُولُنْ", "feet": 3},
    "الخفيف":    {"pattern": "فَاعِلَاتُنْ مُسْتَفْعِلُنْ فَاعِلَاتُنْ", "feet": 3},
    "المتقارب":  {"pattern": "فَعُولُنْ فَعُولُنْ فَعُولُنْ فَعُولُنْ", "feet": 4},
    "الرجز":     {"pattern": "مُسْتَفْعِلُنْ مُسْتَفْعِلُنْ مُسْتَفْعِلُنْ", "feet": 3},
    "الهزج":     {"pattern": "مَفَاعِيلُنْ مَفَاعِيلُنْ", "feet": 2},
    "السريع":    {"pattern": "مُسْتَفْعِلُنْ مُسْتَفْعِلُنْ فَاعِلُنْ", "feet": 3},
    "المنسرح":   {"pattern": "مُسْتَفْعِلُنْ مَفْعُولَاتُ مُسْتَفْعِلُنْ", "feet": 3},
    "المديد":    {"pattern": "فَاعِلَاتُنْ فَاعِلُنْ فَاعِلَاتُنْ", "feet": 3},
    "المجتث":    {"pattern": "مُسْتَفْعِلُنْ فَاعِلَاتُنْ", "feet": 2},
}

# ── System Prompts ─────────────────────────────────────────────────────────────
POEM_SYSTEM = """\
أنت شاعر عربي متمكّن ومرجع في علم العروض والقوافي. معرفتك شاملة بكل شعراء العرب عبر العصور.

قواعد صارمة:
١. لا تتكلم إلا بالعربية الفصحى.
٢. كل بيت يُكتب هكذا: الصدر ### العجز
٣. يلتزم كل بيت بالتفعيلة المطلوبة بدقة.
٤. القافية موحّدة في نهاية كل عجز.
٥. لا تضع أي نص خارج كتلة JSON.

صيغة الإخراج — JSON فقط:
{
  "poem": ["الصدر الأول ### العجز الأول", "الصدر الثاني ### العجز الثاني"],
  "meter": "اسم البحر",
  "rhyme_letter": "حرف الروي",
  "rhyme_word_examples": ["كلمة1", "كلمة2"],
  "theme": "الغرض الشعري",
  "explanation": "شرح موجز للصور الشعرية والأسلوب"
}
"""

CHAT_SYSTEM = """\
أنت شاعر عربي متمكّن ومرجع في علم العروض والقوافي. معرفتك شاملة بكل شعراء العرب عبر العصور:
الجاهلي (امرؤ القيس، زهير، عنترة)، الأموي (جرير، الفرزدق)، العباسي (المتنبي، أبو تمام، البحتري)، والحديث (شوقي، درويش، قباني).

قواعد:
١. تكلم بالعربية الفصحى دائماً.
٢. كن معلماً صبوراً في شرح العروض والبلاغة.
٣. اذكر أمثلة شعرية من التراث عند الشرح.
٤. إذا طُلب منك إنشاء بيت شعري، فالتزم بالوزن والقافية.
"""


# ── Helpers ────────────────────────────────────────────────────────────────────
def _clean_json(text: str) -> str:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    start = text.find("{")
    end   = text.rfind("}")
    if start != -1 and end != -1:
        text = text[start:end+1]
    return text.strip()


def _is_quota_error(msg: str) -> bool:
    msg = msg.lower()
    return any(k in msg for k in ["quota", "rate limit", "resource_exhausted", "429", "too many"])


def _parse_retry_seconds(msg: str) -> int:
    """Extract retry delay from error message, default to 15s for free tier."""
    m = re.search(r"retry in (\d+(?:\.\d+)?)s", msg)
    if not m:
        m = re.search(r"retry_delay\s*\{\s*seconds:\s*(\d+)", msg)
    if m:
        try:
            return max(5, int(float(m.group(1))))
        except Exception:
            pass
    return 15  # safe default for free tier


def _call_gemini_with_retry(model: str, contents, config, max_api_retries: int = 3) -> str:
    """Call Gemini API with automatic retry on 429 rate limit errors."""
    for api_attempt in range(1, max_api_retries + 1):
        try:
            response = client.models.generate_content(
                model=model,
                contents=contents,
                config=config,
            )
            return response.text
        except Exception as e:
            msg = str(e)
            if _is_quota_error(msg):
                wait = _parse_retry_seconds(msg)
                log.warning(f"Rate limited (attempt {api_attempt}/{max_api_retries}). "
                            f"Waiting {wait}s before retry...")
                if api_attempt < max_api_retries:
                    time.sleep(wait)
                    continue
            raise  # re-raise if not quota error or exhausted retries
    raise Exception("استنفدت كل محاولات إعادة الاتصال بسبب تجاوز الحصة")


# ── Gemini API Calls ───────────────────────────────────────────────────────────
def generate_poem_gemini(topic: str, meter: str, num_verses: int,
                         style: str, feedback: Optional[str] = None) -> dict:
    pattern = METERS.get(meter, {}).get("pattern", "")
    feedback_block = ""
    if feedback:
        feedback_block = f"ملاحظات على المحاولة السابقة:\n{feedback}\n---\n"

    prompt = f"""{feedback_block}
اكتب قصيدة عربية فصيحة بهذه المواصفات:

• الموضوع: {topic}
• البحر الشعري: {meter}
• التفعيلة: {pattern}
• عدد الأبيات: {num_verses}
• الأسلوب: {style}

شروط إلزامية:
- كل بيت: شطر أول ### شطر ثانٍ
- القافية موحّدة في نهاية كل عجز
- الوزن ملتزم به بدقة
- اللغة عربية فصحى رفيعة

أعط النتيجة بصيغة JSON فقط.
"""
    config = types.GenerateContentConfig(
        system_instruction=POEM_SYSTEM,
        temperature=0.85,
        top_p=0.95,
        max_output_tokens=3000,
    )
    text = _call_gemini_with_retry(GEMINI_MODEL, prompt, config)
    return json.loads(_clean_json(text))


def chat_gemini(message: str, history: list) -> str:
    contents = []
    for h in history:
        role = "user" if h["role"] == "user" else "model"
        contents.append(types.Content(role=role, parts=[types.Part(text=h["content"])]))
    contents.append(types.Content(role="user", parts=[types.Part(text=message)]))

    config = types.GenerateContentConfig(
        system_instruction=CHAT_SYSTEM,
        temperature=0.8,
        top_p=0.9,
        max_output_tokens=2000,
    )
    return _call_gemini_with_retry(GEMINI_MODEL, contents, config)


# ── Validator ──────────────────────────────────────────────────────────────────
def validate_poem(poem_lines: list, expected_meter: str) -> dict:
    try:
        from qawafi_backend.bohour.poem import Poem as QawafiPoem
        results, issues, all_valid = [], [], True
        for i, line in enumerate(poem_lines):
            if "###" not in line:
                all_valid = False
                issues.append(f"البيت {i+1}: يجب أن يحتوي على ###")
                results.append({"verse": i+1, "valid": False, "error": "missing separator"})
                continue
            full_verse = line.replace("###", " ").strip()
            try:
                qp = QawafiPoem([full_verse])
                analysis = qp.analyze()
                detected = analysis.get("meter", "غير معروف")
                is_ok = (expected_meter in detected) or (detected in expected_meter)
                if not is_ok:
                    all_valid = False
                    issues.append(f"البيت {i+1}: بحر '{detected}' بدل '{expected_meter}'")
                results.append({"verse": i+1, "valid": is_ok, "detected_meter": detected})
            except Exception as ve:
                results.append({"verse": i+1, "valid": False, "error": str(ve)})
                all_valid = False
        return {"valid": all_valid, "validator": "qawafi", "results": results,
                "feedback": "\n".join(issues) if issues else None}
    except ImportError:
        return _rule_based_validate(poem_lines, expected_meter)
    except Exception as e:
        log.warning(f"qawafi error: {e}")
        return _rule_based_validate(poem_lines, expected_meter)


def _rule_based_validate(poem_lines: list, expected_meter: str) -> dict:
    results, all_issues, rhyme_endings = [], [], []
    for i, line in enumerate(poem_lines):
        verse_issues = []
        if "###" not in line:
            verse_issues.append("يجب الفصل بين الشطرين بـ ###")
        else:
            parts = [p.strip() for p in line.split("###")]
            if len(parts) != 2:
                verse_issues.append("يجب أن يكون هناك شطران فقط")
            else:
                sadr, ajuz = parts
                if len(sadr.split()) < 2:
                    verse_issues.append("الصدر قصير جداً")
                if len(ajuz.split()) < 2:
                    verse_issues.append("العجز قصير جداً")
                words = ajuz.split()
                if words:
                    last = words[-1].rstrip(".,،؟!:")
                    rhyme_endings.append(last[-2:] if len(last) >= 2 else last)
        valid = len(verse_issues) == 0
        if not valid:
            all_issues.extend([f"البيت {i+1}: {iss}" for iss in verse_issues])
        results.append({"verse": i+1, "valid": valid, "issues": verse_issues})
    if len(rhyme_endings) >= 3:
        unique = set(rhyme_endings)
        if len(unique) > max(2, len(rhyme_endings) // 3):
            all_issues.append(f"القافية غير منتظمة: {', '.join(unique)}")
    return {"valid": len(all_issues) == 0, "validator": "rule-based", "results": results,
            "feedback": "\n".join(all_issues) if all_issues else None,
            "rhyme_endings": rhyme_endings}


# ── Routes ─────────────────────────────────────────────────────────────────────
@app.route("/api/generate", methods=["POST"])
def generate():
    if not client:
        return jsonify({"error": "GEMINI_API_KEY غير مُعيَّن. أضفه في ملف .env"}), 503

    data       = request.get_json(force=True) or {}
    topic      = (data.get("topic") or "").strip()
    meter      = data.get("meter", "الطويل")
    num_verses = max(2, min(int(data.get("num_verses", 6)), 16))
    style      = data.get("style", "كلاسيكي")

    if not topic:
        return jsonify({"error": "الموضوع مطلوب"}), 400
    if meter not in METERS:
        return jsonify({"error": f"البحر '{meter}' غير معروف"}), 400

    history: list = []
    feedback: Optional[str] = None

    for attempt in range(1, MAX_RETRIES + 1):
        log.info(f"[gen] attempt {attempt}/{MAX_RETRIES} — meter={meter} topic={topic[:30]}")
        # Respect free tier rate limits between poem attempts
        if attempt > 1:
            time.sleep(API_CALL_DELAY)
        try:
            poem_data  = generate_poem_gemini(topic, meter, num_verses, style, feedback)
            lines      = poem_data.get("poem", [])
            if not lines:
                feedback = "القصيدة فارغة. يجب أن تحتوي على أبيات."
                continue
            validation = validate_poem(lines, meter)
            history.append({"attempt": attempt, "poem": lines, "validation": validation})
            if validation["valid"]:
                log.info(f"[gen] ✓ valid on attempt {attempt}")
                return jsonify({"success": True, "poem": poem_data, "validation": validation,
                                "attempts": attempt, "attempt_history": history})
            feedback = validation.get("feedback") or "يرجى مراجعة الوزن والقافية."
        except json.JSONDecodeError as e:
            log.warning(f"[gen] JSON error attempt {attempt}: {e}")
            feedback = "الإخراج لم يكن JSON صحيحاً. استخدم JSON فقط."
        except Exception as e:
            msg = str(e)
            log.error(f"[gen] error attempt {attempt}: {e}")
            # If still rate limited after internal retries, return error to frontend
            if _is_quota_error(msg):
                wait = _parse_retry_seconds(msg)
                return jsonify({
                    "error": f"الحصة المجانية مشغولة — انتظر {wait} ثانية وأعد المحاولة.",
                    "retry_after": wait,
                    "detail": msg
                }), 429
            feedback = f"خطأ: {e}."

    last = history[-1] if history else {}
    return jsonify({"success": False, "poem": last.get("poem", {}),
                    "validation": last.get("validation", {}),
                    "attempts": MAX_RETRIES, "attempt_history": history,
                    "warning": "لم تجتز القصيدة كل الفحوصات — هذه أفضل محاولة."})


@app.route("/api/chat", methods=["POST"])
def chat():
    if not client:
        return jsonify({"error": "GEMINI_API_KEY غير مُعيَّن"}), 503

    data    = request.get_json(force=True) or {}
    message = (data.get("message") or "").strip()
    history = data.get("history", [])

    if not message:
        return jsonify({"error": "الرسالة فارغة"}), 400

    # Small delay to respect free tier limits
    time.sleep(API_CALL_DELAY)

    try:
        reply = chat_gemini(message, history)
        return jsonify({"response": reply})
    except Exception as e:
        msg = str(e)
        log.error(f"[chat] {msg}")
        if _is_quota_error(msg):
            wait = _parse_retry_seconds(msg)
            return jsonify({
                "error": f"الحصة المجانية مشغولة — انتظر {wait} ثانية وأعد المحاولة.",
                "retry_after": wait,
            }), 429
        return jsonify({"error": msg}), 500


# ── Qafiyah Proxy ──────────────────────────────────────────────────────────────
def qafiyah(path: str, params: dict = None):
    url = f"{QAFIYAH_BASE}/{path.lstrip('/')}"
    try:
        r = requests.get(url, params=params, timeout=REQUEST_TIMEOUT,
                         headers={"Accept": "application/json", "User-Agent": "Diwan/1.0"})
        r.raise_for_status()
        try:
            return r.json(), r.status_code
        except ValueError:
            return {"data": {"text": r.text}}, r.status_code
    except requests.exceptions.Timeout:
        return {"error": "انتهت مهلة الاتصال بـ qafiyah"}, 504
    except requests.exceptions.HTTPError as e:
        return {"error": f"qafiyah: {e}"}, getattr(r, 'status_code', 502)
    except requests.exceptions.RequestException as e:
        return {"error": str(e)}, 502


@app.route("/api/eras")
def eras():
    data, status = qafiyah("eras"); return jsonify(data), status

@app.route("/api/eras/<slug>/page/<int:page>")
def eras_page(slug, page):
    data, status = qafiyah(f"eras/{slug}/page/{page}"); return jsonify(data), status

@app.route("/api/qafiyah/meters")
def qafiyah_meters():
    data, status = qafiyah("meters"); return jsonify(data), status

@app.route("/api/qafiyah/meters/<slug>/page/<int:page>")
def qafiyah_meters_page(slug, page):
    data, status = qafiyah(f"meters/{slug}/page/{page}"); return jsonify(data), status

@app.route("/api/poems/random")
def poems_random():
    data, status = qafiyah("poems/random"); return jsonify(data), status

@app.route("/api/poems/slug/<slug>")
def poem_by_slug(slug):
    data, status = qafiyah(f"poems/slug/{slug}"); return jsonify(data), status

@app.route("/api/poets/page/<int:page>")
def poets_page(page):
    data, status = qafiyah(f"poets/page/{page}"); return jsonify(data), status

@app.route("/api/poets/slug/<slug>")
def poet_by_slug(slug):
    data, status = qafiyah(f"poets/slug/{slug}"); return jsonify(data), status

@app.route("/api/poets/<slug>/page/<int:page>")
def poet_poems(slug, page):
    data, status = qafiyah(f"poets/{slug}/page/{page}"); return jsonify(data), status

@app.route("/api/rhymes")
def rhymes():
    data, status = qafiyah("rhymes"); return jsonify(data), status

@app.route("/api/rhymes/<slug>/page/<int:page>")
def rhymes_page(slug, page):
    data, status = qafiyah(f"rhymes/{slug}/page/{page}"); return jsonify(data), status

@app.route("/api/themes")
def themes():
    data, status = qafiyah("themes"); return jsonify(data), status

@app.route("/api/themes/<slug>/page/<int:page>")
def themes_page(slug, page):
    data, status = qafiyah(f"themes/{slug}/page/{page}"); return jsonify(data), status

@app.route("/api/search")
def search():
    params = {"q": request.args.get("q", ""), "search_type": request.args.get("search_type", "poem"),
              "page": request.args.get("page", 1), "match_type": request.args.get("match_type", "partial")}
    data, status = qafiyah("search", params); return jsonify(data), status

@app.route("/api/meters")
def meters_local():
    return jsonify({"meters": [{"name": k, "pattern": v["pattern"], "feet": v["feet"]}
                                for k, v in METERS.items()]})

@app.route("/api/health")
def health():
    return jsonify({"status": "ok", "gemini_configured": bool(GEMINI_API_KEY),
                    "gemini_model": GEMINI_MODEL, "max_retries": MAX_RETRIES,
                    "api_call_delay": API_CALL_DELAY})


if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=os.getenv("FLASK_ENV") == "development")