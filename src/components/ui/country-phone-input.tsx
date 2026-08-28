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
}: CountryPhoneInputProps) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[11px] font-bold text-[#17386d] dark:text-slate-200 sm:text-[12px]">
        {label}
      </span>
      <div
        className="relative flex h-[44px] rounded-[10px] border border-[#ccd9e7] bg-white dark:border-[#304861] dark:bg-[#091c30]"
        dir="ltr"
      >
        <SelectDropdown
          value={country}
          items={countries}
          getKey={(item) => `${item.name}-${item.code}`}
          onChange={onCountryChange}
          className="h-full w-[142px] shrink-0 border-r border-[#dbe5ef] dark:border-[#304861] sm:w-[154px]"
          buttonClassName="px-2 text-[10px] font-semibold text-[#17386d] dark:text-white sm:text-[11px]"
          menuClassName="w-[230px]"
          align="left"
          renderValue={(item) => (
            <span className="flex min-w-0 items-center justify-center gap-1.5">
              <span className="text-[16px] leading-none" style={emojiStyle} aria-hidden="true">{item.flag}</span>
              <span className="truncate">{item.name}</span>
              <span dir="ltr" className="shrink-0">{item.code}</span>
            </span>
          )}
          renderItem={(item, active) => (
            <span className={`flex w-full items-center justify-between px-2.5 py-2 text-[11px] ${active ? "font-bold" : ""}`} dir="rtl">
              <span className="flex items-center gap-2">
                <span className="text-[17px] leading-none" style={emojiStyle} aria-hidden="true">{item.flag}</span>
                <span>{item.name}</span>
              </span>
              <span dir="ltr">{item.code}</span>
            </span>
          )}
        />

        <div className="relative min-w-0 flex-1" dir="rtl">
          <Phone className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={phone}
            onChange={(event) => onPhoneChange(event.target.value)}
            placeholder={placeholder}
            inputMode="tel"
            className="h-full w-full bg-transparent pr-10 pl-3 text-[12px] text-[#17386d] outline-none placeholder:text-slate-400 dark:text-white sm:text-[13px]"
          />
        </div>
      </div>
    </label>
  );
}
