export const homepageSections = [
  { id: "welcome", label: "الترحيب", description: "رسالة الترحيب باسم صاحب الحساب." },
  { id: "statistics", label: "الإحصاءات", description: "أعداد طلبات الدفع وحالاتها." },
  { id: "activity", label: "آخر النشاطات", description: "الحسابات وطلبات الدفع وآخر تحديثاتها." },
  { id: "shortcuts", label: "الاختصارات", description: "روابط سريعة متاحة حسب صلاحيات الحساب." },
] as const;

export type HomepageSectionId = typeof homepageSections[number]["id"];
export type HomepageConfig = {
  welcomeText: string;
  sections: { id: HomepageSectionId; enabled: boolean }[];
};

export function defaultHomepageConfig(): HomepageConfig {
  return {
    welcomeText: "مرحبًا بك في Radius Lord. تابع طلباتك ونشاط حسابك من مكان واحد.",
    sections: homepageSections.map(section => ({ id: section.id, enabled: true })),
  };
}

export function isHomepageConfig(value: unknown): value is HomepageConfig {
  if (!value || typeof value !== "object") return false;
  const config = value as HomepageConfig;
  return typeof config.welcomeText === "string" && config.welcomeText.trim().length > 0
    && config.welcomeText.length <= 300 && Array.isArray(config.sections)
    && config.sections.length === homepageSections.length
    && config.sections.every(section => section && homepageSections.some(item => item.id === section.id) && typeof section.enabled === "boolean")
    && new Set(config.sections.map(section => section.id)).size === homepageSections.length;
}
