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

export function CompactField({
  label,
  icon: Icon,
  type = "text",
  value,
  onChange,
  placeholder,
  suffix,
  className = "",
  name,
  autoComplete,
}: CompactFieldProps) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-2.5 block text-[12px] font-bold text-[#17386d] dark:text-[#f4f1f5] sm:text-[13px]">
        {label}
      </span>
      <div className="group relative">
        <span className="pointer-events-none absolute inset-[-3px] rounded-[19px] bg-gradient-to-l from-[#1479ff]/0 via-[#1479ff]/0 to-[#8ab5ff]/0 opacity-0 blur-md transition-all duration-300 group-hover:opacity-30 group-focus-within:from-[#1479ff]/35 group-focus-within:via-[#5d9bff]/15 group-focus-within:to-[#8ab5ff]/30 group-focus-within:opacity-100" />
        <span className="absolute right-2.5 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-[#e8eff6] text-[#0758e9] transition-all duration-300 ease-[cubic-bezier(.22,.8,.25,1)] group-hover:scale-[1.05] group-focus-within:rotate-[4deg] group-focus-within:scale-[1.12] group-focus-within:bg-[#dceaff] group-focus-within:shadow-[0_6px_18px_rgba(20,121,255,.18)] dark:bg-[#38363c] dark:text-[#8ab5ff] dark:group-focus-within:bg-[#454149]">
          <Icon className="h-5 w-5" />
        </span>
        <input
          type={type}
          name={name}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="relative h-[52px] w-full origin-center rounded-[17px] border border-[#ccd9e7] bg-white pr-[58px] pl-11 text-[13px] text-[#17386d] outline-none transition-all duration-300 ease-[cubic-bezier(.22,.8,.25,1)] placeholder:text-slate-400 hover:-translate-y-[1px] hover:border-[#9eb6d0] hover:shadow-[0_8px_22px_rgba(20,121,255,.08)] focus:-translate-y-[2px] focus:scale-[1.018] focus:border-[#4c8dff]/90 focus:shadow-[0_13px_34px_rgba(20,121,255,.17)] focus:ring-4 focus:ring-[#1479ff]/10 dark:border-white/[.10] dark:bg-[#211a25] dark:text-[#f4f1f5] dark:placeholder:text-[#8f8894] dark:hover:border-white/[.20] dark:hover:bg-[#26202a] dark:focus:border-[#6aa8ff] dark:focus:bg-[#211a25] dark:focus:shadow-[0_14px_36px_rgba(20,121,255,.20)] dark:focus:ring-[#1479ff]/20 sm:text-[14px]"
        />
        {suffix}
      </div>

      <style jsx global>{`
        @view-transition {
          navigation: auto;
        }

        ::view-transition-group(root) {
          animation-duration: .42s;
          animation-timing-function: cubic-bezier(.22,.8,.25,1);
        }

        ::view-transition-old(root) {
          animation: authPageOut .30s cubic-bezier(.4,0,.35,1) both;
        }

        ::view-transition-new(root) {
          animation: authPageIn .42s cubic-bezier(.22,.8,.25,1) both;
        }

        @keyframes authPageOut {
          from { opacity: 1; transform: translate3d(0,0,0) scale(1); }
          to { opacity: .08; transform: translate3d(0,-2px,0) scale(.998); }
        }

        @keyframes authPageIn {
          from { opacity: .08; transform: translate3d(0,3px,0) scale(.998); }
          60% { opacity: .96; }
          to { opacity: 1; transform: translate3d(0,0,0) scale(1); }
        }

        @keyframes authModeContentIn {
          0% { opacity: 0; transform: translate3d(0,6px,0) scale(.995); }
          62% { opacity: .94; transform: translate3d(0,1px,0) scale(.999); }
          100% { opacity: 1; transform: translate3d(0,0,0) scale(1); }
        }

        @keyframes authFeaturePanelIn {
          0% { opacity: 0; transform: translate3d(-10px,0,0); }
          100% { opacity: 1; transform: translate3d(0,0,0); }
        }

        .auth-shell {
          transition-duration: 520ms !important;
          transition-timing-function: cubic-bezier(.22,.8,.25,1) !important;
          will-change: width, max-width, transform, opacity;
        }

        .auth-login-content,
        .auth-signup-content {
          animation: authModeContentIn .42s cubic-bezier(.22,.8,.25,1) both;
          will-change: transform, opacity;
        }

        .auth-shell:has(.auth-signup-content) > section:first-child {
          animation: authFeaturePanelIn .46s .04s cubic-bezier(.22,.8,.25,1) both;
          will-change: transform, opacity;
        }

        .dark main:has(.auth-shell) {
          background: #1d1721 !important;
        }

        .dark .auth-bg-grid {
          opacity: .68 !important;
          background-image:
            linear-gradient(rgba(126,164,255,.30) 1px, transparent 1px),
            linear-gradient(90deg, rgba(126,164,255,.30) 1px, transparent 1px) !important;
          background-size: 28px 28px !important;
        }

        .dark .auth-network-lines {
          opacity: .66 !important;
          filter: drop-shadow(0 0 8px rgba(106,168,255,.34));
        }

        .dark .auth-network-dot {
          opacity: 1 !important;
          filter: drop-shadow(0 0 9px rgba(106,168,255,.72));
        }

        .dark .auth-shell {
          background: rgba(48,46,51,.96) !important;
          border-color: rgba(255,255,255,.10) !important;
          box-shadow: 0 28px 80px rgba(0,0,0,.30) !important;
          backdrop-filter: blur(14px);
        }

        .dark .auth-shell > section:last-child {
          background: rgba(48,46,51,.95) !important;
          backdrop-filter: blur(12px);
        }

        .auth-signup-content {
          max-width: 418px !important;
        }

        .auth-signup-content > .text-center .auth-login-icon {
          width: 44px !important;
          height: 44px !important;
        }

        .auth-signup-content > .text-center h1 {
          margin-top: 8px !important;
          font-size: 22px !important;
          line-height: 1.2 !important;
        }

        .auth-signup-content > .text-center p {
          margin-top: 4px !important;
          font-size: 11px !important;
          line-height: 16px !important;
        }

        .auth-signup-content form {
          margin-top: 12px !important;
        }

        .auth-signup-content form > div {
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          column-gap: 14px !important;
          row-gap: 7px !important;
        }

        .auth-signup-content label > span:first-child {
          margin-bottom: 5px !important;
          font-size: 11px !important;
          line-height: 14px !important;
        }

        .auth-signup-content label > .group > input {
          height: 44px !important;
          border-radius: 14px !important;
          padding-right: 52px !important;
          font-size: 12px !important;
        }

        .auth-signup-content label > .group > span.absolute:not(.pointer-events-none) {
          right: 8px !important;
          width: 34px !important;
          height: 34px !important;
        }

        .auth-signup-content label > .group > div[dir="ltr"] {
          height: 44px !important;
          border-radius: 14px !important;
        }

        .auth-signup-content label > .group > div[dir="ltr"] span.absolute {
          right: 8px !important;
          width: 34px !important;
          height: 34px !important;
        }

        .auth-signup-content label > .group > div[dir="ltr"] input {
          padding-right: 52px !important;
          font-size: 12px !important;
        }

        .auth-signup-content form button[type="submit"],
        .auth-signup-content form button[type="button"]:not(label button) {
          height: 44px !important;
          border-radius: 14px !important;
        }

        .auth-signup-content form > div > div:has(> button[type="submit"]) {
          padding-top: 1px;
        }

        .auth-signup-content form > div > label.flex {
          font-size: 9px !important;
          line-height: 16px !important;
        }

        .auth-signup-content form > div > .text-center,
        .auth-signup-content form > div > .flex.items-center {
          font-size: 9px !important;
        }

        @media (min-width: 1024px) {
          .auth-shell:has(.auth-signup-content) {
            max-width: 1000px !important;
            height: min(610px, calc(100dvh - 24px)) !important;
            grid-template-columns: 1fr 1fr !important;
          }

          .auth-shell:has(.auth-signup-content) > section:last-child {
            padding: 14px 32px !important;
          }
        }

        @keyframes authButtonShake {
          0%,100% { transform: translateX(0); }
          18% { transform: translateX(-7px); }
          36% { transform: translateX(7px); }
          54% { transform: translateX(-5px); }
          72% { transform: translateX(5px); }
          88% { transform: translateX(-2px); }
        }
        @keyframes authButtonSpin {
          to { transform: rotate(360deg); }
        }
        @keyframes authArrowLaunch {
          0% { transform: translateX(0) scale(.82); opacity: .35; }
          28% { transform: translateX(-3px) scale(1); opacity: 1; }
          100% { transform: translateX(-20px) scale(1.1); opacity: 1; }
        }
        @keyframes authStatusMorphIn {
          0% { transform: scale(.45); opacity: 0; }
          70% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes authSuccessOverlayIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes authSuccessCardIn {
          0% { opacity: 0; transform: translateY(10px) scale(.93); }
          70% { opacity: 1; transform: translateY(-1px) scale(1.018); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes authSuccessRing {
          0% { transform: scale(.72); opacity: .25; }
          70% { transform: scale(1.08); opacity: .75; }
          100% { transform: scale(1); opacity: .55; }
        }
        @keyframes authSuccessArrowCard {
          0% { transform: translateX(5px) scale(.82); opacity: 0; }
          45% { opacity: 1; }
          100% { transform: translateX(-5px) scale(1); opacity: 1; }
        }
        .auth-primary-error { animation: authButtonShake .46s ease-in-out; }
        .auth-primary-spinner { animation: authButtonSpin .68s linear infinite, authStatusMorphIn .24s ease-out both; }
        .auth-primary-success-arrow { animation: authArrowLaunch .58s cubic-bezier(.22,.8,.25,1) both; }
        .auth-success-overlay { animation: authSuccessOverlayIn .16s ease-out both; }
        .auth-success-card { animation: authSuccessCardIn .34s cubic-bezier(.22,.8,.25,1) both; }
        .auth-success-ring { animation: authSuccessRing .38s cubic-bezier(.22,.8,.25,1) both; }
        .auth-success-card-arrow { animation: authSuccessArrowCard .42s .08s cubic-bezier(.22,.8,.25,1) both; }

        @media (prefers-reduced-motion: reduce) {
          ::view-transition-old(root),
          ::view-transition-new(root),
          .auth-login-content,
          .auth-signup-content,
          .auth-shell:has(.auth-signup-content) > section:first-child,
          .auth-success-overlay,
          .auth-success-card,
          .auth-success-ring,
          .auth-success-card-arrow { animation-duration: .01ms !important; }
        }
      `}</style>
    </label>
  );
}

