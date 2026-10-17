"use client";

import { Grid2X2, List } from "lucide-react";
import { useEffect, useState } from "react";
import ProjectTooltip from "@/components/ui/project-tooltip";

export type CollectionViewMode = "grid" | "row";

type CollectionViewToggleProps = {
  storageKey?: string;
  value?: CollectionViewMode;
  defaultValue?: CollectionViewMode;
  onChange?: (mode: CollectionViewMode) => void;
  hostingerStyle?: boolean;
};

export default function CollectionViewToggle({
  storageKey = "lord-radius-collection-view",
  value,
  defaultValue = "row",
  onChange,
  hostingerStyle = false,
}: CollectionViewToggleProps) {
  const [internalValue, setInternalValue] = useState<CollectionViewMode>(defaultValue);
  const mode = value ?? internalValue;

  useEffect(() => {
    if (value) return;
    const saved = window.localStorage.getItem(storageKey);
    if (saved === "grid" || saved === "row") setInternalValue(saved);
  }, [storageKey, value]);

  const select = (next: CollectionViewMode) => {
    if (value === undefined) setInternalValue(next);
    window.localStorage.setItem(storageKey, next);
    onChange?.(next);
  };

  return (
    <div
      className={`inline-flex shrink-0 items-center p-1 transition-colors ${hostingerStyle ? "gap-0.5 rounded-full border border-[#e5e5e8] bg-[#f4f4f5] shadow-none dark:border-white/[.10] dark:bg-[#172b40]" : "rounded-[16px] border border-[#d7e3ef] bg-white shadow-sm dark:border-white/[.10] dark:bg-[#38363c]"}`}
      role="group"
      aria-label="طريقة العرض"
    >
      <ProjectTooltip label="عرض شبكي">
      <button
        type="button"
        onClick={() => select("grid")}
        aria-pressed={mode === "grid"}
        className={`grid h-9 w-9 place-items-center transition sm:h-10 sm:w-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#8eabc8] ${hostingerStyle ? `rounded-full ${mode === "grid" ? "bg-white text-[#202124] shadow-[0_1px_4px_rgba(0,0,0,.14)] dark:bg-[#29435d] dark:text-white dark:shadow-[0_1px_4px_rgba(0,0,0,.32)]" : "text-[#6b6d72] hover:bg-white/70 hover:text-[#303239] dark:text-slate-400 dark:hover:bg-white/[.07] dark:hover:text-slate-100"}` : `rounded-[12px] ${mode === "grid" ? "bg-[#e9f2ff] text-[#0758e9] dark:bg-white/[.08] dark:text-[#8ab5ff]" : "text-slate-400 hover:bg-[#edf4fb] hover:text-[#0758e9] dark:hover:bg-white/[.05]"}`}`}
      >
        <Grid2X2 className="h-[18px] w-[18px]" />
        <span className="sr-only">Grid</span>
      </button>
      </ProjectTooltip>
      <ProjectTooltip label="عرض صفوف">
      <button
        type="button"
        onClick={() => select("row")}
        aria-pressed={mode === "row"}
        className={`grid h-9 w-9 place-items-center transition sm:h-10 sm:w-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#8eabc8] ${hostingerStyle ? `rounded-full ${mode === "row" ? "bg-white text-[#202124] shadow-[0_1px_4px_rgba(0,0,0,.14)] dark:bg-[#29435d] dark:text-white dark:shadow-[0_1px_4px_rgba(0,0,0,.32)]" : "text-[#6b6d72] hover:bg-white/70 hover:text-[#303239] dark:text-slate-400 dark:hover:bg-white/[.07] dark:hover:text-slate-100"}` : `rounded-[12px] ${mode === "row" ? "bg-[#e9f2ff] text-[#0758e9] dark:bg-white/[.08] dark:text-[#8ab5ff]" : "text-slate-400 hover:bg-[#edf4fb] hover:text-[#0758e9] dark:hover:bg-white/[.05]"}`}`}
      >
        <List className="h-5 w-5" />
        <span className="sr-only">Row</span>
      </button>
      </ProjectTooltip>
    </div>
  );
}
