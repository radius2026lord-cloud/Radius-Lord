import type {ComponentProps, ReactNode} from "react";
import type {LucideIcon} from "lucide-react";

const tones = {
  info: {surface:"border-blue-200 bg-blue-50/70 dark:border-blue-400/25 dark:bg-blue-500/[.08]", ink:"text-blue-500", icon:"bg-blue-500/10"},
  success: {surface:"border-emerald-200 bg-emerald-50/70 dark:border-emerald-400/25 dark:bg-emerald-500/[.08]", ink:"text-emerald-500", icon:"bg-emerald-500/10"},
  warning: {surface:"border-amber-200 bg-amber-50/70 dark:border-amber-400/25 dark:bg-amber-500/[.08]", ink:"text-amber-500", icon:"bg-amber-500/10"},
  danger: {surface:"border-red-200 bg-red-50/70 dark:border-red-400/25 dark:bg-red-500/[.08]", ink:"text-red-500", icon:"bg-red-500/10"},
  pending: {surface:"border-indigo-200 bg-indigo-50/70 dark:border-indigo-400/25 dark:bg-indigo-500/[.08]", ink:"text-indigo-500", icon:"bg-indigo-500/10"},
  cpu: {surface:"border-sky-200 bg-sky-50/70 dark:border-sky-400/25 dark:bg-sky-500/[.08]", ink:"text-sky-500", icon:"bg-sky-500/10"},
  memory: {surface:"border-violet-200 bg-violet-50/70 dark:border-violet-400/25 dark:bg-violet-500/[.08]", ink:"text-violet-500", icon:"bg-violet-500/10"},
  connections: {surface:"border-teal-200 bg-teal-50/70 dark:border-teal-400/25 dark:bg-teal-500/[.08]", ink:"text-teal-500", icon:"bg-teal-500/10"},
};
export type InfoCardTone = keyof typeof tones;
export function ProjectInfoCard({tone="info",className="",...props}:ComponentProps<"div"> & {tone?:InfoCardTone}) {
  return <div className={`rounded-[18px] border p-4 ${tones[tone].surface} ${className}`} {...props}/>;
}
export function ProjectCardIcon({icon:Icon,tone="info"}:{icon:LucideIcon;tone?:InfoCardTone}) {
  return <span className={`inline-flex shrink-0 rounded-lg p-1.5 ${tones[tone].ink} ${tones[tone].icon}`}><Icon className="h-4 w-4" aria-hidden="true"/></span>;
}
export function ProjectCardDetails({open,children}:{open:boolean;children:ReactNode}) {
  return <div className={`grid transition-[grid-template-rows,opacity,transform] duration-300 ease-in-out motion-reduce:transition-none ${open?'grid-rows-[1fr] translate-y-0 opacity-100':'grid-rows-[0fr] translate-y-2 opacity-0'}`} aria-hidden={!open} inert={!open}><div className="min-h-0 overflow-hidden">{children}</div></div>;
}