export function PrimaryFormButton({
  children,
  status,
  disabled = false,
}: {
  children: ReactNode;
  status?: PrimaryButtonStatus;
  disabled?: boolean;
}) {
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
      const requiredInputs = requiredNames
        .map((name) => form.querySelector<HTMLInputElement>(`input[name="${name}"]`))
        .filter((input): input is HTMLInputElement => Boolean(input));
      const terms = form.querySelector<HTMLInputElement>('input[type="checkbox"]');
      const password = form.querySelector<HTMLInputElement>('input[name="new-password"]');
      const confirmPassword = form.querySelector<HTMLInputElement>('input[name="confirm-password"]');
      const hasEmptyRequired = requiredInputs.length !== requiredNames.length || requiredInputs.some((input) => !input.value.trim());
      const passwordsMismatch = Boolean(password && confirmPassword && password.value !== confirmPassword.value);

      if (hasEmptyRequired || !terms?.checked || passwordsMismatch) {
        setLocalStatus("error");
        window.setTimeout(() => setLocalStatus("idle"), 560);
        return;
      }
    }

    setLocalStatus("loading");
    window.setTimeout(() => setLocalStatus("success"), 420);
    window.setTimeout(() => setLocalStatus("idle"), 1050);
  };

  return (
    <>
      <button
        type="submit"
        onClick={startLocalSubmitAnimation}
        disabled={disabled || busy}
        className={`relative flex h-[52px] w-full items-center justify-center overflow-hidden rounded-[17px] bg-gradient-to-l from-[#1479ff] to-[#0758e9] px-6 text-[13px] font-bold text-white shadow-[0_10px_28px_rgba(20,121,255,.22)] transition-all duration-300 ease-[cubic-bezier(.22,.8,.25,1)] hover:-translate-y-0.5 hover:brightness-105 hover:shadow-[0_14px_34px_rgba(20,121,255,.30)] active:translate-y-0 disabled:cursor-wait sm:text-[14px] ${effectiveStatus === "error" ? "auth-primary-error" : ""}`}
      >
        <span className={`auth-primary-content flex items-center justify-center gap-2 transition-all duration-300 ${busy ? "[&>span:last-child]:scale-50 [&>span:last-child]:opacity-0 [&>svg:last-child]:scale-50 [&>svg:last-child]:opacity-0" : ""}`}>
          {children}
        </span>

        {showStatusIndicator && (
          <span className="pointer-events-none absolute left-[calc(50%-78px)] top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center">
            {effectiveStatus === "loading" && (
              <span className="auth-primary-spinner h-[19px] w-[19px] rounded-full border-2 border-white/35 border-t-white" />
            )}
            {effectiveStatus === "success" && (
              <span className="auth-primary-success-arrow text-[20px] font-black leading-none">←</span>
            )}
          </span>
        )}
      </button>

      {controlled && effectiveStatus === "success" && (
        <div className="auth-success-overlay fixed inset-0 z-[140] flex items-center justify-center bg-[#dce5ef]/20 backdrop-blur-[2px] dark:bg-[#1d1721]/25" aria-live="polite" aria-label="تم تسجيل الدخول بنجاح">
          <div className="auth-success-card flex min-w-[220px] flex-col items-center rounded-[24px] border border-white/75 bg-white/90 px-8 py-7 shadow-[0_24px_72px_rgba(31,74,132,.20)] backdrop-blur-xl dark:border-white/[.10] dark:bg-[#302e33]/90 dark:shadow-[0_26px_80px_rgba(0,0,0,.34)]">
            <div className="relative grid h-16 w-16 place-items-center rounded-full bg-[#1479ff]/10 text-[#0758e9] dark:bg-[#6aa8ff]/10 dark:text-[#8ab5ff]">
              <span className="auth-success-ring absolute inset-0 rounded-full border-2 border-[#1479ff]/30 dark:border-[#6aa8ff]/30" />
              <span className="auth-success-card-arrow text-[28px] font-black leading-none">←</span>
            </div>
            <div className="mt-4 text-sm font-black text-[#102a63] dark:text-[#f4f1f5]">تم تسجيل الدخول بنجاح</div>
            <div className="mt-1 text-[11px] text-slate-500 dark:text-[#b9b3bd]">جارٍ فتح لوحة التحكم...</div>
          </div>
        </div>
      )}
    </>
  );
}

export function SecondaryFormButton({ children }: { children: ReactNode }) {
  return (
    <button type="button" className="flex h-[52px] w-full items-center justify-center gap-2 rounded-[17px] border border-[#ccd9e7] bg-white text-[12px] font-bold text-[#17386d] transition-all duration-500 ease-[cubic-bezier(.22,.8,.25,1)] hover:bg-[#f3f7fb] dark:border-white/[.10] dark:bg-[#38363c] dark:text-[#f4f1f5] dark:hover:border-white/[.18] dark:hover:bg-[#454149] sm:text-[13px]">
      {children}
    </button>
  );
}
