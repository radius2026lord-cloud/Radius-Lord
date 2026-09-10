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
      <span className="mb-2 block text-[11px] font-bold text-[#17386d] dark:text-[#f4f1f5] sm:text-[12px]">
        {label}
      </span>
      <div className="group relative">
        <span className="absolute right-2.5 top-1/2 z-10 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-[#e8eff6] text-[#0758e9] transition-all duration-300 ease-[cubic-bezier(.22,.8,.25,1)] group-focus-within:scale-[1.08] group-focus-within:bg-[#dceaff] dark:bg-[#38363c] dark:text-[#8ab5ff] dark:group-focus-within:bg-[#454149]">
          <Icon className="h-4 w-4" />
        </span>
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="h-[48px] w-full origin-center rounded-[16px] border border-[#ccd9e7] bg-white pr-12 pl-10 text-[12px] text-[#17386d] outline-none transition-all duration-300 ease-[cubic-bezier(.22,.8,.25,1)] placeholder:text-slate-400 hover:border-[#aebfd2] focus:-translate-y-px focus:scale-[1.018] focus:border-[#4c8dff]/80 focus:shadow-[0_10px_28px_rgba(20,121,255,.14)] focus:ring-4 focus:ring-[#1479ff]/10 dark:border-white/[.10] dark:bg-[#211a25] dark:text-[#f4f1f5] dark:placeholder:text-[#8f8894] dark:hover:border-white/[.18] dark:hover:bg-[#26202a] dark:focus:border-[#6aa8ff] dark:focus:bg-[#211a25] dark:focus:shadow-[0_12px_32px_rgba(20,121,255,.16)] dark:focus:ring-[#1479ff]/20 sm:text-[13px]"
        />
        {suffix}
      </div>

      <style jsx global>{`
        .dark main:has(.auth-shell) {
          background: #1d1721 !important;
        }

        .dark .auth-bg-grid {
          opacity: .52 !important;
          background-image:
            linear-gradient(rgba(126,164,255,.24) 1px, transparent 1px),
            linear-gradient(90deg, rgba(126,164,255,.24) 1px, transparent 1px) !important;
          background-size: 40px 40px !important;
        }

        .dark .auth-network-lines {
          opacity: .48 !important;
          filter: drop-shadow(0 0 6px rgba(106,168,255,.28));
        }

        .dark .auth-network-dot {
          opacity: 1 !important;
          filter: drop-shadow(0 0 9px rgba(106,168,255,.72));
        }

        .dark .auth-shell {
          background: #302e33 !important;
          border-color: rgba(255,255,255,.10) !important;
          box-shadow: 0 28px 80px rgba(0,0,0,.30) !important;
        }

        .dark .auth-shell > section:last-child {
          background: #302e33 !important;
        }
      `}</style>
    </label>
  );
}

export function PrimaryFormButton({ children }: { children: ReactNode }) {
  return (
    <button type="submit" className="flex h-[48px] w-full items-center justify-center gap-2 rounded-[16px] bg-gradient-to-l from-[#1479ff] to-[#0758e9] text-[12px] font-bold text-white shadow-[0_10px_28px_rgba(20,121,255,.22)] transition-all duration-500 ease-[cubic-bezier(.22,.8,.25,1)] hover:-translate-y-0.5 hover:brightness-105 hover:shadow-[0_14px_34px_rgba(20,121,255,.28)] active:translate-y-0 sm:text-[13px]">
      {children}
    </button>
  );
}

export function SecondaryFormButton({ children }: { children: ReactNode }) {
  return (
    <button type="button" className="flex h-[48px] w-full items-center justify-center gap-2 rounded-[16px] border border-[#ccd9e7] bg-white text-[11px] font-bold text-[#17386d] transition-all duration-500 ease-[cubic-bezier(.22,.8,.25,1)] hover:bg-[#f3f7fb] dark:border-white/[.10] dark:bg-[#38363c] dark:text-[#f4f1f5] dark:hover:border-white/[.18] dark:hover:bg-[#454149] sm:text-[12px]">
      {children}
    </button>
  );
}
