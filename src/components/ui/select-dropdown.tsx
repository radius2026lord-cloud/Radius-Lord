"use client";

import { ReactNode, useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
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
const MENU_GAP = 6;

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
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateMenuPosition = () => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;

    setMenuStyle(
      align === "right"
        ? { top: rect.bottom + MENU_GAP, right: window.innerWidth - rect.right }
        : { top: rect.bottom + MENU_GAP, left: rect.left }
    );
  };

  const openMenu = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    updateMenuPosition();
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
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) closeMenu();
    };
    document.addEventListener("mousedown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const reposition = () => updateMenuPosition();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [mounted, align]);

  const menu = mounted ? (
    <div
      ref={menuRef}
      style={menuStyle}
      className={`select-dropdown-menu ${open ? "is-open" : "is-closing"} fixed z-[300] max-h-64 overflow-auto rounded-[13px] border border-[#ccd9e7] bg-white p-1.5 shadow-[0_16px_42px_rgba(29,58,91,.20)] dark:border-white/[.09] dark:bg-[#37343a] dark:shadow-[0_18px_46px_rgba(0,0,0,.32)] ${menuClassName}`}
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
            className={`block w-full rounded-[10px] transition-colors duration-200 ${active ? "bg-[#edf5ff] text-[#0b5fd7] dark:bg-[#4c8dff]/15 dark:text-[#8db5ff]" : "text-[#17386d] hover:bg-[#f3f7fb] dark:text-[#f6f2f7] dark:hover:bg-white/[.06]"}`}
          >
            {renderItem(item, active)}
          </button>
        );
      })}
    </div>
  ) : null;

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button type="button" onClick={toggleMenu} className={`flex h-full w-full items-center justify-between gap-2 ${buttonClassName}`} aria-expanded={open}>
        <span className="min-w-0 flex-1">{renderValue(value)}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform duration-300 ease-out ${open ? "rotate-180" : ""}`} />
      </button>

      {typeof document !== "undefined" && menu ? createPortal(menu, document.body) : null}

      <style jsx global>{`
        .select-dropdown-menu { transform-origin: top center; will-change: opacity, transform, filter; transition: opacity ${ANIMATION_MS}ms cubic-bezier(.22,.75,.24,1), transform ${ANIMATION_MS}ms cubic-bezier(.22,.75,.24,1), filter ${ANIMATION_MS}ms ease; }
        .select-dropdown-menu.is-open { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
        .select-dropdown-menu.is-closing { opacity: 0; transform: translateY(-9px) scale(.975); filter: blur(1.4px); pointer-events: none; }
        @starting-style { .select-dropdown-menu.is-open { opacity: 0; transform: translateY(-9px) scale(.975); filter: blur(1.4px); } }
        .auth-dot-grid { background-image: radial-gradient(circle, rgba(38,111,205,.30) 1.15px, transparent 1.35px), radial-gradient(circle, rgba(255,173,22,.16) 1px, transparent 1.2px); background-position: 0 0, 12px 12px; background-size: 24px 24px, 48px 48px; opacity: .24; -webkit-mask-image: radial-gradient(ellipse 47% 47% at 50% 50%, transparent 0%, transparent 60%, rgba(0,0,0,.30) 70%, rgba(0,0,0,.82) 84%, #000 100%); mask-image: radial-gradient(ellipse 47% 47% at 50% 50%, transparent 0%, transparent 60%, rgba(0,0,0,.30) 70%, rgba(0,0,0,.82) 84%, #000 100%); }
        .dark .auth-dot-grid { opacity: .12; background-image: radial-gradient(circle, rgba(126,164,255,.30) 1.15px, transparent 1.35px), radial-gradient(circle, rgba(255,179,77,.14) 1px, transparent 1.2px); }
        @media (prefers-reduced-motion: reduce) { .select-dropdown-menu,.select-dropdown-menu.is-open,.select-dropdown-menu.is-closing { transition:none; transform:none; filter:none; } }
      `}</style>
    </div>
  );
}
