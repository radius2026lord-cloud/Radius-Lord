export const hotspotCardFields=['speed','quota','duration','price','serial','expiry'] as const;
export type HotspotCardField=typeof hotspotCardFields[number];
export type HotspotCardDesign={accent:string;layout:'stripe'|'simple';size:'86x54'|'90x50'|'54x86';align:'center'|'right';fontSize:number;logo:string;title:string;note:string;fields:HotspotCardField[]};
export type HotspotCardTemplate={id:string;name:string;draft:HotspotCardDesign;approved:HotspotCardDesign|null};
export type HotspotTemplateLibrary={templates:HotspotCardTemplate[];defaultId:string;packageTemplates:Record<string,string>};
export type HotspotTemplateReport={library:HotspotTemplateLibrary;revision:number;packages:{id:number;name:string;login_mode:"code"|"username_password"|null;download_bps?:string;upload_bps?:string;quota_bytes?:string|null;duration_value?:number;duration_mode?:string;unit_name?:string; base_price?:string;currency_code?:string}[]};
export type HotspotPrintCard={username:string;password:string;serial:string;loginMode:'code'|'username_password';expiry?:string|null};
export type HotspotPrintData={packageId:number;packageName:string;downloadBps:string;uploadBps:string;quotaBytes:string|null;duration:string;price:string;timezone:string;cards:HotspotPrintCard[]};
export const defaultHotspotDesign:HotspotCardDesign={accent:'#0758e9',layout:'stripe',size:'86x54',align:'center',fontSize:11,logo:'',title:'',note:'احتفظ ببيانات بطاقتك ولا تشاركها.',fields:['speed','quota','duration','serial']};
export function hotspotCardDimensions(design:HotspotCardDesign){const [width,height]=design.size.split('x').map(Number);return {width,height};}
export function hotspotRate(value:string){const n=Number(value);return Number.isFinite(n)&&n>0?(n/1000000).toLocaleString('ar',{maximumFractionDigits:2})+' Mbps':'—';}
export function hotspotQuota(value:string|null){if(value===null)return 'غير محدود';const n=Number(value);return Number.isFinite(n)?(n/1000000000).toLocaleString('ar',{maximumFractionDigits:2})+' GB':'—';}

