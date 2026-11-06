"use client";

import {useCallback, useEffect, useState, type FormEvent} from "react";
import {Database, History, PackagePlus, RefreshCw, Upload} from "lucide-react";
import {useAuth} from "@/components/auth/auth-provider";
import {CollectionState} from "@/components/ui/collection-display";
import FloatingNotice from "@/components/ui/floating-notice";
import ProjectButton from "@/components/ui/project-button";
import {ProjectCardIcon, ProjectInfoCard} from "@/components/ui/project-info-card";

const endpoint = "/api/admin/platform-settings/system-updates";

type Release = {version: string; changes: string; receivedAt: string};
type UpdateData = {
  uploadEnabled: boolean;
  currentVersion: string | null;
  targetSchemaVersion: string | null;
  releases: Release[];
  networks: {tenantId: number; name: string; schemaVersion: string | null}[];
};

async function encode(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(""));
}

export default function SystemUpdatesPage() {
  const {isMasterAdmin, loading} = useAuth();
  const [data, setData] = useState<UpdateData>();
  const [reading, setReading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<{error?: string; message?: string}>({});

  const refresh = useCallback(async () => {
    setReading(true);
    try {
      const response = await fetch(endpoint, {cache: "no-store"});
      if (!response.ok) throw new Error();
      setData(await response.json());
    } catch {
      setNotice({error: "تعذّر تحميل سجل التحديثات. أعد المحاولة."});
    } finally {
      setReading(false);
    }
  }, []);

  useEffect(() => {
    if (isMasterAdmin) void refresh();
  }, [isMasterAdmin, refresh]);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const archive = fields.get("archive");
    const manifest = fields.get("manifest");
    const signature = fields.get("signature");
    if (!(archive instanceof File) || !(manifest instanceof File) || !(signature instanceof File) ||
        !archive.size || archive.size > 100 * 1024 * 1024 || !manifest.size || manifest.size > 6144 || signature.size !== 64) {
      setNotice({error: "تحقق من ملفات الإصدار الموقّعة. الحد الأقصى للحزمة 100 ميبي بايت."});
      return;
    }

    setUploading(true);
    try {
      const [encodedManifest, encodedSignature] = await Promise.all([encode(manifest), encode(signature)]);
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          "X-Release-Manifest": encodedManifest,
          "X-Release-Signature": encodedSignature,
        },
        body: archive,
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.message || "تعذّر رفع حزمة الإصدار.");
      }
      form.reset();
      setNotice({message: "تم حفظ الحزمة والتحقق من توقيعها وبصمتها."});
      await refresh();
    } catch (error) {
      setNotice({error: error instanceof Error ? error.message : "تعذّر رفع حزمة الإصدار."});
    } finally {
      setUploading(false);
    }
  }

  if (loading) return <CollectionState loading>جارٍ التحميل...</CollectionState>;
  if (!isMasterAdmin) return <CollectionState>هذه الصفحة خاصة بالمدير الرئيسي.</CollectionState>;

  return (
    <div dir="rtl" className="mx-auto max-w-6xl space-y-4">
      <FloatingNotice {...notice} onDismiss={() => setNotice({})}/>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 font-bold"><ProjectCardIcon icon={PackagePlus}/> تحديثات النظام</h1>
        <ProjectButton variant="secondary" onClick={refresh} disabled={reading}><RefreshCw/> تحديث السجل</ProjectButton>
      </header>
      <ProjectInfoCard>
        <p className="font-semibold">الإصدار الحالي <bdi>{data?.currentVersion || "غير مسجّل"}</bdi></p>
        <p className="mt-1 text-sm">الحزم المرفوعة تُحفظ بانتظار النشر.</p>
      </ProjectInfoCard>
      <ProjectInfoCard tone="pending">
        <h2 className="flex items-center gap-2 font-semibold"><ProjectCardIcon icon={Upload} tone="pending"/> رفع حزمة إصدار</h2>
        {!data?.uploadEnabled ? <p className="mt-2 text-sm">يتاح الرفع بعد ضبط مجلد الإصدارات ومفتاح التحقق على الاستضافة.</p> :
          <form onSubmit={upload} className="mt-3 space-y-3">
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                {name: "archive", label: "حزمة الإصدار", accept: ".zip"},
                {name: "manifest", label: "بيان الإصدار", accept: ".json"},
                {name: "signature", label: "توقيع الإصدار", accept: ".sig"},
              ].map(field => <label key={field.name} className="grid min-w-0 gap-1 text-sm">
                {field.label}
                <input className="w-full min-w-0 rounded-lg border border-current/20 p-2" type="file" name={field.name} accept={field.accept} required disabled={uploading}/>
              </label>)}
            </div>
            <ProjectButton type="submit" disabled={uploading}><Upload/>{uploading ? "جارٍ الرفع والتحقق…" : "رفع الحزمة"}</ProjectButton>
          </form>}
      </ProjectInfoCard>
      <ProjectInfoCard>
        <h2 className="flex items-center gap-2 font-semibold"><ProjectCardIcon icon={History}/> سجل الحزم</h2>
        <ul className="mt-3 space-y-3">
          {data?.releases.map(release => <li key={release.version} className="border-t border-current/10 pt-2">
            <div className="flex flex-wrap justify-between gap-2"><bdi>{release.version}</bdi><span>جاهزة للمراجعة</span></div>
            <p className="whitespace-pre-wrap break-words text-sm">{release.changes}</p>
            <time className="text-xs" dateTime={release.receivedAt}>{new Date(release.receivedAt).toLocaleString("ar")}</time>
          </li>)}
        </ul>
        {data && !data.releases.length && <p className="text-sm">لا توجد حزم مرفوعة.</p>}
      </ProjectInfoCard>
      <ProjectInfoCard tone="memory">
        <h2 className="flex items-center gap-2 font-semibold"><ProjectCardIcon icon={Database} tone="memory"/> إصدارات قواعد الشبكات</h2>
        {data?.targetSchemaVersion && <p className="mt-1 text-sm">البنية المعتمدة <bdi>{data.targetSchemaVersion}</bdi></p>}
        <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data?.networks.map(network => <li key={network.tenantId} className="flex min-w-0 flex-wrap justify-between gap-2 border-t border-current/10 pt-2 text-sm">
            <span className="break-words">{network.name} <bdi>#{network.tenantId}</bdi></span>
            <bdi className="break-all">{network.schemaVersion || "إصدار غير مسجّل"}</bdi>
            {data.targetSchemaVersion && network.schemaVersion && <span className="basis-full">
              {network.schemaVersion === data.targetSchemaVersion ? "مطابقة للإصدار المعتمد" : "إصدار البنية مختلف"}
            </span>}
          </li>)}
        </ul>
        {data && !data.networks.length && <p className="text-sm">لا توجد قواعد شبكات نشطة.</p>}
      </ProjectInfoCard>
    </div>
  );
}
