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
      <div className="relative">
        <span className="absolute right-2.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-[#e8eff6] text-[#0758e9] transition-all duration-500 ease-[cubic-bezier(.22,.8,.25,1)] dark:bg-[#5a5660] dark:text-[#9ec0ff]">
          <Icon className="h-4 w-4" />
        </span>
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="h-[48px] w-full rounded-[16px] border border-[#ccd9e7] bg-white pr-12 pl-10 text-[12px] text-[#17386d] outline-none transition-all duration-500 ease-[cubic-bezier(.22,.8,.25,1)] placeholder:text-slate-400 hover:border-[#aebfd2] focus:border-[#4c8dff]/80 focus:ring-4 focus:ring-[#1479ff]/10 dark:border-white/[.18] dark:bg-[#504c55] dark:text-white dark:placeholder:text-[#c0bac5] dark:hover:border-white/[.28] dark:hover:bg-[#57535d] dark:focus:border-[#6aa8ff] dark:focus:bg-[#5b5761] dark:focus:ring-[#1479ff]/20 sm:text-[13px]"
        />
        {suffix}
      </div>

      <style jsx global>{`
        .dark main:has(.auth-shell) {
          background:
            radial-gradient(circle at 12% 18%, rgba(20,121,255,.25), transparent 32%),
            radial-gradient(circle at 88% 82%, rgba(255,173,22,.13), transparent 28%),
            radial-gradient(circle at 52% 48%, rgba(99,74,120,.20), transparent 42%),
            linear-gradient(135deg, #17111b 0%, #24192b 46%, #1b2134 72%, #17111b 100%) !important;
        }

        .dark .auth-bg-grid {
          opacity: .34 !important;
          background-image:
            linear-gradient(rgba(126,164,255,.17) 1px, transparent 1px),
            linear-gradient(90deg, rgba(126,164,255,.17) 1px, transparent 1px) !important;
          background-size: 42px 42px !important;
        }

        .dark .auth-network-lines {
          opacity: .30 !important;
          filter: drop-shadow(0 0 5px rgba(106,168,255,.16));
        }

        .dark .auth-network-dot {
          opacity: .95;
          filter: drop-shadow(0 0 7px rgba(106,168,255,.52));
        }

        .dark .auth-shell {
          background: linear-gradient(145deg, #36323a 0%, #302e33 52%, #2c2931 100%) !important;
          border-color: rgba(255,255,255,.14) !important;
        }

        .dark .auth-shell > section:last-child {
          background: linear-gradient(145deg, #36323a 0%, #302e33 58%, #2c2931 100%) !important;
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
    <button type="button" className="flex h-[48px] w-full items-center justify-center gap-2 rounded-[16px] border border-[#ccd9e7] bg-white text-[11px] font-bold text-[#17386d] transition-all duration-500 ease-[cubic-bezier(.22,.8,.25,1)] hover:bg-[#f3f7fb] dark:border-white/[.18] dark:bg-[#504c55] dark:text-white dark:hover:border-white/[.28] dark:hover:bg-[#5b5761] sm:text-[12px]">
      {children}
    </button>
  );
}
