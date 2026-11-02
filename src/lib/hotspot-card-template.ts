export const hotspotFontFamilies=['LBC','Tahoma','Arial','Times New Roman','Courier New'] as const;
export type HotspotCardFont=typeof hotspotFontFamilies[number];
export function hotspotFontStack(font?:string){return ({LBC:"'LBC','LBC Arabic',Tahoma,Arial,sans-serif",Tahoma:'Tahoma,Arial,sans-serif',Arial:'Arial,Tahoma,sans-serif','Times New Roman':"'Times New Roman',Tahoma,serif",'Courier New':"'Courier New',Tahoma,monospace"} as Record<string,string>)[font||'Tahoma']||'Tahoma,Arial,sans-serif';}
export const hotspotCardFields=['speed','quota','duration','price','serial','expiry','contacts'] as const;
export type HotspotCardField=typeof hotspotCardFields[number];
export const hotspotCanvasKeys=['brand','logo','package','username','password','note','speed','quota','duration','price','serial','expiry','qr','contacts'] as const;
export type HotspotCanvasKey=typeof hotspotCanvasKeys[number];
export type HotspotCanvasPosition={x:number;y:number;width:number};
export const defaultHotspotPositions:Record<HotspotCanvasKey,HotspotCanvasPosition>={brand:{x:5,y:4,width:70},logo:{x:80,y:3,width:13},package:{x:5,y:16,width:90},username:{x:5,y:29,width:42},password:{x:52,y:29,width:43},speed:{x:5,y:52,width:61},quota:{x:5,y:62,width:61},duration:{x:5,y:72,width:61},price:{x:67,y:42,width:28},serial:{x:5,y:82,width:61},expiry:{x:5,y:82,width:61},note:{x:5,y:90,width:90},qr:{x:73,y:52,width:22},contacts:{x:5,y:86,width:90}};
export type HotspotCardSheet={paper:'A4'|'A5';columns:number;rows:number;margin:number;gap:number};
export const defaultHotspotSheet:HotspotCardSheet={paper:'A4',columns:2,rows:5,margin:8,gap:2};
export const hotspotSheetLayouts=[{count:4,columns:2,rows:2},{count:6,columns:2,rows:3},{count:8,columns:2,rows:4},{count:10,columns:2,rows:5},{count:12,columns:3,rows:4},{count:15,columns:3,rows:5},{count:18,columns:3,rows:6},{count:20,columns:4,rows:5}];
export function hotspotSheetValid(s:any):s is HotspotCardSheet{return Boolean(s&&['A4','A5'].includes(s.paper)&&Number.isInteger(s.columns)&&s.columns>=1&&s.columns<=5&&Number.isInteger(s.rows)&&s.rows>=1&&s.rows<=10&&Number.isFinite(s.margin)&&s.margin>=5&&s.margin<=20&&Number.isFinite(s.gap)&&s.gap>=0&&s.gap<=5&&hotspotSheetLayouts.some(layout=>layout.columns===s.columns&&layout.rows===s.rows)&&(s.paper!=='A5'||s.columns*s.rows<=12));}
export type HotspotCardDesign={cropMarks?:boolean;locked?:HotspotCanvasKey[];fontFamily?:HotspotCardFont;contactLabels?:Record<string,string>;showContactLabels?:boolean;cardStyle?:'plain'|'identity'|'wave'|'diagonal';cornerStyle?:'rounded'|'square';sheet?:HotspotCardSheet;showLabels?:boolean;selectedContactPhones?:string[];backgroundMode?:'solid'|'gradient';backgroundColor?:string;gradientColor?:string;gradientAngle?:number;hidden?:HotspotCanvasKey[];elementStyles?:Partial<Record<HotspotCanvasKey,{fontFamily?:HotspotCardFont;fontSize:number;color:string;bold:boolean;align:'left'|'center'|'right'}>>;textColor?:string;background?:string;customLayout?:boolean;showQr?:boolean;loginUrl?:string;positions?:Partial<Record<HotspotCanvasKey,HotspotCanvasPosition>>;accent:string;layout:'stripe'|'simple'|'modern';size:'86x54'|'90x50'|'54x86';align:'center'|'right';fontSize:number;logo:string;title:string;note:string;fields:HotspotCardField[]};
export type HotspotCardTemplate={id:string;name:string;draft:HotspotCardDesign;approved:HotspotCardDesign|null};
export type HotspotTemplateLibrary={templates:HotspotCardTemplate[];defaultId:string;packageTemplates:Record<string,string>};
export type HotspotTemplateReport={library:HotspotTemplateLibrary;revision:number;contactOptions?:{phone:string;label:string}[];packages:{id:number;name:string;login_mode:"code"|"username_password"|null;download_bps?:string;upload_bps?:string;quota_bytes?:string|null;duration_value?:number;duration_mode?:string;unit_name?:string; base_price?:string;currency_code?:string}[]};
export type HotspotPrintCard={username:string;password:string;serial:string;loginMode:'code'|'username_password';expiry?:string|null};
export type HotspotPrintData={packageId:number;packageName:string;downloadBps:string;uploadBps:string;quotaBytes:string|null;duration:string;price:string;timezone:string;contactOptions?:{phone:string;label:string}[];cards:HotspotPrintCard[]};
export const defaultHotspotDesign:HotspotCardDesign={accent:'#0758e9',layout:'modern',size:'86x54',align:'center',fontSize:11,logo:'',title:'',note:'احتفظ ببيانات بطاقتك ولا تشاركها.',fields:['speed','quota','duration','serial']};
export function hotspotCardDimensions(design:HotspotCardDesign){if(design.sheet&&hotspotSheetValid(design.sheet)){const s=design.sheet;return {width:Math.floor(((s.paper==='A4'?210:148)-2*s.margin-(s.columns-1)*s.gap)/s.columns*100)/100,height:Math.floor(((s.paper==='A4'?297:210)-2*s.margin-(s.rows-1)*s.gap)/s.rows*100)/100};}const [width,height]=design.size.split('x').map(Number);return {width,height};}
export function hotspotRate(value:string){const n=Number(value);return Number.isFinite(n)&&n>0?(n/1000000).toLocaleString('ar',{maximumFractionDigits:2})+' Mbps':'—';}
export function hotspotQuota(value:string|null){if(value===null)return 'غير محدود';const n=Number(value);return Number.isFinite(n)?(n/1000000000).toLocaleString('ar',{maximumFractionDigits:2})+' GB':'—';}



