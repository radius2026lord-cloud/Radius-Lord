"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Clock3,
  Cpu,
  HardDrive,
  Layers,
  Server,
  ShieldCheck,
  Users,
} from "lucide-react";
import ProjectTooltip from "./project-tooltip";

type Nas = {
  id: number;
  name: string;
  isEnabled?: boolean;
  routerosVersion?: string | null;
  boardName?: string | null;
  uptime?: string | null;
  connectedAccounts?: number;
  status?: string;
  metricsUpdatedAt?: string | null;
  metrics?: Array<{
    receivedAt: string;
    cpu: number;
    freeMemory: number;
    totalMemory: number;
    uptime: string;
  }>;
};

type Prefs = {
  footer: {
    showNetwork: boolean;
    showNas: boolean;
    showStatus: boolean;
    showCpu: boolean;
    showRam: boolean;
    showUptime: boolean;
    showConnected: boolean;
    showClock: boolean;
    showExpiry: boolean;
    rotateNas: boolean;
    rotateSeconds: number;
    clock24h: boolean;
  };
};

const defaults: Prefs = {
  footer: {
    showNetwork: true,
    showNas: true,
    showStatus: true,
    showCpu: true,
    showRam: true,
    showUptime: true,
    showConnected: true,
    showClock: true,
    showExpiry: true,
    rotateNas: false,
    rotateSeconds: 15,
    clock24h: true,
  },
};

