import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Sparkles,
  BookOpen,
  Search,
  MessageCircle,
  ArrowLeft,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getLocalMeters } from "../api";
import { FALLBACK_VERSES } from "../types";

export default function HomePage() {
  const [vi, setVi] = useState(0);

  useEffect(() => {
    const t = setInterval(
      () => setVi((v) => (v + 1) % FALLBACK_VERSES.length),
      5000,
    );
    return () => clearInterval(t);
  }, []);

  const { data: metersData } = useQuery({
    queryKey: ["local-meters"],
    queryFn: getLocalMeters,
  });

  const verse = FALLBACK_VERSES[vi];

  return (
    <div className="min-h-screen" dir="rtl">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 right-10 w-64 h-64 rounded-full bg-gold-600/5 blur-3xl" />
          <div className="absolute bottom-10 left-20 w-96 h-96 rounded-full bg-ink-700/30 blur-3xl" />
          {/* Arabic geometric pattern */}
          <svg
            className="absolute inset-0 w-full h-full opacity-[0.02]"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <pattern
                id="geo"
                width="80"
                height="80"
                patternUnits="userSpaceOnUse"
              >
                <circle
                  cx="40"
                  cy="40"
                  r="20"
                  fill="none"
                  stroke="#c8862d"
                  strokeWidth="0.5"
                />
                <rect
                  x="20"
                  y="20"
                  width="40"
                  height="40"
                  fill="none"
                  stroke="#c8862d"
                  strokeWidth="0.5"
                  transform="rotate(45 40 40)"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#geo)" />
          </svg>
        </div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20 text-center">
          {/* Tag */}
          <div className="inline-flex items-center gap-2 bg-gold-600/10 border border-gold-600/20 rounded-full px-4 py-1.5 text-gold-400 text-sm mb-6">
            <Sparkles size={14} />
            شعر عربي فصيح بالذكاء الاصطناعي
          </div>

          {/* Title */}
          <h1
            className="font-arabic text-4xl sm:text-5xl lg:text-7xl font-bold mb-4 leading-tight"
            style={{ animationDelay: "0.1s", animationFillMode: "both" }}
          >
            <span className="text-gold-400">الديوان</span>
            <br />
            <span className="text-parchment-100">الذكي</span>
          </h1>

          <p
            className="text-parchment-400 text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed mb-10 mt-10"
            style={{ animationDelay: "0.2s", animationFillMode: "both" }}
          >
            منصة لتوليد الشعر العربي الملتزم بالأوزان والقوافي، واستكشاف كنوز
            التراث الشعري العربي عبر العصور
          </p>

          {/* ── Rotating verse showcase ────────────────────────────────────────── */}
          <section className="max-w-4xl mx-auto px-4 sm:px-6 -mt-2 sm:-mt-4 mb-16 sm:mb-20">
            <div className="poem-container px-5 sm:px-10 lg:px-12 py-8 sm:py-10 text-center">
              <p className="text-xs text-gray-200 uppercase tracking-widest mb-4 sm:mb-6">
                من عيون الشعر العربي
              </p>
              <div
                key={vi}
                className="font-arabic text-xl sm:text-2xl lg:text-3xl text-parchment-100 leading-loose animate-fade-in"
              >
                {verse.text}
              </div>
              <p className="mt-4 sm:mt-6 text-gold-500 text-xs sm:text-sm">
                — {verse.poet}
              </p>
            </div>
          </section>

          {/* CTAs */}
          <div
            className="flex flex-col sm:flex-row items-center justify-center gap-4
             animate-fade-up w-full max-w-md sm:max-w-6xl mx-auto px-4"
            style={{ animationDelay: "0.3s", animationFillMode: "both" }}
          >
            {/* Primary Button: Explore Library */}
            <Link
              to="/library"
              className="btn-gold flex items-center justify-center gap-2 text-base px-6
               w-full sm:w-64 h-14 sm:h-16 rounded-xl shadow-lg transition-transform active:scale-95"
            >
              <BookOpen size={20} />
              <span className="font-arabic font-bold">استكشف المكتبة</span>
            </Link>

            {/* Poets Button: Sit with the Poet */}
            <Link
              to="/chat"
              className="group relative flex flex-col items-center justify-center 
               bg-ink-900/40 border border-gold-600/40 active:bg-gold-600/20
               text-parchment-100 rounded-xl px-6 w-full sm:w-64 h-14 sm:h-16
               transition-all duration-300 overflow-hidden active:scale-95 hover:bg-gold-600/10"
            >
              {/* Inner Wrapper: Keeps everything centered and stable */}
              <div className="relative flex flex-col items-center justify-center h-full w-full">
                {/* Main Text: Stays centered on mobile, slides up on desktop hover */}
                <div className="flex items-center gap-2 transition-all duration-300 transform sm:group-hover:-translate-y-3">
                  <MessageCircle size={20} className="text-gold-500" />
                  <span className="font-arabic font-bold text-lg leading-none">
                    جالس الشاعر
                  </span>
                </div>

                {/* Sub-header: Hidden on desktop until hover, always visible but small on mobile */}
                <span
                  className="font-arabic text-gold-500/80 text-[10px] sm:text-xs
                       mt-1 sm:mt-0 
                       sm:absolute sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:translate-y-2
                       sm:opacity-0 sm:group-hover:opacity-100 sm:group-hover:translate-y-1
                       transition-all duration-300 whitespace-nowrap"
                >
                  استعد زمن الفصاحة
                </span>
              </div>

              {/* Decorative Touch: Corner highlights that don't affect layout */}
              <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-gold-600/30" />
              <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-gold-600/30" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-20">
        <h2 className="font-arabic text-3xl font-bold text-center text-parchment-200 mb-10">
          ما يمكنك فعله
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[
            {
              icon: Sparkles,
              title: "توليد القصائد",
              desc: "أنشئ قصائد ملتزمة بالأوزان مع التحقق الآلي والتصحيح التلقائي",
              to: "/generate",
              cta: "ابدأ الإنشاء",
            },
            {
              icon: BookOpen,
              title: "مكتبة الشعر",
              desc: "944K+ بيت من 932 شاعراً عبر 10 عصور من قافية المفتوحة",
              to: "/library",
              cta: "تصفح المكتبة",
            },
            {
              icon: Search,
              title: "بحث متقدم",
              desc: "ابحث في الأبيات والشعراء بالكلمات أو المعنى",
              to: "/search",
              cta: "ابدأ البحث",
            },
            {
              icon: MessageCircle,
              title: "حوار الشاعر",
              desc: "تحدث مع شاعر رقمي متمكن يعرف تاريخ الشعر العربي كله",
              to: "/chat",
              cta: "ابدأ الحوار",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="card-parchment p-4 sm:p-5 hover:border-ink-600 transition-all group h-full flex flex-col"
            >
              <f.icon size={22} className="text-gold-500 mb-3" />
              <h3 className="font-arabic font-bold text-parchment-200 mb-2 text-base sm:text-lg">
                {f.title}
              </h3>
              <p className="text-ink-500 text-sm leading-relaxed mb-4 flex-1">
                {f.desc}
              </p>
              <Link
                to={f.to}
                className="inline-flex items-center gap-1.5 text-gold-400 text-sm
                               hover:text-gold-300 transition-colors group-hover:gap-2.5 w-max"
              >
                {f.cta}
                <ArrowLeft size={13} className="rotate-180" />
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ── Meters grid ──────────────────────────────────────────────────── */}
      {metersData?.meters && (
        <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-20">
          <h2 className="font-arabic text-2xl font-bold text-center text-parchment-200 mb-6">
            البحور الشعرية المدعومة
          </h2>
          <div className="flex flex-wrap justify-center gap-3">
            {metersData.meters.map((m) => (
              <Link
                key={m.name}
                to={`/generate?meter=${encodeURIComponent(m.name)}`}
                className="card-parchment px-4 py-3 hover:border-gold-700/50 transition-all group text-center"
              >
                <div
                  className="font-arabic font-bold text-parchment-300 group-hover:text-gold-300
                                 transition-colors text-sm"
                >
                  {m.name}
                </div>
                <div className="text-xs text-ink-700 mt-0.5 font-mono leading-tight">
                  {m.pattern.split(" ").slice(0, 2).join(" ")}…
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Stats ────────────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-20">
        <div className="card-parchment p-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { n: "+944K", l: "بيت شعري" },
              { n: "932", l: "شاعر" },
              { n: "10", l: "عصور تاريخية" },
              { n: "12", l: "بحراً شعرياً" },
            ].map((s) => (
              <div key={s.l}>
                <div className="font-arabic text-3xl sm:text-4xl font-bold text-gold-400 mb-1">
                  {s.n}
                </div>
                <div className="text-ink-500 text-sm">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
