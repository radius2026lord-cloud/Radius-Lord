"use client";

import Link from "next/link";
import { Home, Settings2 } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { CollectionState } from "@/components/ui/collection-display";

export default function HomepageSettingsPage() {
  const { accountType, loading } = useAuth();
  if (loading) return <CollectionState loading>جارٍ تحميل حسابك...</CollectionState>;
  if (accountType !== "master_admin") return <CollectionState>هذه الإعدادات متاحة للمسؤول الرئيسي فقط.</CollectionState>;
  return <div dir="rtl" className="space-y-4">
    <header className="rl-surface flex flex-wrap items-center justify-between gap-3 rounded-[22px] bg-white p-4 dark:bg-[#0d243b]">
      <h1 className="flex items-center gap-2 text-lg font-semibold text-[#17386d] dark:text-white"><Settings2 className="h-5 w-5 text-[#0758e9]" />تخصيص الصفحة الرئيسية</h1>
      <Link href="/Dashboard" className="inline-flex h-10 items-center gap-2 rounded-[14px] border border-[#bfd4ea] px-3 text-xs text-[#0758e9] dark:border-white/10 dark:text-[#8fc0ff]"><Home className="h-4 w-4" />الصفحة الرئيسية</Link>
    </header>
  </div>;
}
