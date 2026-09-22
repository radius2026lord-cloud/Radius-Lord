"use client";

import { Check, Copy } from "lucide-react";
import type { ReactNode } from "react";

type ActionSuccessCardProps = {
  title: string;
  description?: string;
  valueLabel?: string;
  value?: string;
  primaryAction?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
  children?: ReactNode;
  modal?: boolean;
};

export function ActionSuccessCard({
  title,
  description,
  valueLabel,
  value,
  primaryAction,
  secondaryAction,
  children,
  modal = false,
}: ActionSuccessCardProps) {
  const copyValue = async () => {
    if (!value || !navigator.clipboard) return;
    await navigator.clipboard.writeText(value);
  };

  const card = (
    <div className={`action-success-card mx-auto flex w-full max-w-[410px] flex-col items-center rounded-[24px] ${modal ? "border border-white/80 bg-[#f9fbfe] p-6 shadow-[0_28px_90px_rgba(15,42,99,.28)] dark:border-white/[.10] dark:bg-[#302e33] dark:shadow-[0_32px_100px_rgba(0,0,0,.55)] sm:p-8" : ""} text-center`} role="status" aria-live="polite">
      <div className="action-success-icon grid h-[70px] w-[70px] place-items-center rounded-full border border-emerald-500/25 bg-emerald-500/10 text-emerald-600 shadow-[0_12px_34px_rgba(16,185,129,.16)] dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300">
        <Check className="action-success-check h-9 w-9" strokeWidth={2.6} />
      </div>
      <h2 className="mt-5 text-[24px] font-black text-[#102a63] dark:text-[#f4f1f5]">{title}</h2>
      {description && <p className="mt-2 max-w-[350px] text-[12px] leading-6 text-slate-500 dark:text-[#b9b3bd]">{description}</p>}

      {value && (
        <div className="mt-6 w-full rounded-[18px] border border-[#d7e2ed] bg-[#f2f6fa] p-3 dark:border-white/[.09] dark:bg-[#211a25]/70">
          {valueLabel && <div className="text-[10px] font-bold text-slate-500 dark:text-[#b9b3bd]">{valueLabel}</div>}
          <div className="mt-2 flex items-center gap-2" dir="ltr">
            <div className="min-w-0 flex-1 rounded-[12px] bg-white px-4 py-3 text-[15px] font-black tracking-wide text-[#0758e9] shadow-sm dark:bg-[#302e33] dark:text-[#8ab5ff]">{value}</div>
            <button type="button" onClick={copyValue} className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[12px] border border-[#ccd9e7] bg-white text-[#0758e9] transition hover:border-[#7fb1e8] hover:bg-[#edf5ff] dark:border-white/[.10] dark:bg-[#38363c] dark:text-[#8ab5ff] dark:hover:bg-[#454149]" aria-label="نسخ">
              <Copy className="h-[17px] w-[17px]" />
            </button>
          </div>
        </div>
      )}

      {children}

      {(primaryAction || secondaryAction) && (
        <div className="mt-6 grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
          {primaryAction && <button type="button" onClick={primaryAction.onClick} className="h-[44px] rounded-[14px] bg-gradient-to-l from-[#1479ff] to-[#0758e9] px-5 text-[12px] font-bold text-white shadow-[0_8px_22px_rgba(20,121,255,.20)] transition hover:brightness-105">{primaryAction.label}</button>}
          {secondaryAction && <button type="button" onClick={secondaryAction.onClick} className="h-[44px] rounded-[14px] border border-[#ccd9e7] bg-white px-5 text-[12px] font-bold text-[#17386d] transition hover:bg-[#f3f7fb] dark:border-white/[.10] dark:bg-[#38363c] dark:text-[#f4f1f5] dark:hover:bg-[#454149]">{secondaryAction.label}</button>}
        </div>
      )}

      <style jsx global>{`
        @keyframes actionSuccessEnter { from { opacity: 0; transform: translateY(10px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes actionSuccessIcon { 0% { transform: scale(.45); opacity: 0; } 55% { transform: scale(1.12); opacity: 1; } 78% { transform: scale(.96); } 100% { transform: scale(1); opacity: 1; } }\n        @keyframes actionSuccessCheck { 0% { stroke-dashoffset: 48; opacity: 0; } 20% { opacity: 1; } 100% { stroke-dashoffset: 0; opacity: 1; } }
        .action-success-card { animation: actionSuccessEnter .45s cubic-bezier(.22,.8,.25,1) both; }
        .action-success-icon { animation: actionSuccessIcon .62s cubic-bezier(.22,.8,.25,1) .08s both; }\n        .action-success-check { stroke-dasharray: 48; stroke-dashoffset: 48; animation: actionSuccessCheck .48s ease-out .28s forwards; }
        @media (prefers-reduced-motion: reduce) { .action-success-card, .action-success-icon, .action-success-check { animation: none !important; stroke-dashoffset: 0 !important; } }
      `}</style>
    </div>
  );

  if (!modal) return card;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#102a63]/28 p-4 backdrop-blur-[7px] dark:bg-black/55" role="dialog" aria-modal="true">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(20,121,255,.12),transparent_58%)]" />
      <div className="relative z-10 w-full max-w-[410px]">{card}</div>
    </div>
  );
}
