"use client";

import { Phone } from "lucide-react";
import type { ArabCountry } from "@/components/auth/auth-content";
import { SelectDropdown } from "@/components/ui/select-dropdown";

type CountryPhoneInputProps = {
  label?: string;
  countries: ArabCountry[];
  country: ArabCountry;
  onCountryChange: (country: ArabCountry) => void;
  phone: string;
  onPhoneChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  name?: string;
  autoComplete?: string;
};

const emojiStyle = {
  fontFamily: '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif',
};

export function CountryPhoneInput({
  label = "رقم الهاتف *",
  countries,
  country,
  onCountryChange,
  phone,
  onPhoneChange,
  placeholder = "أدخل رقم الهاتف",
  className = "",
  name = "phone",
  autoComplete = "tel",
}: CountryPhoneInputProps) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-2.5 block text-[12px] font-bold text-[#17386d] dark:text-[#f4f1f5] sm:text-[13px]">
        {label}
      </span>

      <div className="group relative">
        <span className="pointer-events-none absolute inset-[-3px] rounded-[19px] bg-gradient-to-l from-[#1479ff]/0 via-[#1479ff]/0 to-[#8ab5ff]/0 opacity-0 blur-md transition-all duration-300 group-hover:opacity-30 group-focus-within:from-[#1479ff]/35 group-focus-within:via-[#5d9bff]/15 group-focus-within:to-[#8ab5ff]/30 group-focus-within:opacity-100" />

        <div
          className="relative flex h-[52px] origin-center overflow-visible rounded-[17px] border border-[#ccd9e7] bg-white transition-all duration-300 ease-[cubic-bezier(.22,.8,.25,1)] hover:-translate-y-[1px] hover:border-[#9eb6d0] hover:shadow-[0_8px_22px_rgba(20,121,255,.08)] group-focus-within:-translate-y-[2px] group-focus-within:scale-[1.018] group-focus-within:border-[#4c8dff]/90 group-focus-within:shadow-[0_13px_34px_rgba(20,121,255,.17)] group-focus-within:ring-4 group-focus-within:ring-[#1479ff]/10 dark:border-white/[.10] dark:bg-[#211a25] dark:hover:border-white/[.20] dark:hover:bg-[#26202a] dark:group-focus-within:border-[#6aa8ff] dark:group-focus-within:bg-[#211a25] dark:group-focus-within:shadow-[0_14px_36px_rgba(20,121,255,.20)] dark:group-focus-within:ring-[#1479ff]/20"
          dir="ltr"
        >
          <SelectDropdown
            value={country}
            items={countries}
            getKey={(item) => `${item.name}-${item.code}`}
            onChange={onCountryChange}
            className="h-full w-[142px] shrink-0 border-r border-[#dbe5ef] dark:border-white/[.09] sm:w-[154px]"
            buttonClassName="px-2 text-[10px] font-semibold text-[#17386d] transition-colors duration-300 dark:text-[#f4f1f5] sm:text-[11px]"
            menuClassName="w-[240px]"
            align="left"
            renderValue={(item) => (
              <span className="flex min-w-0 items-center justify-center gap-1.5">
                <span className="grid h-6 w-7 shrink-0 place-items-center rounded-md bg-[#edf3f8] text-[18px] leading-none shadow-sm dark:bg-white/[.07]" style={emojiStyle} aria-hidden="true">
                  {item.flag}
                </span>
                <span className="truncate">{item.name}</span>
                <span dir="ltr" className="shrink-0">{item.code}</span>
              </span>
            )}
            renderItem={(item, active) => (
              <span className={`flex w-full items-center justify-between px-2.5 py-2 text-[11px] ${active ? "font-bold" : ""}`} dir="rtl">
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="grid h-7 w-8 shrink-0 place-items-center rounded-md bg-[#edf3f8] text-[20px] leading-none shadow-sm dark:bg-white/[.07]" style={emojiStyle} aria-hidden="true">
                    {item.flag}
                  </span>
                  <span className="truncate">{item.name}</span>
                </span>
                <span dir="ltr" className="shrink-0 font-semibold">{item.code}</span>
              </span>
            )}
          />

          <div className="relative min-w-0 flex-1" dir="rtl">
            <span className="pointer-events-none absolute right-2.5 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-[#e8eff6] text-[#0758e9] transition-all duration-300 ease-[cubic-bezier(.22,.8,.25,1)] group-hover:scale-[1.05] group-focus-within:rotate-[4deg] group-focus-within:scale-[1.12] group-focus-within:bg-[#dceaff] group-focus-within:shadow-[0_6px_18px_rgba(20,121,255,.18)] dark:bg-[#38363c] dark:text-[#8ab5ff] dark:group-focus-within:bg-[#454149]">
              <Phone className="h-5 w-5" />
            </span>
            <input
              name={name}
              autoComplete={autoComplete}
              value={phone}
              onChange={(event) => onPhoneChange(event.target.value)}
              placeholder={placeholder}
              inputMode="tel"
              className="h-full w-full bg-transparent pr-[58px] pl-3 text-[13px] text-[#17386d] outline-none placeholder:text-slate-400 dark:text-[#f4f1f5] dark:placeholder:text-[#8f8894] sm:text-[14px]"
            />
          </div>
        </div>
      </div>
    </label>
  );
}
