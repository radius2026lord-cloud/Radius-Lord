import "./signup-step-polish.css";
import LordAuth from "@/components/auth/lord-auth";

export default function SignupPage() {
  return (
    <div className="signup-page">
      <LordAuth mode="signup" />
    </div>
  );
}
