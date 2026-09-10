"use client";

import type { ComponentType, ReactNode } from "react";

type IconType = ComponentType<{ className?: string }>;

type CompactFieldProps = {
  label: string;
  icon: IconType;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  suffix?: ReactNode;
  className?: string;
};

export function CompactField({
  label,
  icon: Icon,
  type = "text",
  value,
  onChange,
  placeholder,
  suffix,
  className = "",
}: CompactFieldProps) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[11px] font-bold text-[#17386d] dark:text-[#f6f2f7] sm:text-[12px]">
        {label}
      </span>
      <div className="relative">
        <Icon className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-[#b8b0bc]" />
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="h-[44px] w-full rounded-[12px] border border-[#ccd9e7] bg-white pr-10 pl-10 text-[12px] text-[#17386d] outline-none transition placeholder:text-slate-400 focus:border-[#4b92ef] focus:ring-2 focus:ring-[#147bff]/10 dark:border-white/[.09] dark:bg-[#37343a] dark:text-[#f6f2f7] dark:placeholder:text-[#8f8795] dark:focus:border-[#4c8dff]/70 dark:focus:ring-[#4c8dff]/15 sm:text-[13px]"
        />
        {suffix}
      </div>
      <style jsx global>{`
        .dark .auth-shell {
          background: #302e33 !important;
          border-color: rgba(255,255,255,.09) !important;
          box-shadow: 0 24px 70px rgba(0,0,0,.34), inset 0 1px 0 rgba(255,255,255,.035) !important;
        }
        .dark .auth-shell > section {
          background: #302e33 !important;
        }
        .dark .auth-shell > section:first-child:not(:last-child) {
          background: radial-gradient(circle at 28% 28%,rgba(76,141,255,.10),transparent 27%), radial-gradient(circle at 70% 72%,rgba(255,179,77,.055),transparent 24%), #211a25 !important;
        }
        .dark .auth-shell [class*="dark:bg-[#0d243b]"] {
          background-color: #37343a !important;
          border-color: rgba(255,255,255,.09) !important;
        }
        .dark .auth-shell [class*="dark:bg-white/[.04]"] {
          background-color: rgba(255,255,255,.055) !important;
        }
        .dark .auth-shell [class*="dark:bg-[#102d4d]"] {
          background-color: #3e3a42 !important;
          color: #7ea4ff !important;
        }
        .dark .auth-shell .text-slate-300 { color: #d8d2dc !important; }
        .dark .auth-shell .text-slate-400,
        .dark .auth-shell .text-slate-500 { color: #b8b0bc !important; }
        .dark .auth-shell input { background-color: #37343a; }
        .dark .auth-shell input::placeholder { color: #8f8795; }
        .dark main:has(.auth-shell) {
          background: radial-gradient(circle at 12% 24%,rgba(76,141,255,.12),transparent 31%), radial-gradient(circle at 88% 84%,rgba(255,179,77,.055),transparent 28%), linear-gradient(135deg,#1d1721 0%,#211a25 52%,#1d1721 100%) !important;
        }
      `}</style>
    </label>
  );
}

export function PrimaryFormButton({ children }: { children: ReactNode }) {
  return (
    <button type="submit" className="flex h-[44px] w-full items-center justify-center gap-2 rounded-[12px] bg-gradient-to-l from-[#0d6ef0] to-[#0754d8] text-[12px] font-bold text-white shadow-sm transition hover:brightness-105 dark:from-[#4c8dff] dark:to-[#3977e8] dark:shadow-[0_8px_24px_rgba(76,141,255,.18)] sm:text-[13px]">
      {children}
    </button>
  );
}

export function SecondaryFormButton({ children }: { children: ReactNode }) {
  return (
    <button type="button" className="flex h-[44px] w-full items-center justify-center gap-2 rounded-[12px] border border-[#ccd9e7] bg-white text-[11px] font-bold text-[#17386d] transition hover:bg-slate-50 dark:border-white/[.09] dark:bg-[#37343a] dark:text-[#f6f2f7] dark:hover:bg-[#3e3a42] sm:text-[12px]">
      {children}
    </button>
  );
}
