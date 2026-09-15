import LordAuth from "@/components/auth/lord-auth";
import styles from "./SuccessOverlay.module.css";

export default function LoginPage() {
  return (
    <div className={styles.scope}>
      <LordAuth mode="login" />
    </div>
  );
}
