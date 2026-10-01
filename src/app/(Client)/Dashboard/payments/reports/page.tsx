"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, ChevronDown, CircleDollarSign, Filter, List, RefreshCw, RotateCcw, Search } from "lucide-react";
import ProjectDatePicker from "@/components/ui/project-date-picker";
import ProjectTooltip from "@/components/ui/project-tooltip";
import ProjectDropdown from "@/components/ui/project-dropdown";
import ProjectInput from "@/components/ui/project-input";
import PaymentPurposeBadge from "@/components/payments/payment-purpose-badge";
import { paymentPurposeOptions } from "@/lib/payment-display";
import { useAuth } from "@/components/auth/auth-provider";
import { CollectionMobileCard, CollectionMobileList, CollectionState, CollectionTable, CollectionTableBody, CollectionTableHead } from "@/components/ui/collection-display";

type ReceivedPayment={id:number;customerId:number;customerName:string;customerUsername:string|null;customerEmail:string;paymentCode:string;purpose:string;planName:string;deploymentName:string|null;purchasedItems:string[];amount:string;currency:string;paidAt:string;confirmedBy:string|null};
type Filters={period:string;startDate:string;endDate:string;search:string;currency:string;purpose:string};
type Report={range:{period:string;startDate:string;endDate:string;today:string};payments:ReceivedPayment[];currencies:string[];pagination:{page:number;pageSize:number;total:number};summary:{currency:string;count:number;amount:string}[];series:{period:string;currency:string;count:number;amount:string}[]};
const defaults=():Filters=>({period:"month",startDate:"",endDate:"",search:"",currency:"all",purpose:"all"});
const periods=[{value:"today",label:"اليوم"},{value:"month",label:"هذا الشهر"},{value:"year",label:"هذه السنة"},{value:"custom",label:"فترة مخصصة"}];
const grouping=[{value:"day",label:"يومي"},{value:"month",label:"شهري"},{value:"year",label:"سنوي"}];

