"use client";

import {useMemo,useState} from "react";
import * as XLSX from "xlsx";
import {CheckCircle2,Download,FileSpreadsheet,LockKeyhole,Upload,X} from "lucide-react";
import ProjectButton from "@/components/ui/project-button";
import ProjectDialog from "@/components/ui/project-dialog";
import ProjectDropdown from "@/components/ui/project-dropdown";
import {ProjectInfoCard} from "@/components/ui/project-info-card";
import FloatingNotice from "@/components/ui/floating-notice";

type Category={id:number;name:string};
type FieldKey="firstName"|"lastName"|"username"|"password"|"profile"|"phone"|"expiresAt"|"notes";
type ImportRow={rowNumber:number;firstName:string;lastName:string;username:string;password:string;profile:string;phone:string;expiresAt:string;notes:string};
type Profile={id:number;name:string;version:number;speed:string};
type Preview={total:number;ready:number;duplicates:number;rejected:number;withPhone:number;withoutPhone:number;withExpiry:number;withoutExpiry:number;profiles:Profile[];items:Array<{rowNumber:number;firstName:string;lastName:string;username:string;profile:string;normalizedSpeed:string|null;phone:boolean;expiresAt:string|null;packageVersionId:number|null;kind:"ready"|"duplicate"|"rejected";reasons:string[]}>};
type ImportField={key:FieldKey;label:string;aliases:string[];required?:boolean};
const fields:ImportField[]=[
 {key:"firstName",label:"الاسم الأول",aliases:["الاسم الاول","الاسم الأول","first name","firstname","first_name","الاسم"]},
 {key:"lastName",label:"الكنية",aliases:["الكنية","الكنيه","last name","lastname","last_name","surname"]},
 {key:"username",label:"اسم المستخدم",aliases:["اليوزر","اليوزرنيم","اسم المستخدم","username","user name","login"],required:true},
 {key:"password",label:"كلمة المرور",aliases:["باسبورد","باسورد","كلمة المرور","كلمة السر","password","pass"],required:true},
 {key:"profile",label:"البروفايل / السرعة",aliases:["بروفايل","البروفايل","السرعة","السرعه","profile","speed","rate limit"],required:true},
 {key:"phone",label:"رقم الهاتف",aliases:["رقم الهاتف","الهاتف","الجوال","phone","mobile"]},
 {key:"expiresAt",label:"تاريخ الانتهاء",aliases:["تاريخ الانتهاء","تاريخ انتهاء","end time","expiry date","expires at","expiration"]},
 {key:"notes",label:"ملاحظات",aliases:["ملاحظات","notes","comment","comments"]},
];
const normalizeHeader=(value:string)=>value.trim().toLocaleLowerCase().replace(/[\s_\-،:]/g,"");
function guessMapping(headers:string[]){
 const mapping:Record<number,FieldKey|"">={},used=new Set<FieldKey>();
 headers.forEach((header,index)=>{const field=fields.find(item=>item.aliases.some(alias=>normalizeHeader(alias)===normalizeHeader(header)));if(field&&!used.has(field.key)){mapping[index]=field.key;used.add(field.key);}else mapping[index]="";});
 return mapping;
}
async function parseWorkbook(file:File):Promise<string[][]>{
 const buffer=await file.arrayBuffer(),workbook=XLSX.read(buffer,{type:"array",cellDates:true,raw:false}),sheet=workbook.Sheets[workbook.SheetNames[0]];
 if(!sheet)throw new Error("الملف لا يحتوي على ورقة بيانات.");
 const matrix=XLSX.utils.sheet_to_json<unknown[]>(sheet,{header:1,raw:false,defval:"",blankrows:true,dateNF:"yyyy-mm-dd"});
 const rows=matrix.map(row=>row.map(value=>String(value??"").trim()));
 if(!rows.some(row=>row.some(Boolean)))throw new Error("لم أجد بيانات في الورقة الأولى من الملف.");
 return rows;
}
const reasonName:Record<string,string>={required_credentials:"اسم المستخدم أو كلمة المرور ناقصة أو غير صالحة",profile_missing:"البروفايل مفقود",profile_unmapped:"لا يوجد بروفايل خدمة مطابق",profile_invalid:"صيغة السرعة أو البروفايل غير صالحة",expiry_invalid:"صيغة تاريخ الانتهاء غير مفهومة",expiry_past:"تاريخ الانتهاء مضى",phone_invalid:"رقم الهاتف غير صالح",username_duplicate:"اسم المستخدم مكرر",phone_duplicate:"رقم الهاتف مكرر",row_create_failed:"تعذر إنشاء الحساب؛ راجع توافق البيانات"};

