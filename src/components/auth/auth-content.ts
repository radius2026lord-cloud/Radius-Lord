import { Activity, Server, ShieldCheck, UsersRound } from "lucide-react";

export type ArabCountry = {
  name: string;
  code: string;
  flag: string;
};

export const arabCountries: ArabCountry[] = [
  { name: "سوريا", code: "+963", flag: "🇸🇾" },
  { name: "العراق", code: "+964", flag: "🇮🇶" },
  { name: "السعودية", code: "+966", flag: "🇸🇦" },
  { name: "الأردن", code: "+962", flag: "🇯🇴" },
  { name: "لبنان", code: "+961", flag: "🇱🇧" },
  { name: "فلسطين", code: "+970", flag: "🇵🇸" },
  { name: "الإمارات", code: "+971", flag: "🇦🇪" },
  { name: "قطر", code: "+974", flag: "🇶🇦" },
  { name: "الكويت", code: "+965", flag: "🇰🇼" },
  { name: "البحرين", code: "+973", flag: "🇧🇭" },
  { name: "عُمان", code: "+968", flag: "🇴🇲" },
  { name: "اليمن", code: "+967", flag: "🇾🇪" },
  { name: "مصر", code: "+20", flag: "🇪🇬" },
  { name: "ليبيا", code: "+218", flag: "🇱🇾" },
  { name: "تونس", code: "+216", flag: "🇹🇳" },
  { name: "الجزائر", code: "+213", flag: "🇩🇿" },
  { name: "المغرب", code: "+212", flag: "🇲🇦" },
  { name: "موريتانيا", code: "+222", flag: "🇲🇷" },
  { name: "السودان", code: "+249", flag: "🇸🇩" },
  { name: "الصومال", code: "+252", flag: "🇸🇴" },
  { name: "جيبوتي", code: "+253", flag: "🇩🇯" },
  { name: "جزر القمر", code: "+269", flag: "🇰🇲" },
];

export const defaultArabCountry = arabCountries[0];

/**
 * محتوى القسم التعريفي في صفحات الدخول وإنشاء الحساب.
 * يتم تعديل النصوص والمزايا من هذا الملف فقط دون لمس تصميم الواجهة.
 */
export const radiusAuthContent = {
  title: "منصة RADIUS و NAS متكاملة وسهلة الإدارة",
  description:
    "إدارة كاملة للمشتركين والأجهزة والسياسات من مكان واحد بسهولة وأمان وموثوقية عالية.",
  summaryTitle: "باختصار",
  features: [
    {
      title: "إدارة NAS",
      description: "إضافة ومراقبة الأجهزة وتنظيمها بسهولة",
      icon: Server,
      tone: "blue",
    },
    {
      title: "إدارة المشتركين",
      description: "حسابات وملفات وتنظيم المستخدمين",
      icon: UsersRound,
      tone: "green",
    },
    {
      title: "مراقبة الشبكة",
      description: "حالة الاتصال والتقارير والتنبيهات الفورية",
      icon: Activity,
      tone: "violet",
    },
    {
      title: "أمان عالي",
      description: "سياسات مرنة وتحكم كامل وصلاحيات دقيقة",
      icon: ShieldCheck,
      tone: "amber",
    },
  ],
} as const;
