"use client";

import { useState } from "react";
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

function CountryFlag({ country, size = "small" }: { country: ArabCountry; size?: "small" | "large" }) {
  const width = size === "large" ? 28 : 24;
  const height = size === "large" ? 21 : 18;
  return <span className={`grid shrink-0 place-items-center overflow-hidden rounded-[5px] bg-[#edf3f8] shadow-sm ring-1 ring-black/[.05] dark:bg-white/[.07] dark:ring-white/[.08] ${size === "large" ? "h-[23px] w-[30px]" : "h-5 w-[26px]"}`} aria-hidden="true"><img src={`https://flagcdn.com/${width}x${height}/${country.iso2}.png`} srcSet={`https://flagcdn.com/${width * 2}x${height * 2}/${country.iso2}.png 2x`} width={width} height={height} alt="" className="block h-auto max-h-full w-auto max-w-full object-cover" loading="lazy" /></span>;
}

function adaptivePhoneFontSize(value: string) {
  const length = Array.from(value).length;
  if (length <= 18) return 12;
  if (length <= 22) return 11;
  if (length <= 26) return 10;
  if (length <= 30) return 9;
  if (length <= 36) return 8.5;
  return 8;
}

export function CountryPhoneInput({ label = "رقم الهاتف *", countries, country, onCountryChange, phone, onPhoneChange, placeholder = "أدخل رقم الهاتف", className = "", name = "phone", autoComplete = "tel" }: CountryPhoneInputProps) {
  const hasValue = phone.length > 0;
  const [numberWarning, setNumberWarning] = useState(false);

  const handlePhoneChange = (nextValue: string) => {
    const digitsOnly = nextValue.replace(/[^0-9]/g, "");
    setNumberWarning(digitsOnly !== nextValue);
    onPhoneChange(digitsOnly.slice(0, 25));
  };

  return (
    <label className={`block ${className}`}>
      <span className="mb-[5px] block text-[11px] font-bold leading-[14px] text-[#17386d] dark:text-[#f4f1f5]">{label}</span>
      <div className={`group relative origin-center transition-[transform,filter] duration-[620ms] ease-[cubic-bezier(.16,1,.3,1)] ${hasValue ? "scale-[1.018]" : "scale-100"}`}>
        <span className={`pointer-events-none absolute inset-[-5px] rounded-[18px] bg-gradient-to-l from-[#1479ff]/35 via-[#5d9bff]/20 to-[#8ab5ff]/35 blur-[10px] transition-all duration-[620ms] ease-[cubic-bezier(.16,1,.3,1)] ${hasValue ? "scale-[1.015] opacity-65" : "scale-95 opacity-0 group-hover:opacity-25 group-focus-within:scale-100 group-focus-within:opacity-55"}`} />
        <div className={`relative flex h-[44px] origin-center overflow-visible rounded-[14px] border bg-white transition-[border-color,box-shadow,background-color] duration-[620ms] ease-[cubic-bezier(.16,1,.3,1)] dark:bg-[#211a25] ${hasValue ? "border-[#6aa8ff] shadow-[0_0_0_1px_rgba(20,121,255,.16),0_8px_24px_rgba(20,121,255,.10)] dark:border-[#6aa8ff]/80 dark:shadow-[0_0_0_1px_rgba(106,168,255,.12),0_8px_26px_rgba(20,121,255,.10)]" : "border-[#ccd9e7] dark:border-white/[.10]"}`} dir="ltr">
          <SelectDropdown value={country} items={countries} getKey={(item) => `${item.name}-${item.code}`} onChange={onCountryChange} className="h-full w-[142px] shrink-0 border-r border-[#dbe5ef] dark:border-white/[.09] sm:w-[154px]" buttonClassName="px-2 text-[10px] font-semibold text-[#17386d] dark:text-[#f4f1f5]" menuClassName="w-[240px]" align="left" renderValue={(item) => <span className="flex min-w-0 items-center justify-center gap-1.5"><CountryFlag country={item} /><span className="truncate">{item.name}</span><span dir="ltr" className="shrink-0">{item.code}</span></span>} renderItem={(item, active) => <span className={`flex w-full items-center justify-between px-2.5 py-2 text-[11px] ${active ? "font-bold" : ""}`} dir="rtl"><span className="flex min-w-0 items-center gap-2.5"><CountryFlag country={item} size="large" /><span className="truncate">{item.name}</span></span><span dir="ltr" className="shrink-0 font-semibold">{item.code}</span></span>} />
          <div className="relative min-w-0 flex-1" dir="rtl">
            <span className={`pointer-events-none absolute right-2 top-1/2 z-10 grid h-[34px] w-[34px] -translate-y-1/2 place-items-center rounded-full bg-[#e8eff6] text-[#0758e9] opacity-100 transition-[transform,background-color,box-shadow] duration-[620ms] ease-[cubic-bezier(.16,1,.3,1)] dark:bg-[#38363c] dark:text-[#8ab5ff] ${hasValue ? "translate-x-[-2px] rotate-[3deg] scale-[1.10] shadow-[0_0_14px_rgba(20,121,255,.20)] dark:shadow-[0_0_16px_rgba(106,168,255,.18)]" : "scale-100"}`}><Phone className="h-[18px] w-[18px]" /></span>
            <input
              name={name}
              autoComplete={autoComplete}
              value={phone}
              onChange={(event) => handlePhoneChange(event.target.value)}
              placeholder={placeholder}
              inputMode="numeric"
              maxLength={25}
              pattern="[0-9]{1,25}"
              style={{ fontFamily: "LBC, Tahoma, Arial, sans-serif", fontSize: `${adaptivePhoneFontSize(phone)}px` }}
              className="h-full w-full bg-transparent pr-[52px] pl-3 text-[#17386d] outline-none transition-[font-size,padding] duration-[620ms] ease-[cubic-bezier(.16,1,.3,1)] placeholder:text-[11px] placeholder:text-slate-400 dark:text-[#f4f1f5] dark:placeholder:text-[#8f8894]"
            />
          </div>
        </div>
      </div>
      {numberWarning && (
        <span className="auth-field-warning mt-1 block text-[9px] font-semibold text-[#c2410c] dark:text-[#ffb067]">
          يرجى استخدام الأرقام الإنكليزية من 0 إلى 9 فقط.
        </span>
      )}
    </label>
  );
}
