import "./signup-step-polish.css";
import LordAuth from "@/components/auth/lord-auth";
import { SignupStepper } from "@/components/auth/signup-stepper";

export default function SignupPage() {
  return (
    <div className="signup-page">
      <LordAuth mode="signup" />
      <SignupStepper />
    </div>
  );
}
