import { Activity, Server, ShieldCheck, UsersRound } from "lucide-react";

export type ArabCountry = {
  name: string;
  code: string;
  flag: string;
  iso2: string;
};

export const arabCountries: ArabCountry[] = [
  { name: "سوريا", code: "+963", flag: "🇸🇾", iso2: "sy" },
  { name: "العراق", code: "+964", flag: "🇮🇶", iso2: "iq" },
  { name: "السعودية", code: "+966", flag: "🇸🇦", iso2: "sa" },
  { name: "الأردن", code: "+962", flag: "🇯🇴", iso2: "jo" },
  { name: "لبنان", code: "+961", flag: "🇱🇧", iso2: "lb" },
  { name: "فلسطين", code: "+970", flag: "🇵🇸", iso2: "ps" },
  { name: "الإمارات", code: "+971", flag: "🇦🇪", iso2: "ae" },
  { name: "قطر", code: "+974", flag: "🇶🇦", iso2: "qa" },
  { name: "الكويت", code: "+965", flag: "🇰🇼", iso2: "kw" },
  { name: "البحرين", code: "+973", flag: "🇧🇭", iso2: "bh" },
  { name: "عُمان", code: "+968", flag: "🇴🇲", iso2: "om" },
  { name: "اليمن", code: "+967", flag: "🇾🇪", iso2: "ye" },
  { name: "مصر", code: "+20", flag: "🇪🇬", iso2: "eg" },
  { name: "ليبيا", code: "+218", flag: "🇱🇾", iso2: "ly" },
  { name: "تونس", code: "+216", flag: "🇹🇳", iso2: "tn" },
  { name: "الجزائر", code: "+213", flag: "🇩🇿", iso2: "dz" },
  { name: "المغرب", code: "+212", flag: "🇲🇦", iso2: "ma" },
  { name: "موريتانيا", code: "+222", flag: "🇲🇷", iso2: "mr" },
  { name: "السودان", code: "+249", flag: "🇸🇩", iso2: "sd" },
  { name: "الصومال", code: "+252", flag: "🇸🇴", iso2: "so" },
  { name: "جيبوتي", code: "+253", flag: "🇩🇯", iso2: "dj" },
  { name: "جزر القمر", code: "+269", flag: "🇰🇲", iso2: "km" },
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