export function hotspotLoginBase(base:string){
 const input=String(base||'').trim();
 if(!input)throw Error('أدخل رابط دخول الهوتسبوت لإنشاء QR، مثل http://g.net/login.');
 let url:URL;try{url=new URL(input);}catch{throw Error('رابط دخول الهوتسبوت غير صالح. ابدأ بـ http:// أو https://، مثل http://g.net/login.');}
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.hash||input.length>500||url.searchParams.has('username')||url.searchParams.has('password'))throw Error('استخدم رابط دخول http:// أو https:// دون اسم مستخدم أو كلمة مرور أو علامة #.');
 return url;
}
export function hotspotLoginUrl(base:string,card:HotspotPrintCard){
 const url=hotspotLoginBase(base);
 if(url.pathname==='/'||!url.pathname)url.pathname='/login';url.searchParams.set('username',card.username);url.searchParams.set('password',card.loginMode==='code'?card.username:card.password);return url.toString();
}
export function importHotspotDesign(input:any):HotspotCardDesign{
 const value=input?.type==='radius-lord-hotspot-template'?input.design:input;
 const d={...defaultHotspotDesign,...value};
 const image=(v:unknown,max:number)=>typeof v==='string'&&v.length<=max&&(!v||/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(v));
 if(!value||d.customLayout!==undefined&&typeof d.customLayout!=='boolean'||d.showQr!==undefined&&typeof d.showQr!=='boolean'||d.loginUrl!==undefined&&typeof d.loginUrl!=='string'||d.textColor!==undefined&&!/^#[a-f0-9]{6}$/i.test(d.textColor)||!/^#[a-f0-9]{6}$/i.test(d.accent)||!['modern','stripe','simple'].includes(d.layout)||!['86x54','90x50','54x86'].includes(d.size)||!['center','right'].includes(d.align)||!Number.isInteger(d.fontSize)||d.fontSize<9||d.fontSize>14||typeof d.title!=='string'||d.title.length>60||typeof d.note!=='string'||d.note.length>100||!image(d.logo,80000)||!image(d.background||'',180000)||!Array.isArray(d.fields)||d.fields.length>7||new Set(d.fields).size!==d.fields.length||d.fields.some((f:any)=>!hotspotCardFields.includes(f)))throw Error('ملف القالب غير صالح أو يحتوي على خيارات غير مدعومة.');
 if(d.showQr){hotspotLoginUrl(d.loginUrl||'',{username:'preview',password:'preview',loginMode:'code',serial:'0'});}
 if(d.sheet&&!hotspotSheetValid(d.sheet))throw Error('إعدادات الورقة غير صالحة.');
 if(d.showLabels!==undefined&&typeof d.showLabels!=='boolean'||d.backgroundMode!==undefined&&!['solid','gradient'].includes(d.backgroundMode)||d.backgroundColor!==undefined&&!/^#[a-f0-9]{6}$/i.test(d.backgroundColor)||d.gradientColor!==undefined&&!/^#[a-f0-9]{6}$/i.test(d.gradientColor)||d.gradientAngle!==undefined&&(!Number.isFinite(d.gradientAngle)||d.gradientAngle<0||d.gradientAngle>360))throw Error('ألوان الخلفية غير صالحة.');
 if(d.selectedContactPhones!==undefined&&(!Array.isArray(d.selectedContactPhones)||d.selectedContactPhones.length>6||d.selectedContactPhones.some((phone:any)=>typeof phone!=='string'||phone.length>80)))throw Error('أرقام التواصل غير صالحة.');
 if(d.cardStyle!==undefined&&!['plain','identity','wave','diagonal'].includes(d.cardStyle)||d.cornerStyle!==undefined&&!['rounded','square'].includes(d.cornerStyle))throw Error('شكل البطاقة غير صالح.');
 if(d.cropMarks!==undefined&&typeof d.cropMarks!=='boolean')throw Error('إعداد علامات القص غير صالح.');
 if(d.fontFamily!==undefined&&!hotspotFontFamilies.includes(d.fontFamily)||d.showContactLabels!==undefined&&typeof d.showContactLabels!=='boolean')throw Error('خيارات الخط وتسميات التواصل غير صالحة.');
 const contactLabels:Record<string,string>=Object.fromEntries(Object.entries(d.contactLabels||{}).map(([phone,label])=>{if(!phone||phone.length>80||typeof label!=='string'||label.length>60)throw Error('تسمية الرقم غير صالحة.');return [phone,label.trim()];}));
 if(d.contactLabels!==undefined&&(!d.contactLabels||typeof d.contactLabels!=='object'||Array.isArray(d.contactLabels)||Object.keys(d.contactLabels).length>6))throw Error('تسميات الأرقام غير صالحة.');
 const locked=d.locked||[];if(!Array.isArray(locked)||locked.length>14||new Set(locked).size!==locked.length||locked.some((key:any)=>!hotspotCanvasKeys.includes(key)))throw Error('خيارات قفل العناصر غير صالحة.');
 const hidden=d.hidden||[];if(!Array.isArray(hidden)||hidden.length>14||new Set(hidden).size!==hidden.length||hidden.some((key:any)=>!hotspotCanvasKeys.includes(key)))throw Error('خيارات إظهار العناصر غير صالحة.');
 const elementStyles:NonNullable<HotspotCardDesign['elementStyles']>={};if(d.elementStyles){if(typeof d.elementStyles!=='object'||Array.isArray(d.elementStyles)||Object.keys(d.elementStyles).length>14)throw Error('تنسيق المتغيرات غير صالح.');for(const [key,style] of Object.entries(d.elementStyles) as [HotspotCanvasKey,any][]){if(!hotspotCanvasKeys.includes(key)||!style||style.fontFamily!==undefined&&!hotspotFontFamilies.includes(style.fontFamily)||!Number.isInteger(style.fontSize)||style.fontSize<8||style.fontSize>28||!/^#[a-f0-9]{6}$/i.test(style.color)||typeof style.bold!=='boolean'||!['left','center','right'].includes(style.align))throw Error('تنسيق المتغيرات غير صالح.');elementStyles[key]={fontFamily:style.fontFamily,fontSize:style.fontSize,color:style.color,bold:style.bold,align:style.align};}}
 const positions:Partial<Record<HotspotCanvasKey,HotspotCanvasPosition>>={};
 if(d.positions){if(typeof d.positions!=='object'||Array.isArray(d.positions))throw Error('مواضع القالب غير صالحة.');for(const [key,pos] of Object.entries(d.positions) as [HotspotCanvasKey,any][]){if(!hotspotCanvasKeys.includes(key)||!pos||![pos.x,pos.y,pos.width].every(Number.isFinite)||pos.x<0||pos.y<0||pos.x>98||pos.y>98||pos.width<5||pos.width>100||pos.x+pos.width>100.1)throw Error('مواضع القالب تتجاوز حدود البطاقة.');positions[key]={x:pos.x,y:pos.y,width:pos.width};}}
 return {cropMarks:Boolean(d.cropMarks),locked,fontFamily:d.fontFamily,contactLabels:Object.fromEntries(Object.entries(contactLabels).filter(([phone])=>(d.selectedContactPhones||[]).includes(phone))),showContactLabels:d.showContactLabels,cardStyle:d.cardStyle,cornerStyle:d.cornerStyle,sheet:d.sheet,showLabels:Boolean(d.showLabels),selectedContactPhones:d.selectedContactPhones||[],backgroundMode:d.backgroundMode||'solid',backgroundColor:d.backgroundColor||'#ffffff',gradientColor:d.gradientColor||'#dbeafe',gradientAngle:d.gradientAngle??135,hidden,elementStyles,textColor:d.textColor||'#0f172a',accent:d.accent,layout:d.layout,size:d.size,align:d.align,fontSize:d.fontSize,logo:d.logo,title:d.title,note:d.note,fields:d.fields,background:d.background||'',customLayout:Boolean(d.customLayout),showQr:Boolean(d.showQr),loginUrl:String(d.loginUrl||'').slice(0,500),positions};
}

export function hotspotElementPosition(design:HotspotCardDesign,key:HotspotCanvasKey,loginMode?:'code'|'username_password'):HotspotCanvasPosition{
 const width=hotspotCardDimensions(design).width,qrWidth=Math.max(22,1700/width),premium=Boolean(design.cardStyle&&design.cardStyle!=='plain'&&!design.background);
 const polished:Partial<Record<HotspotCanvasKey,HotspotCanvasPosition>>={brand:{x:6,y:7,width:72},logo:{x:81,y:5,width:13},package:{x:6,y:22,width:70},username:{x:6,y:38,width:loginMode==='code'?(design.showQr?59:88):42},password:{x:52,y:38,width:42},speed:{x:6,y:61,width:42},quota:{x:52,y:61,width:42},duration:{x:6,y:77,width:42},price:{x:52,y:77,width:42},serial:{x:6,y:89,width:42},expiry:{x:6,y:89,width:88},note:{x:6,y:91,width:88},contacts:{x:6,y:91,width:88}};
 if(design.showQr){if(loginMode==='username_password')Object.assign(polished,{username:{x:6,y:35,width:58},password:{x:6,y:52,width:58},speed:{x:6,y:79,width:28},quota:{x:36,y:79,width:28},duration:{x:66,y:79,width:28}});else Object.assign(polished,{speed:{x:6,y:58,width:58},quota:{x:6,y:70,width:58},duration:{x:6,y:82,width:58},price:{x:6,y:89,width:58}});}
 const base=key==='qr'?{x:Math.max(0,(premium?94:95)-qrWidth),y:premium?43:47,width:qrWidth}:premium?polished[key]||defaultHotspotPositions[key]:defaultHotspotPositions[key];
 return {...base,...design.positions?.[key]};

}


