"use client";

import {useEffect,useMemo,useState} from 'react';
import {Archive,Building2,Check,Network,Pencil,Plus,RotateCcw,Tags,Users,UserRound} from 'lucide-react';
import BulkSelectionBar from '@/components/ui/bulk-selection-bar';
import {CollectionToolbar,CollectionGrid,CollectionState,CollectionCard,CollectionItemActions,CollectionSelectionBox,type CollectionItemAction,CollectionTable,CollectionTableHead,CollectionTableBody,CollectionMobileList,CollectionMobileCard,useCollectionDisplay,collectionRowClass} from '@/components/ui/collection-display';
import {ProjectCardIcon} from '@/components/ui/project-info-card';
import ProjectInput from '@/components/ui/project-input';
import ProjectButton from '@/components/ui/project-button';
import ProjectDialog from '@/components/ui/project-dialog';
import FloatingNotice from '@/components/ui/floating-notice';

type Manager={
 id:number;
 full_name:string;
 manager_type:string;
 account_role:string|null;
 is_enabled:number;
 archived_at:string|null;
};
type Category={
 id:number;
 name:string;
 description:string|null;
 archived_at:string|null;
 subscriber_count:number|string;
 managers:Manager[];
};
type CategoryDraft={id:number;name:string;description:string;managerIds:number[]};

const managerLabel=(manager:Manager)=>{
 if(manager.account_role==='agent')return 'وكيل';
 if(manager.account_role==='center_employee')return 'مدير';
 if(manager.account_role==='agent_employee')return 'موظف وكيل';
 return manager.manager_type==='principal'?'المدير الرئيسي':'مدير';
};

function CategoryActions({item,archiveOnly,busy,canEdit,canArchive,canRestore,onEdit,onArchive,onRestore}:{item:Category;archiveOnly:boolean;busy:boolean;canEdit:boolean;canArchive:boolean;canRestore:boolean;onEdit:()=>void;onArchive:()=>void;onRestore:()=>void}){
 const actions:CollectionItemAction[]=archiveOnly
  ?(canRestore?[{label:'استرجاع',icon:RotateCcw,onClick:onRestore,disabled:busy}]:[])
  :[
    ...(canEdit?[{label:'تعديل',icon:Pencil,onClick:onEdit,disabled:busy}]:[]),
    ...(canArchive?[{label:'أرشفة',icon:Archive,onClick:onArchive,tone:'danger' as const,disabled:busy}]:[])
   ];
 return actions.length?<CollectionItemActions label={'إجراءات '+item.name} items={actions}/>:null;
}

function CategoryCardContent({item,archiveOnly,busy,canEdit,canArchive,canRestore,onEdit,onArchive,onRestore}:{item:Category;archiveOnly:boolean;busy:boolean;canEdit:boolean;canArchive:boolean;canRestore:boolean;onEdit:()=>void;onArchive:()=>void;onRestore:()=>void}){
 return <>
  <div className="flex items-start justify-between gap-3">
   <div className="flex min-w-0 items-start gap-2.5">
    <ProjectCardIcon icon={Tags} tone="warning"/>
    <div className="min-w-0">
     <h3 className="break-words font-semibold">{item.name}</h3>
     <p className="mt-1 text-xs text-slate-500">{item.description||'بدون وصف'}</p>
    </div>
   </div>
   <div className="flex shrink-0 items-center gap-2">
    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-300">{item.managers.length} {item.managers.length===1?'مدير':'مدراء'}</span>
    <CategoryActions item={item} archiveOnly={archiveOnly} busy={busy} canEdit={canEdit} canArchive={canArchive} canRestore={canRestore} onEdit={onEdit} onArchive={onArchive} onRestore={onRestore}/>
   </div>
  </div>
  <div className="mt-4 grid grid-cols-2 gap-3">
   <div className="rounded-xl bg-blue-50/80 p-3 dark:bg-blue-500/[.08]">
    <div className="flex items-center gap-2 text-[11px] text-slate-500"><UserRound className="h-4 w-4 text-blue-500"/>المشتركون</div>
    <div className="mt-1 text-base font-bold text-slate-800 dark:text-slate-100">{Number(item.subscriber_count||0).toLocaleString('ar')}</div>
   </div>
   <div className="rounded-xl bg-slate-50 p-3 dark:bg-white/[.04]">
    <div className="flex items-center gap-2 text-[11px] text-slate-500"><Users className="h-4 w-4 text-violet-500"/>المدراء والوكلاء</div>
    <div className="mt-1 text-base font-bold text-slate-800 dark:text-slate-100">{Number(item.managers.length||0).toLocaleString('ar')}</div>
   </div>
  </div>
  <div className="mt-4 border-t border-slate-200 pt-3 dark:border-white/10">
   <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300"><Users className="h-4 w-4 text-blue-500"/>المدراء والوكلاء المسند إليهم</div>
   {item.managers.length
    ?<div className="flex flex-wrap gap-2">{item.managers.map(manager=><span key={manager.id} className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
      {manager.account_role==='agent'?<Network className="h-3.5 w-3.5"/>:<Building2 className="h-3.5 w-3.5"/>}
      {manager.full_name}<span className="opacity-70">· {managerLabel(manager)}{manager.archived_at||!manager.is_enabled?' · متوقف':''}</span>
     </span>)}</div>
    :<p className="text-xs text-slate-500">لم يُسند هذا التصنيف إلى مدير.</p>}
  </div>
 </>;
}

