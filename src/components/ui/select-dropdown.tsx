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

const ANIMATION_MS = 360;

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
  const [mounted, setMounted] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openMenu = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    setMounted(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setOpen(true)));
  };

  const closeMenu = () => {
    setOpen(false);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => setMounted(false), ANIMATION_MS);
  };

  const toggleMenu = () => {
    if (open) closeMenu();
    else openMenu();
  };

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) closeMenu();
    };
    document.addEventListener("mousedown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={toggleMenu}
        className={`flex h-full w-full items-center justify-between gap-2 ${buttonClassName}`}
        aria-expanded={open}
      >
        <span className="min-w-0 flex-1">{renderValue(value)}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform duration-300 ease-out ${open ? "rotate-180" : ""}`} />
      </button>

      {mounted && (
        <div
          className={`select-dropdown-menu ${open ? "is-open" : "is-closing"} absolute top-[calc(100%+6px)] z-50 max-h-64 overflow-auto rounded-[11px] border border-[#ccd9e7] bg-white p-1.5 shadow-[0_16px_42px_rgba(29,58,91,.20)] dark:border-[#304861] dark:bg-[#0b2138] ${align === "right" ? "right-0" : "left-0"} ${menuClassName}`}
        >
          {items.map((item) => {
            const active = getKey(item) === getKey(value);
            return (
              <button
                key={getKey(item)}
                type="button"
                onClick={() => {
                  onChange(item);
                  closeMenu();
                }}
                className={`block w-full rounded-[8px] transition-colors duration-200 ${active ? "bg-[#edf5ff] text-[#0b5fd7] dark:bg-[#12304f] dark:text-[#70b4ff]" : "text-[#17386d] hover:bg-[#f3f7fb] dark:text-slate-200 dark:hover:bg-white/[.05]"}`}
              >
                {renderItem(item, active)}
              </button>
            );
          })}
        </div>
      )}

      <style jsx global>{`
        .select-dropdown-menu {
          transform-origin: top center;
          will-change: opacity, transform, filter;
          transition:
            opacity ${ANIMATION_MS}ms cubic-bezier(.22,.75,.24,1),
            transform ${ANIMATION_MS}ms cubic-bezier(.22,.75,.24,1),
            filter ${ANIMATION_MS}ms ease;
        }
        .select-dropdown-menu.is-open {
          opacity: 1;
          transform: translateY(0) scale(1);
          filter: blur(0);
        }
        .select-dropdown-menu.is-closing {
          opacity: 0;
          transform: translateY(-9px) scale(.975);
          filter: blur(1.4px);
          pointer-events: none;
        }
        @starting-style {
          .select-dropdown-menu.is-open {
            opacity: 0;
            transform: translateY(-9px) scale(.975);
            filter: blur(1.4px);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .select-dropdown-menu,
          .select-dropdown-menu.is-open,
          .select-dropdown-menu.is-closing {
            transition: none;
            transform: none;
            filter: none;
          }
        }
      `}</style>
    </div>
  );
}
