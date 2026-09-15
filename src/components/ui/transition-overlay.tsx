"use client";

import { LogIn, LogOut } from "lucide-react";

type TransitionOverlayProps = {
  variant: "login" | "logout";
};

export default function TransitionOverlay({ variant }: TransitionOverlayProps) {
  const login = variant === "login";
  const Icon = login ? LogIn : LogOut;
  const title = login ? "تم تسجيل الدخول بنجاح" : "تسجيل الخروج";
  const subtitle = login ? "جارٍ فتح لوحة التحكم بأمان..." : "جارٍ إنهاء الجلسة بأمان...";

  return (
    <div className="transition-overlay fixed inset-0 z-[120] flex items-center justify-center bg-[#dce5ef]/30 backdrop-blur-[3px] dark:bg-[#1d1721]/35" aria-live="polite" aria-label={title}>
      <div className="transition-card flex min-w-[210px] flex-col items-center rounded-[24px] border border-white/70 bg-white/88 px-8 py-7 shadow-[0_24px_70px_rgba(31,54,83,.20)] backdrop-blur-xl dark:border-white/[.10] dark:bg-[#302e33]/88 dark:shadow-[0_26px_80px_rgba(0,0,0,.34)]">
        <div className={`relative grid h-16 w-16 place-items-center rounded-full ${login ? "bg-emerald-500/10 text-emerald-500 dark:bg-emerald-400/10 dark:text-emerald-400" : "bg-red-500/10 text-red-500 dark:bg-red-400/10 dark:text-red-400"}`}>
          <span className={`transition-ring absolute inset-0 rounded-full border-2 ${login ? "border-emerald-500/20 border-t-emerald-500 dark:border-emerald-400/20 dark:border-t-emerald-400" : "border-red-500/20 border-t-red-500 dark:border-red-400/20 dark:border-t-red-400"}`} />
          <Icon className="transition-arrow h-7 w-7" />
        </div>
        <div className="mt-4 text-sm font-bold text-[#102a63] dark:text-[#f4f1f5]">{title}</div>
        <div className="mt-1 text-[11px] text-slate-500 dark:text-[#b9b3bd]">{subtitle}</div>
      </div>

      <style jsx global>{`
        @keyframes transitionOverlayIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes transitionCardIn {
          0% { opacity: 0; transform: translateY(8px) scale(.94); }
          70% { opacity: 1; transform: translateY(-1px) scale(1.015); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes transitionRingSpin { to { transform: rotate(360deg); } }
        @keyframes transitionArrowMove {
          0%, 100% { transform: translateX(2px); opacity: .72; }
          50% { transform: translateX(-4px); opacity: 1; }
        }
        .transition-overlay { animation: transitionOverlayIn .18s ease-out both; }
        .transition-card { animation: transitionCardIn .30s cubic-bezier(.22,.8,.25,1) both; }
        .transition-ring { animation: transitionRingSpin .72s linear infinite; }
        .transition-arrow { animation: transitionArrowMove .72s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .transition-overlay, .transition-card, .transition-ring, .transition-arrow { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
