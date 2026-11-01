export const hotspotCardFields=['speed','quota','duration','price','serial','expiry'] as const;
export type HotspotCardField=typeof hotspotCardFields[number];
export const hotspotCanvasKeys=['brand','logo','package','username','password','note','speed','quota','duration','price','serial','expiry','qr'] as const;
export type HotspotCanvasKey=typeof hotspotCanvasKeys[number];
export type HotspotCanvasPosition={x:number;y:number;width:number};
export const defaultHotspotPositions:Record<HotspotCanvasKey,HotspotCanvasPosition>={brand:{x:5,y:4,width:70},logo:{x:80,y:3,width:13},package:{x:5,y:16,width:90},username:{x:5,y:29,width:42},password:{x:52,y:29,width:43},speed:{x:5,y:52,width:61},quota:{x:5,y:62,width:61},duration:{x:5,y:72,width:61},price:{x:67,y:42,width:28},serial:{x:5,y:82,width:61},expiry:{x:5,y:82,width:61},note:{x:5,y:90,width:90},qr:{x:73,y:52,width:22}};
export type HotspotCardDesign={hidden?:('brand'|'package'|'logo'|'note')[];textColor?:string;background?:string;customLayout?:boolean;showQr?:boolean;loginUrl?:string;positions?:Partial<Record<HotspotCanvasKey,HotspotCanvasPosition>>;accent:string;layout:'stripe'|'simple'|'modern';size:'86x54'|'90x50'|'54x86';align:'center'|'right';fontSize:number;logo:string;title:string;note:string;fields:HotspotCardField[]};
export type HotspotCardTemplate={id:string;name:string;draft:HotspotCardDesign;approved:HotspotCardDesign|null};
export type HotspotTemplateLibrary={templates:HotspotCardTemplate[];defaultId:string;packageTemplates:Record<string,string>};
export type HotspotTemplateReport={library:HotspotTemplateLibrary;revision:number;packages:{id:number;name:string;login_mode:"code"|"username_password"|null;download_bps?:string;upload_bps?:string;quota_bytes?:string|null;duration_value?:number;duration_mode?:string;unit_name?:string; base_price?:string;currency_code?:string}[]};
export type HotspotPrintCard={username:string;password:string;serial:string;loginMode:'code'|'username_password';expiry?:string|null};
export type HotspotPrintData={packageId:number;packageName:string;downloadBps:string;uploadBps:string;quotaBytes:string|null;duration:string;price:string;timezone:string;cards:HotspotPrintCard[]};
export const defaultHotspotDesign:HotspotCardDesign={accent:'#0758e9',layout:'modern',size:'86x54',align:'center',fontSize:11,logo:'',title:'',note:'احتفظ ببيانات بطاقتك ولا تشاركها.',fields:['speed','quota','duration','serial']};
export function hotspotCardDimensions(design:HotspotCardDesign){const [width,height]=design.size.split('x').map(Number);return {width,height};}
export function hotspotRate(value:string){const n=Number(value);return Number.isFinite(n)&&n>0?(n/1000000).toLocaleString('ar',{maximumFractionDigits:2})+' Mbps':'—';}
export function hotspotQuota(value:string|null){if(value===null)return 'غير محدود';const n=Number(value);return Number.isFinite(n)?(n/1000000000).toLocaleString('ar',{maximumFractionDigits:2})+' GB':'—';}



export function hotspotLoginUrl(base:string,card:HotspotPrintCard){
 const url=new URL(base.trim());if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.hash||base.length>500||url.searchParams.has('username')||url.searchParams.has('password'))throw Error('أدخل رابط صفحة دخول هوتسبوت صالحًا دون بيانات مستخدم.');
 if(url.pathname==='/'||!url.pathname)url.pathname='/login';url.searchParams.set('username',card.username);url.searchParams.set('password',card.loginMode==='code'?card.username:card.password);return url.toString();
}
export function importHotspotDesign(input:any):HotspotCardDesign{
 const value=input?.type==='radius-lord-hotspot-template'?input.design:input;
 const d={...defaultHotspotDesign,...value};
 const image=(v:unknown,max:number)=>typeof v==='string'&&v.length<=max&&(!v||/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(v));
 if(!value||d.customLayout!==undefined&&typeof d.customLayout!=='boolean'||d.showQr!==undefined&&typeof d.showQr!=='boolean'||d.loginUrl!==undefined&&typeof d.loginUrl!=='string'||d.textColor!==undefined&&!/^#[a-f0-9]{6}$/i.test(d.textColor)||!/^#[a-f0-9]{6}$/i.test(d.accent)||!['modern','stripe','simple'].includes(d.layout)||!['86x54','90x50','54x86'].includes(d.size)||!['center','right'].includes(d.align)||!Number.isInteger(d.fontSize)||d.fontSize<9||d.fontSize>14||typeof d.title!=='string'||d.title.length>60||typeof d.note!=='string'||d.note.length>100||!image(d.logo,80000)||!image(d.background||'',180000)||!Array.isArray(d.fields)||d.fields.length>6||new Set(d.fields).size!==d.fields.length||d.fields.some((f:any)=>!hotspotCardFields.includes(f)))throw Error('ملف القالب غير صالح أو يحتوي على خيارات غير مدعومة.');
 if(d.showQr){hotspotLoginUrl(d.loginUrl||'',{username:'preview',password:'preview',loginMode:'code',serial:'0'});}
 const hidden=d.hidden||[];if(!Array.isArray(hidden)||hidden.length>4||new Set(hidden).size!==hidden.length||hidden.some((key:any)=>!['brand','package','logo','note'].includes(key)))throw Error('خيارات إظهار العناصر غير صالحة.');
 const positions:Partial<Record<HotspotCanvasKey,HotspotCanvasPosition>>={};
 if(d.positions){if(typeof d.positions!=='object'||Array.isArray(d.positions))throw Error('مواضع القالب غير صالحة.');for(const [key,pos] of Object.entries(d.positions) as [HotspotCanvasKey,any][]){if(!hotspotCanvasKeys.includes(key)||!pos||![pos.x,pos.y,pos.width].every(Number.isFinite)||pos.x<0||pos.y<0||pos.x>98||pos.y>98||pos.width<5||pos.width>100||pos.x+pos.width>100.1)throw Error('مواضع القالب تتجاوز حدود البطاقة.');positions[key]={x:pos.x,y:pos.y,width:pos.width};}}
 return {hidden,textColor:d.textColor||'#0f172a',accent:d.accent,layout:d.layout,size:d.size,align:d.align,fontSize:d.fontSize,logo:d.logo,title:d.title,note:d.note,fields:d.fields,background:d.background||'',customLayout:Boolean(d.customLayout),showQr:Boolean(d.showQr),loginUrl:String(d.loginUrl||'').slice(0,500),positions};
}

export function hotspotElementPosition(design:HotspotCardDesign,key:HotspotCanvasKey):HotspotCanvasPosition{
 const base=key==='qr'&&design.size==='54x86'?{x:66,y:52,width:30}:defaultHotspotPositions[key];
 return {...base,...design.positions?.[key]};
}
