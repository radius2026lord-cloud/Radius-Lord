import { Home, Bell, User, Settings } from "lucide-react";

export const headerConfig = [
    { label: "Home", href: "/", icon: Home },
    { label: "Alerts", href: "/alerts", icon: Bell, badge: 3 },
    { label: "Profile", href: "/profile", icon: User },
    { label: "Settings", href: "/settings", icon: Settings },
];
