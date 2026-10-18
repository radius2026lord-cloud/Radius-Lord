import * as React from "react";
import ProjectInput from "@/components/ui/project-input";

type PppoeInputProps = React.ComponentProps<"input">;

const PppoeInput = React.forwardRef<HTMLInputElement, PppoeInputProps>(
  ({ className, ...props }, ref) => (
    <ProjectInput
      ref={ref}
      {...props}
      className={`!h-12 !border-[#9fb8d2] !bg-white !text-[14px] !font-medium !text-[#17386d] placeholder:!text-right placeholder:!text-[11px] placeholder:!font-normal placeholder:!text-slate-400 focus:!border-[#0758e9] dark:!border-white/15 dark:!bg-[#17263b] dark:!text-[#dce8fa] dark:placeholder:!text-slate-400 ${className || ""}`}
    />
  ),
);

PppoeInput.displayName = "PppoeInput";

export default PppoeInput;
