"use client";

import { handleLogout } from "../../app/backend/services/auth/logout.service";

import { useState, useEffect, useRef } from "react";
import {
  Search,
  SlidersHorizontal,
  ChevronDown,
  LogOut,
  Settings,
  HelpCircle,
  User,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

export default function PrimaryHeader({ isSidebarExpanded }: { isSidebarExpanded: boolean }) {
  const [focused, setFocused] = useState(false);
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [showModes, setShowModes] = useState(false);
  const modeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);

    const handleClickOutside = (event: MouseEvent) => {
      if (modeRef.current && !modeRef.current.contains(event.target as Node)) {
        setShowModes(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const playToggleSound = () => {
    const audio = new Audio("/sounds/toggle.mp3");
    audio.volume = 0.5;
    audio.play().catch(() => { });
  };

  if (!mounted) return null;

  return (
    <header>
      <div
        className={cn(
          "fixed top-[15px] right-[20px] h-[65px] z-50",
          "bg-white dark:bg-darkCard",
          "rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.35)]",
          "flex items-center justify-between gap-4 px-4",
          "transition-all duration-500 ease-out delay-200",
          isSidebarExpanded
            ? "left-[280px] w-[calc(100%-240px)]"   // كان 280px → صار 240px (أكبر 40px)
            : "left-[140px] w-[calc(100%-120px)]"   // كان 140px → صار 100px (أكبر 40px)
        )}
      >
        {/* Avatar on the left */}
        <DropdownMenu dir="ltr">
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-100 dark:bg-darkInput hover:bg-gray-200 dark:hover:bg-[#475569] transition-all duration-300 hover:scale-105">
              <Avatar className="w-8 h-8">
                <AvatarImage src="https://github.com/shadcn.png" />
                <AvatarFallback>CN</AvatarFallback>
              </Avatar>
              <ChevronDown size={18} className="text-gray-700 dark:text-gray-300" />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="start"
            side="bottom"
            sideOffset={8}
            className="rounded-xl shadow-lg w-56 bg-white dark:bg-darkCard border border-gray-200 dark:border-gray-700"
          >
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <Avatar className="w-10 h-10">
                  <AvatarImage src="https://github.com/shadcn.png" />
                  <AvatarFallback>CN</AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="font-semibold text-gray-800 dark:text-gray-200">SafwaNn</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">admin@example.com</span>
                </div>
              </div>
            </div>

            <DropdownMenuSeparator />

            <DropdownMenuItem className="cursor-pointer flex items-center gap-2 dark:text-gray-200">
              <User size={16} /> Profile
            </DropdownMenuItem>

            <DropdownMenuItem className="cursor-pointer flex items-center gap-2 dark:text-gray-200">
              <Settings size={16} /> Settings
            </DropdownMenuItem>

            <DropdownMenuItem className="cursor-pointer flex items-center gap-2 dark:text-gray-200">
              <HelpCircle size={16} /> Support
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem className="cursor-pointer text-red-500 flex items-center gap-2" onClick={handleLogout}>
              <LogOut size={16} /> Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Search */}
        <div className="flex-1 flex justify-center">
          <div
            className={cn(
              "flex items-center w-full max-w-md h-[45px]",
              "bg-gray-100 dark:bg-darkInput rounded-xl px-3",
              "transition-all duration-300",
              focused ? "ring-2 ring-[#2D6CDF]/40 scale-[1.02]" : "scale-100"
            )}
          >
            <Search size={18} className="text-gray-500 dark:text-gray-300" />
            <input
              type="text"
              placeholder="Search..."
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              className="flex-1 bg-transparent outline-none px-3 text-sm text-gray-700 dark:text-gray-200"
            />
            <button className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-[#475569] transition-all duration-300">
              <SlidersHorizontal size={18} className="text-gray-600 dark:text-gray-300" />
            </button>
          </div>
        </div>

        {/* Theme Toggle Inline Bar */}
        <div className="relative flex items-center" ref={modeRef}>
          <button
            onClick={() => setShowModes((prev) => !prev)}
            className="p-2 rounded-xl bg-gray-100 dark:bg-darkInput hover:bg-gray-200 dark:hover:bg-[#475569] text-gray-800 dark:text-gray-100 transition-all duration-300"
          >
            {resolvedTheme === "light" && <Sun size={18} />}
            {resolvedTheme === "dark" && <Moon size={18} />}
            {resolvedTheme === "system" && <Monitor size={18} />}
          </button>

          <div
            className={cn(
              "ml-2 flex h-[45px] items-center bg-gray-100 dark:bg-darkInput text-gray-800 dark:text-gray-100 rounded-xl shadow-sm overflow-hidden transition-all transform",
              "origin-left",
              showModes
                ? "opacity-100 scale-100 w-auto px-2 duration-500 ease-in-out"
                : "opacity-0 scale-x-90 w-0 px-0 pointer-events-none duration-300 ease-in"
            )}
          >
            {[
              { mode: "light", icon: <Sun size={16} />, label: "Light" },
              { mode: "dark", icon: <Moon size={16} />, label: "Dark" },
              { mode: "system", icon: <Monitor size={16} />, label: "System" },
            ].map(({ mode, icon, label }) => (
              <button
                key={mode}
                onClick={() => {
                  setTheme(mode);
                  setShowModes(false);
                  playToggleSound();
                }}
                className={cn(
                  "flex items-center gap-1 px-3 py-2 rounded-md transition",
                  "hover:bg-gray-200 dark:hover:bg-[#475569]",
                  resolvedTheme === mode
                    ? "bg-[#E0F2FE] text-blue-800 dark:bg-[#475569] dark:text-white"
                    : ""
                )}
              >
                {icon}
                <span className="text-sm">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Avatar on the right */}

      </div>
    </header>
  );
}
