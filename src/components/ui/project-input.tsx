import * as React from "react";

import { cn } from "@/lib/utils";

type ProjectInputProps = React.ComponentProps<"input">;

const ProjectInput = React.forwardRef<HTMLInputElement, ProjectInputProps>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "allow-text-selection h-12 w-full rounded-[14px] border border-[#d7e3ef] bg-[#f9fbfe] px-3.5 text-sm text-slate-700 outline-none transition focus:border-[#2382ef] focus:bg-white focus:ring-4 focus:ring-[#2382ef]/10 dark:border-white/10 dark:bg-[#26384a] dark:text-slate-100 dark:focus:bg-[#2b4055]",
        className,
      )}
      {...props}
    />
  ),
);

ProjectInput.displayName = "ProjectInput";

export default ProjectInput;
