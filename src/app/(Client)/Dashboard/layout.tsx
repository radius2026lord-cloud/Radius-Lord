import type { Metadata } from "next";
import { Changa } from "next/font/google";
import "./globals.css";

import { ThemeProvider } from "next-themes";
import DashboardShell from "@/components/ui/dashboard-shell";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const changa = Changa({
  subsets: ["arabic"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Dashboard Layout",
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
      <body className={changa.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <DashboardShell>{children}</DashboardShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
