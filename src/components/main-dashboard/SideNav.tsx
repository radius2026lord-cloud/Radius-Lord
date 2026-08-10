"use client";

import { sidebarConfig } from "@/app/(Client)/Dashboard/(Configs_Pages)/config_Nav";
import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ChevronRight, ChevronLeft, ChevronDown } from "lucide-react";

interface SideNavProps {
  isSidebarExpanded: boolean;
  setIsSidebarExpanded: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function SideNav({
  isSidebarExpanded,
  setIsSidebarExpanded,
}: SideNavProps) {
  const pathname = usePathname();
  const [openGroup, setOpenGroup] = useState("");

  useEffect(() => {
    sidebarConfig.nav.forEach((group) => {
      group.items.forEach((item) => {
        if (item.submenu) {
          item.submenu.forEach((sub) => {
            if (pathname.startsWith(sub.href)) {
              setOpenGroup(item.name);
            }
          });
        }
      });
    });
  }, [pathname]);

  const toggleSidebar = () => setIsSidebarExpanded(!isSidebarExpanded);

  return (
    <>
      <div
        dir="ltr"
        className={cn(
          "sidebar",
          "fixed left-0 top-[15px]   bottom-2 ",
          "transition-all duration-500 ease-in-out z-[40]",
          "rounded-tr-2xl rounded-br-2xl overflow-y-auto",

          // Width
          isSidebarExpanded ? "w-[200px]" : "w-[80px]",

          // 🎨 Glass + Dark Mode h-[calc(100vh-15px)]
          "bg-white/70 dark:bg-[#1e293b]/80 backdrop-blur-xl",

          // 🎨 Shadow + Border
          "shadow-[0_4px_20px_rgba(0,0,0,0.35)] border-r border-gray-200/40 dark:border-gray-700/40"
        )}
      >
        {/* زر فتح/طي */}
        <button
          type="button"
          onClick={toggleSidebar}
          className="
            absolute -right-3 top-4 h-7 w-7 rounded-full shadow 
            bg-white/80 dark:bg-[#334155]/80 border border-gray-300/40 dark:border-gray-600/40
            flex items-center justify-center transition-all backdrop-blur-md
            hover:scale-110
          "
        >
          {isSidebarExpanded ? (
            <ChevronLeft size={18} className="text-gray-700 dark:text-gray-300" />
          ) : (
            <ChevronRight size={18} className="text-gray-700 dark:text-gray-300" />
          )}
        </button>

        {/* بروفايل الشركة */}
        <div className="flex flex-col items-center justify-center pt-6 pb-3">
          <div
            className={cn(
              "relative w-16 h-16 rounded-full overflow-hidden shadow-xl border-2 transition-all duration-300 cursor-pointer",
              pathname === "/" ? "border-blue-500" : "border-white/30 dark:border-gray-600",
              "hover:scale-110 hover:border-blue-400"
            )}
          >
            <Image
              src={
                sidebarConfig.company.logo ||
                "https://images.pexels.com/photos/3184292/pexels-photo-3184292.jpeg"
              }
              alt="Company Logo"
              fill
              className="object-cover"
              priority
            />
          </div>

          {isSidebarExpanded && (
            <div className="text-center animate-fadeIn mt-2">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                {sidebarConfig.company.name}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {sidebarConfig.company.slogan}
              </p>
            </div>
          )}
        </div>

        {/* الخط الفاصل */}
        <div className="w-full h-[2px] bg-gray-200/50 dark:bg-gray-700/50 mb-2"></div>

        {/* عناصر السايدبار */}
        <aside className="flex flex-col w-full px-3 space-y-4">
          {sidebarConfig.nav.map((group, i) => (
            <div key={i} className="animate-stagger">
              {isSidebarExpanded && (
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 animate-fadeIn">
                  {group.group}
                </p>
              )}

              {group.items.map((item, j) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                const isOpen = openGroup === item.name;

                return (
                  <div key={j} className="animate-stagger">
                    <button
                      type="button"
                      onClick={(e) => {
                        if (item.submenu) setOpenGroup(isOpen ? "" : item.name);

                        const ripple = document.createElement("span");
                        ripple.className = "ripple";
                        e.currentTarget.appendChild(ripple);
                        setTimeout(() => ripple.remove(), 600);
                      }}
                      className={cn(
                        "relative overflow-hidden",
                        "flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-all w-full",

                        // Hover
                        "hover:bg-[#E8F0FF]/60 dark:hover:bg-[#334155] hover:text-[#2D6CDF] hover:translate-x-1",

                        // Active
                        isActive &&
                        "bg-[#E8F0FF] dark:bg-[#334155] text-[#2D6CDF] font-semibold",

                        isSidebarExpanded ? "justify-start" : "justify-center"
                      )}
                    >
                      <Icon className="text-gray-600 dark:text-gray-300" size={20} />

                      {isSidebarExpanded && (
                        <>
                          <span className="animate-fadeIn text-gray-700 dark:text-gray-300">
                            {item.name}
                          </span>

                          {item.submenu && (
                            <ChevronDown
                              className={cn(
                                "ml-auto transition-transform text-gray-600 dark:text-gray-300",
                                isOpen && "rotate-180"
                              )}
                            />
                          )}
                        </>
                      )}
                    </button>

                    {item.submenu && isOpen && isSidebarExpanded && (
                      <div className="ml-10 mt-1 space-y-1 animate-bounceDown">
                        {item.submenu.map((sub, k) => {
                          const isSubActive = pathname === sub.href;

                          return (
                            <Link
                              key={k}
                              href={sub.href}
                              className={cn(
                                "block px-2 py-1 text-sm rounded transition-all",
                                "hover:bg-[#E8F0FF]/60 dark:hover:bg-[#334155] hover:text-[#2D6CDF]",
                                isSubActive &&
                                "bg-[#E8F0FF] dark:bg-[#334155] text-[#2D6CDF] font-semibold"
                              )}
                            >
                              {sub.name}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </aside>
      </div>

      {/* CSS داخل نفس الملف */}
      <style jsx global>{`
        /* Glassmorphism */
        .glass {
          background: rgba(255, 255, 255, 0.75);
          backdrop-filter: blur(12px);
        }

        /* Scrollbar */
        .sidebar::-webkit-scrollbar {
          width: 8px;
          background: transparent;
        }
        .sidebar::-webkit-scrollbar-thumb {
          background: transparent;
          border-radius: 10px;
          transition: background 0.3s ease;
        }
        .sidebar:hover::-webkit-scrollbar-thumb {
          background: #3b82f6;
        }
        .dark .sidebar:hover::-webkit-scrollbar-thumb {
          background: #60a5fa;
        }

        /* Ripple Effect */
        .ripple {
          position: absolute;
          width: 120px;
          height: 120px;
          background: rgba(0, 0, 0, 0.15);
          border-radius: 50%;
          transform: scale(0);
          animation: rippleAnim 0.6s linear;
          pointer-events: none;
          top: 50%;
          left: 50%;
          translate: -50% -50%;
        }
        @keyframes rippleAnim {
          to {
            transform: scale(4);
            opacity: 0;
          }
        }

        /* Fade In */
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateX(-6px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }

        /* Bounce Down */
        @keyframes bounceDown {
          0% {
            opacity: 0;
            transform: translateY(-10px);
          }
          60% {
            opacity: 1;
            transform: translateY(4px);
          }
          100% {
            transform: translateY(0);
          }
        }
        .animate-bounceDown {
          animation: bounceDown 0.35s ease-out;
        }

        /* Stagger Animation */
        .animate-stagger {
          animation: fadeIn 0.4s ease-out;
        }
      `}</style>
    </>
  );
}
