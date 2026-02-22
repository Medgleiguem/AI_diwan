# ديوان الذكاء — دليل الإعداد الكامل

## المتطلبات
- Python 3.10+
- Node.js 18+
- مفتاح Gemini API (مجاني من https://aistudio.google.com/app/apikey)

---

## الخطوة 1 — تحميل المشروع

```bash
unzip diwan.zip
cd diwan
```

---

## الخطوة 2 — إعداد الخادم الخلفي (Backend)

```bash
cd backend

# إنشاء بيئة Python افتراضية
python -m venv venv

# تفعيل البيئة الافتراضية
# على Linux/macOS:
source venv/bin/activate
# على Windows:
venv\Scripts\activate

# تثبيت المكتبات
pip install -r requirements.txt

# ✅ اختياري — تثبيت qawafi للتحقق الدقيق من الأوزان
# (إذا لم يُثبَّت، يُستخدم محقق قواعدي تلقائياً)
pip install git+https://github.com/ARBML/qawafi.git
```

### إعداد مفتاح Gemini

افتح ملف `backend/.env` وضع مفتاحك:

```env
GEMINI_API_KEY=AIza...مفتاحك_هنا...
FLASK_ENV=development
PORT=5000
MAX_RETRIES=5
```

### تشغيل الخادم

```bash
python app.py
```

يجب أن ترى:
```
INFO * Running on http://0.0.0.0:5000
```

### اختبار الخادم

```bash
curl http://localhost:5000/api/health
# {"gemini_configured": true, "max_retries": 5, "status": "ok"}

curl http://localhost:5000/api/meters
# قائمة البحور الشعرية

curl http://localhost:5000/api/poets/page/1
# قائمة الشعراء من qafiyah
```

---

## الخطوة 3 — إعداد الواجهة الأمامية (Frontend)

افتح نافذة طرفية جديدة:

```bash
cd frontend

# تثبيت المكتبات
npm install

# تشغيل بيئة التطوير
npm run dev
```

افتح المتصفح على: **http://localhost:5173**

---

## الخطوة 4 — التحقق من عمل كل شيء

| الميزة | كيف تتحقق |
|--------|-----------|
| الخادم يعمل | http://localhost:5000/api/health |
| الواجهة تعمل | http://localhost:5173 |
| Gemini مُعيَّن | `"gemini_configured": true` في /api/health |
| مكتبة الشعر | افتح تبويب "مكتبة الشعر" |
| التوليد | اكتب موضوعاً في "أنشئ قصيدة" |
| البحث | تبويب "بحث" |
| الدردشة | تبويب "حوار الشاعر" |

---

## استكشاف الأخطاء

### خطأ GEMINI_API_KEY
```
error: GEMINI_API_KEY غير مُعيَّن
```
← تأكد من وجود المفتاح في `backend/.env` وأعد تشغيل الخادم.

### مكتبة الشعر لا تعمل (خطأ 502/504)
← هذا يعني api.qafiyah.com غير متاح من موقعك.
   تحقق من اتصالك بالإنترنت وأن الخادم الخلفي يعمل.

### خطأ CORS
← تأكد أن الواجهة تعمل على port 5173 والخادم على 5000.
   لا تفتح index.html مباشرة في المتصفح.

### توليد القصيدة بطيء
← طبيعي — قد يستغرق 30-60 ثانية مع إعادة المحاولات.
   الخطوة الواحدة تستغرق ~5-10 ثوانٍ.

---

## النشر للإنتاج (Docker)

```bash
# من مجلد المشروع الرئيسي
cp backend/.env .env   # أو اضبط GEMINI_API_KEY في البيئة

docker-compose up --build
# الواجهة على: http://localhost:80
```

---

## هيكل البحور API

التطبيق يدعم البحور التالية:
- الطويل · البسيط · الكامل · الوافر · الخفيف
- المتقارب · الرجز · الهزج · السريع · المنسرح
- المديد · المجتث

---

## مصادر

- **Gemini API**: https://aistudio.google.com
- **qafiyah API**: https://api.qafiyah.com
- **qawafi**: https://github.com/ARBML/qawafi
- **قافية**: https://github.com/alwalxed/qafiyah
