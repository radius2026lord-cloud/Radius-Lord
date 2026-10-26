import {withNetwork,validateLocalLicense} from './network-runtime.service';

export type SubscriberCardTemplate={
 accentColor:string;
 showSubscriberId:boolean;
 showPhone:boolean;
 showNetworkContact:boolean;
 showBackQr:boolean;
 cornerStyle:'rounded'|'square';
 selectedContactPhones:string[];
 contactText:string;
 backNote:string;
};
const defaults:SubscriberCardTemplate={
 accentColor:'#0758e9',
 showSubscriberId:true,
 showPhone:true,
 showNetworkContact:true,
 showBackQr:false,
 cornerStyle:'rounded',
 selectedContactPhones:[],
 contactText:'',
 backNote:'هذه البطاقة تعريفية خاصة بالمشترك. عند العثور عليها يرجى التواصل مع الشبكة.',
};
const allowedColors=new Set(['#0758e9','#1d4ed8','#0f766e','#047857','#6d28d9','#7c3aed','#9333ea','#b45309','#c2410c','#be123c','#9f1239','#334155','#0f172a','#0891b2','#0369a1','#a16207']);
function normalize(input:any):SubscriberCardTemplate{
 const value=input&&typeof input==='object'?input:{};
 const accentColor=String(value.accentColor||defaults.accentColor);
 if(!allowedColors.has(accentColor))throw new Error('SUBSCRIBER_CARD_INPUT');
 for(const key of ['showSubscriberId','showPhone','showNetworkContact','showBackQr'])if(typeof value[key]!=='boolean')throw new Error('SUBSCRIBER_CARD_INPUT');
 const cornerStyle=value.cornerStyle==='square'?'square':value.cornerStyle==='rounded'?'rounded':null;
 const selectedContactPhones=Array.isArray(value.selectedContactPhones)?Array.from(new Set(value.selectedContactPhones.filter((phone:any)=>typeof phone==='string').map((phone:string)=>phone.trim()).filter(Boolean))):[];
 if(!cornerStyle||selectedContactPhones.length>6)throw new Error('SUBSCRIBER_CARD_INPUT');
 const contactText=String(value.contactText??'').trim(),backNote=String(value.backNote??'').trim();
 if(contactText.length>120||backNote.length>300)throw new Error('SUBSCRIBER_CARD_INPUT');
 return {accentColor,showSubscriberId:value.showSubscriberId,showPhone:value.showPhone,showNetworkContact:value.showNetworkContact,showBackQr:value.showBackQr,cornerStyle,selectedContactPhones,contactText,backNote};
}
async function readContactOptions(app:any){
 const [settings]:any=await app.query('SELECT primary_contact_phone phone FROM network_settings WHERE id=1 LIMIT 1');
 const [additional]:any=await app.query('SELECT phone,label FROM network_contact_numbers WHERE network_settings_id=1 ORDER BY display_order,id');
 const seen=new Set<string>(),options:{phone:string;label:string}[]=[];
 const primary=String(settings[0]?.phone||'').trim();if(primary){seen.add(primary);options.push({phone:primary,label:'رقم التواصل الأساسي'});}
 for(let index=0;index<additional.length;index++){const phone=String(additional[index]?.phone||'').trim();if(!phone||seen.has(phone))continue;seen.add(phone);options.push({phone,label:String(additional[index]?.label||'').trim()||`رقم إضافي ${index+1}`});}
 return options;
}
export async function readSubscriberCardTemplate(scope:any){
 return withNetwork(scope,async app=>{
  await validateLocalLicense(app,scope);
  const [rows]:any=await app.query('SELECT template_json,is_approved,updated_at FROM network_subscriber_card_templates WHERE id=1 LIMIT 1');
  const row=rows[0];
  const contactOptions=await readContactOptions(app);
  let template:any=defaults;
  if(row?.template_json){try{template={...defaults,...(typeof row.template_json==='string'?JSON.parse(row.template_json):row.template_json)};}catch{template=defaults;}}
  if(!row?.template_json||!Object.prototype.hasOwnProperty.call(template,'selectedContactPhones'))template.selectedContactPhones=contactOptions.slice(0,1).map(item=>item.phone);
  const available=new Set(contactOptions.map(item=>item.phone));template.selectedContactPhones=Array.isArray(template.selectedContactPhones)?template.selectedContactPhones.filter((phone:string)=>available.has(phone)).slice(0,6):[];
  return {template,contactOptions,approved:Boolean(row?.is_approved),updatedAt:row?.updated_at||null};
 });
}
export async function saveSubscriberCardTemplate(scope:any,input:any){
 const template=normalize(input?.template);
 if(typeof input?.approve!=='boolean')throw new Error('SUBSCRIBER_CARD_INPUT');
 const approved=input.approve;
 return withNetwork(scope,async app=>{
  await validateLocalLicense(app,scope);
  const contactOptions=await readContactOptions(app),allowed=new Set(contactOptions.map(item=>item.phone));
  if(template.selectedContactPhones.some(phone=>!allowed.has(phone)))throw new Error('SUBSCRIBER_CARD_INPUT');
  await app.beginTransaction();
  try{
   await app.query(`INSERT INTO network_subscriber_card_templates(id,template_json,is_approved,approved_by,approved_at)
    VALUES(1,?,?,?,IF(?,CURRENT_TIMESTAMP(3),NULL))
    ON DUPLICATE KEY UPDATE template_json=VALUES(template_json),is_approved=VALUES(is_approved),approved_by=VALUES(approved_by),approved_at=VALUES(approved_at),updated_at=CURRENT_TIMESTAMP(3)`,
    [JSON.stringify(template),approved?1:0,approved?scope.managerId:null,approved?1:0]);
   await app.commit();
  }catch(error){await app.rollback();throw error;}
  const [rows]:any=await app.query('SELECT template_json,is_approved,updated_at FROM network_subscriber_card_templates WHERE id=1 LIMIT 1');
  const row=rows[0];
  let saved=defaults;
  if(row?.template_json){try{saved={...defaults,...(typeof row.template_json==='string'?JSON.parse(row.template_json):row.template_json)};}catch{saved=defaults;}}
  return {template:saved,contactOptions,approved:Boolean(row?.is_approved),updatedAt:row?.updated_at||null};
 });
}
