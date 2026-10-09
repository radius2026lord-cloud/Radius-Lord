"use client";
import {useEffect,useRef,useState} from "react";
import {TerminalSquare,Plug,Unplug,ShieldCheck,Save,ArrowRight} from "lucide-react";
import ProjectInput from "@/components/ui/project-input";
import ProjectButton from "@/components/ui/project-button";
import ProjectDropdown from "@/components/ui/project-dropdown";
import ProjectTooltip from "@/components/ui/project-tooltip";
import {useAuth} from "@/components/auth/auth-provider";
import "@xterm/xterm/css/xterm.css";

const initial={host:"",port:"22",username:"",authMethod:"password",secret:"",passphrase:"",fingerprint:""};
export default function SshTerminal({serverId,name,host,onClose}:{serverId:number;name:string;host:string;onClose:()=>void}){
 const {isMasterAdmin}=useAuth();
 const [form,setForm]=useState({...initial,host}),[configured,setConfigured]=useState(false),[dirty,setDirty]=useState(false),[verified,setVerified]=useState(""),[candidate,setCandidate]=useState(""),[busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState(""),[state,setState]=useState<"closed"|"connecting"|"ready">("closed");
 const surface=useRef<HTMLDivElement>(null),cleanup=useRef(()=>{}),opening=useRef(false),abort=useRef<AbortController|null>(null),mounted=useRef(true);
 const endpoint=`/api/admin/platform-settings/database-servers/${serverId}/ssh`;
 useEffect(()=>{mounted.current=true;const controller=new AbortController();setLoaded(false);setConfigured(false);setDirty(false);setForm({...initial,host});
  if(isMasterAdmin)void (async()=>{try{const r=await fetch(endpoint,{credentials:"include",cache:"no-store",signal:controller.signal}),j=await r.json();if(!r.ok)throw new Error(j.message);if(j.connection){setForm({...initial,...j.connection,port:String(j.connection.port)});setConfigured(true);}}catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:"تعذر تحميل SSH.");}finally{if(!controller.signal.aborted)setLoaded(true);}})();
  return()=>{mounted.current=false;controller.abort();abort.current?.abort();cleanup.current();};
 },[endpoint,host,isMasterAdmin]);
 function change(key:keyof typeof initial,value:string){setDirty(true);setForm(f=>({...f,[key]:value}));setVerified("");setCandidate("");setError("");setMessage("");}
 async function check(save:boolean){if(busy)return;setBusy(true);setError("");setMessage("");setCandidate("");try{const r=await fetch(endpoint+(save?"":"/inspect"),{method:save?"PUT":"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({...form,port:Number(form.port),verified})}),j=await r.json();if(!mounted.current)return;if(!r.ok){if(j.fingerprint)setCandidate(j.fingerprint);throw new Error(j.message);}setMessage(j.message);if(save){setDirty(false);setConfigured(true);setVerified("");setForm(f=>({...f,secret:"",passphrase:""}));}else setVerified(j.verified);}catch(e){if(mounted.current)setError(e instanceof Error?e.message:"تعذر تنفيذ فحص SSH.");}finally{if(mounted.current)setBusy(false);}}
 function disconnect(){abort.current?.abort();cleanup.current();opening.current=false;setState("closed");}
 async function connect(){if(opening.current||state!=="closed"||!isMasterAdmin)return;opening.current=true;setState("connecting");setError("");setMessage("");const controller=new AbortController();abort.current=controller;
  try{const r=await fetch(endpoint+"/ticket",{method:"POST",credentials:"include",signal:controller.signal}),j=await r.json();if(!r.ok)throw new Error(j.message);
   const [{Terminal},{FitAddon}]=await Promise.all([import("@xterm/xterm"),import("@xterm/addon-fit")]);
   if(controller.signal.aborted||!surface.current)return;
   cleanup.current();const terminal=new Terminal({cursorBlink:true,fontSize:14,fontFamily:"Consolas, monospace",scrollback:1500,theme:{background:"#020617",foreground:"#e2e8f0"}}),fit=new FitAddon();terminal.loadAddon(fit);terminal.open(surface.current);fit.fit();
   const url=new URL("/api/admin/ssh/terminal",window.location.href);url.protocol=window.location.protocol==="https:"?"wss:":"ws:";
   const ws=new WebSocket(url);let ready=false,disposed=false;
   const send=(data:unknown)=>{if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(data));};
   const resize=()=>{if(disposed)return;try{fit.fit();if(ready)send({type:"resize",cols:Math.max(20,Math.min(500,terminal.cols)),rows:Math.max(5,Math.min(200,terminal.rows))});}catch{}};
   const observer=new ResizeObserver(resize);observer.observe(surface.current);
   const input=terminal.onData(data=>{if(ready){for(let i=0;i<data.length;i+=4096)send({type:"input",data:data.slice(i,i+4096)});}});
   ws.onopen=()=>send({type:"connect",ticket:j.ticket});
   ws.onmessage=event=>{try{const msg=JSON.parse(event.data);if(msg.type==="ready"){ready=true;setState("ready");resize();terminal.focus();}else if(msg.type==="output"){const data=atob(msg.data);terminal.write(Uint8Array.from(data,c=>c.charCodeAt(0)));}else if(msg.type==="closed"){ready=false;setState("closed");setMessage(msg.message);}else if(msg.type==="message")setMessage(msg.message);}catch{setError("تعذر قراءة مخرجات الطرفية.");ws.close();}};
   ws.onerror=()=>{if(!disposed)setError("تعذر الاتصال بالطرفية. تحقق من الباك إند ودعم WebSocket في مسار الاتصال.");};
   ws.onclose=()=>{ready=false;opening.current=false;if(!disposed&&mounted.current)setState("closed");observer.disconnect();input.dispose();};
   cleanup.current=()=>{if(disposed)return;disposed=true;ready=false;ws.onmessage=null;ws.onerror=null;ws.onclose=null;send({type:"disconnect"});ws.close();observer.disconnect();input.dispose();terminal.dispose();};
  }catch(e){opening.current=false;if(mounted.current&&!controller.signal.aborted){setState("closed");setError(e instanceof Error?e.message:"فشل فتح الطرفية.");}}
 }
 if(!isMasterAdmin)return null;
 const locked=busy||state!=="closed"||!loaded;
 return <section dir="rtl" className="space-y-5 rounded-[20px] border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#203044] sm:p-6">
  <div className="flex items-center justify-between gap-3"><h2 className="flex min-w-0 items-center gap-2 font-semibold"><TerminalSquare className="shrink-0 text-cyan-500"/><span className="truncate">طرفية SSH — {name}</span></h2><ProjectTooltip label="إغلاق طرفية المخدم"><ProjectButton variant="back" size="icon" aria-label="إغلاق طرفية المخدم" onClick={()=>{disconnect();onClose();}}><ArrowRight/></ProjectButton></ProjectTooltip></div>
  <p className="text-sm leading-7 text-slate-500">نفّذ أوامر الصيانة يدويًا بصلاحيات مستخدم Ubuntu المحدد. الطرفية خاصة بالمدير الرئيسي، وتغلق بعد خمس دقائق دون إدخال.</p>
  {error&&<p role="alert" className="ui-field-warning rounded-[14px] bg-red-50 p-3 text-sm text-red-600 dark:bg-red-500/10">{error}</p>}{message&&<p role="status" className="rounded-[14px] bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">{message}</p>}
  <details open={!configured} className="rounded-[14px] border border-slate-200 p-4 dark:border-white/10"><summary className="cursor-pointer text-sm font-semibold">إعدادات اتصال SSH</summary><form className="mt-4 space-y-4" onSubmit={e=>{e.preventDefault();void check(Boolean(verified));}}>
   <div className="grid gap-4 sm:grid-cols-2">{([{key:"host",label:"عنوان المخدم"},{key:"port",label:"منفذ SSH"},{key:"username",label:"مستخدم Ubuntu"}] as const).map(f=><label key={f.key} className="space-y-2 text-sm"><span className="block">{f.label}</span><ProjectInput dir="ltr" disabled={locked} required maxLength={f.key==="port"?5:253} inputMode={f.key==="port"?"numeric":undefined} value={form[f.key]} onChange={e=>change(f.key,f.key==="port"?e.target.value.replace(/\D/g,""):e.target.value)}/></label>)}
   <label className="space-y-2 text-sm"><span className="block">طريقة الدخول</span><div className={locked?"pointer-events-none opacity-60":""}><ProjectDropdown value={form.authMethod} onChange={v=>{change("authMethod",v);setForm(f=>({...f,secret:"",passphrase:""}));}} options={[{value:"password",label:"كلمة مرور"},{value:"key",label:"مفتاح SSH خاص"}]}/></div></label>
   <label className="space-y-2 text-sm sm:col-span-2"><span className="block">{form.authMethod==="password"?"كلمة مرور Ubuntu":"المفتاح الخاص (OpenSSH أو PEM)"}{configured?" — اتركه فارغًا للاحتفاظ بالمحفوظ":""}</span>{form.authMethod==="password"?<ProjectInput disabled={locked} type="password" autoComplete="new-password" maxLength={512} value={form.secret} onChange={e=>change("secret",e.target.value)}/>:<textarea dir="ltr" aria-label="المفتاح الخاص" disabled={locked} autoComplete="off" rows={5} maxLength={32768} className="allow-text-selection w-full rounded-[14px] border border-slate-200 bg-slate-50 p-3 font-mono text-xs dark:border-white/10 dark:bg-[#26384a]" value={form.secret} onChange={e=>change("secret",e.target.value)}/>}</label>
   {form.authMethod==="key"&&<label className="space-y-2 text-sm"><span className="block">عبارة مرور المفتاح (اختياري)</span><ProjectInput type="password" autoComplete="new-password" disabled={locked} maxLength={512} value={form.passphrase} onChange={e=>change("passphrase",e.target.value)}/></label>}
   <label className="space-y-2 text-sm sm:col-span-2"><span className="block">بصمة المخدم الموثوقة SHA256</span><ProjectInput disabled={locked} dir="ltr" maxLength={80} placeholder="SHA256:..." value={form.fingerprint} onChange={e=>change("fingerprint",e.target.value)}/><span className="block text-xs leading-6 text-slate-500">الفحص الأول يعرض البصمة قبل إرسال بيانات الدخول. طابقها مع بصمة المخدم عبر اتصال موثوق، ثم اعتمدها وأعد الفحص.</span></label></div>
   {candidate&&<div className="space-y-3 rounded-[14px] bg-amber-50 p-3 dark:bg-amber-500/10"><p dir="ltr" className="allow-text-selection break-all font-mono text-xs">{candidate}</p><ProjectButton type="button" variant="secondary" disabled={locked} onClick={()=>change("fingerprint",candidate)}><ShieldCheck className="text-amber-500"/>اعتماد البصمة بعد مطابقتها</ProjectButton></div>}
   <div className="flex flex-wrap justify-end gap-2"><ProjectButton type="submit" disabled={locked}>{verified?<Save/>:<ShieldCheck/>}{busy?"جارٍ التنفيذ...":verified?"حفظ اتصال SSH":"فحص الاتصال والطرفية"}</ProjectButton></div>
  </form></details>
  <div className="flex flex-wrap items-center justify-between gap-3"><span role="status" className="text-sm text-slate-500">{state==="ready"?"الطرفية متصلة":state==="connecting"?"جارٍ الاتصال...":"الطرفية مفصولة"}</span><ProjectButton disabled={!configured||dirty||busy||!loaded} variant={state==="closed"?"primary":"secondary"} onClick={()=>state==="closed"?void connect():disconnect()}>{state==="closed"?<Plug className="text-cyan-300"/>:<Unplug/>}{state==="closed"?"فتح الطرفية":"فصل الجلسة"}</ProjectButton></div>
  <div dir="ltr" ref={surface} aria-label="طرفية SSH التفاعلية" className="allow-text-selection h-[360px] min-w-0 overflow-hidden rounded-[14px] bg-slate-950 p-2 text-left sm:h-[480px]"/>
  <p className="text-xs leading-6 text-slate-500">نُسجل فتح الجلسة وإغلاقها واسم المدير والمخدم، دون حفظ الأوامر أو مخرجات الطرفية.</p>
 </section>;
}