export default function NetworkCategories({
 endpoint,permissions,principal,archiveOnly=false,
}:{endpoint:string;permissions:string[];principal:boolean;archiveOnly?:boolean}){
 const [items,setItems]=useState<Category[]>([]);
 const [managers,setManagers]=useState<Manager[]>([]);
 const [actorOwner,setActorOwner]=useState<{id:number;full_name:string;role:string}|null>(null);
 const [query,setQuery]=useState('');
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');
 const [revision,setRevision]=useState(0);
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 const [edit,setEdit]=useState<CategoryDraft|null>(null);
 const [confirm,setConfirm]=useState<Category|null>(null);
 const [confirmBulk,setConfirmBulk]=useState<'archive'|'restore'|'assign'|null>(null);
 const [bulkManagerIds,setBulkManagerIds]=useState<number[]>([]);
 const {view,setView,selected:selectedIds,setSelectionMode,selectionMode,toggle,setAll,clear}=useCollectionDisplay<number>(archiveOnly?'customer-category-archive':'customer-categories','grid');
 const allowed=(action:string)=>principal||permissions.includes('categories.'+action);

 useEffect(()=>{
  let live=true;
  setLoading(true);
  fetch(endpoint+'/categories',{credentials:'include',cache:'no-store'})
   .then(async response=>{
    const body=await response.json();
    if(!response.ok)throw new Error(body.message);
    if(live){
     setItems((body.items||[]).filter((item:Category)=>Boolean(item.archived_at)===archiveOnly));
     setManagers(body.managers||[]);
     setActorOwner(body.actorOwner||null);
    }
   })
   .catch(e=>{if(live)setError(e.message);})
   .finally(()=>{if(live)setLoading(false);});
  return()=>{live=false;};
 },[endpoint,revision,archiveOnly]);

 const visibleItems=useMemo(()=>items.filter(item=>item.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())),[items,query]);
 const principalManager=managers.find(manager=>manager.manager_type==='principal');
 const selectedItems=items.filter(item=>selectedIds.has(Number(item.id)));
 const allVisibleSelected=visibleItems.length>0&&visibleItems.every(item=>selectedIds.has(Number(item.id)));
 const toggleAllVisible=()=>setAll(visibleItems.map(item=>Number(item.id)),!allVisibleSelected);
 const startCreate=()=>setEdit({id:0,name:'',description:'',managerIds:principal&&principalManager?[Number(principalManager.id)]:[]});
 const startEdit=(item:Category)=>setEdit({id:item.id,name:item.name,description:item.description||'',managerIds:item.managers.map(manager=>Number(manager.id))});
 const toggleManager=(managerId:number,checked:boolean)=>{
  if(!edit)return;
  if(!checked&&managerId===Number(principalManager?.id)&&(edit.id===0||edit.managerIds.includes(managerId)))return;
  const managerIds=checked?Array.from(new Set([...edit.managerIds,managerId])):edit.managerIds.filter(id=>id!==managerId);
  setEdit({...edit,managerIds});
 };
 const applyBulk=async()=>{
  if(!confirmBulk||selectedIds.size===0)return;
  if(confirmBulk==='assign'&&bulkManagerIds.length===0)return;
  setBusy(true);
  try{
   const action=confirmBulk==='assign'?'bulk_assign':confirmBulk==='archive'?'bulk_archive':'bulk_restore';
   const payload={action,ids:Array.from(selectedIds),...(confirmBulk==='assign'?{managerIds:bulkManagerIds}:{})};
   const response=await fetch(endpoint+'/categories',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
   const body=await response.json();
   if(!response.ok)throw new Error(body.message);
   setConfirmBulk(null);setBulkManagerIds([]);clear();
   setMessage(confirmBulk==='assign'?'تمت إضافة الإسنادات إلى '+Number(body.affected||0).toLocaleString('ar')+' علاقة.':confirmBulk==='archive'?'تمت أرشفة '+(body.affected||selectedIds.size)+' تصنيفًا.':'تم استرجاع '+(body.affected||selectedIds.size)+' تصنيفًا.');
   setRevision(value=>value+1);
  }catch(e){setError(e instanceof Error?e.message:'تعذر تنفيذ العملية الجماعية.');}
  finally{setBusy(false);}
 };
 const save=async(action:string,id?:number)=>{
  setBusy(true);
  try{
   const response=await fetch(endpoint+'/categories',{
    method:'POST',credentials:'include',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({...edit,action,id:id||edit?.id}),
   });
   const body=await response.json();
   if(!response.ok)throw new Error(body.message);
   setEdit(null);setConfirm(null);setMessage('تم حفظ عملية التصنيف.');setRevision(value=>value+1);
  }catch(e){setError(e instanceof Error?e.message:'تعذر الحفظ.');}
  finally{setBusy(false);}
 };
 const renderActions=(item:Category)=><CategoryActions item={item} archiveOnly={archiveOnly} busy={busy} canEdit={!archiveOnly&&allowed('update')} canArchive={!archiveOnly&&allowed('archive')} canRestore={archiveOnly&&allowed('restore')} onEdit={()=>startEdit(item)} onArchive={()=>setConfirm(item)} onRestore={()=>void save('restore',item.id)}/>;

 return <div className="space-y-4">
  <FloatingNotice error={error} message={message} onDismiss={()=>{setError('');setMessage('');}}/>
  <CollectionToolbar
   responsive icon={Tags}
   title={archiveOnly?'أرشيف التصنيفات':'تصنيفات المشتركين'}
   description="أدر التصنيفات وأسندها إلى مدراء أو وكلاء ليستخدموها مع مشتركيهم."
   view={view} onViewChange={setView}
   selectionMode={selectionMode}
   onSelectionModeChange={enabled=>{setSelectionMode(enabled);if(!enabled)clear();}}
   allSelected={allVisibleSelected} onToggleAll={toggleAllVisible}
   query={query} onQueryChange={setQuery}
   primaryAction={!archiveOnly&&allowed('create')?<ProjectButton onClick={startCreate}><Plus/>إضافة تصنيف</ProjectButton>:undefined}
  />
  <BulkSelectionBar count={selectedItems.length} noun="التصنيفات" allSelected={allVisibleSelected} onToggleAll={toggleAllVisible} onClearSelection={clear} customActions={[
   ...(principal&&!archiveOnly?[{label:'إسناد المحدد لمدراء',icon:Users,tone:'primary' as const,onClick:()=>{setBulkManagerIds([]);setConfirmBulk('assign');},disabled:busy}]:[]),
   {label:archiveOnly?'استرجاع المحدد':'أرشفة المحدد',icon:archiveOnly?RotateCcw:Archive,tone:archiveOnly?'success':'warning',onClick:()=>setConfirmBulk(archiveOnly?'restore':'archive'),disabled:busy}
  ]}/>
  {loading?<CollectionState loading>جارٍ التحميل…</CollectionState>:!visibleItems.length?<CollectionState>{query?'لا توجد تصنيفات مطابقة.':'لا توجد تصنيفات.'}</CollectionState>:view==='grid'
   ?<CollectionGrid>{visibleItems.map(item=><CollectionCard key={item.id} selectionMode={selectionMode} selected={selectedIds.has(Number(item.id))} onToggle={()=>toggle(Number(item.id))} onOpen={()=>{}}><CategoryCardContent item={item} archiveOnly={archiveOnly} busy={busy} canEdit={!archiveOnly&&allowed('update')} canArchive={!archiveOnly&&allowed('archive')} canRestore={archiveOnly&&allowed('restore')} onEdit={()=>startEdit(item)} onArchive={()=>setConfirm(item)} onRestore={()=>void save('restore',item.id)}/></CollectionCard>)}</CollectionGrid>
   :<>
    <CollectionTable minWidth="820px">
     <CollectionTableHead><tr><th className="w-12 p-3 text-center"><CollectionSelectionBox checked={allVisibleSelected} onChange={toggleAllVisible} label="تحديد كل التصنيفات الظاهرة"/></th><th className="p-3">التصنيف</th><th>المشتركون</th><th>المدراء والوكلاء</th><th>الحالة</th><th className="w-14 text-center">إجراء</th></tr></CollectionTableHead>
     <CollectionTableBody>{visibleItems.map(item=><tr key={item.id} onClick={()=>selectionMode&&toggle(Number(item.id))} className={collectionRowClass(selectedIds.has(Number(item.id)))}>
      <td className="w-12 p-3 text-center" onClick={event=>event.stopPropagation()}><CollectionSelectionBox checked={selectedIds.has(Number(item.id))} onChange={()=>toggle(Number(item.id))} label={'تحديد '+item.name}/></td>
      <td className="max-w-[280px] p-3"><div className="break-words font-semibold text-[#17386d] dark:text-slate-100">{item.name}</div><div className="mt-1 break-words text-[10px] text-slate-500">{item.description||'بدون وصف'}</div></td>
      <td className="font-semibold">{Number(item.subscriber_count||0).toLocaleString('ar')}</td>
      <td className="max-w-[320px]"><div className="font-semibold">{Number(item.managers.length).toLocaleString('ar')}</div><div className="mt-1 break-words text-[10px] text-slate-500">{item.managers.map(manager=>manager.full_name).join('، ')||'غير مسند'}</div></td>
      <td><span className={item.archived_at?'rounded-full bg-slate-100 px-2.5 py-1 text-[10px] text-slate-500 dark:bg-white/10':'rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300'}>{item.archived_at?'مؤرشف':'نشط'}</span></td>
      <td className="w-14 text-center">{renderActions(item)}</td>
     </tr>)}</CollectionTableBody>
    </CollectionTable>
    <CollectionMobileList>{visibleItems.map(item=><CollectionMobileCard key={item.id} onOpen={()=>{if(selectionMode)toggle(Number(item.id));}}>
     <div className="mb-2 flex justify-end" onClick={event=>event.stopPropagation()}><CollectionSelectionBox checked={selectedIds.has(Number(item.id))} onChange={()=>toggle(Number(item.id))} label={'تحديد '+item.name}/></div>
     <CategoryCardContent item={item} archiveOnly={archiveOnly} busy={busy} canEdit={!archiveOnly&&allowed('update')} canArchive={!archiveOnly&&allowed('archive')} canRestore={archiveOnly&&allowed('restore')} onEdit={()=>startEdit(item)} onArchive={()=>setConfirm(item)} onRestore={()=>void save('restore',item.id)}/>
    </CollectionMobileCard>)}</CollectionMobileList>
   </>}

  <ProjectDialog open={Boolean(edit)} title={edit?.id?'تعديل التصنيف وإسناده':'إضافة تصنيف وإسناده'} onClose={()=>setEdit(null)}>
   {edit&&<form className="space-y-4" onSubmit={event=>{event.preventDefault();void save(edit.id?'update':'create');}}>
    <label className="block text-xs font-medium">اسم التصنيف
     <ProjectInput required maxLength={100} className="mt-2" value={edit.name} onChange={event=>setEdit({...edit,name:event.target.value})}/>
    </label>
    <label className="block text-xs font-medium">الوصف
     <ProjectInput maxLength={5000} className="mt-2" value={edit.description} onChange={event=>setEdit({...edit,description:event.target.value})}/>
    </label>
    {principal
     ?<fieldset className="space-y-2">
       <legend className="mb-2 flex items-center gap-2 text-xs font-semibold"><Users className="h-4 w-4 text-blue-500"/>إسناد التصنيف إلى مدير أو أكثر</legend>
       <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2 dark:border-white/10">
        {managers.map(manager=>{
         const checked=edit.managerIds.includes(Number(manager.id));
         const unavailable=Boolean(manager.archived_at)||!manager.is_enabled;
         return <label key={manager.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-white/5">
          <input type="checkbox" checked={checked} disabled={manager.manager_type==='principal'&&(edit.id===0||checked)} onChange={event=>toggleManager(Number(manager.id),event.target.checked)} className="h-4 w-4 rounded accent-blue-600 disabled:cursor-not-allowed disabled:opacity-70"/>
          <span className="flex-1">{manager.full_name}</span>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] text-slate-500 dark:bg-white/10">{managerLabel(manager)}{unavailable?' · متوقف':''}</span>
          {checked&&<Check className="h-4 w-4 text-emerald-600"/>}
         </label>;
        })}
        {!managers.length&&<p className="px-3 py-4 text-xs text-slate-500">لا يوجد مدراء متاحون للإسناد.</p>}
       </div>
       <p className="text-[11px] leading-5 text-slate-500">يسند التصنيف تلقائيًا إلى المدير الرئيسي، ويمكن إضافة مدراء أو وكلاء آخرين. يظهر لكل مدير مسند إليه، ولا يغيّر الإسناد تبعية المشترك.</p>
      </fieldset>
     :<div className="flex items-start gap-2 rounded-xl bg-blue-50 p-3 text-xs leading-5 text-blue-800 dark:bg-blue-500/10 dark:text-blue-200">
       <Building2 className="mt-0.5 h-4 w-4 shrink-0"/>
       <span>{edit.id?'تبعية التصنيف للمدراء تبقى بإدارة المدير الرئيسي.':'سيُسند التصنيف تلقائيًا إلى المدير الرئيسي وحسابك؛ ويستخدمه فريق الوكيل ضمن تبعيته.'}{actorOwner?.full_name?' ('+actorOwner.full_name+')':''}</span>
      </div>}
    <div className="flex justify-end gap-2 pt-1">
     <ProjectButton type="button" variant="ghost" disabled={busy} onClick={()=>setEdit(null)}>إلغاء</ProjectButton>
     <ProjectButton type="submit" disabled={busy||principal&&edit.managerIds.length===0}>حفظ</ProjectButton>
    </div>
   </form>}
  </ProjectDialog>

  <ProjectDialog open={Boolean(confirm)} title="أرشفة التصنيف" onClose={()=>setConfirm(null)} footer={<ProjectButton disabled={busy} onClick={()=>void save('archive',confirm?.id)}>تأكيد الأرشفة</ProjectButton>}>
   <p>سيُنقل تصنيف {confirm?.name} إلى الأرشيف مع حفظ علاقاته الحالية.</p>
  </ProjectDialog>

  <ProjectDialog open={confirmBulk==='assign'} title="إسناد التصنيفات المحددة" onClose={()=>setConfirmBulk(null)} footer={<><ProjectButton variant="ghost" disabled={busy} onClick={()=>setConfirmBulk(null)}>إلغاء</ProjectButton><ProjectButton disabled={busy||bulkManagerIds.length===0} onClick={()=>void applyBulk()}>تأكيد الإسناد</ProjectButton></>}>
   <div className="space-y-3"><p className="text-sm text-slate-500">اختر مدراء أو وكلاء لإضافة إسنادهم إلى التصنيفات المحددة. لا تُحذف الإسنادات الحالية.</p><div className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2 dark:border-white/10">{managers.map(manager=>{const checked=bulkManagerIds.includes(Number(manager.id)),unavailable=Boolean(manager.archived_at)||!manager.is_enabled;return <label key={manager.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-white/5"><input type="checkbox" checked={checked} disabled={unavailable} onChange={event=>setBulkManagerIds(current=>event.target.checked?Array.from(new Set([...current,Number(manager.id)])):current.filter(id=>id!==Number(manager.id)))} className="h-4 w-4 rounded accent-blue-600"/><span className="flex-1">{manager.full_name}</span><span className="text-[10px] text-slate-500">{managerLabel(manager)}{unavailable?' · متوقف':''}</span></label>;})}</div></div>
  </ProjectDialog>
  <ProjectDialog open={confirmBulk==='archive'||confirmBulk==='restore'} title={confirmBulk==='restore'?'استرجاع التصنيفات المحددة':'أرشفة التصنيفات المحددة'} onClose={()=>setConfirmBulk(null)} footer={<><ProjectButton variant="ghost" disabled={busy} onClick={()=>setConfirmBulk(null)}>إلغاء</ProjectButton><ProjectButton disabled={busy} onClick={()=>void applyBulk()}>{confirmBulk==='restore'?'تأكيد الاسترجاع':'تأكيد الأرشفة'}</ProjectButton></>}>
   <p>{confirmBulk==='restore'?'سيتم استرجاع':'سيتم نقل'} {selectedIds.size} تصنيفًا {confirmBulk==='restore'?'من الأرشيف إلى القائمة النشطة.':'إلى الأرشيف مع إبقاء سجلات المشتركين محفوظة.'}</p>
  </ProjectDialog>
 </div>;
}
