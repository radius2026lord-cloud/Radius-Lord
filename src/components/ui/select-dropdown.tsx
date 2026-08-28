"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

type SelectDropdownProps<T> = {
  value: T;
  items: T[];
  getKey: (item: T) => string;
  renderValue: (item: T) => ReactNode;
  renderItem: (item: T, active: boolean) => ReactNode;
  onChange: (item: T) => void;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  align?: "left" | "right";
};

export function SelectDropdown<T>({
  value,
  items,
  getKey,
  renderValue,
  renderItem,
  onChange,
  className = "",
  buttonClassName = "",
  menuClassName = "",
  align = "left",
}: SelectDropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`flex h-full w-full items-center justify-between gap-2 ${buttonClassName}`}
        aria-expanded={open}
      >
        <span className="min-w-0 flex-1">{renderValue(value)}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          className={`select-dropdown-menu absolute top-[calc(100%+6px)] z-50 max-h-64 overflow-auto rounded-[11px] border border-[#ccd9e7] bg-white p-1.5 shadow-[0_16px_42px_rgba(29,58,91,.20)] dark:border-[#304861] dark:bg-[#0b2138] ${align === "right" ? "right-0" : "left-0"} ${menuClassName}`}
        >
          {items.map((item) => {
            const active = getKey(item) === getKey(value);
            return (
              <button
                key={getKey(item)}
                type="button"
                onClick={() => {
                  onChange(item);
                  setOpen(false);
                }}
                className={`block w-full rounded-[8px] transition-colors duration-150 ${active ? "bg-[#edf5ff] text-[#0b5fd7] dark:bg-[#12304f] dark:text-[#70b4ff]" : "text-[#17386d] hover:bg-[#f3f7fb] dark:text-slate-200 dark:hover:bg-white/[.05]"}`}
              >
                {renderItem(item, active)}
              </button>
            );
          })}
        </div>
      )}

      <style jsx global>{`
        @keyframes lordDropdownEnter {
          from { opacity: 0; transform: translateY(-6px) scale(.985); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .select-dropdown-menu {
          transform-origin: top center;
          animation: lordDropdownEnter 170ms cubic-bezier(.2,.8,.2,1);
        }
        @media (prefers-reduced-motion: reduce) {
          .select-dropdown-menu { animation: none; }
        }
      `}</style>
    </div>
  );
}
