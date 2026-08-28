"use client";

import { ChevronDown, Phone } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ArabCountry } from "@/components/auth/auth-content";

type CountryPhoneInputProps = {
  label?: string;
  countries: ArabCountry[];
  country: ArabCountry;
  onCountryChange: (country: ArabCountry) => void;
  phone: string;
  onPhoneChange: (value: string) => void;
  placeholder?: string;
};

export function CountryPhoneInput({
  label = "رقم الهاتف *",
  countries,
  country,
  onCountryChange,
  phone,
  onPhoneChange,
  placeholder = "أدخل رقم الهاتف",
}: CountryPhoneInputProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-bold text-[#17386d] dark:text-slate-200">
        {label}
      </span>
      <div
        ref={rootRef}
        className="relative flex h-[36px] rounded-[9px] border border-[#ccd9e7] bg-white dark:border-[#304861] dark:bg-[#091c30]"
        dir="ltr"
      >
        <div className="relative w-[128px] shrink-0 border-r border-[#dbe5ef] dark:border-[#304861]">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="flex h-full w-full items-center justify-center gap-1.5 px-2 text-[10px] font-semibold text-[#17386d] dark:text-white"
            aria-expanded={open}
          >
            <span>{country.flag}</span>
            <span>{country.name}</span>
            <span dir="ltr">{country.code}</span>
            <ChevronDown className={`h-3 w-3 transition ${open ? "rotate-180" : ""}`} />
          </button>

          {open && (
            <div
              className="absolute left-0 top-[41px] z-50 max-h-56 w-[220px] overflow-auto rounded-[11px] border border-[#ccd9e7] bg-white p-1.5 shadow-[0_14px_38px_rgba(29,58,91,.18)] dark:border-[#304861] dark:bg-[#0b2138]"
              dir="rtl"
            >
              {countries.map((item) => {
                const active = item.code === country.code;
                return (
                  <button
                    key={`${item.name}-${item.code}`}
                    type="button"
                    onClick={() => {
                      onCountryChange(item);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-[8px] px-2.5 py-2 text-[10px] transition ${
                      active
                        ? "bg-[#edf5ff] font-bold text-[#0b5fd7] dark:bg-[#12304f] dark:text-[#70b4ff]"
                        : "text-[#17386d] hover:bg-[#f3f7fb] dark:text-slate-200 dark:hover:bg-white/[.05]"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span>{item.flag}</span>
                      <span>{item.name}</span>
                    </span>
                    <span dir="ltr">{item.code}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="relative min-w-0 flex-1" dir="rtl">
          <Phone className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={phone}
            onChange={(event) => onPhoneChange(event.target.value)}
            placeholder={placeholder}
            inputMode="tel"
            className="h-full w-full bg-transparent pr-9 pl-3 text-[11px] text-[#17386d] outline-none placeholder:text-slate-400 dark:text-white"
          />
        </div>
      </div>
    </label>
  );
}
