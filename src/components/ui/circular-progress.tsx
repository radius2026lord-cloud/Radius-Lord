type Props = {
  value: number | null;
  label: string;
  tone?: "success" | "warning" | "danger" | "neutral";
};

const colors = {success: "text-emerald-500", warning: "text-amber-500", danger: "text-red-500", neutral: "text-slate-400"};

export default function CircularProgress({value, label, tone = "success"}: Props) {
  const percent = value === null || !Number.isFinite(value) ? null : Math.max(0, Math.min(100, value));
  const circumference = 2 * Math.PI * 42;
  return <div className="relative h-24 w-24 shrink-0" role="img" aria-label={`${label}: ${percent === null ? "غير متاح" : `${Math.round(percent)}%`}`}>
    <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="7" className="text-slate-200/80 dark:text-white/10"/>
      <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - (percent ?? 0) / 100)} className={`${colors[tone]} transition-[stroke-dashoffset] duration-700 ease-in-out motion-reduce:transition-none`} opacity={percent === null || percent === 0 ? 0 : 1}/>
    </svg>
    <span className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden="true"><strong className="text-2xl font-bold tabular-nums">{percent === null ? "—" : Math.round(percent)}</strong><span className="text-[10px] text-slate-500">{percent === null ? "لم يُفحص" : "%"}</span></span>
  </div>;
}
