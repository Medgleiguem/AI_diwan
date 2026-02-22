"""
ديوان الذكاء — Arabic Poetry Platform
Backend: Flask + Gemini + qawafi + qafiyah API
"""

import os, json, time, re, logging
from typing import Optional
from flask import Flask, request, jsonify
from flask_cors import CORS
import google.generativeai as genai
import requests
from dotenv import load_dotenv

load_dotenv()

# ── App ────────────────────────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger(__name__)

# ── Config ─────────────────────────────────────────────────────────────────────
GEMINI_API_KEY      = os.getenv("GEMINI_API_KEY", "")
QAFIYAH_BASE        = "https://api.qafiyah.com"
MAX_RETRIES         = int(os.getenv("MAX_RETRIES", "5"))
REQUEST_TIMEOUT     = 15

if not GEMINI_API_KEY:
    log.warning("⚠  GEMINI_API_KEY not set — generation endpoints will return 503")
else:
    genai.configure(api_key=GEMINI_API_KEY)

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

# ── Gemini Poet Wrapper ────────────────────────────────────────────────────────
SYSTEM_PROMPT = """\
أنت شاعر عربي متمكّن ومرجع في علم العروض والقوافي. معرفتك شاملة بكل شعراء العرب عبر العصور:
الجاهلي (امرؤ القيس، زهير، عنترة)، الأموي (جرير، الفرزدق، الأخطل)، العباسي (المتنبي، أبو تمام، البحتري، أبو نواس)،
والحديث (شوقي، حافظ، درويش، قباني).

**قواعد صارمة لا تُخالَف أبداً:**

١. لا تتكلم إلا بالعربية الفصحى في كل ردودك دون استثناء.
٢. عند توليد قصيدة، يكتب كل بيت هكذا بالضبط:
   الشطر الأول (الصدر) ### الشطر الثاني (العجز)
   — الفاصل هو ثلاث علامات مائزة: ###
٣. يجب أن يلتزم كل بيت بالتفعيلة المطلوبة بدقة.
٤. القافية (حرف الروي) يجب أن تكون موحّدة في نهاية كل عجز.
٥. لا تضع أي نص خارج كتلة JSON عند طلب القصيدة.

**صيغة الإخراج عند طلب قصيدة — JSON فقط، لا شيء غيره:**
{
  "poem": [
    "الصدر الأول ### العجز الأول",
    "الصدر الثاني ### العجز الثاني"
  ],
  "meter": "اسم البحر",
  "rhyme_letter": "حرف الروي",
  "rhyme_word_examples": ["كلمة1", "كلمة2"],
  "theme": "الغرض الشعري",
  "explanation": "شرح موجز للصور الشعرية والأسلوب"
}
"""


class ArabicPoetGemini:
    def __init__(self):
        self.model = genai.GenerativeModel(
            model_name="gemini-2.0-flash",
            system_instruction=SYSTEM_PROMPT,
            generation_config=genai.types.GenerationConfig(
                temperature=0.85,
                top_p=0.95,
                max_output_tokens=3000,
            ),
        )

    def _clean_json(self, text: str) -> str:
        """Strip markdown fences and extract JSON object."""
        text = text.strip()
        # Remove ```json ... ``` or ``` ... ```
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
        # Find the first { and last }
        start = text.find("{")
        end   = text.rfind("}")
        if start != -1 and end != -1:
            text = text[start:end+1]
        return text.strip()

    def generate_poem(self, topic: str, meter: str, num_verses: int,
                      style: str, feedback: Optional[str] = None) -> dict:
        pattern = METERS.get(meter, {}).get("pattern", "")
        feedback_block = ""
        if feedback:
            feedback_block = f"""
⚠️ ملاحظات المحلل على المحاولة السابقة — يجب تصحيحها:
{feedback}
---
"""
        prompt = f"""{feedback_block}
اكتب قصيدة عربية فصيحة بهذه المواصفات الدقيقة:

• الموضوع: {topic}
• البحر الشعري: {meter}
• التفعيلة: {pattern}
• عدد الأبيات: {num_verses}
• الأسلوب: {style}

شروط إلزامية:
- كل بيت يتكون من شطرين مفصولين بـ ###
- القافية موحّدة في نهاية كل عجز
- الوزن الشعري ملتزم به في كل بيت بدقة تامة
- اللغة عربية فصحى رفيعة

أعط النتيجة بصيغة JSON فقط، لا تكتب أي شيء خارج الـ JSON.
"""
        response = self.model.generate_content(prompt)
        cleaned = self._clean_json(response.text)
        return json.loads(cleaned)

    def chat(self, message: str, history: list) -> str:
        formatted_history = []
        for h in history:
            role = "user" if h["role"] == "user" else "model"
            formatted_history.append({"role": role, "parts": [h["content"]]})
        chat_session = self.model.start_chat(history=formatted_history)
        resp = chat_session.send_message(message)
        return resp.text


