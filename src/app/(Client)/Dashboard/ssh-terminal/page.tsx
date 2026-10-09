"use client";
import {useEffect,useState} from "react";
import {TerminalSquare,Server} from "lucide-react";
import {useAuth} from "@/components/auth/auth-provider";
import SshTerminal from "@/components/settings/ssh-terminal";
import {CollectionCard,CollectionState,CollectionToolbar} from "@/components/ui/collection-display";
import ProjectButton from "@/components/ui/project-button";

type Host={id:number;name:string;host:string};
export default function SshTerminalPage(){
 const {isMasterAdmin,loading}=useAuth();const [servers,setServers]=useState<Host[]>([]),[selected,setSelected]=useState<Host|null>(null),[query,setQuery]=useState(""),[error,setError]=useState(""),[pending,setPending]=useState(true);
 useEffect(()=>{if(!isMasterAdmin)return;const controller=new AbortController();void (async()=>{try{const r=await fetch("/api/admin/platform-settings/database-servers",{credentials:"include",cache:"no-store",signal:controller.signal}),j=await r.json();if(!r.ok)throw new Error(j.message);setServers(j.servers);}catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:"تعذر تحميل المخدمات.");}finally{if(!controller.signal.aborted)setPending(false);}})();return()=>controller.abort();},[isMasterAdmin]);
 if(loading)return <CollectionState>جارٍ التحميل...</CollectionState>;
 if(!isMasterAdmin)return <CollectionState>طرفية SSH خاصة بالمدير الرئيسي.</CollectionState>;
 return <div dir="rtl" className="space-y-4 text-slate-800 dark:text-slate-200"><CollectionToolbar responsive icon={TerminalSquare} title="طرفية SSH" description="تنفيذ أوامر الصيانة الطارئة على المخدمات — للمدير الرئيسي فقط" query={query} onQueryChange={setQuery} searchPlaceholder="بحث عن مخدم..."/>
 {error&&<p role="alert" className="rounded-[14px] bg-red-50 p-3 text-sm text-red-600 dark:bg-red-500/10">{error}</p>}
 {selected?<SshTerminal key={selected.id} serverId={selected.id} name={selected.name} host={selected.host} onClose={()=>setSelected(null)}/>:pending?<CollectionState>جارٍ تحميل المخدمات...</CollectionState>:<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{servers.filter(s=>`${s.name} ${s.host}`.toLowerCase().includes(query.toLowerCase())).map(s=><CollectionCard key={s.id} onOpen={()=>setSelected(s)}><div className="flex items-center gap-3"><Server className="h-8 w-8 text-cyan-500"/><div className="min-w-0"><h2 className="truncate font-semibold">{s.name}</h2><p className="mt-1 break-all text-xs text-slate-500"><bdi>{s.host}</bdi></p></div></div><div className="mt-4" onClick={e=>e.stopPropagation()}><ProjectButton variant="secondary" onClick={()=>setSelected(s)}><TerminalSquare className="text-cyan-500"/>إعداد الاتصال وفتح الطرفية</ProjectButton></div></CollectionCard>)}{!servers.length&&<CollectionState>أضف مخدمًا من خوادم قواعد البيانات، ثم اضبط اتصال SSH الخاص به هنا.</CollectionState>}</div>}</div>;
}
