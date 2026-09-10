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
          className="h-[44px] w-full rounded-[12px] border border-[#ccd9e7] bg-white pr-10 pl-10 text-[12px] text-[#17386d] outline-none transition-all duration-500 ease-[cubic-bezier(.22,.8,.25,1)] placeholder:text-slate-400 focus:border-[#4b92ef] focus:ring-2 focus:ring-[#147bff]/10 dark:border-white/[.10] dark:bg-[#38363c] dark:text-[#f6f2f7] dark:placeholder:text-[#8f8795] dark:focus:border-[#4c8dff]/70 dark:focus:ring-[#4c8dff]/15 sm:text-[13px]"
        />
        {suffix}
      </div>
      <style jsx global>{`
        .dark main:has(.auth-shell) {
          background:
            radial-gradient(circle at 12% 22%, rgba(76,141,255,.10), transparent 30%),
            radial-gradient(circle at 88% 82%, rgba(255,179,77,.045), transparent 27%),
            #1d1721 !important;
        }

        .dark .auth-shell {
          background: #302e33 !important;
          border-color: rgba(255,255,255,.10) !important;
          border-radius: 22px !important;
          box-shadow: 0 24px 70px rgba(0,0,0,.34), inset 0 1px 0 rgba(255,255,255,.035) !important;
          backdrop-filter: none !important;
        }

        .dark .auth-shell > section {
          background: #302e33 !important;
        }

        .dark .auth-shell > section:first-child:not(:last-child) {
          background:
            radial-gradient(circle at 28% 28%, rgba(76,141,255,.085), transparent 27%),
            radial-gradient(circle at 70% 72%, rgba(255,179,77,.045), transparent 24%),
            #211a25 !important;
        }

        .dark .auth-shell [class*="dark:bg-[#0d243b]"] {
          background-color: #302e33 !important;
          border-color: rgba(255,255,255,.10) !important;
          backdrop-filter: none !important;
        }

        .dark .auth-shell [class*="dark:bg-white/[.04]"] {
          background-color: #38363c !important;
        }

        .dark .auth-shell [class*="dark:bg-[#102d4d]"] {
          background-color: #38363c !important;
          color: #7ea4ff !important;
        }

        .dark .auth-shell [class*="dark:bg-[#102e4f]"],
        .dark .auth-shell [class*="dark:bg-[#113a31]"],
        .dark .auth-shell [class*="dark:bg-[#2b2147]"],
        .dark .auth-shell [class*="dark:bg-[#3d2d18]"] {
          background-color: #3b383e !important;
          border-radius: 999px !important;
        }

        .dark .auth-shell [class*="dark:from-[#1b3556]"] {
          --tw-gradient-from: #38363c var(--tw-gradient-from-position) !important;
          --tw-gradient-to: rgb(56 54 60 / 0) var(--tw-gradient-to-position) !important;
        }

        .dark .auth-shell [class*="dark:to-[#102845]"] {
          --tw-gradient-to: #302e33 var(--tw-gradient-to-position) !important;
        }

        .dark .auth-shell .text-slate-300 { color: #d8d2dc !important; }
        .dark .auth-shell .text-slate-400,
        .dark .auth-shell .text-slate-500 { color: #b8b0bc !important; }

        .dark .auth-shell input {
          background-color: #38363c;
          border-color: rgba(255,255,255,.10);
        }

        .dark .auth-shell input::placeholder { color: #8f8795; }

        .auth-shell,
        .auth-shell input,
        .auth-shell button,
        .auth-shell [class*="rounded-"] {
          transition-duration: 500ms;
          transition-timing-function: cubic-bezier(.22,.8,.25,1);
        }
      `}</style>
    </label>
  );
}

export function PrimaryFormButton({ children }: { children: ReactNode }) {
  return (
    <button type="submit" className="flex h-[44px] w-full items-center justify-center gap-2 rounded-[12px] bg-gradient-to-l from-[#0d6ef0] to-[#0754d8] text-[12px] font-bold text-white shadow-sm transition-all duration-500 ease-[cubic-bezier(.22,.8,.25,1)] hover:brightness-105 dark:from-[#4c8dff] dark:to-[#3977e8] dark:shadow-[0_8px_24px_rgba(76,141,255,.18)] sm:text-[13px]">
      {children}
    </button>
  );
}

export function SecondaryFormButton({ children }: { children: ReactNode }) {
  return (
    <button type="button" className="flex h-[44px] w-full items-center justify-center gap-2 rounded-[12px] border border-[#ccd9e7] bg-white text-[11px] font-bold text-[#17386d] transition-all duration-500 ease-[cubic-bezier(.22,.8,.25,1)] hover:bg-slate-50 dark:border-white/[.10] dark:bg-[#38363c] dark:text-[#f6f2f7] dark:hover:bg-[#3e3a42] sm:text-[12px]">
      {children}
    </button>
  );
}
