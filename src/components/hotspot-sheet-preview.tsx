"use client";
import {useEffect,useRef,useState} from 'react';
import {hotspotCardDimensions,type HotspotCardDesign,type HotspotPrintData,type HotspotPrintCard} from '@/lib/hotspot-card-template';
import {hotspotCardHtml} from '@/lib/hotspot-card-render';
import {hotspotQrSvgs} from '@/lib/hotspot-card-qr';
export default function HotspotSheetPreview({design,data,card,networkName,clock24h}:{design:HotspotCardDesign;data:HotspotPrintData;card:HotspotPrintCard;networkName:string;clock24h:boolean}){
 const ref=useRef<HTMLDivElement>(null),[scale,setScale]=useState(.5),[svg,setSvg]=useState(''),[error,setError]=useState('');const sheet=design.sheet,width=sheet?.paper==='A5'?148:210,height=sheet?.paper==='A5'?210:297,cols=sheet?.columns||2,rows=sheet?.rows||5,dim=hotspotCardDimensions(design);
 useEffect(()=>{const element=ref.current;if(!element)return;const measure=()=>setScale(Math.min(1,Math.max(.1,(element.clientWidth-2)/(width*96/25.4))));measure();const observer=new ResizeObserver(measure);observer.observe(element);return()=>observer.disconnect();},[width]);
 useEffect(()=>{let live=true;setError('');setSvg('');if(design.showQr)void hotspotQrSvgs(design.loginUrl||'',[card]).then(result=>{if(live)setSvg(result[0]||'');}).catch(()=>{if(live)setError('تعذر تجهيز QR؛ راجع رابط الدخول.');});return()=>{live=false;};},[design.showQr,design.loginUrl,card.username,card.password,card.loginMode]);
 const html=hotspotCardHtml(design,data,card,networkName,clock24h,svg);
 return <div className="space-y-3"><p className="text-xs text-slate-500 dark:text-slate-300">معاينة توزيع {cols*rows} بطاقة في الورقة ببيانات تجريبية. الطباعة الفعلية تستخدم بيانات الدفعة.</p>{error&&<p className="text-xs text-amber-700 dark:text-amber-300">{error}</p>}<div ref={ref} className="max-w-full overflow-hidden rounded-xl bg-slate-200/60 dark:bg-white/5" style={{height:Math.ceil(height*96/25.4*scale)}}><div style={{width:width+'mm',height:height+'mm',padding:(sheet?.margin||8)+'mm',boxSizing:'border-box',transform:`scale(${scale})`,transformOrigin:'top right',background:'#fff',display:'grid',gridTemplateColumns:`repeat(${cols},${dim.width}mm)`,gridAutoRows:dim.height+'mm',gap:(sheet?.gap??2)+'mm',alignContent:'start',justifyContent:'center'}}>{Array.from({length:cols*rows},(_,i)=><div key={i} dangerouslySetInnerHTML={{__html:html}}/>)}</div></div></div>;
}