export default function CollectionReportsPage(){
  const router=useRouter();
  const {accountType,loading:authLoading}=useAuth();
  const [report,setReport]=useState<Report|null>(null),[draft,setDraft]=useState<Filters>(defaults),[applied,setApplied]=useState<Filters>(defaults);
  const [advanced,setAdvanced]=useState(false),[aggregated,setAggregated]=useState(false),[group,setGroup]=useState("day");
  const [page,setPage]=useState(1),[loading,setLoading]=useState(true),[error,setError]=useState(""),[validation,setValidation]=useState(""),[revision,setRevision]=useState(0);
  useEffect(()=>{
    if(authLoading||accountType!=="master_admin")return;
    const controller=new AbortController();setLoading(true);setError("");
    const params=new URLSearchParams({period:applied.period,search:applied.search,currency:applied.currency,purpose:applied.purpose,page:String(page),group:aggregated?group:"none"});
    if(applied.period==="custom"){params.set("startDate",applied.startDate);params.set("endDate",applied.endDate);}
    fetch(`/api/billing/admin/collection-report?${params}`,{credentials:"include",cache:"no-store",signal:controller.signal}).then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.message||"تعذر تحميل تقرير التحصيل.");if(!controller.signal.aborted)setReport(data);}).catch(reason=>{if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:"تعذر تحميل التقرير.");}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[authLoading,accountType,applied,aggregated,group,page,revision]);
  const set=(key:keyof Filters,value:string)=>{setDraft(current=>({...current,[key]:value}));setValidation("");};
  const apply=()=>{
    const next={...draft,search:draft.search.trim()};
    if(next.period==="custom"){
      next.startDate=next.startDate||report?.range.today||"";next.endDate=next.endDate||report?.range.today||"";
      if(!next.startDate||!next.endDate||next.startDate>next.endDate){setValidation("حدد تاريخ البداية والنهاية بالترتيب الصحيح.");return;}
    }
    setDraft(next);setApplied(next);setPage(1);setValidation("");
  };
  const reset=()=>{setDraft(defaults());setApplied(defaults());setPage(1);setAdvanced(false);setValidation("");};
  const currencies=Array.from(new Set([...(report?.currencies??[]),...(draft.currency==="all"?[]:[draft.currency])]));
  if(authLoading)return <CollectionState>جارٍ تحميل حسابك...</CollectionState>;
  if(accountType!=="master_admin")return <CollectionState>تقارير التحصيل متاحة للمسؤول الرئيسي فقط.</CollectionState>;
  return <div dir="rtl" className="space-y-4">
    <header className="rl-surface flex flex-wrap items-center justify-between gap-3 rounded-[22px] bg-white p-4 dark:bg-[#0d243b]">
      <div className="flex items-center gap-3"><ProjectTooltip label="الرجوع إلى عرض الاشتراكات"><Link href="/Dashboard/subscriptions" aria-label="الرجوع إلى عرض الاشتراكات" className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] border-2 border-[#78afe9] bg-[#e9f2ff] text-[#0758e9] shadow-[0_4px_12px_rgba(7,88,233,.10)] transition hover:border-[#0758e9] hover:bg-[#dcecff] dark:border-[#4d83c8] dark:bg-[#173554] dark:text-[#8fc0ff]"><ArrowRight className="h-4 w-4"/></Link></ProjectTooltip><div><h1 className="flex items-center gap-2 text-lg font-semibold text-[#17386d] dark:text-white"><CircleDollarSign className="h-5 w-5 text-[#0758e9]"/>تقارير التحصيل</h1><p className="mt-1 text-xs text-slate-500">الدفعات المستلمة خلال الفترة المختارة.</p></div></div>
      <div className="flex gap-2"><Link href="/Dashboard/payments" className="inline-flex h-10 items-center rounded-[14px] border border-[#bfd4ea] px-3 text-xs text-[#0758e9] dark:border-white/10 dark:text-[#8fc0ff]">عمليات الدفع</Link><ProjectTooltip label="تحديث نتائج الفلاتر المطبقة"><button type="button" disabled={loading} onClick={()=>setRevision(value=>value+1)} className="inline-flex h-10 items-center gap-2 rounded-[14px] border border-[#bfd4ea] px-3 text-xs text-[#17386d] disabled:opacity-50 dark:border-white/10 dark:text-slate-200"><RefreshCw className="h-4 w-4"/>تحديث</button></ProjectTooltip></div>
    </header>
    <form onSubmit={event=>{event.preventDefault();apply();}} className="rl-surface space-y-3 rounded-[22px] bg-white p-4 dark:bg-[#0d243b]">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[160px] text-xs text-slate-500"><span className="mb-2 block">الفترة</span><ProjectDropdown value={draft.period} onChange={value=>set("period",value)} options={periods}/></div>
        {draft.period==="custom"&&<><div className="min-w-[210px] text-xs text-slate-500"><span className="mb-2 block">من تاريخ</span><ProjectDatePicker value={draft.startDate||report?.range.today||""} onChange={value=>set("startDate",value)} label="بداية فترة التحصيل"/></div><div className="min-w-[210px] text-xs text-slate-500"><span className="mb-2 block">إلى تاريخ</span><ProjectDatePicker value={draft.endDate||report?.range.today||""} onChange={value=>set("endDate",value)} label="نهاية فترة التحصيل"/></div></>}
        <label className="min-w-[200px] flex-1 text-xs text-slate-500"><span className="mb-2 block">بحث عن العميل</span><ProjectInput maxLength={120} value={draft.search} onChange={event=>set("search",event.target.value)} placeholder="الاسم أو اسم المستخدم أو البريد الإلكتروني"/></label>
        <button type="submit" disabled={loading} className="inline-flex h-11 items-center gap-2 rounded-[14px] bg-[#0758e9] px-4 text-xs font-semibold text-white disabled:opacity-50"><Search className="h-4 w-4"/>تطبيق الفلاتر</button>
        <ProjectTooltip label="العودة إلى فلاتر هذا الشهر"><button type="button" onClick={reset} className="inline-flex h-11 items-center gap-2 rounded-[14px] border border-[#bfd4ea] px-3 text-xs text-slate-500 dark:border-white/10 dark:text-slate-300"><RotateCcw className="h-4 w-4"/>إعادة الضبط</button></ProjectTooltip>
        <button type="button" aria-expanded={advanced} onClick={()=>setAdvanced(value=>!value)} className="inline-flex h-11 items-center gap-2 rounded-[14px] border border-[#bfd4ea] px-3 text-xs text-[#0758e9] dark:border-white/10 dark:text-[#8fc0ff]"><Filter className="h-4 w-4"/>فلاتر إضافية<ChevronDown className={`h-4 w-4 transition ${advanced?"rotate-180":""}`}/></button>
      </div>
      {advanced&&<div className="ui-state-enter flex flex-wrap gap-3 border-t border-[#e2ebf4] pt-3 dark:border-white/10"><div className="min-w-[220px] text-xs text-slate-500"><span className="mb-2 block">العملة</span><ProjectDropdown value={draft.currency} onChange={value=>set("currency",value)} options={[{value:"all",label:"جميع العملات"},...currencies.map(value=>({value,label:value}))]}/></div><div className="min-w-[180px] text-xs text-slate-500"><span className="mb-2 block">نوع العملية</span><ProjectDropdown value={draft.purpose} onChange={value=>set("purpose",value)} options={[{value:"all",label:"جميع العمليات"},...paymentPurposeOptions]}/></div></div>}
      {validation&&<p role="alert" className="text-xs text-red-600 dark:text-red-300">{validation}</p>}
      {(applied.currency!=="all"||applied.purpose!=="all"||applied.search)&&<p className="text-[11px] text-slate-500">الفلاتر المطبقة: {[applied.search&&`العميل: ${applied.search}`,applied.currency!=="all"&&`العملة: ${applied.currency}`,applied.purpose!=="all"&&paymentPurposeOptions.find(option=>option.value===applied.purpose)?.label].filter(Boolean).join(" · ")}</p>}
    </form>
    {error&&<p role="alert" className="rounded-2xl bg-red-50 p-4 text-xs text-red-600 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
    {loading?<CollectionState>جارٍ تحميل التحصيل...</CollectionState>:!error&&report&&<>
      <section className="rl-surface rounded-[22px] bg-white p-4 dark:bg-[#0d243b]"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold text-[#17386d] dark:text-white">ملخص الفترة المختارة</h2><span className="text-xs text-slate-500" dir="ltr">{report.range.startDate} — {report.range.endDate}</span></div>
        {report.summary.length?<div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{report.summary.map(item=><div key={item.currency} className="rl-surface-soft rounded-[16px] bg-[#f9fbfe] p-3 dark:bg-white/[.035]"><b className="block text-xl text-[#17386d] dark:text-white" dir="ltr">{formatAmount(item.amount)} <span className="text-xs font-normal">{item.currency}</span></b><p className="mt-2 text-xs text-slate-500">{item.count} دفعة مستلمة</p></div>)}</div>:<p className="mt-3 text-xs text-slate-400">لا توجد دفعات مستلمة مطابقة خلال هذه الفترة.</p>}
      </section>
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-sm font-semibold text-[#17386d] dark:text-white">{aggregated?"ملخص التحصيل المجمّع":"تفاصيل الدفعات المستلمة"}</h2><p className="mt-1 text-[11px] text-slate-500">حسب تاريخ تأكيد الدفع وتوقيت الخادم. العملات معروضة بصورة منفصلة.</p></div><div className="flex flex-wrap gap-2">{aggregated&&<ProjectDropdown compact className="min-w-[120px]" value={group} onChange={setGroup} options={grouping}/>}<button type="button" onClick={()=>setAggregated(value=>!value)} className="inline-flex h-9 items-center gap-2 rounded-[12px] border border-[#bfd4ea] px-3 text-xs text-[#0758e9] dark:border-white/10 dark:text-[#8fc0ff]"><List className="h-4 w-4"/>{aggregated?"العودة إلى تفاصيل الدفعات":"عرض ملخص مجمّع"}</button></div></div>
        {aggregated?(report.series.length?<><CollectionTable><CollectionTableHead><tr><th className="p-3">الفترة</th><th>العملة</th><th>عدد الدفعات</th><th>المبلغ المحصّل</th></tr></CollectionTableHead><CollectionTableBody>{report.series.map(row=><tr key={`${row.period}-${row.currency}`} className="border-t border-slate-100 dark:border-white/10"><td className="p-3" dir="ltr">{row.period}</td><td>{row.currency}</td><td>{row.count}</td><td dir="ltr" className="font-semibold">{formatAmount(row.amount)}</td></tr>)}</CollectionTableBody></CollectionTable><CollectionMobileList>{report.series.map(row=><article key={`${row.period}-${row.currency}`} className="rl-surface rounded-[18px] bg-white p-4 dark:bg-[#0d243b]"><div className="flex items-center justify-between gap-3"><b className="text-xs text-[#17386d] dark:text-slate-200" dir="ltr">{row.period}</b><span className="text-xs text-slate-500">{row.count} دفعة</span></div><p className="mt-3 text-sm font-semibold text-[#0758e9] dark:text-[#8fc0ff]" dir="ltr">{formatAmount(row.amount)} {row.currency}</p></article>)}</CollectionMobileList></>:<CollectionState>لا توجد دفعات مطابقة للتجميع.</CollectionState>):report.payments.length?<>
          <CollectionTable minWidth="1150px"><CollectionTableHead><tr><th className="p-3">العميل</th><th>نوع العملية</th><th>الخطة أو الخدمة</th><th>المبلغ والعملة</th><th>تاريخ التحصيل</th><th>المسؤول</th></tr></CollectionTableHead><CollectionTableBody>{report.payments.map(payment=><tr key={payment.id} className="border-t border-slate-100 dark:border-white/10">
            <td className="p-3"><Link href={`/Dashboard/customers/${payment.customerId}`} className="block font-semibold text-[#0758e9] dark:text-[#8fc0ff]">{payment.customerName}</Link><span className="mt-1 block text-[10px] text-slate-400">@{payment.customerUsername||"—"}</span></td>
            <td><PaymentPurposeBadge value={payment.purpose}/></td><td><b className="block">{payment.planName}</b><span className="block text-[10px] text-slate-400">{payment.deploymentName||"—"}</span><ProjectTooltip label="عرض تفاصيل عملية الدفع"><Link href={`/Dashboard/payments?code=${encodeURIComponent(payment.paymentCode)}`} className="mt-1 inline-block font-mono text-[10px] text-[#0758e9] dark:text-[#8fc0ff]" dir="ltr">{payment.paymentCode}</Link></ProjectTooltip>{payment.purchasedItems.length>0&&<span className="mt-1 block text-[10px] text-slate-500">الإضافات: {payment.purchasedItems.join("، ")}</span>}</td>
            <td className="font-semibold" dir="ltr">{formatAmount(payment.amount)} {payment.currency}</td><td>{new Intl.DateTimeFormat("ar",{dateStyle:"short",timeStyle:"short"}).format(new Date(payment.paidAt))}</td><td>{payment.confirmedBy||"—"}</td>
          </tr>)}</CollectionTableBody></CollectionTable>
          <CollectionMobileList>{report.payments.map(payment=><CollectionMobileCard key={payment.id} onOpen={()=>router.push(`/Dashboard/payments?code=${encodeURIComponent(payment.paymentCode)}`)}><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0 flex-1"><b className="block truncate text-sm text-[#17386d] dark:text-slate-200">{payment.customerName}</b><span className="mt-1 block text-[10px] text-slate-400">@{payment.customerUsername||"—"}</span></div><PaymentPurposeBadge value={payment.purpose}/></div><div className="mt-3 space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-white/10"><p className="break-words">{payment.planName}</p>{payment.purchasedItems.length>0&&<p className="break-words text-[10px]">الإضافات: {payment.purchasedItems.join("، ")}</p>}<div className="flex flex-wrap items-center justify-between gap-2"><b className="text-[#0758e9] dark:text-[#8fc0ff]" dir="ltr">{formatAmount(payment.amount)} {payment.currency}</b><span>{new Intl.DateTimeFormat("ar",{dateStyle:"short",timeStyle:"short"}).format(new Date(payment.paidAt))}</span></div><p className="text-[10px]">أكد الدفع: {payment.confirmedBy||"—"}</p></div></CollectionMobileCard>)}</CollectionMobileList>
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500"><span>{report.pagination.total} دفعة · الصفحة {page} من {Math.max(1,Math.ceil(report.pagination.total/report.pagination.pageSize))}</span><div className="flex gap-2"><button type="button" disabled={page<=1} onClick={()=>setPage(value=>value-1)} className="h-9 rounded-xl border border-[#bfd4ea] px-3 disabled:opacity-40 dark:border-white/10">السابق</button><button type="button" disabled={page*report.pagination.pageSize>=report.pagination.total} onClick={()=>setPage(value=>value+1)} className="h-9 rounded-xl border border-[#bfd4ea] px-3 disabled:opacity-40 dark:border-white/10">التالي</button></div></div>
        </>:<CollectionState>لا توجد دفعات مستلمة مطابقة.</CollectionState>}
      </section>
    </>}
  </div>;
}
function formatAmount(value:string){const [whole,fraction=""]=value.split(".");return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g,",")}.${fraction.padEnd(2,"0").slice(0,2)}`;}
