import { Link } from "react-router-dom";
import { ArrowLeft, Home, Sparkles } from "lucide-react";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden" dir="rtl">
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
              id="geo-404"
              width="80"
              height="80"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="40" cy="40" r="20" fill="none" stroke="#c8862d" strokeWidth="0.5" />
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
          <rect width="100%" height="100%" fill="url(#geo-404)" />
        </svg>
      </div>

      <div className="relative z-10 text-center px-4 animate-fade-up">
         {/* Tag */}
         <div className="inline-flex items-center justify-center gap-2 bg-gold-600/10 border border-gold-600/20 rounded-full px-4 py-1.5 text-gold-400 text-sm mb-8 mx-auto">
            <Sparkles size={14} />
            تائه في بحور الخيال
          </div>

        <h1 className="font-arabic text-8xl md:text-[10rem] font-bold text-transparent bg-clip-text bg-gradient-to-br from-gold-400 to-gold-700 mb-4 leading-none">
          404
        </h1>
        
        <h2 className="font-arabic text-3xl md:text-5xl font-bold text-parchment-100 mb-6">
          الصفحة غير موجودة
        </h2>
        
        <p className="text-parchment-400 text-lg md:text-xl max-w-lg mx-auto mb-12 leading-relaxed">
          عذراً، يبدو أنك قد ضللت الطريق. الصفحة التي تبحث عنها غير متوفرة في ديواننا الرقمي حالياً.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-md mx-auto">
          <Link
            to="/"
            className="btn-gold flex items-center justify-center gap-2 text-base px-6
             w-full h-14 rounded-xl shadow-lg transition-transform active:scale-95"
          >
            <Home size={20} />
            <span className="font-arabic font-bold">العودة للرئيسية</span>
          </Link>
          
          <button
            onClick={() => window.history.back()}
            className="group flex flex-col items-center justify-center 
             bg-ink-900/40 border border-gold-600/40 active:bg-gold-600/20 hover:bg-gold-600/10
             text-parchment-100 rounded-xl px-6 w-full h-14
             transition-all duration-300 active:scale-95"
          >
            <div className="flex items-center gap-2">
               <span className="font-arabic font-bold">الصفحة السابقة</span>
               <ArrowLeft size={18} className="text-gold-500" />
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
