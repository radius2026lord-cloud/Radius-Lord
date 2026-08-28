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
};

export function CompactField({
  label,
  icon: Icon,
  type = "text",
  value,
  onChange,
  placeholder,
  suffix,
}: CompactFieldProps) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-bold text-[#17386d] dark:text-slate-200">
        {label}
      </span>
      <div className="relative">
        <Icon className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="h-[36px] w-full rounded-[9px] border border-[#ccd9e7] bg-white pr-9 pl-9 text-[11px] text-[#17386d] outline-none transition placeholder:text-slate-400 focus:border-[#4b92ef] focus:ring-2 focus:ring-[#147bff]/10 dark:border-[#304861] dark:bg-[#091c30] dark:text-white"
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
      className="flex h-[37px] w-full items-center justify-center gap-2 rounded-[9px] bg-gradient-to-l from-[#0d6ef0] to-[#0754d8] text-[11px] font-bold text-white shadow-sm transition hover:brightness-105"
    >
      {children}
    </button>
  );
}

export function SecondaryFormButton({ children }: { children: ReactNode }) {
  return (
    <button
      type="button"
      className="flex h-[37px] w-full items-center justify-center gap-2 rounded-[9px] border border-[#ccd9e7] bg-white text-[10px] font-bold text-[#17386d] transition hover:bg-slate-50 dark:border-[#304861] dark:bg-[#091c30] dark:text-white dark:hover:bg-[#0d243b]"
    >
      {children}
    </button>
  );
}