_poet: Optional[ArabicPoetGemini] = None

def get_poet() -> Optional[ArabicPoetGemini]:
    global _poet
    if _poet is None and GEMINI_API_KEY:
        _poet = ArabicPoetGemini()
    return _poet


# ── qawafi Validator ───────────────────────────────────────────────────────────
def validate_with_qawafi(poem_lines: list, expected_meter: str) -> dict:
    """
    Try to use qawafi (ARBML) for validation.
    Install: pip install git+https://github.com/ARBML/qawafi.git
    Falls back to rule-based validator if not installed.
    """
    try:
        # qawafi exposes a high-level analyze function
        from qawafi_backend.bohour.poem import Poem as QawafiPoem

        results = []
        all_valid = True
        issues = []

        for i, line in enumerate(poem_lines):
            if "###" not in line:
                all_valid = False
                issues.append(f"البيت {i+1}: يجب أن يحتوي على ### للفصل بين الشطرين")
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
                    issues.append(
                        f"البيت {i+1}: تم رصد بحر '{detected}' بدل '{expected_meter}'"
                    )
                results.append({
                    "verse": i+1, "valid": is_ok,
                    "detected_meter": detected,
                    "arudi_style": analysis.get("arudi_style", ""),
                })
            except Exception as ve:
                log.debug(f"qawafi verse error: {ve}")
                results.append({"verse": i+1, "valid": False, "error": str(ve)})
                all_valid = False
                issues.append(f"البيت {i+1}: تعذّر تحليله ({ve})")

        return {
            "valid": all_valid,
            "validator": "qawafi",
            "results": results,
            "feedback": "\n".join(issues) if issues else None,
        }

    except ImportError:
        log.info("qawafi not installed — using rule-based validator")
        return _rule_based_validate(poem_lines, expected_meter)
    except Exception as e:
        log.warning(f"qawafi crashed: {e} — falling back to rule-based")
        return _rule_based_validate(poem_lines, expected_meter)


