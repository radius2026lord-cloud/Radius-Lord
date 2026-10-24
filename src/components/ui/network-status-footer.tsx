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
      className="flex min-h-[50px] flex-wrap items-center gap-2 rounded-[14px] border border-[#c9dced]/80 bg-[#f9fbfe]/95 px-2.5 py-2 text-[10px] text-slate-600 shadow-[0_10px_28px_rgba(60,88,116,.09)] backdrop-blur-xl dark:border-white/10 dark:bg-[#302e33]/95 dark:text-slate-300 sm:gap-2.5 sm:px-3"
    >
      {prefs.footer.showNetwork && (
        <div className="flex min-w-0 items-center gap-2 rounded-[11px] border border-blue-100/80 bg-white/75 px-2.5 py-1.5 dark:border-white/[.07] dark:bg-white/[.035]">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[9px] bg-blue-50 text-blue-600 dark:bg-blue-400/10 dark:text-blue-300">
            <Layers className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-[9px] text-slate-500 dark:text-slate-400">الشبكة</span>
            <b className="block max-w-36 truncate text-[11px] font-semibold text-[#17386d] dark:text-slate-100">
              {networkName}
            </b>
          </span>
        </div>
      )}

      {prefs.footer.showNas && (
        <section
          aria-label="معلومات جهاز NAS المحدد"
          className="min-w-[min(100%,250px)] flex-1 rounded-[12px] border border-[#d9e5ef] bg-white/75 p-1.5 dark:border-white/[.08] dark:bg-white/[.035]"
        >
          <div className="flex min-w-0 items-center gap-2 px-1 pb-1.5">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[9px] bg-cyan-50 text-cyan-600 dark:bg-cyan-400/10 dark:text-cyan-300">
              <Server className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <span className="block text-[9px] leading-4 text-slate-500 dark:text-slate-400">جهاز NAS</span>
              <strong className="block truncate text-[11px] font-semibold leading-4 text-[#17386d] dark:text-slate-100">
                {item?.name || (nasError ? "تعذر تحميل بيانات NAS" : "لا يوجد NAS مضاف")}
              </strong>
            </div>
            {item && prefs.footer.showStatus && (
              <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 text-[9px] font-semibold ${status.tone}`}>
                <i className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                {status.label}
              </span>
            )}
            {nas.length > 1 && (
              <div className="mr-auto flex shrink-0 items-center gap-0.5 rounded-full bg-slate-50 p-0.5 dark:bg-white/[.04]">
                <button
                  type="button"
                  onClick={previous}
                  title="NAS السابق"
                  aria-label="NAS السابق"
                  className="grid h-6 w-6 place-items-center rounded-full text-slate-500 transition hover:bg-white hover:text-blue-600 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-blue-300"
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
                <span className="min-w-8 text-center text-[9px] font-semibold tabular-nums text-slate-500 dark:text-slate-300">
                  {selected + 1} / {nas.length}
                </span>
                <button
                  type="button"
                  onClick={next}
                  title="NAS التالي"
                  aria-label="NAS التالي"
                  className="grid h-6 w-6 place-items-center rounded-full text-slate-500 transition hover:bg-white hover:text-blue-600 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-blue-300"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          {item && (
            <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
              {prefs.footer.showCpu && (
                <NasMetric icon={Cpu} label="المعالج" value={cpu === undefined ? "—" : `${Math.round(cpu)}%`} tone="text-amber-500" />
              )}
              {prefs.footer.showRam && (
                <NasMetric icon={HardDrive} label="الذاكرة" value={ram === null ? "—" : `${ram}%`} tone="text-violet-500" />
              )}
              {prefs.footer.showUptime && (
                <NasMetric icon={Clock3} label="مدة التشغيل" value={uptime || "—"} tone="text-sky-500" />
              )}
              {prefs.footer.showConnected && (
                <NasMetric icon={Users} label="المشتركون" value={String(item.connectedAccounts ?? "—")} tone="text-emerald-500" />
              )}
            </div>
          )}
        </section>
      )}

      {prefs.footer.showClock && (
        <div className="mr-auto flex shrink-0 items-center gap-2 rounded-[11px] border border-cyan-100/80 bg-white/75 px-2.5 py-1.5 dark:border-white/[.07] dark:bg-white/[.035]">
          <span className="grid h-7 w-7 place-items-center rounded-[9px] bg-cyan-50 text-cyan-600 dark:bg-cyan-400/10 dark:text-cyan-300">
            <Clock3 className="h-4 w-4" />
          </span>
          <span>
            <bdi className="block text-[11px] font-semibold tabular-nums text-[#17386d] dark:text-slate-100">{time}</bdi>
            <span className="block text-[9px] text-slate-500 dark:text-slate-400">{date}</span>
          </span>
        </div>
      )}

      {prefs.footer.showExpiry && (
        <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-violet-100 bg-violet-50/80 px-2.5 py-1.5 text-[9px] text-violet-700 dark:border-violet-300/10 dark:bg-violet-400/[.06] dark:text-violet-200">
          <ShieldCheck className="h-3.5 w-3.5 text-violet-500 dark:text-violet-300" />
          <span>الاشتراك حتى</span>
          <bdi className="font-semibold">{expiryLabel}</bdi>
        </span>
      )}

      {updated && (
        <ProjectTooltip label={`آخر عينة موارد من الجهاز: ${new Date(updated).toLocaleTimeString("ar")}`}>
          <span className="flex shrink-0 items-center gap-1 rounded-full px-1.5 py-1 text-[9px] text-slate-400">
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
    <div className="flex min-w-0 items-center gap-1.5 rounded-[9px] bg-[#f6f9fc] px-2 py-1.5 dark:bg-white/[.045]">
      <Icon className={`h-3.5 w-3.5 shrink-0 ${tone}`} />
      <span className="min-w-0 flex-1 truncate text-[9px] text-slate-500 dark:text-slate-400">{label}</span>
      <bdi className="max-w-[50%] shrink-0 truncate text-[10px] font-semibold tabular-nums text-[#17386d] dark:text-slate-100">
        {value}
      </bdi>
    </div>
  );
}
