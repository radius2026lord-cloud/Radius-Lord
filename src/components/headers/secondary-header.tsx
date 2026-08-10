"use client";

import Link from "next/link";
import { headerConfig } from "@/app/(Client)/Dashboard/(Configs_Pages)/config_NavSecondry";
import { cn } from "@/lib/utils";

export default function SecondaryHeader({ isSidebarExpanded }: { isSidebarExpanded: boolean }) {
    return (
        <div
            className={cn(
                "fixed top-[85px] right-[20px] h-[65px] z-40",
                "rounded-2xl flex items-center px-6",
                "transition-all duration-500 ease-in-out",

                // 🎨 خلفية متناسقة مع الدارك مود
                "bg-white dark:bg-darkCard",

                // 🎨 ظل ناعم يناسب الدارك
                "shadow-[0_4px_20px_rgba(0,0,0,0.35)] border border-gray-200/40 dark:border-gray-700/40",

                // حركة مع السايدبار
                isSidebarExpanded
                    ? "left-[280px] w-[calc(100%-240px)]"   // كان 280px → صار 240px (أكبر 40px)
                    : "left-[140px] w-[calc(100%-120px)]"   // كان 140px → صار 100px (أكبر 40px)


            )}
        >
            <div className="flex justify-around items-center w-full">
                {headerConfig.map((item, i) => (
                    <Link
                        key={i}
                        href={item.href}
                        className={cn(
                            "relative flex flex-col items-center space-y-1 transition-all duration-300",

                            // 🎨 نصوص وأيقونات متناسقة
                            "text-gray-700 dark:text-gray-300",

                            // 🎨 Hover جميل
                            "hover:scale-110 hover:text-[#2D6CDF]"
                        )}
                    >
                        <item.icon size={24} className="text-gray-700 dark:text-gray-300" />

                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                            {item.label}
                        </span>

                        {/* Badge */}
                        {item.badge && (
                            <span
                                className="
                  absolute -top-1 right-2 
                  bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full
                  shadow-[0_0_6px_rgba(255,0,0,0.4)]
                "
                            >
                                {item.badge}
                            </span>
                        )}
                    </Link>
                ))}
            </div>
        </div>
    );
}
