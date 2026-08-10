import {
  Home,
  User,
  Bell,
  Briefcase,
  Settings,
  Wallet,
  Calendar,
  History,
} from "lucide-react";

export interface NavSubItem {
  name: string;
  href: string;
}

export interface NavItem {
  name: string;
  href: string;
  icon: any;
  badge?: number;
  submenu?: NavSubItem[];
}

export interface NavGroup {
  group: string;
  items: NavItem[];
}

export interface CompanyInfo {
  logo: string;
  name: string;
  slogan: string;
}

export interface SidebarConfig {
  company: CompanyInfo;
  nav: NavGroup[];
}

export const sidebarConfig: SidebarConfig = {
  company: {
    logo: "/public/next.svg", // ← ضع مسار الصورة هنا
    name: "SafwaNn",
    slogan: "IT Eng",
  },

  nav: [
    {
      group: "General",
      items: [
        { name: "Home", href: "../(Dynamic_Pages)/(home)/home.tsx", icon: Home },
        { name: "Profile", href: "/profile", icon: User },
        { name: "Notifications", href: "/notifications", icon: Bell, badge: 5 },
      ],
    },

    {
      group: "Management",
      items: [
        { name: "Appointments", href: "/appointments", icon: Calendar },

        {
          name: "Wallet",
          href: "/wallet",
          icon: Wallet,
          submenu: [
            { name: "test", href: "/profile" },

            { name: "Transactions", href: "/wallet/transactions" },
          ],
        },

        { name: "History", href: "/history", icon: History },
      ],
    },

    {
      group: "Settings",
      items: [{ name: "Settings", href: "/settings", icon: Settings }],
    },
  ],
};