export default function NetworkPppoeImport({endpoint,categories,onCompleted}:{endpoint:string;categories:Category[];onCompleted:()=>void}){
 const [open,setOpen]=useState(false),[file,setFile]=useState<File|null>(null),[sheetRows,setSheetRows]=useState<string[][]>([]),[hasHeader,setHasHeader]=useState(true),[mapping,setMapping]=useState<Record<number,FieldKey|"">>({}),[categoryId,setCategoryId]=useState(""),[profileMap,setProfileMap]=useState<Record<string,string>>({}),[availableProfiles,setAvailableProfiles]=useState<Profile[]>([]),[preview,setPreview]=useState<Preview|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const options=useMemo(()=>categories.map(item=>({value:String(item.id),label:item.name})),[categories]);
 const headers=useMemo(()=>{
  if(!sheetRows.length)return [];
  const start=hasHeader?1:0,columns=Math.max(...sheetRows.slice(start).map(row=>row.length),hasHeader?sheetRows[0]?.length||0:0);
  return Array.from({length:columns},(_,index)=>hasHeader?(sheetRows[0]?.[index]||`عمود ${index+1}`):`عمود ${index+1}`);
 },[sheetRows,hasHeader]);
 const sourceRows=useMemo(()=>sheetRows.map((values,index)=>({values,rowNumber:index+(hasHeader?2:1),sourceIndex:index})).filter(row=>row.values.some(Boolean)&&(!hasHeader||row.sourceIndex>0)).map(({values,rowNumber})=>({values,rowNumber})),[sheetRows,hasHeader]);
 const rows=useMemo<ImportRow[]>(()=>sourceRows.map(source=>{
  const row:ImportRow={rowNumber:source.rowNumber,firstName:"",lastName:"",username:"",password:"",profile:"",phone:"",expiresAt:"",notes:""};
  Object.entries(mapping).forEach(([column,field])=>{if(field)row[field]=String(source.values[Number(column)]??"").trim();});
  return row;
 }).filter(row=>row.firstName||row.lastName||row.username||row.password||row.profile||row.phone||row.expiresAt||row.notes),[sourceRows,mapping]);
 const distinct=Array.from(new Set(rows.map(row=>row.profile).filter(Boolean)));
 const mappedFields=new Set(Object.values(mapping).filter(Boolean));
 const missingRequired=fields.filter(field=>field.required&&!mappedFields.has(field.key));
 const previewRows=sourceRows.slice(0,20);
 const reset=()=>{if(busy)return;setOpen(false);setFile(null);setSheetRows([]);setHasHeader(true);setMapping({});setCategoryId("");setProfileMap({});setAvailableProfiles([]);setPreview(null);setError("");setNotice("");};
 const chooseFile=async(next:File|null)=>{
  setFile(next);setSheetRows([]);setMapping({});setProfileMap({});setAvailableProfiles([]);setPreview(null);setError("");
  if(!next)return;
  if(next.size>10*1024*1024){setError("حجم الملف يتجاوز 10 ميغابايت.");return;}
  if(!/\.(csv|xlsx|xls)$/i.test(next.name)){setError("اختر ملف CSV أو Excel بصيغة XLSX أو XLS.");return;}
  try{const parsed=await parseWorkbook(next);const nonBlank=parsed.filter(row=>row.some(Boolean)).length;if(nonBlank>5001)throw new Error("الحد الأقصى 5000 صف بيانات في الملف الواحد.");setSheetRows(parsed);setHasHeader(true);const initialHeaders=parsed[0].map((value,index)=>value||`عمود ${index+1}`);setMapping(guessMapping(initialHeaders));}
  catch(e){setFile(null);setSheetRows([]);setError(e instanceof Error?e.message:"تعذرت قراءة الملف.");}
 };
 const changeHeaderMode=(checked:boolean)=>{setHasHeader(checked);setPreview(null);setProfileMap({});setAvailableProfiles([]);const nextHeaders=checked?(sheetRows[0]||[]).map((value,index)=>value||`عمود ${index+1}`):Array.from({length:Math.max(...sheetRows.map(row=>row.length),0)},(_,index)=>`عمود ${index+1}`);setMapping(guessMapping(nextHeaders));};
 const setColumnMapping=(index:number,value:string)=>{setMapping(current=>({...current,[index]:(value||"") as FieldKey|""}));setProfileMap({});setPreview(null);setAvailableProfiles([]);};
 const runPreview=async()=>{if(!rows.length){setError("اختر ملفًا صالحًا أولًا.");return;}if(missingRequired.length){setError("اربط الحقول المطلوبة من قوائم أعمدة الملف أولًا.");return;}if(!categoryId){setError("اختر تصنيف المشتركين قبل المعاينة.");return;}setBusy(true);setError("");try{const response=await fetch(`${endpoint}/pppoe/import/preview`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({rows,categoryId,profileMap,sourceName:file?.name})});const data=await response.json();if(!response.ok)throw new Error(data.message||"تعذرت معاينة الملف.");setAvailableProfiles(Array.isArray(data.profiles)?data.profiles:[]);setPreview(data);}catch(e){setError(e instanceof Error?e.message:"تعذرت معاينة الملف.");}finally{setBusy(false);}};
 const commit=async()=>{if(!preview||preview.ready<1)return;setBusy(true);setError("");try{const response=await fetch(`${endpoint}/pppoe/import/commit`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({rows,categoryId,profileMap,sourceName:file?.name})});const data=await response.json();if(!response.ok)throw new Error(data.message||"تعذر استيراد الحسابات.");setNotice(`اكتمل الاستيراد: أُنشئ ${Number(data.imported).toLocaleString("ar")} خط، وحُفظ ${Number(data.queued).toLocaleString("ar")} صف للمراجعة.`);setOpen(false);setPreview(null);setSheetRows([]);setFile(null);setAvailableProfiles([]);onCompleted();}catch(e){setError(e instanceof Error?e.message:"تعذر استيراد الحسابات.");}finally{setBusy(false);}};
 const exportIssues=()=>{if(!preview)return;const rowsByNumber=new Map(rows.map(row=>[row.rowNumber,row]));const data=preview.items.filter(item=>item.kind!=="ready").map(item=>{const source=rowsByNumber.get(item.rowNumber);return {الصف:item.rowNumber,"الاسم الأول":item.firstName,الكنية:item.lastName,اليوزر:item.username,البروفايل:item.profile,السرعة_المطبعة:item.normalizedSpeed||"",الهاتف:source?.phone||"",تاريخ_الانتهاء:source?.expiresAt||"",السبب:item.reasons.map(reason=>reasonName[reason]||reason).join("، ")};});const worksheet=XLSX.utils.json_to_sheet(data),csv=XLSX.utils.sheet_to_csv(worksheet,{FS:","});const blob=new Blob(["\uFEFF",csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download="pppoe-import-review.csv";link.click();URL.revokeObjectURL(url);};
 const fieldOptions=[{value:"",label:"تجاهل هذا العمود"},...fields.map(field=>({value:field.key,label:`${field.label}${field.required?" · مطلوب":""}`}))];
 return <>
  <FloatingNotice message={notice} error={error} onDismiss={()=>{setNotice("");setError("");}}/>
  <ProjectButton variant="secondary" onClick={()=>{setOpen(true);setError("");}}><FileSpreadsheet/>استيراد PPPoE</ProjectButton>
  <ProjectDialog open={open} title="استيراد حسابات PPPoE" description="اعرض محتوى الملف، وحدد من ترويسة كل عمود الحقل الذي يمثله قبل تحليل الحسابات." onClose={reset} busy={busy} maxWidth="max-w-6xl" hostingerStyle compact>
   <div className="space-y-4" dir="rtl">
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(220px,.65fr)]">
     <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-2xl border border-dashed border-[#9fb8d2] bg-[#f6f9fc] px-4 py-3 text-xs font-semibold text-[#17386d] hover:bg-[#edf4fb] dark:border-white/20 dark:bg-white/[.035] dark:text-slate-100"><span className="flex min-w-0 items-center gap-2"><Upload className="h-4 w-4 shrink-0 text-blue-600"/><span className="truncate">{file?file.name:"اختر ملف CSV أو Excel"}</span></span><span className="shrink-0 text-[10px] font-normal text-slate-500">حتى 10 MB</span><input type="file" accept=".csv,.xlsx,.xls,text/csv" className="sr-only" disabled={busy} onChange={event=>void chooseFile(event.target.files?.[0]||null)}/></label>
     <label className="space-y-1 text-[11px] font-semibold text-[#202124] dark:text-slate-200"><span>تصنيف المشتركين *</span><ProjectDropdown fieldStyle value={categoryId} onChange={value=>{setCategoryId(value);setPreview(null);}} options={options} placeholder="اختر التصنيف" disabled={busy||!categories.length}/></label>
    </div>
    {!!sheetRows.length&&<>
     <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[11px] dark:border-white/10 dark:bg-[#102136]"><label className="flex cursor-pointer items-center gap-2 font-semibold text-slate-700 dark:text-slate-200"><input type="checkbox" checked={hasHeader} disabled={busy} onChange={event=>changeHeaderMode(event.target.checked)} className="h-4 w-4 accent-[#0758e9]"/>الصف الأول يحتوي على أسماء الأعمدة</label><span className="text-slate-500">{rows.length.toLocaleString("ar")} صف بيانات · {headers.length.toLocaleString("ar")} عمود</span></div>
     <ProjectInfoCard tone="info" className="text-[11px]">اختر الحقل المناسب من القائمة الموجودة في ترويسة كل عمود. اترك الأعمدة غير المطلوبة على «تجاهل». الاسم والكنية والهاتف وتاريخ الانتهاء والملاحظات اختيارية؛ والاسم الناقص سيُنشأ تلقائيًا كعميل متسلسل.</ProjectInfoCard>
     <section aria-label="معاينة محتوى الملف وتحديد الحقول" className="overflow-hidden rounded-2xl border border-[#dbe3ec] bg-white dark:border-white/10 dark:bg-[#0d243b]"><div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-[#f5f8fb] px-3 py-2.5 dark:border-white/10 dark:bg-white/[.035]"><h3 className="text-xs font-bold text-[#17386d] dark:text-slate-100">محتوى الملف وربط الأعمدة</h3><span className="text-[10px] text-slate-500">تُخفى قيم كلمة المرور في هذه المعاينة</span></div><div className="max-h-[min(36vh,340px)] overflow-auto"><table className="w-full min-w-max border-separate border-spacing-0 text-right text-[10px]"><thead className="sticky top-0 z-10"><tr><th className="sticky right-0 z-20 min-w-12 border-b border-l border-slate-200 bg-[#f5f8fb] px-2 py-2 text-center font-semibold text-slate-500 dark:border-white/10 dark:bg-[#142b43]">صف</th>{headers.map((header,index)=>{const usedElsewhere=new Set(Object.entries(mapping).filter(([column,value])=>Number(column)!==index&&value).map(([,value])=>value));const optionsForColumn=fieldOptions.filter(option=>!option.value||option.value===mapping[index]||!usedElsewhere.has(option.value as FieldKey));return <th key={`heading-${index}`} className="min-w-[190px] border-b border-l border-slate-200 bg-[#f5f8fb] p-2 align-top dark:border-white/10 dark:bg-[#142b43]"><div className="mb-1.5 max-w-[190px] truncate font-semibold text-[#303239] dark:text-slate-100" title={header}>{header}</div><ProjectDropdown compact searchable searchPlaceholder="ابحث عن الحقل..." value={mapping[index]||""} onChange={value=>setColumnMapping(index,value)} options={optionsForColumn} placeholder="اختر الحقل المقابل" disabled={busy}/></th>;})}</tr></thead><tbody>{previewRows.map((source,rowIndex)=><tr key={`${source.rowNumber}-${rowIndex}`} className="odd:bg-white even:bg-[#fafbfd] dark:odd:bg-[#0d243b] dark:even:bg-white/[.025]"><td className="sticky right-0 z-[1] border-b border-l border-slate-100 bg-inherit px-2 py-2 text-center font-semibold text-slate-500 dark:border-white/[.06]">{source.rowNumber}</td>{headers.map((_,column)=>{const value=String(source.values[column]??"").trim(),field=mapping[column];return <td key={`${source.rowNumber}-${column}`} className="max-w-[220px] border-b border-l border-slate-100 px-2 py-2 text-slate-700 dark:border-white/[.06] dark:text-slate-200"><span className="block max-w-[210px] truncate" dir={field==="username"||field==="password"||field==="phone"?"ltr":"auto"} title={field==="password"&&value?"قيمة مخفية":value}>{field==="password"&&value?"••••••":value||"—"}</span></td>;})}</tr>)}</tbody></table></div>{sourceRows.length>previewRows.length&&<p className="border-t border-slate-100 px-3 py-2 text-[10px] text-slate-500 dark:border-white/[.06]">تعرض المعاينة أول {previewRows.length.toLocaleString("ar")} صفوف؛ بقية الصفوف مشمولة في التحليل والاستيراد.</p>}</section>
     {missingRequired.length>0&&<p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-800 dark:border-amber-400/20 dark:bg-amber-500/[.07] dark:text-amber-200">اربط الحقول المطلوبة: اسم المستخدم، كلمة المرور، والبروفايل / السرعة.</p>}
    </>}
    {distinct.length>0&&<section className="space-y-2 rounded-2xl border border-[#e4e4e7] bg-white p-3 dark:border-white/10 dark:bg-[#0d243b]"><h3 className="text-xs font-bold text-[#17386d] dark:text-slate-100">ربط قيم البروفايل بالسرعات المعتمدة</h3>{distinct.map(profile=><label key={profile} className="grid items-center gap-2 text-[11px] sm:grid-cols-[minmax(140px,.6fr)_minmax(0,1.4fr)]"><span className="truncate font-medium" title={profile}>{profile}</span><ProjectDropdown fieldStyle compact value={profileMap[profile]||""} onChange={value=>{setProfileMap(current=>({...current,[profile]:value}));setPreview(null);}} options={[{value:"",label:"غير مربوط — سيُنقل للمراجعة"},...availableProfiles.map(item=>({value:String(item.id),label:`${item.name} · ${item.speed} · إصدار ${item.version}`}))]} placeholder="طابقه مع بروفايل خدمة" disabled={busy}/></label>)}</section>}
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="flex items-center gap-1.5 text-[10px] text-slate-500"><LockKeyhole className="h-3.5 w-3.5"/>لا تظهر كلمات المرور في تقارير المراجعة، وتُشفّر الصفوف المحفوظة.</p><ProjectButton variant="secondary" disabled={busy||!rows.length||missingRequired.length>0||!categoryId} onClick={()=>void runPreview()}><FileSpreadsheet/>تحليل البيانات المختارة</ProjectButton></div>
    {preview&&<>
     <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{[{label:"الحسابات الجاهزة",value:preview.ready,tone:"text-emerald-700"},{label:"مكررات للمراجعة",value:preview.duplicates,tone:"text-amber-700"},{label:"صفوف غير صالحة",value:preview.rejected,tone:"text-rose-700"},{label:"إجمالي الصفوف",value:preview.total,tone:"text-blue-700"}].map(item=><div key={item.label} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-white/[.03]"><p className="text-[10px] text-slate-500">{item.label}</p><p className={`mt-1 text-lg font-bold ${item.tone}`}>{item.value.toLocaleString("ar")}</p></div>)}</div>
     <div className="grid gap-2 rounded-xl bg-[#f5f8fb] p-3 text-[10px] text-slate-600 dark:bg-white/[.035] dark:text-slate-300 sm:grid-cols-2"><p>أرقام هاتف موجودة: {preview.withPhone} · فارغة: {preview.withoutPhone}</p><p>تاريخ انتهاء موجود: {preview.withExpiry} · فارغ: {preview.withoutExpiry}</p></div>
     {preview.items.length>0&&<div className="max-h-64 overflow-auto rounded-xl border border-slate-200 dark:border-white/10"><table className="w-full min-w-[620px] text-right text-[10px]"><thead className="sticky top-0 bg-[#f1f7fd] text-[#17386d] dark:bg-[#142b43] dark:text-slate-100"><tr>{["صف","الاسم","اسم المستخدم","البروفايل / السرعة","الحالة","سبب المراجعة"].map(value=><th key={value} className="px-2 py-2 font-semibold">{value}</th>)}</tr></thead><tbody>{preview.items.map(item=><tr key={item.rowNumber} className="border-t border-slate-100 dark:border-white/[.06]"><td className="px-2 py-2">{item.rowNumber}</td><td className="px-2 py-2">{item.firstName} {item.lastName}</td><td dir="ltr" className="px-2 py-2 text-right">{item.username||"—"}</td><td className="px-2 py-2">{item.profile}{item.normalizedSpeed?` → ${item.normalizedSpeed}`:""}</td><td className="px-2 py-2">{item.kind==="ready"?"جاهز":item.kind==="duplicate"?"مكرر":"يحتاج تصحيح"}</td><td className="px-2 py-2">{item.reasons.map(reason=>reasonName[reason]||reason).join("، ")||"—"}</td></tr>)}</tbody></table></div>}
     <div className="flex flex-wrap justify-between gap-2">{preview.duplicates+preview.rejected>0&&<ProjectButton variant="secondary" disabled={busy} onClick={exportIssues}><Download/>تنزيل تقرير الصفوف للمراجعة</ProjectButton>}<div className="mr-auto flex flex-wrap justify-end gap-2"><ProjectButton variant="secondary" disabled={busy} onClick={reset}><X/>إغلاق</ProjectButton><ProjectButton disabled={busy||preview.ready<1} onClick={()=>void commit()}><CheckCircle2/>استيراد {preview.ready.toLocaleString("ar")} حساب</ProjectButton></div></div>
    </>}
   </div>
  </ProjectDialog>
 </>;
}