def _rule_based_validate(poem_lines: list, expected_meter: str) -> dict:
    """
    Rule-based Arabic prosody validator.
    Checks: separator presence, hemistich length, rhyme consistency.
    """
    results = []
    all_issues = []

    rhyme_endings = []

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
                # Minimum 3 words per hemistich
                if len(sadr.split()) < 2:
                    verse_issues.append("الصدر قصير جداً")
                if len(ajuz.split()) < 2:
                    verse_issues.append("العجز قصير جداً")
                # Collect rhyme
                words = ajuz.split()
                if words:
                    last = words[-1].rstrip(".,،؟!:")
                    # Last 2 chars as rhyme fingerprint
                    rhyme_endings.append(last[-2:] if len(last) >= 2 else last)

        valid = len(verse_issues) == 0
        if not valid:
            all_issues.extend([f"البيت {i+1}: {iss}" for iss in verse_issues])

        results.append({"verse": i+1, "valid": valid, "issues": verse_issues})

    # Rhyme consistency check
    if len(rhyme_endings) >= 3:
        unique = set(rhyme_endings)
        if len(unique) > max(2, len(rhyme_endings) // 3):
            all_issues.append(
                f"القافية غير منتظمة — نهايات متباينة: {', '.join(unique)}"
            )

    return {
        "valid": len(all_issues) == 0,
        "validator": "rule-based",
        "results": results,
        "feedback": "\n".join(all_issues) if all_issues else None,
        "rhyme_endings": rhyme_endings,
    }


# ── Generation Route ───────────────────────────────────────────────────────────
@app.route("/api/generate", methods=["POST"])
def generate():
    poet = get_poet()
    if not poet:
        return jsonify({"error": "GEMINI_API_KEY غير مُعيَّن. أضفه في ملف .env"}), 503

    data        = request.get_json(force=True) or {}
    topic       = (data.get("topic") or "").strip()
    meter       = data.get("meter", "الطويل")
    num_verses  = max(2, min(int(data.get("num_verses", 6)), 16))
    style       = data.get("style", "كلاسيكي")

    if not topic:
        return jsonify({"error": "الموضوع مطلوب"}), 400
    if meter not in METERS:
        return jsonify({"error": f"البحر '{meter}' غير معروف"}), 400

    history = []   # attempt history
    feedback: Optional[str] = None

    for attempt in range(1, MAX_RETRIES + 1):
        log.info(f"[gen] attempt {attempt}/{MAX_RETRIES} — meter={meter} topic={topic[:30]}")
        try:
            poem_data = poet.generate_poem(topic, meter, num_verses, style, feedback)
            lines     = poem_data.get("poem", [])

            if not lines:
                feedback = "القصيدة فارغة. يجب أن تحتوي على أبيات."
                continue

            validation = validate_with_qawafi(lines, meter)
            history.append({
                "attempt":    attempt,
                "poem":       lines,
                "validation": validation,
            })

            if validation["valid"]:
                log.info(f"[gen] ✓ valid on attempt {attempt}")
                return jsonify({
                    "success":         True,
                    "poem":            poem_data,
                    "validation":      validation,
                    "attempts":        attempt,
                    "attempt_history": history,
                })

            feedback = validation.get("feedback") or "يرجى مراجعة الوزن والقافية."
            log.info(f"[gen] ✗ attempt {attempt} invalid: {feedback[:80]}")
            if attempt < MAX_RETRIES:
                time.sleep(0.4)

        except json.JSONDecodeError as e:
            log.warning(f"[gen] JSON parse error attempt {attempt}: {e}")
            feedback = "الإخراج لم يكن JSON صحيحاً. استخدم JSON فقط بدون أي نص خارجه."
        except Exception as e:
            # Detect quota / rate-limit style errors from the Gemini client and return 429
            msg = str(e)
            if "quota" in msg.lower() or "quota exceeded" in msg.lower() or "rate limit" in msg.lower():
                # try to extract retry seconds from message
                retry = None
                m = re.search(r"retry in (\d+(?:\.\d+)?)s", msg)
                if not m:
                    m = re.search(r"retry_delay\s*\{\s*seconds:\s*(\d+)", msg)
                if m:
                    try:
                        retry = int(float(m.group(1)))
                    except Exception:
                        retry = None
                headers = {}
                if retry is not None:
                    headers["Retry-After"] = str(retry)
                log.error(f"[gen] quota/rate-limit error: {msg}")
                return jsonify({"error": "خدمة التوليد تجاوزت الحصة أو وصلت لحدود الاستخدام. حاول مجدداً لاحقاً.", "detail": msg}), 429, headers

            log.error(f"[gen] error attempt {attempt}: {e}")
            feedback = f"خطأ: {e}. حاول مجدداً مع الالتزام بالتنسيق."

    # Return best attempt
    last = history[-1] if history else {}
    return jsonify({
        "success":         False,
        "poem":            last.get("poem", {}),
        "validation":      last.get("validation", {}),
        "attempts":        MAX_RETRIES,
        "attempt_history": history,
        "warning":         "لم تجتز القصيدة كل الفحوصات — هذه أفضل محاولة.",
    })


# ── Chat Route ─────────────────────────────────────────────────────────────────
@app.route("/api/chat", methods=["POST"])
def chat():
    poet = get_poet()
    if not poet:
        return jsonify({"error": "GEMINI_API_KEY غير مُعيَّن"}), 503

    data    = request.get_json(force=True) or {}
    message = (data.get("message") or "").strip()
    history = data.get("history", [])

    if not message:
        return jsonify({"error": "الرسالة فارغة"}), 400

    try:
        reply = poet.chat(message, history)
        return jsonify({"response": reply})
    except Exception as e:
        msg = str(e)
        log.error(f"[chat] {msg}")
        if "quota" in msg.lower() or "quota exceeded" in msg.lower() or "rate limit" in msg.lower():
            # try to extract retry seconds from message
            retry = None
            m = re.search(r"retry in (\d+(?:\.\d+)?)s", msg)
            if not m:
                m = re.search(r"retry_delay\s*\{\s*seconds:\s*(\d+)", msg)
            headers = {}
            if m:
                try:
                    retry = int(float(m.group(1)))
                except Exception:
                    retry = None
            if retry is not None:
                headers["Retry-After"] = str(retry)
            return jsonify({"error": "خدمة الدردشة تجاوزت الحصة أو وصلت لحدود الاستخدام. حاول مجدداً لاحقاً.", "detail": msg}), 429, headers

        return jsonify({"error": msg}), 500


# ── Qafiyah Proxy ──────────────────────────────────────────────────────────────
def qafiyah(path: str, params: dict = None):
    url = f"{QAFIYAH_BASE}/{path.lstrip('/')}"
    try:
        log.info(f"qafiyah: GET {url} params={params}")
        r = requests.get(url, params=params, timeout=REQUEST_TIMEOUT,
                         headers={"Accept": "application/json", "User-Agent": "Diwan/1.0"})
        r.raise_for_status()
        try:
            return r.json(), r.status_code
        except ValueError:
            # qafiyah sometimes returns plain text (poem body) with content-type text/plain
            log.info(f"qafiyah returned non-JSON for {url}, wrapping text into JSON")
            return {"data": {"text": r.text}}, r.status_code
    except requests.exceptions.Timeout:
        log.exception(f"qafiyah timeout calling {url}")
        return {"error": "انتهت مهلة الاتصال بـ qafiyah", "url": url}, 504
    except requests.exceptions.HTTPError as e:
        log.exception(f"qafiyah HTTP error calling {url}: {e}")
        # r should exist here from requests.get
        status = getattr(r, 'status_code', 502)
        return {"error": f"qafiyah: {e}", "url": url}, status
    except requests.exceptions.RequestException as e:
        log.exception(f"qafiyah request exception calling {url}: {e}")
        return {"error": str(e), "url": url}, 502


# Eras
@app.route("/api/eras")
def eras():
    data, status = qafiyah("eras")
    return jsonify(data), status

@app.route("/api/eras/<slug>/page/<int:page>")
def eras_page(slug, page):
    data, status = qafiyah(f"eras/{slug}/page/{page}")
    return jsonify(data), status

# Meters (from qafiyah)
@app.route("/api/qafiyah/meters")
def qafiyah_meters():
    data, status = qafiyah("meters")
    return jsonify(data), status

@app.route("/api/qafiyah/meters/<slug>/page/<int:page>")
def qafiyah_meters_page(slug, page):
    data, status = qafiyah(f"meters/{slug}/page/{page}")
    return jsonify(data), status

# Poems
@app.route("/api/poems/random")
def poems_random():
    data, status = qafiyah("poems/random")
    return jsonify(data), status

@app.route("/api/poems/slug/<slug>")
def poem_by_slug(slug):
    data, status = qafiyah(f"poems/slug/{slug}")
    return jsonify(data), status

# Poets
@app.route("/api/poets/page/<int:page>")
def poets_page(page):
    data, status = qafiyah(f"poets/page/{page}")
    return jsonify(data), status

@app.route("/api/poets/slug/<slug>")
def poet_by_slug(slug):
    data, status = qafiyah(f"poets/slug/{slug}")
    return jsonify(data), status

@app.route("/api/poets/<slug>/page/<int:page>")
def poet_poems(slug, page):
    data, status = qafiyah(f"poets/{slug}/page/{page}")
    return jsonify(data), status

# Rhymes
@app.route("/api/rhymes")
def rhymes():
    data, status = qafiyah("rhymes")
    return jsonify(data), status

@app.route("/api/rhymes/<slug>/page/<int:page>")
def rhymes_page(slug, page):
    data, status = qafiyah(f"rhymes/{slug}/page/{page}")
    return jsonify(data), status

# Themes
@app.route("/api/themes")
def themes():
    data, status = qafiyah("themes")
    return jsonify(data), status

@app.route("/api/themes/<slug>/page/<int:page>")
def themes_page(slug, page):
    data, status = qafiyah(f"themes/{slug}/page/{page}")
    return jsonify(data), status

# Search
@app.route("/api/search")
def search():
    params = {
        "q":           request.args.get("q", ""),
        "search_type": request.args.get("search_type", "poem"),
        "page":        request.args.get("page", 1),
        "match_type":  request.args.get("match_type", "partial"),
    }
    data, status = qafiyah("search", params)
    return jsonify(data), status

# Local meters list (from our METERS dict)
@app.route("/api/meters")
def meters_local():
    return jsonify({
        "meters": [
            {"name": k, "pattern": v["pattern"], "feet": v["feet"]}
            for k, v in METERS.items()
        ]
    })

# Health
@app.route("/api/health")
def health():
    return jsonify({
        "status":            "ok",
        "gemini_configured": bool(GEMINI_API_KEY),
        "max_retries":       MAX_RETRIES,
    })


if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=os.getenv("FLASK_ENV") == "development")
