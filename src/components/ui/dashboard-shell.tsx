"use client";

import { useState } from "react";
import SideNav from "@/components/main-dashboard/SideNav";
import SecondaryHeader from "@/components/headers/secondary-header";
import PrimaryHeader from "@/components/headers/primary-header";
import PageWorkspace from "@/components/main-dashboard/PageWorkspace";

export default function DashboardShell({ children }: { children: React.ReactNode }) {
    const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-darkBg">
            <div className="flex">
                <SideNav
                    isSidebarExpanded={isSidebarExpanded}
                    setIsSidebarExpanded={setIsSidebarExpanded}
                />

                <div className="flex-1 flex flex-col">
                    <PrimaryHeader isSidebarExpanded={isSidebarExpanded} />
                    <SecondaryHeader isSidebarExpanded={isSidebarExpanded} />

                    {/* مساحة العمل */}
                    <PageWorkspace isSidebarExpanded={isSidebarExpanded}>
                        {children}
                    </PageWorkspace>
                </div>
            </div>
        </div>
    );
}
