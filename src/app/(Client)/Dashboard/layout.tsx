import type { Metadata } from "next";
import "./globals.css";
import "@/styles/typography.css";
import "./dashboard-entry.css";
import "./sidebar-motion.css";

import { ThemeProvider } from "next-themes";
import DashboardShell from "@/components/ui/dashboard-shell";
import { AuthProvider } from "@/components/auth/auth-provider";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "الصفحة الرئيسية | Radius Lord",
  description: "منصة Radius Lord",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // قراءة الكوكيز
  const token = cookies().get("token")?.value;

  // إذا ما في توكن → رجّع المستخدم إلى صفحة تسجيل الدخول
  if (!token) {
    redirect("/login");
  }

  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className="dashboard-enter">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AuthProvider>
            <DashboardShell>{children}</DashboardShell>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
