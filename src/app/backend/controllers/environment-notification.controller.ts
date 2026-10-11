import {readHostingPreflight} from '../services/hosting-preflight.service';
import {decryptProvisioningSecret} from '../services/provisioning-secrets.service';
import {env} from '../config/env';
import type {Response} from 'express';
import {db} from '../config/db';
import type {AuthenticatedRequest} from '../middleware/auth.middleware';
import {writeAuditLog} from '../services/audit.service';
import {readPrivateSetting} from '../services/radius-provision.service';
import {activationLink} from '../services/environment-activation.service';
// Preparing a draft is manual delivery, never a claim that a message was sent.
export async function requestEnvironmentNotification(req:AuthenticatedRequest,res:Response){
 res.setHeader('Cache-Control','no-store');
 try{const hosting=await readHostingPreflight((sql,params)=>db.query(sql,params));if(req.headers.origin!==new URL(env.FRONTEND_URL).origin&&req.headers.origin!==new URL(hosting.baseUrl).origin)return res.status(403).json({message:'مصدر الطلب غير مصرح.'});}catch{return res.status(409).json({message:'راجع إعداد الوصول للمنصة.'});}
 const id=Number(req.params.id);if(!Number.isSafeInteger(id)||id<1)return res.status(400).json({message:'رقم الاشتراك غير صالح.'});
 try{
  const [rows]:any=await db.query(`SELECT e.id environment_id,e.tenant_id,e.status,e.system_url,t.name,t.license_number,s.id subscription_id,s.status subscription_status,s.expires_at,l.status license_status,p.plan_name_snapshot,c.full_name customer_name,c.email,c.phone FROM payment_orders p JOIN subscriptions s ON s.id=p.subscription_id AND s.tenant_id=p.tenant_id JOIN tenants t ON t.id=s.tenant_id JOIN tenant_environments e ON e.tenant_id=t.id JOIN subscription_licenses l ON l.tenant_id=t.id AND l.subscription_id=s.id JOIN customers c ON c.id=t.customer_id WHERE p.id=? AND p.status IN ('paid','completed') AND EXISTS (SELECT 1 FROM environment_provisioning_jobs j WHERE j.environment_id=e.id AND j.subscription_id=s.id AND j.status='success')`,[id]);
  const e=rows[0];if(!e||e.status!=='ready'||e.subscription_status!=='active'||e.license_status!=='active'||!e.system_url||!e.expires_at||new Date(e.expires_at).getTime()<=Date.now())return res.status(409).json({message:'يجب اكتمال تجهيز البيئة وتفعيل الاشتراك والرخصة أولًا.'});
  const state=await readPrivateSetting('environment_runtime','environment_'+e.environment_id);
  if(!state||state.tenantId!==Number(e.tenant_id)||state.subscriptionId!==Number(e.subscription_id)||!state.credentialsExpiresAt||new Date(state.credentialsExpiresAt).getTime()<=Date.now())return res.status(409).json({message:'انتهت مهلة تسليم بيانات الدخول الأولية أو لم تُجهّز بعد.'});
  const temporary=state.mustChangeCredentials===true;
  const activation=temporary?null:await activationLink(e,state.credentialsExpiresAt);
  const temporaryPassword=temporary?decryptProvisioningSecret(state.passwordEncrypted):null;
  const clean=(value:unknown)=>String(value??'').replace(/[\r\n\x00-\x1f*_~`]/g,' ').trim();
  const date=(value:string)=>{const d=new Date(value);return `${d.getUTCFullYear()}/${String(d.getUTCMonth()+1).padStart(2,'0')}/${String(d.getUTCDate()).padStart(2,'0')} - ${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}`;};
  const value=(input:unknown)=>{const plain=clean(input);return /[A-Za-z0-9]/.test(plain)?'\u200e'+plain+'\u200e':plain;};
  const content=(whatsapp=false)=>{const heading=(label:string)=>whatsapp?`*${label}*`:label;return [
   `أهلًا ${clean(e.customer_name)||'بك'}،`,
   '',
   'مرحبًا بك في راديوس لورد.',
   'تم تجهيز بيئة شبكتك بنجاح، ويسعدنا انضمامك إلينا.',
   '',
   heading('بيانات الشبكة'),
   'اسم الشبكة:',value(e.name),
   '',
   'اسم المستخدم:',value(state.username),
   '',
   heading('تفاصيل الاشتراك'),
   'الخطة:',value(e.plan_name_snapshot),
   '',
   'رقم الرخصة:',value(e.license_number),
   '',
   'انتهاء الاشتراك:',value(date(e.expires_at)),
   '',
   ...(temporary?[
    heading('بيانات الدخول المؤقتة'),
    'اسم المستخدم المؤقت:',whatsapp?'`'+String(state.username)+'`':String(state.username),
    'كلمة المرور المؤقتة:',whatsapp?'`'+String(temporaryPassword)+'`':String(temporaryPassword),
    '',
    'صفحة تسجيل الدخول:',new URL('/login',e.system_url).href,
    '',
    'عند أول تسجيل دخول سيُطلب منك اختيار اسم مستخدم وكلمة مرور خاصين بك قبل فتح إدارة الشبكة.',
    'صلاحية البيانات المؤقتة حتى:',value(date(state.credentialsExpiresAt)),
    'لا تشارك بيانات الدخول. تُلغى البيانات المؤقتة بعد حفظ بياناتك الجديدة.',
   ]:[
    heading('تفعيل حسابك'),'افتح الرابط التالي لتعيين كلمة مرورك:',activation!.url,
    'انتهاء صلاحية رابط التفعيل:',value(date(activation!.expiresAt)),
    'الرابط خاص بك ويُستخدم مرة واحدة فقط. لا تشاركه مع الآخرين.',
    'بعد تعيين كلمة المرور، يمكنك تسجيل الدخول باسم المستخدم أعلاه.',
   ]),
   'جميع الأوقات بتوقيت UTC.',
   '',
   'شكرًا لثقتك بنا.',
   'فريق راديوس لورد',
  ].join('\n');};
  const text=content(),whatsappText=content(true);
  const phone=String(e.phone??'').replace(/[\s+()-]/g,'');
  const whatsappUrl=/^[1-9][0-9]{7,14}$/.test(phone)?`https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(whatsappText.replace(/\n/g,'\r\n'))}`:null;
  const email=String(e.email??'');const emailUrl=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)?`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent('مرحبًا بك — شبكتك جاهزة في Radius Lord')}&body=${encodeURIComponent(text)}`:null;
  await writeAuditLog(req,{actionCode:'UPDATE',entityTypeCode:'TENANT_ENVIRONMENT',entityId:e.environment_id,tenantId:e.tenant_id,description:'عرض مسودة تسليم بيانات البيئة يدويًا دون إرسال تلقائي',metadata:{event:'manual_delivery_draft',subscriptionId:e.subscription_id}});
  return res.json({message:'بيانات البيئة جاهزة للمراجعة والإرسال اليدوي. لم تُرسل رسالة تلقائيًا.',text,whatsappUrl,emailUrl});
 }catch{return res.status(500).json({message:'تعذر تجهيز مسودة بيانات الدخول.'});}
}
