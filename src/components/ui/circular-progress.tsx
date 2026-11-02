import {useId} from "react";

type Props = {
  value: number | null;
  label: string;
  caption?:string;
  tone?: "success" | "warning" | "danger" | "neutral" | "info";
  size?: "xs" | "sm" | "md";
  valueText?:string;
  trackClassName?:string;
};

const colors = {info:"text-cyan-500",success: "text-emerald-500", warning: "text-amber-500", danger: "text-red-500", neutral: "text-slate-400"};

export default function CircularProgress({value, label, caption, tone = "success",size="md",valueText,trackClassName}: Props) {
  const gradientId = useId();
  const percent = value === null || !Number.isFinite(value) ? null : Math.max(0, Math.min(100, value));
  const circumference = 2 * Math.PI * 42;
  return <div className={`relative shrink-0 ${size==="xs"?"h-14 w-14":size==="sm"?"h-20 w-20":"h-28 w-28"}`} role="img" aria-label={`${label}: ${valueText ?? (percent === null ? "غير متاح" : `${Math.round(percent)}%`)}`}>
    <span className={`absolute ${size==="md"?"inset-[18px]":"inset-[16%]"} rounded-full border border-slate-100 bg-white shadow-[0_3px_12px_rgba(15,23,42,.04)] dark:border-white/10 dark:bg-slate-900/30`} aria-hidden="true"/>
    <svg className={`h-full w-full -rotate-90 ${colors[tone]}`} viewBox="0 0 100 100" aria-hidden="true">
      <defs><linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity=".55"/><stop offset="100%" stopColor="currentColor"/></linearGradient></defs>
      <circle cx="50" cy="50" r="49" fill="none" stroke="currentColor" strokeWidth=".6" opacity=".16"/>
      <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="6" className={trackClassName??"text-slate-200/80 dark:text-white/10"}/>
      <circle cx="50" cy="50" r="42" fill="none" stroke={`url(#${gradientId})`} strokeWidth="6" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - (percent ?? 0) / 100)} className={`${colors[tone]} transition-[stroke-dashoffset] duration-700 ease-in-out motion-reduce:transition-none`} opacity={percent === null || percent === 0 ? 0 : 1}/>
    </svg>
    <span className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden="true"><span dir="ltr" className="flex items-baseline gap-0.5"><strong className={`font-bold tracking-tight tabular-nums ${size==="xs"?"text-[14px]":size==="sm"?"text-[20px]":"text-[27px]"}`}>{valueText ?? (percent === null ? "—" : Math.round(percent))}</strong>{percent !== null&&!valueText&&<span className={`${size==="xs"?"text-[8px]":"text-[11px]"} font-semibold text-slate-400`}>%</span>}</span>{size!=="xs"&&<span className={`${size==="sm"?"text-[8px]":"text-[9px]"} mt-0.5 text-slate-500`}>{caption ?? (percent === null ? "لم يُفحص" : "اجتياز")}</span>}</span>
  </div>;
}

