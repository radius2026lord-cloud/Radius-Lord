"use client";

import { createContext, useContext, useEffect, useMemo, useState, useRef } from "react";
import useSessionActivity from "./use-session-activity";
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

  const endingSession = useRef(false);
  const endSessionRef=useRef<()=>void>(()=>{});
  useSessionActivity({
    enabled:Boolean(account),
    endpoint:"/api/auth/session/renew",
    onExpired:()=>endSessionRef.current(),
    onRenewed:data=>{if(!endingSession.current&&data.account)setAccount(data.account);},
  });

  const refreshAccount = async (initial = true) => {
    if (endingSession.current) return;

    if (initial) setLoading(true);
    try {
      const response = await fetch("/api/auth/me", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) return;
      const data = await response.json();
      if (!endingSession.current) {
        setAccount(data.account ?? null);
      }
    } catch {
      // A network failure does not prove that the session has expired.
    } finally {
      if (!endingSession.current) setLoading(false);
    }
  };

  useEffect(() => {
    const originalFetch = window.fetch;
    const endSession = async () => {
      if (endingSession.current) return;
      endingSession.current = true;
      setAccount(null);
      setLoading(true);
      try {
        await originalFetch("/api/auth/logout", {method: "POST", credentials: "include", signal: AbortSignal.timeout(6000)});
      } catch { /* Redirect even when logout notification is unavailable. */ }
      finally { router.replace("/login"); }
    };
    endSessionRef.current=()=>void endSession();
    const authenticatedFetch: typeof window.fetch = async (input, init) => {
      const response = await originalFetch(input, init);
      const url = new URL(input instanceof Request ? input.url : String(input), window.location.href);
      if (response.status === 401 && url.origin === window.location.origin && url.pathname.startsWith("/api/") && !["/api/auth/login", "/api/auth/logout"].includes(url.pathname)) {
        void endSession();
      }
      return response;
    };
    window.fetch = authenticatedFetch;
    void refreshAccount();
    const checkSession = () => {
      if (endingSession.current) return;
      void refreshAccount(false);
    };
    const timer = window.setInterval(()=>{if(document.visibilityState==="visible")checkSession();}, 30000);
    const onVisible = () => { if (document.visibilityState === "visible") checkSession(); };
    window.addEventListener("focus", checkSession);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", checkSession);
      document.removeEventListener("visibilitychange", onVisible);
      if (window.fetch === authenticatedFetch) window.fetch = originalFetch;
    };
  }, []);

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

export function useOptionalAuth(){return useContext(AuthContext);}
