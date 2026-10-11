import {ThemeProvider} from "next-themes";
import "../Dashboard/globals.css";
import "../Dashboard/dashboard-entry.css";
import "../Dashboard/sidebar-motion.css";
import "@/styles/typography.css";
export default function NetworkLayout({children}:{children:React.ReactNode}){return <html lang="ar" dir="rtl" suppressHydrationWarning><body className="dashboard-enter"><ThemeProvider attribute="class" defaultTheme="system" enableSystem>{children}</ThemeProvider></body></html>;}
