export const paymentPurposeOptions = [
  { value: "initial_subscription", label: "اشتراك جديد" },
  { value: "renewal", label: "تجديد اشتراك" },
  { value: "upgrade", label: "ترقية اشتراك" },
  { value: "addon_purchase", label: "شراء إضافة" },
];

export function paymentPurposeLabel(value: string) {
  return paymentPurposeOptions.find(option => option.value === value)?.label ?? "عملية أخرى";
}
