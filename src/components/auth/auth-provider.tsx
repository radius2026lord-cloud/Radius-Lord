"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type AccountType = "master_admin" | "customer";
export type AuthAccount = {
  id: number;
  fullName: string;
  username: string | null;
  email: string;
  accountType: AccountType;
};

type AuthContextValue = {
  account: AuthAccount | null;
  accountType: AccountType | null;
  isAuthenticated: boolean;
  loading: boolean;
  isMasterAdmin: boolean;
  isCustomer: boolean;
  refreshAccount: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [account, setAccount] = useState<AuthAccount | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshAccount = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/auth/me", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) {
        setAccount(null);
        router.replace("/login");
        return;
      }
      const data = await response.json();
      setAccount(data.account ?? null);
    } catch {
      setAccount(null);
      router.replace("/login");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refreshAccount(); }, []);

  const value = useMemo<AuthContextValue>(() => ({
    account,
    accountType: account?.accountType ?? null,
    isAuthenticated: Boolean(account),
    loading,
    isMasterAdmin: account?.accountType === "master_admin",
    isCustomer: account?.accountType === "customer",
    refreshAccount,
  }), [account, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
