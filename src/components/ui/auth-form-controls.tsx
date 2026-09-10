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
    </label>
  );
}

export function PrimaryFormButton({ children }: { children: ReactNode }) {
  return (
    <button
      type="submit"
      className="flex h-[44px] w-full items-center justify-center gap-2 rounded-[12px] bg-gradient-to-l from-[#0d6ef0] to-[#0754d8] text-[12px] font-bold text-white shadow-sm transition hover:brightness-105 dark:from-[#4c8dff] dark:to-[#3977e8] dark:shadow-[0_8px_24px_rgba(76,141,255,.18)] sm:text-[13px]"
    >
      {children}
    </button>
  );
}

export function SecondaryFormButton({ children }: { children: ReactNode }) {
  return (
    <button
      type="button"
      className="flex h-[44px] w-full items-center justify-center gap-2 rounded-[12px] border border-[#ccd9e7] bg-white text-[11px] font-bold text-[#17386d] transition hover:bg-slate-50 dark:border-white/[.09] dark:bg-[#37343a] dark:text-[#f6f2f7] dark:hover:bg-[#3e3a42] sm:text-[12px]"
    >
      {children}
    </button>
  );
}
