import * as React from "react";
import ProjectInput from "@/components/ui/project-input";

type PppoeInputProps = React.ComponentProps<"input"> & { invalid?: boolean };

const PppoeInput = React.forwardRef<HTMLInputElement, PppoeInputProps>(
  ({ className, invalid = false, ...props }, ref) => (
    <ProjectInput
      ref={ref}
      {...props}
      className={`!h-12 !border-[#9fb8d2] !bg-white !text-[14px] !font-medium !text-[#17386d] placeholder:!text-right placeholder:!text-[10px] placeholder:!font-normal placeholder:!text-slate-400 focus:!border-[#0758e9] dark:!border-white/15 dark:!bg-[#17263b] dark:!text-[#dce8fa] dark:placeholder:!text-slate-400 ${invalid ? "!border-rose-500 focus:!border-rose-500 focus:!ring-rose-100 dark:!border-rose-400 dark:focus:!ring-rose-400/15" : ""} ${className || ""}`}
    />
  ),
);

PppoeInput.displayName = "PppoeInput";

export default PppoeInput;
