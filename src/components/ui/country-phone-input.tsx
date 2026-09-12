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
  return (
    <label className={`block ${className}`}>
      <span className="mb-[5px] block text-[11px] font-bold leading-[14px] text-[#17386d] dark:text-[#f4f1f5]">{label}</span>
      <div className="group relative">
        <span className="pointer-events-none absolute inset-[-3px] rounded-[16px] bg-gradient-to-l from-[#1479ff]/0 via-[#1479ff]/0 to-[#8ab5ff]/0 opacity-0 blur-md transition-all duration-300 group-hover:opacity-30 group-focus-within:from-[#1479ff]/35 group-focus-within:via-[#5d9bff]/15 group-focus-within:to-[#8ab5ff]/30 group-focus-within:opacity-100" />
        <div className="relative flex h-[44px] origin-center overflow-visible rounded-[14px] border border-[#ccd9e7] bg-white transition-all duration-300 dark:border-white/[.10] dark:bg-[#211a25]" dir="ltr">
          <SelectDropdown value={country} items={countries} getKey={(item) => `${item.name}-${item.code}`} onChange={onCountryChange} className="h-full w-[142px] shrink-0 border-r border-[#dbe5ef] dark:border-white/[.09] sm:w-[154px]" buttonClassName="px-2 text-[10px] font-semibold text-[#17386d] dark:text-[#f4f1f5]" menuClassName="w-[240px]" align="left" renderValue={(item) => <span className="flex min-w-0 items-center justify-center gap-1.5"><CountryFlag country={item} /><span className="truncate">{item.name}</span><span dir="ltr" className="shrink-0">{item.code}</span></span>} renderItem={(item, active) => <span className={`flex w-full items-center justify-between px-2.5 py-2 text-[11px] ${active ? "font-bold" : ""}`} dir="rtl"><span className="flex min-w-0 items-center gap-2.5"><CountryFlag country={item} size="large" /><span className="truncate">{item.name}</span></span><span dir="ltr" className="shrink-0 font-semibold">{item.code}</span></span>} />
          <div className="relative min-w-0 flex-1" dir="rtl">
            <span className={`pointer-events-none absolute right-2 top-1/2 z-10 grid h-[34px] w-[34px] -translate-y-1/2 place-items-center rounded-full bg-[#e8eff6] text-[#0758e9] transition-all duration-200 dark:bg-[#38363c] dark:text-[#8ab5ff] ${hasValue ? "scale-75 opacity-0" : "opacity-100"}`}><Phone className="h-[18px] w-[18px]" /></span>
            <input name={name} autoComplete={autoComplete} value={phone} onChange={(event) => onPhoneChange(event.target.value)} placeholder={placeholder} inputMode="tel" style={{ fontFamily: "LBC, Tahoma, Arial, sans-serif", fontSize: `${adaptivePhoneFontSize(phone)}px` }} className={`h-full w-full bg-transparent text-[#17386d] outline-none transition-[font-size,padding] duration-300 placeholder:text-[11px] placeholder:text-slate-400 dark:text-[#f4f1f5] dark:placeholder:text-[#8f8894] ${hasValue ? "px-3" : "pr-[52px] pl-3"}`} />
          </div>
        </div>
      </div>
    </label>
  );
}
