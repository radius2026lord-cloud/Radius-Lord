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
      <span className="mb-2 block text-[11px] font-bold text-[#ece8ee] sm:text-[12px]">
        {label}
      </span>
      <div className="relative">
        <span className="absolute right-2.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-[#454149] text-[#8ab5ff]">
          <Icon className="h-4 w-4" />
        </span>
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="h-[48px] w-full rounded-[16px] border border-white/[.10] bg-[#38363c] pr-12 pl-10 text-[12px] text-[#f6f2f7] outline-none transition-all duration-500 ease-[cubic-bezier(.22,.8,.25,1)] placeholder:text-[#8f8795] hover:border-white/[.16] focus:border-[#4c8dff]/80 focus:bg-[#3d3a40] focus:ring-4 focus:ring-[#1479ff]/10 sm:text-[13px]"
        />
        {suffix}
      </div>
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
    <button type="button" className="flex h-[48px] w-full items-center justify-center gap-2 rounded-[16px] border border-white/[.10] bg-[#38363c] text-[11px] font-bold text-[#f6f2f7] transition-all duration-500 ease-[cubic-bezier(.22,.8,.25,1)] hover:border-white/[.16] hover:bg-[#454149] sm:text-[12px]">
      {children}
    </button>
  );
}
