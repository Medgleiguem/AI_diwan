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

QAFIYAH_BASE    = "https://api.qafiyah.com"
MAX_RETRIES     = int(os.getenv("MAX_RETRIES", "3"))
REQUEST_TIMEOUT = 15

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
    return jsonify({"status": "ok"})

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=os.getenv("FLASK_ENV") == "development")