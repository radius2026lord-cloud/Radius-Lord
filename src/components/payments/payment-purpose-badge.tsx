import { paymentPurposeLabel } from "@/lib/payment-display";

export default function PaymentPurposeBadge({ value }: { value: string }) {
  const tones: Record<string, string> = {
    initial_subscription: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300",
    renewal: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
    upgrade: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
    addon_purchase: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300",
  };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${tones[value] || "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300"}`}>{paymentPurposeLabel(value)}</span>;
}
