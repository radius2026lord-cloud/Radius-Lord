import "@/app/(Client)/Dashboard/globals.css";
import styles from "./Login.module.css";
import { ThemeProvider } from "next-themes";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <div className={styles.loginScope}>{children}</div>
        </ThemeProvider>
      </body>
    </html>
  );
}
