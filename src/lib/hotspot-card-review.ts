import type {HotspotCanvasKey} from './hotspot-card-template';
export type HotspotCardIssue={id:string;severity:'error'|'warning';message:string;key?:HotspotCanvasKey};
export function inspectHotspotCard(card:HTMLElement,widthMm:number,heightMm:number):HotspotCardIssue[]{
 const names:Record<string,string>={brand:'العنوان',logo:'الشعار',package:'الباقة',username:'بيانات الدخول',password:'كلمة المرور',qr:'QR',speed:'السرعة',quota:'الحجم',duration:'المدة',price:'السعر',serial:'رقم البطاقة',expiry:'الانتهاء',note:'الملاحظة',contacts:'التواصل'};
 const issues:HotspotCardIssue[]=[],bounds=card.getBoundingClientRect(),scale=bounds.width/widthMm;
 if(!scale)return [{id:'unavailable',severity:'error',message:'تعذر قياس البطاقة؛ أعد فتح المعاينة.'}];
 const nodes=Array.from(card.querySelectorAll<HTMLElement>('[data-hotspot-element]')).map(node=>({node,key:node.dataset.hotspotElement as HotspotCanvasKey,box:node.getBoundingClientRect()}));
 if(card.scrollWidth>card.clientWidth+2||card.scrollHeight>card.clientHeight+2)issues.push({id:'overflow',severity:'error',message:'محتوى البطاقة يتجاوز المقاس المحدد.'});
 for(const {node,key,box} of nodes){
  const x=(box.left-bounds.left)/scale,y=(box.top-bounds.top)/scale,w=box.width/scale,h=box.height/scale;
  if(x<-.2||y<-.2||x+w>widthMm+.2||y+h>heightMm+.2)issues.push({id:'bounds-'+key,severity:'error',key,message:'عنصر يتجاوز حدود البطاقة.'});
  else if(x<3||y<3||x+w>widthMm-3||y+h>heightMm-3)issues.push({id:'safe-'+key,severity:'warning',key,message:'عنصر قريب من الحافة وخارج منطقة الأمان 3 مم.'});
  if(key==='qr'&&w<16-.05)issues.push({id:'qr-size',severity:'error',key,message:'حجم QR أقل من 16 مم؛ كبّره قبل الطباعة.'});
  if(!['qr','logo'].includes(key)&&parseFloat(getComputedStyle(node).fontSize)<9)issues.push({id:'font-'+key,severity:'warning',key,message:'خط صغير؛ راجع وضوحه في الطباعة التجريبية.'});
 }
 for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){const a=nodes[i],b=nodes[j],w=Math.min(a.box.right,b.box.right)-Math.max(a.box.left,b.box.left),h=Math.min(a.box.bottom,b.box.bottom)-Math.max(a.box.top,b.box.top);if(w>.5*scale&&h>.5*scale)issues.push({id:'overlap-'+a.key+'-'+b.key,severity:'warning',key:a.key,message:`تداخل محتمل بين «${names[a.key]}» و«${names[b.key]}».`});}
 if(card.hasAttribute('data-hotspot-canvas')&&!nodes.some(item=>item.key==='username'||item.key==='qr'))issues.push({id:'login-hidden',severity:'warning',message:'لا تظهر بيانات دخول أو QR؛ تأكد أن البطاقة قابلة للاستخدام.'});
 return issues;
}
