"use client";
import {Ruler,Image as ImageIcon} from 'lucide-react';
import {ProjectInfoCard} from '@/components/ui/project-info-card';
import {hotspotCardDimensions,type HotspotCardDesign} from '@/lib/hotspot-card-template';
export default function HotspotCardSizeGuide({design}:{design:HotspotCardDesign}){
 const {width,height}=hotspotCardDimensions(design),sheet=design.sheet;
 return <ProjectInfoCard tone="info" className="!p-3"><h3 className="flex items-center gap-2 text-xs font-bold"><Ruler className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-300"/>المقاس حسب توزيع الورقة</h3>{sheet&&<p className="mt-1 text-[11px] text-slate-600 dark:text-slate-300">{sheet.columns*sheet.rows} بطاقات · {sheet.paper} · {sheet.columns} أعمدة × {sheet.rows} صفوف</p>}<bdi dir="ltr" className="mt-2 block text-base font-bold text-blue-800 dark:text-blue-200">{width} × {height} مم</bdi><p className="mt-2 flex items-start gap-1.5 text-[11px] text-slate-600 dark:text-slate-300"><ImageIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-600 dark:text-violet-300"/><span>الصورة المقترحة: <bdi dir="ltr">{Math.round(width/25.4*300)} × {Math.round(height/25.4*300)} px</bdi> · 300 DPI</span></p><p className="mt-1 text-[10px] leading-5 text-slate-500 dark:text-slate-300">استخدم النسبة نفسها، واترك نحو 3 مم آمنة حول المحتوى.{(width<60||height<36)&&' التوزيع كثيف؛ قلّل النصوص وأبرز بيانات الدخول.'}</p></ProjectInfoCard>;
}
