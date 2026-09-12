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
  const loginEnglishOnly = name === "username" || name === "password";
  const signupEnglishOnly = name === "email" || name === "new-password" || name === "confirm-password";
  const hasValue = value.length > 0;
  const [languageWarning, setLanguageWarning] = useState(false);

  const handleChange = (nextValue: string) => {
    if (loginEnglishOnly || signupEnglishOnly) {
      const englishOnly = emailField
        ? nextValue.replace(/[^A-Za-z0-9.!#$%&'*+/=?^_`{|}~@-]/g, "")
        : nextValue.replace(/[^\x21-\x7E]/g, "");
      setLanguageWarning(englishOnly !== nextValue);
      onChange(englishOnly);
      return;
    }

    onChange(nextValue);
  };

  const inputFontSize = loginEnglishOnly ? 12 : adaptiveInputFontSize(value);
  const inputPadding = suffix ? "pr-[52px] pl-10" : "pr-[52px] pl-3";

  return (
    <label className={`block ${className}`}>
      <span className="mb-[5px] block text-[11px] font-bold leading-[14px] text-[#17386d] dark:text-[#f4f1f5]">{label}</span>
      <div className={`group auth-input-stage relative z-0 origin-center transition-[transform,filter] duration-[900ms] ease-[cubic-bezier(.16,1,.3,1)] ${hasValue ? "auth-input-stage-active z-10 scale-[1.055]" : "scale-100"}`}>
        <span className={`auth-input-glow pointer-events-none absolute inset-[-9px] -z-10 rounded-[22px] bg-gradient-to-l from-[#1479ff]/70 via-[#5d9bff]/45 to-[#8ab5ff]/70 blur-[16px] transition-[opacity,transform,filter] duration-[900ms] ease-[cubic-bezier(.16,1,.3,1)] ${hasValue ? "scale-[1.055] opacity-100" : "scale-90 opacity-0 group-hover:opacity-20 group-focus-within:scale-100 group-focus-within:opacity-60"}`} />
        <span className={`auth-input-icon absolute right-2 top-1/2 z-10 grid h-[34px] w-[34px] -translate-y-1/2 place-items-center rounded-full bg-[#e8eff6] text-[#0758e9] opacity-100 transition-[transform,background-color,box-shadow] duration-[900ms] ease-[cubic-bezier(.16,1,.3,1)] dark:bg-[#38363c] dark:text-[#8ab5ff] ${hasValue ? "translate-x-[-6px] rotate-[9deg] scale-[1.20] bg-[#dceaff] shadow-[0_0_22px_rgba(20,121,255,.46)] dark:bg-[#454149] dark:shadow-[0_0_24px_rgba(106,168,255,.38)]" : "scale-100 group-hover:scale-[1.04] group-focus-within:rotate-[2deg] group-focus-within:scale-[1.07] group-focus-within:bg-[#dceaff] dark:group-focus-within:bg-[#454149]"}`}>
          <Icon className="h-[18px] w-[18px]" />
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
          autoCapitalize={emailField || loginEnglishOnly || signupEnglishOnly ? "none" : undefined}
          spellCheck={emailField || loginEnglishOnly || signupEnglishOnly ? false : undefined}
          lang={emailField || loginEnglishOnly || signupEnglishOnly ? "en" : undefined}
          dir={emailField || loginEnglishOnly || signupEnglishOnly ? "ltr" : undefined}
          style={{ fontFamily: "LBC, Tahoma, Arial, sans-serif", fontSize: `${inputFontSize}px` }}
          className={`auth-input-control relative h-[44px] w-full origin-center rounded-[14px] border bg-white text-[#17386d] outline-none transition-[border-color,box-shadow,background-color,font-size,padding] duration-[900ms] ease-[cubic-bezier(.16,1,.3,1)] placeholder:text-[11px] placeholder:text-slate-400 dark:bg-[#211a25] dark:text-[#f4f1f5] dark:placeholder:text-[#8f8894] ${hasValue ? "border-[#4c8dff] shadow-[0_0_0_2px_rgba(20,121,255,.30),0_0_30px_rgba(20,121,255,.32),0_16px_38px_rgba(20,121,255,.18)] dark:border-[#6aa8ff] dark:shadow-[0_0_0_2px_rgba(106,168,255,.24),0_0_32px_rgba(106,168,255,.26),0_16px_40px_rgba(20,121,255,.18)]" : "border-[#ccd9e7] hover:border-[#9eb6d0] focus:border-[#4c8dff]/90 focus:ring-3 focus:ring-[#1479ff]/10 dark:border-white/[.10] dark:hover:border-white/[.20] dark:focus:border-[#6aa8ff] dark:focus:ring-[#1479ff]/20"} ${inputPadding}`}
        />
        {suffix}
      </div>

      {(loginEnglishOnly || signupEnglishOnly) && languageWarning && (
        <span className="auth-field-warning mt-1 block text-[9px] font-semibold text-[#c2410c] dark:text-[#ffb067]">
          يرجى استخدام الأحرف الإنكليزية والأرقام والرموز فقط.
        </span>
      )}

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
          font-size: 11px !important;
          letter-spacing: 0 !important;
        }
        .auth-login-content input[name="username"],
        .auth-login-content input[name="password"] {
          direction: ltr !important;
          text-align: left !important;
          font-size: 12px !important;
        }
        .auth-login-content input[name="username"]::placeholder,
        .auth-login-content input[name="password"]::placeholder {
          direction: rtl !important;
          text-align: right !important;
          unicode-bidi: plaintext;
        }
        .auth-input-stage-active {
          filter: drop-shadow(0 12px 18px rgba(20,121,255,.14));
        }
        .auth-input-stage-active .auth-input-glow {
          animation: authInputGlowPulse 2.2s ease-in-out infinite;
        }
        .auth-input-stage-active .auth-input-icon {
          animation: authInputIconFloat 2.6s ease-in-out infinite;
        }

        /* Focus is the main attention state: make the selected field unmistakable. */
        .auth-login-content label:focus-within > div.group,
        .auth-signup-content label:focus-within > div.group {
          z-index: 30 !important;
          transform: scale(1.065) translateY(-1px) !important;
          filter: drop-shadow(0 14px 22px rgba(20,121,255,.34));
          animation: authFieldFocusLift 1.15s cubic-bezier(.16,1,.3,1) both;
        }
        .auth-login-content label:focus-within > div.group > span.pointer-events-none,
        .auth-signup-content label:focus-within > div.group > span.pointer-events-none {
          opacity: 1 !important;
          transform: scale(1.12) !important;
          filter: saturate(1.65) blur(17px) !important;
          animation: authFieldFocusGlow 1.45s ease-in-out infinite !important;
        }
        .auth-login-content label:focus-within > div.group input,
        .auth-signup-content label:focus-within > div.group input {
          border-color: #6aa8ff !important;
          box-shadow: 0 0 0 2px rgba(106,168,255,.48), 0 0 14px rgba(20,121,255,.60), 0 0 34px rgba(20,121,255,.48), 0 18px 42px rgba(20,121,255,.24) !important;
        }
        .auth-login-content label:focus-within > div.group .auth-input-icon,
        .auth-signup-content label:focus-within > div.group .auth-input-icon {
          transform: translate(-7px,-50%) rotate(8deg) scale(1.22) !important;
          box-shadow: 0 0 0 2px rgba(106,168,255,.20), 0 0 24px rgba(20,121,255,.55) !important;
          animation: authFocusedIcon 1.45s ease-in-out infinite !important;
        }
        @keyframes authFieldFocusLift {
          0% { transform: scale(1) translateY(0); filter: drop-shadow(0 0 0 rgba(20,121,255,0)); }
          45% { transform: scale(1.075) translateY(-2px); filter: drop-shadow(0 18px 30px rgba(20,121,255,.42)); }
          100% { transform: scale(1.065) translateY(-1px); filter: drop-shadow(0 14px 22px rgba(20,121,255,.34)); }
        }
        @keyframes authFieldFocusGlow {
          0%, 100% { opacity: .78; transform: scale(1.04); filter: saturate(1.35) blur(14px); }
          50% { opacity: 1; transform: scale(1.15); filter: saturate(1.9) blur(19px); }
        }
        @keyframes authFocusedIcon {
          0%, 100% { margin-top: 0; }
          50% { margin-top: -3px; }
        }
        @keyframes authInputGlowPulse {
          0%, 100% { opacity: .72; transform: scale(1.02); filter: saturate(1); }
          50% { opacity: 1; transform: scale(1.075); filter: saturate(1.35); }
        }
        @keyframes authInputIconFloat {
          0%, 100% { margin-top: 0; }
          50% { margin-top: -2px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .auth-input-stage-active .auth-input-glow,
          .auth-input-stage-active .auth-input-icon,
          .auth-login-content label:focus-within > div.group,
          .auth-signup-content label:focus-within > div.group,
          .auth-login-content label:focus-within > div.group > span.pointer-events-none,
          .auth-signup-content label:focus-within > div.group > span.pointer-events-none,
          .auth-login-content label:focus-within > div.group .auth-input-icon,
          .auth-signup-content label:focus-within > div.group .auth-input-icon { animation: none !important; }
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
    <button type="submit" onClick={startLocalSubmitAnimation} disabled={disabled || busy} className={`relative flex h-[44px] w-full items-center justify-center overflow-hidden rounded-[14px] bg-gradient-to-l from-[#1479ff] to-[#0758e9] px-5 text-[12px] font-bold text-white shadow-[0_8px_22px_rgba(20,121,255,.20)] transition-all duration-300 hover:brightness-105 active:translate-y-0 disabled:cursor-wait ${effectiveStatus === "error" ? "auth-primary-error" : ""}`}>
      <span className={`auth-primary-content flex items-center justify-center gap-2 transition-all duration-300 ${busy ? "[&>span:last-child]:scale-50 [&>span:last-child]:opacity-0 [&>svg:last-child]:scale-50 [&>svg:last-child]:opacity-0" : ""}`}>{children}</span>
      {showStatusIndicator && <span className="pointer-events-none absolute left-[calc(50%-72px)] top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center">
        {effectiveStatus === "loading" && <span className="auth-primary-spinner h-[17px] w-[17px] rounded-full border-2 border-white/35 border-t-white" />}
        {effectiveStatus === "success" && <span className="auth-primary-success-arrow text-[18px] font-black leading-none">←</span>}
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
  return <button type="button" className="flex h-[44px] w-full items-center justify-center gap-2 rounded-[14px] border border-[#ccd9e7] bg-white text-[11px] font-bold text-[#17386d] transition-all duration-300 hover:bg-[#f3f7fb] dark:border-white/[.10] dark:bg-[#38363c] dark:text-[#f4f1f5] dark:hover:border-white/[.18] dark:hover:bg-[#454149]">{children}</button>;
}
