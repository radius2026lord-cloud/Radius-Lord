"use client";

import { Grid2X2, List } from "lucide-react";
import { useEffect, useState } from "react";

export type CollectionViewMode = "grid" | "row";

type CollectionViewToggleProps = {
  storageKey?: string;
  value?: CollectionViewMode;
  defaultValue?: CollectionViewMode;
  onChange?: (mode: CollectionViewMode) => void;
};

export default function CollectionViewToggle({
  storageKey = "lord-radius-collection-view",
  value,
  defaultValue = "row",
  onChange,
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
      className="inline-flex shrink-0 items-center rounded-[16px] border border-[#d7e3ef] bg-white p-1 shadow-sm dark:border-white/[.10] dark:bg-[#38363c]"
      role="group"
      aria-label="طريقة العرض"
    >
      <button
        type="button"
        onClick={() => select("grid")}
        aria-pressed={mode === "grid"}
        title="عرض شبكي"
        className={`grid h-9 w-9 place-items-center rounded-[12px] transition sm:h-10 sm:w-10 ${mode === "grid" ? "bg-[#e9f2ff] text-[#0758e9] dark:bg-white/[.08] dark:text-[#8ab5ff]" : "text-slate-400 hover:bg-[#edf4fb] hover:text-[#0758e9] dark:hover:bg-white/[.05]"}`}
      >
        <Grid2X2 className="h-[18px] w-[18px]" />
        <span className="sr-only">Grid</span>
      </button>
      <button
        type="button"
        onClick={() => select("row")}
        aria-pressed={mode === "row"}
        title="عرض صفوف"
        className={`grid h-9 w-9 place-items-center rounded-[12px] transition sm:h-10 sm:w-10 ${mode === "row" ? "bg-[#e9f2ff] text-[#0758e9] dark:bg-white/[.08] dark:text-[#8ab5ff]" : "text-slate-400 hover:bg-[#edf4fb] hover:text-[#0758e9] dark:hover:bg-white/[.05]"}`}
      >
        <List className="h-5 w-5" />
        <span className="sr-only">Row</span>
      </button>
    </div>
  );
}
