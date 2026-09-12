"use client";

import { useState, type ComponentType, type MouseEvent, type ReactNode } from "react";

type IconType = ComponentType<{ className?: string }>;
export type PrimaryButtonStatus = "idle" | "loading" | "success" | "error";

type CompactFieldProps = {
  label: string;
  icon: IconType;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  suffix?: ReactNode;
  className?: string;
  name?: string;
  autoComplete?: string;
};

function adaptiveInputFontSize(value: string) {
  const length = Array.from(value).length;
  if (length <= 18) return 12;
  if (length <= 22) return 11;
  if (length <= 26) return 10;
  if (length <= 30) return 9;
  if (length <= 36) return 8.5;
  return 8;
}

export function CompactField({ label, icon: Icon, type = "text", value, onChange, placeholder, suffix, className = "", name, autoComplete }: CompactFieldProps) {
  const emailField = type === "email";
  const hasValue = value.length > 0;
  const handleChange = (nextValue: string) => {
    if (!emailField) return onChange(nextValue);
    onChange(nextValue.replace(/[^A-Za-z0-9.!#$%&'*+/=?^_`{|}~@-]/g, ""));
  };

  return (
    <label className={`block ${className}`}>
      <span className="mb-2.5 block text-[12px] font-bold text-[#17386d] dark:text-[#f4f1f5] sm:text-[13px]">{label}</span>
      <div className="group relative">
        <span className="pointer-events-none absolute inset-[-3px] rounded-[19px] bg-gradient-to-l from-[#1479ff]/0 via-[#1479ff]/0 to-[#8ab5ff]/0 opacity-0 blur-md transition-all duration-300 group-hover:opacity-30 group-focus-within:from-[#1479ff]/35 group-focus-within:via-[#5d9bff]/15 group-focus-within:to-[#8ab5ff]/30 group-focus-within:opacity-100" />
        <span className={`absolute right-2.5 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-[#e8eff6] text-[#0758e9] transition-all duration-200 ease-[cubic-bezier(.22,.8,.25,1)] dark:bg-[#38363c] dark:text-[#8ab5ff] ${hasValue ? "pointer-events-none scale-75 opacity-0" : "opacity-100 group-hover:scale-[1.05] group-focus-within:rotate-[4deg] group-focus-within:scale-[1.12] group-focus-within:bg-[#dceaff] group-focus-within:shadow-[0_6px_18px_rgba(20,121,255,.18)] dark:group-focus-within:bg-[#454149]"}`}>
          <Icon className="h-5 w-5" />
        </span>
        <input
          type={type}
          name={name}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => handleChange(event.target.value)}
          placeholder={placeholder}
          inputMode={emailField ? "email" : undefined}
          maxLength={emailField ? 254 : undefined}
          pattern={emailField ? "[A-Za-z0-9._%+\\-]+@[A-Za-z0-9.\\-]+\\.[A-Za-z]{2,}" : undefined}
          autoCapitalize={emailField ? "none" : undefined}
          spellCheck={emailField ? false : undefined}
          lang={emailField ? "en" : undefined}
          dir={emailField ? "ltr" : undefined}
          style={{
            fontFamily: "LBC, Tahoma, Arial, sans-serif",
            fontSize: `${adaptiveInputFontSize(value)}px`,
          }}
          className={`relative h-[52px] w-full origin-center rounded-[17px] border border-[#ccd9e7] bg-white text-[#17386d] outline-none transition-[transform,border-color,box-shadow,background-color,font-size,padding] duration-300 ease-[cubic-bezier(.22,.8,.25,1)] placeholder:text-[12px] placeholder:text-slate-400 hover:-translate-y-[1px] hover:border-[#9eb6d0] hover:shadow-[0_8px_22px_rgba(20,121,255,.08)] focus:-translate-y-[2px] focus:scale-[1.018] focus:border-[#4c8dff]/90 focus:shadow-[0_13px_34px_rgba(20,121,255,.17)] focus:ring-4 focus:ring-[#1479ff]/10 dark:border-white/[.10] dark:bg-[#211a25] dark:text-[#f4f1f5] dark:placeholder:text-[#8f8894] dark:hover:border-white/[.20] dark:hover:bg-[#26202a] dark:focus:border-[#6aa8ff] dark:focus:bg-[#211a25] dark:focus:shadow-[0_14px_36px_rgba(20,121,255,.20)] dark:focus:ring-[#1479ff]/20 ${hasValue ? (suffix ? "pr-3 pl-11" : "px-3") : "pr-[58px] pl-11"}`}
        />
        {suffix}
      </div>
      <style jsx global>{`
        .auth-signup-content input[name="email"] {
          direction: ltr !important;
          text-align: left !important;
          font-family: LBC, Tahoma, Arial, sans-serif !important;
          letter-spacing: 0 !important;
        }
        .auth-signup-content input[name="email"]::placeholder {
          direction: ltr !important;
          text-align: left !important;
          unicode-bidi: plaintext;
          font-family: LBC, Tahoma, Arial, sans-serif !important;
          font-size: 12px !important;
          letter-spacing: 0 !important;
        }
      `}</style>
    </label>
  );
}

export function PrimaryFormButton({ children, status, disabled = false }: { children: ReactNode; status?: PrimaryButtonStatus; disabled?: boolean }) {
  const [localStatus, setLocalStatus] = useState<PrimaryButtonStatus>("idle");
  const controlled = status !== undefined;
  const effectiveStatus = status ?? localStatus;
  const busy = effectiveStatus === "loading" || effectiveStatus === "success";
  const showStatusIndicator = effectiveStatus === "loading" || effectiveStatus === "success";

  const startLocalSubmitAnimation = (event: MouseEvent<HTMLButtonElement>) => {
    if (controlled || localStatus !== "idle") return;
    const form = event.currentTarget.form;
    const signupRoot = event.currentTarget.closest(".auth-signup-content");
    if (signupRoot && form) {
      const requiredNames = ["name", "email", "phone", "new-password", "confirm-password"];
      const requiredInputs = requiredNames.map((n) => form.querySelector<HTMLInputElement>(`input[name="${n}"]`)).filter((i): i is HTMLInputElement => Boolean(i));
      const terms = form.querySelector<HTMLInputElement>('input[type="checkbox"]');
      const password = form.querySelector<HTMLInputElement>('input[name="new-password"]');
      const confirmPassword = form.querySelector<HTMLInputElement>('input[name="confirm-password"]');
      const hasEmptyRequired = requiredInputs.length !== requiredNames.length || requiredInputs.some((input) => !input.value.trim());
      const passwordsMismatch = Boolean(password && confirmPassword && password.value !== confirmPassword.value);
      const hasInvalidField = !form.checkValidity();
      if (hasInvalidField) { event.preventDefault(); form.reportValidity(); }
      if (hasEmptyRequired || !terms?.checked || passwordsMismatch || hasInvalidField) {
        setLocalStatus("error");
        window.setTimeout(() => setLocalStatus("idle"), 560);
        return;
      }
    }
    setLocalStatus("loading");
    window.setTimeout(() => setLocalStatus("success"), 420);
    window.setTimeout(() => setLocalStatus("idle"), 1050);
  };

  return <>
    <button type="submit" onClick={startLocalSubmitAnimation} disabled={disabled || busy} className={`relative flex h-[52px] w-full items-center justify-center overflow-hidden rounded-[17px] bg-gradient-to-l from-[#1479ff] to-[#0758e9] px-6 text-[13px] font-bold text-white shadow-[0_10px_28px_rgba(20,121,255,.22)] transition-all duration-300 ease-[cubic-bezier(.22,.8,.25,1)] hover:-translate-y-0.5 hover:brightness-105 hover:shadow-[0_14px_34px_rgba(20,121,255,.30)] active:translate-y-0 disabled:cursor-wait sm:text-[14px] ${effectiveStatus === "error" ? "auth-primary-error" : ""}`}>
      <span className={`auth-primary-content flex items-center justify-center gap-2 transition-all duration-300 ${busy ? "[&>span:last-child]:scale-50 [&>span:last-child]:opacity-0 [&>svg:last-child]:scale-50 [&>svg:last-child]:opacity-0" : ""}`}>{children}</span>
      {showStatusIndicator && <span className="pointer-events-none absolute left-[calc(50%-78px)] top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center">
        {effectiveStatus === "loading" && <span className="auth-primary-spinner h-[19px] w-[19px] rounded-full border-2 border-white/35 border-t-white" />}
        {effectiveStatus === "success" && <span className="auth-primary-success-arrow text-[20px] font-black leading-none">←</span>}
      </span>}
    </button>
    {controlled && effectiveStatus === "success" && <div className="auth-success-overlay fixed inset-0 z-[140] flex items-center justify-center bg-[#dce5ef]/20 backdrop-blur-[2px] dark:bg-[#1d1721]/25" aria-live="polite" aria-label="تم تسجيل الدخول بنجاح">
      <div className="auth-success-card flex min-w-[220px] flex-col items-center rounded-[24px] border border-white/75 bg-white/90 px-8 py-7 shadow-[0_24px_72px_rgba(31,74,132,.20)] backdrop-blur-xl dark:border-white/[.10] dark:bg-[#302e33]/90 dark:shadow-[0_26px_80px_rgba(0,0,0,.34)]">
        <div className="relative grid h-16 w-16 place-items-center rounded-full bg-[#1479ff]/10 text-[#0758e9] dark:bg-[#6aa8ff]/10 dark:text-[#8ab5ff]"><span className="auth-success-ring absolute inset-0 rounded-full border-2 border-[#1479ff]/30 dark:border-[#6aa8ff]/30" /><span className="auth-success-card-arrow text-[28px] font-black leading-none">←</span></div>
        <div className="mt-4 text-sm font-black text-[#102a63] dark:text-[#f4f1f5]">تم تسجيل الدخول بنجاح</div>
        <div className="mt-1 text-[11px] text-slate-500 dark:text-[#b9b3bd]">جارٍ فتح لوحة التحكم...</div>
      </div>
    </div>}
  </>;
}

export function SecondaryFormButton({ children }: { children: ReactNode }) {
  return <button type="button" className="flex h-[52px] w-full items-center justify-center gap-2 rounded-[17px] border border-[#ccd9e7] bg-white text-[12px] font-bold text-[#17386d] transition-all duration-500 ease-[cubic-bezier(.22,.8,.25,1)] hover:bg-[#f3f7fb] dark:border-white/[.10] dark:bg-[#38363c] dark:text-[#f4f1f5] dark:hover:border-white/[.18] dark:hover:bg-[#454149] sm:text-[13px]">{children}</button>;
}
