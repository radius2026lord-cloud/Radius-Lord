import "./signup-step-polish.css";
import LordAuth from "@/components/auth/lord-auth";

export default function SignupPage() {
  return (
    <div className="signup-page">
      <LordAuth mode="signup" />

      <div className="signup-stepper" dir="rtl" aria-label="مراحل إنشاء الحساب">
        <span className="signup-stepper__step signup-stepper__step--one">1</span>
        <span className="signup-stepper__track" aria-hidden="true">
          <span className="signup-stepper__progress" />
        </span>
        <span className="signup-stepper__step signup-stepper__step--two">2</span>
      </div>
    </div>
  );
}
