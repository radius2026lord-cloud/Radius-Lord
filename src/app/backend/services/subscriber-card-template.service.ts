import {withNetwork,validateLocalLicense} from './network-runtime.service';

export type SubscriberCardTemplate={
 accentColor:string;
 showSubscriberId:boolean;
 showPhone:boolean;
 showNetworkContact:boolean;
 contactText:string;
 backNote:string;
};
const defaults:SubscriberCardTemplate={
 accentColor:'#0758e9',
 showSubscriberId:true,
 showPhone:true,
 showNetworkContact:true,
 contactText:'',
 backNote:'هذه البطاقة تعريفية خاصة بالمشترك. عند العثور عليها يرجى التواصل مع الشبكة.',
};
const allowedColors=new Set(['#0758e9','#0f766e','#6d28d9','#b45309','#334155']);
function normalize(input:any):SubscriberCardTemplate{
 const value=input&&typeof input==='object'?input:{};
 const accentColor=String(value.accentColor||defaults.accentColor);
 if(!allowedColors.has(accentColor))throw new Error('SUBSCRIBER_CARD_INPUT');
 for(const key of ['showSubscriberId','showPhone','showNetworkContact'])if(typeof value[key]!=='boolean')throw new Error('SUBSCRIBER_CARD_INPUT');
 const contactText=String(value.contactText??'').trim(),backNote=String(value.backNote??'').trim();
 if(contactText.length>120||backNote.length>300)throw new Error('SUBSCRIBER_CARD_INPUT');
 return {accentColor,showSubscriberId:value.showSubscriberId,showPhone:value.showPhone,showNetworkContact:value.showNetworkContact,contactText,backNote};
}
export async function readSubscriberCardTemplate(scope:any){
 return withNetwork(scope,async app=>{
  await validateLocalLicense(app,scope);
  const [rows]:any=await app.query('SELECT template_json,is_approved,updated_at FROM network_subscriber_card_templates WHERE id=1 LIMIT 1');
  const row=rows[0];
  let template=defaults;
  if(row?.template_json){try{template={...defaults,...(typeof row.template_json==='string'?JSON.parse(row.template_json):row.template_json)};}catch{template=defaults;}}
  return {template,approved:Boolean(row?.is_approved),updatedAt:row?.updated_at||null};
 });
}
export async function saveSubscriberCardTemplate(scope:any,input:any){
 const template=normalize(input?.template);
 if(typeof input?.approve!=='boolean')throw new Error('SUBSCRIBER_CARD_INPUT');
 const approved=input.approve;
 return withNetwork(scope,async app=>{
  await validateLocalLicense(app,scope);
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
  return {template:saved,approved:Boolean(row?.is_approved),updatedAt:row?.updated_at||null};
 });
}
