"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageWorkspaceProps {
  children: ReactNode;
  isSidebarExpanded: boolean;
}

export default function PageWorkspace({ children, isSidebarExpanded }: PageWorkspaceProps) {
  return (
    <div
      className={cn(
        "fixed top-[160px] right-[20px] bottom-2 z-40",
        "rounded-2xl flex flex-col px-6 py-4",
        "transition-all duration-1000 ease-in-out",
        "bg-white dark:bg-darkCard",
        "shadow-[0_4px_20px_rgba(0,0,0,0.35)] border border-gray-200/40 dark:border-gray-700/40",
        isSidebarExpanded
          ? "left-[280px] w-[calc(100%-240px)]"
          : "left-[140px] w-[calc(100%-120px)]"
      )}
    >
      <div className="w-full h-full overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
