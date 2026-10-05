"use client";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Props=ButtonHTMLAttributes<HTMLButtonElement>&{variant?:"primary"|"secondary"|"back"|"ghost";size?:"default"|"icon"};
const variants={
 primary:"rounded-[14px] bg-[#0758e9] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#064fd1]",
 secondary:"rounded-[14px] border border-[#bfd4ea] bg-white/75 px-4 py-2.5 text-xs font-medium text-[#17386d] hover:bg-white dark:border-white/10 dark:bg-white/[.04] dark:text-slate-200",
 back:"rounded-[14px] border border-[#bfd4ea] bg-white/75 px-3 py-2 text-xs font-medium text-[#0758e9] hover:bg-white dark:border-white/10 dark:bg-white/[.04] dark:text-[#8fc0ff]",
 ghost:"rounded-[14px] px-3 py-2 text-xs font-medium text-[#0758e9] hover:bg-[#edf4fb] dark:text-[#8fc0ff] dark:hover:bg-white/[.04]",
};
const ProjectButton=forwardRef<HTMLButtonElement,Props>(({variant="primary",size="default",className,type="button",...props},ref)=><button ref={ref} type={type} className={cn("inline-flex shrink-0 items-center justify-center gap-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0758e9]/40 disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0",variants[variant],size==="icon"&&"h-9 w-9 p-0",className)} {...props}/>);
ProjectButton.displayName="ProjectButton";
export default ProjectButton;