export default function NetworkStatusFooter({
  endpoint,
  networkName,
  expiresAt,
}: {
  endpoint: string;
  networkName: string;
  expiresAt: string;
}) {
  const [prefs, setPrefs] = useState(defaults);
  const [nas, setNas] = useState<Nas[]>([]);
  const [nasError, setNasError] = useState(false);
  const [selected, setSelected] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const [updated, setUpdated] = useState("");

  useEffect(() => {
    let live = true;
    const controller = new AbortController();
    const prefEndpoint = `${endpoint}/ui-preferences`;

    async function load() {
      const results = await Promise.allSettled([
        fetch(prefEndpoint, {
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
        }),
        fetch(`${endpoint}/nas`, {
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
        }),
      ]);

      if (!live) return;
      const [prefResult, nasResult] = results;

      if (prefResult.status === "fulfilled" && prefResult.value.ok) {
        try {
          const data = await prefResult.value.json();
          if (data?.preferences) {
            setPrefs({
              ...defaults,
              ...data.preferences,
              footer: { ...defaults.footer, ...data.preferences.footer },
            });
          }
        } catch {
          // Keep the last known preferences if the response is malformed.
        }
      }

      if (nasResult.status === "fulfilled" && nasResult.value.ok) {
        try {
          const data = await nasResult.value.json();
          const rows: Nas[] = (data.items || []).filter((item: Nas) => item.isEnabled);
          setNas(rows);
          setNasError(false);
          setSelected((index) => Math.min(index, Math.max(0, rows.length - 1)));
        } catch {
          setNasError(true);
        }
      } else {
        setNasError(true);
      }
    }

    const onPreferences = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.endpoint === prefEndpoint && detail.preferences) {
        setPrefs({
          ...defaults,
          ...detail.preferences,
          footer: { ...defaults.footer, ...detail.preferences.footer },
        });
      }
    };

    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 30000);
    const tick = window.setInterval(() => setNow(new Date()), 1000);
    const visible = () => {
      if (document.visibilityState === "visible") void load();
    };
    window.addEventListener("rl-ui-preferences-updated", onPreferences);
    document.addEventListener("visibilitychange", visible);

    return () => {
      live = false;
      controller.abort();
      clearInterval(timer);
      clearInterval(tick);
      window.removeEventListener("rl-ui-preferences-updated", onPreferences);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [endpoint]);

  useEffect(() => {
    if (!prefs.footer.rotateNas || nas.length < 2) return;
    const timer = window.setInterval(
      () => setSelected((index) => (index + 1) % nas.length),
      Math.max(5, prefs.footer.rotateSeconds || 15) * 1000,
    );
    return () => clearInterval(timer);
  }, [prefs.footer.rotateNas, prefs.footer.rotateSeconds, nas.length]);

  const item = nas[selected];
  const sample = item?.metrics?.[item.metrics.length - 1];
  const cpu = sample?.cpu;
  const ram =
    sample && sample.totalMemory > 0
      ? Math.round((1 - sample.freeMemory / sample.totalMemory) * 100)
      : null;
  const uptime = sample?.uptime || item?.uptime || null;

  useEffect(() => setUpdated(item?.metricsUpdatedAt || ""), [item?.id, item?.metricsUpdatedAt]);

  const time = now.toLocaleTimeString("ar", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: !prefs.footer.clock24h,
  });
  const date = now.toLocaleDateString("ar", { day: "numeric", month: "short" });
  const expiry = new Date(expiresAt);
  const expiryLabel = Number.isNaN(expiry.getTime())
    ? "—"
    : expiry.toLocaleDateString("ar", { day: "numeric", month: "short", year: "numeric" });

  const status =
    item?.status === "connected"
      ? { label: "متصل", tone: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-300/15 dark:bg-emerald-400/[.08] dark:text-emerald-300", dot: "bg-emerald-500" }
      : item?.status === "disconnected"
        ? { label: "غير متصل", tone: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-300/15 dark:bg-rose-400/[.08] dark:text-rose-300", dot: "bg-rose-500" }
        : { label: "بانتظار أول اتصال", tone: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-300/15 dark:bg-amber-400/[.08] dark:text-amber-300", dot: "bg-amber-500" };

  const previous = () => setSelected((index) => (index - 1 + nas.length) % nas.length);
  const next = () => setSelected((index) => (index + 1) % nas.length);

  return (
    <div
      dir="rtl"
      className="flex h-[42px] min-h-[42px] flex-nowrap items-center gap-x-3 overflow-x-auto overflow-y-hidden rounded-[12px] border border-[#c9dced]/80 bg-[#f9fbfe]/95 px-3 py-1.5 text-[10px] text-slate-600 shadow-[0_10px_28px_rgba(60,88,116,.09)] backdrop-blur-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden dark:border-white/10 dark:bg-[#302e33]/95 dark:text-slate-300"
    >
      {prefs.footer.showNetwork && (
        <div className="flex shrink-0 items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 shrink-0 text-blue-500" />
          <b className="max-w-36 truncate font-semibold">{networkName}</b>
        </div>
      )}

      {prefs.footer.showNas && (
        <section
          aria-label="معلومات جهاز NAS المحدد"
          className="flex min-w-max shrink-0 items-center gap-1.5 rounded-[10px] border border-[#d9e5ef] bg-white/75 px-1.5 py-0.5 dark:border-white/[.08] dark:bg-white/[.035]"
        >
          <Server className="h-3.5 w-3.5 shrink-0 text-cyan-500" />
          <span className="shrink-0 text-[9px] text-slate-500 dark:text-slate-400">NAS</span>
          <strong className="min-w-0 max-w-32 truncate text-[10px] font-semibold text-[#17386d] dark:text-slate-100">
            {item?.name || (nasError ? "تعذر التحميل" : "غير مضاف")}
          </strong>
          {item && prefs.footer.showStatus && (
            <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${status.tone}`}>
              <i className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
              {status.label}
            </span>
          )}
          {nas.length > 1 && (
            <div className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  onClick={previous}
                  title="NAS السابق"
                  aria-label="NAS السابق"
                  className="grid h-5 w-5 place-items-center rounded-full text-slate-500 transition hover:bg-white hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-blue-300"
                >
                  <ArrowRight className="h-3 w-3" />
                </button>
                <span className="min-w-7 text-center text-[9px] tabular-nums text-slate-500 dark:text-slate-300">
                  {selected + 1}/{nas.length}
                </span>
                <button
                  type="button"
                  onClick={next}
                  title="NAS التالي"
                  aria-label="NAS التالي"
                  className="grid h-5 w-5 place-items-center rounded-full text-slate-500 transition hover:bg-white hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-blue-300"
                >
                  <ArrowLeft className="h-3 w-3" />
                </button>
            </div>
          )}
          {item && <span className="mx-0.5 h-4 w-px shrink-0 bg-slate-200 dark:bg-white/10" />}
          {item && (
            <div className="flex min-w-0 shrink-0 items-center gap-1">
              {prefs.footer.showCpu && (
                <NasMetric icon={Cpu} label="CPU" value={cpu === undefined ? "—" : `${Math.round(cpu)}%`} tone="text-amber-500" />
              )}
              {prefs.footer.showRam && (
                <NasMetric icon={HardDrive} label="RAM" value={ram === null ? "—" : `${ram}%`} tone="text-violet-500" />
              )}
              {prefs.footer.showUptime && (
                <NasMetric icon={Clock3} label="التشغيل" value={uptime || "—"} tone="text-sky-500" />
              )}
              {prefs.footer.showConnected && (
                <NasMetric icon={Users} label="متصل" value={String(item.connectedAccounts ?? "—")} tone="text-emerald-500" />
              )}
            </div>
          )}
        </section>
      )}

      {prefs.footer.showClock && (
        <div className="mr-auto flex shrink-0 items-center gap-1.5 text-slate-500">
          <Clock3 className="h-3.5 w-3.5 text-cyan-500" />
          <bdi className="tabular-nums">{time}</bdi>
          <span className="hidden sm:inline">· {date}</span>
        </div>
      )}

      {prefs.footer.showExpiry && (
        <span className="flex shrink-0 items-center gap-1 text-slate-400">
          <ShieldCheck className="h-3.5 w-3.5 text-violet-500 dark:text-violet-300" />
          الاشتراك حتى {expiryLabel}
        </span>
      )}

      {updated && (
        <ProjectTooltip label={`آخر عينة موارد من الجهاز: ${new Date(updated).toLocaleTimeString("ar")}`}>
          <span className="hidden shrink-0 items-center gap-1 text-[9px] text-slate-400 xl:flex">
            <Activity className="h-3 w-3 text-cyan-500" />
            آخر قراءة
          </span>
        </ProjectTooltip>
      )}
    </div>
  );
}

function NasMetric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Cpu;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1 rounded-md px-1 py-0.5">
      <Icon className={`h-3 w-3 shrink-0 ${tone}`} />
      <span className="text-[9px] text-slate-500 dark:text-slate-400">{label}</span>
      <bdi className="max-w-24 truncate text-[10px] font-semibold tabular-nums text-[#17386d] dark:text-slate-100">
        {value}
      </bdi>
    </div>
  );
}
