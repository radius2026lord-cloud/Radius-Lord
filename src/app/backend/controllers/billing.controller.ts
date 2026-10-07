import { randomBytes } from 'crypto';
import { Response } from 'express';
import { db } from '../config/db';
import { writeAuditLog } from '../services/audit.service';
import { ensureCentralSubscription, readEnvironmentSummary, EnvironmentRequestError } from '../services/subscription-environment.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

const publicKeys=['contact_name','whatsapp_number','whatsapp_enabled','whatsapp_button_text','whatsapp_message_template','payment_instructions','support_email','support_phone_primary','support_phone_secondary'];
function paymentCode(){return 'PAY-RL-'+new Date().getFullYear()+'-'+randomBytes(4).toString('hex').toUpperCase();}

export async function getPublicPaymentSettingsController(req:AuthenticatedRequest,res:Response){
 try{const [rows]=await db.query("SELECT setting_key,setting_value,value_type FROM platform_settings WHERE setting_group='contact_payment' AND is_public=1");const settings:Object=Object.fromEntries((rows as any[]).map(r=>[r.setting_key,r.value_type==='boolean'?r.setting_value==='1':r.setting_value]));return res.json({success:true,settings});}
 catch(e){console.error(e);return res.status(500).json({success:false,message:'تعذر تحميل معلومات التواصل والدفع.'});}
}
export async function getPaymentSettingsController(req:AuthenticatedRequest,res:Response){
 try{const [rows]=await db.query("SELECT setting_key,setting_value,value_type,is_public FROM platform_settings WHERE setting_group='contact_payment' ORDER BY id");return res.json({success:true,settings:rows});}
 catch(e){console.error(e);return res.status(500).json({success:false,message:'تعذر تحميل إعدادات التواصل والدفع.'});}
}
export async function updatePaymentSettingsController(req:AuthenticatedRequest,res:Response){
 try{const body=req.body??{};const limits:Record<string,number>={contact_name:80,whatsapp_button_text:100,whatsapp_message_template:1000,payment_instructions:1500,support_email:160,support_phone_primary:15,support_phone_secondary:15};if('whatsapp_number' in body){const phone=String(body.whatsapp_number??'').trim();if(phone&&!/^[1-9][0-9]{6,14}$/.test(phone))return res.status(400).json({success:false,message:'رقم WhatsApp يجب أن يحتوي على أرقام إنكليزية فقط من 7 إلى 15 رقمًا بصيغة دولية.'});if(body.whatsapp_enabled&&!phone)return res.status(400).json({success:false,message:'رقم WhatsApp مطلوب عند تفعيل التواصل عبر WhatsApp.'});}if('support_email' in body){const email=String(body.support_email??'').trim();if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(400).json({success:false,message:'البريد الإلكتروني للدعم غير صالح.'});}for(const key of ['support_phone_primary','support_phone_secondary']){if(!(key in body))continue;const phone=String(body[key]??'').trim();if(phone&&!/^[1-9][0-9]{6,14}$/.test(phone))return res.status(400).json({success:false,message:'أرقام التواصل يجب أن تكون من 7 إلى 15 رقمًا بصيغة دولية.'});}for(const key of publicKeys){if(!(key in body))continue;const value=key==='whatsapp_enabled'?(body[key]?'1':'0'):String(body[key]??'').trim();if(limits[key]&&value.length>limits[key])return res.status(400).json({success:false,message:'إحدى القيم المدخلة أطول من الحد المسموح.'});const valueType=key==='whatsapp_enabled'?'boolean':(key==='whatsapp_message_template'||key==='payment_instructions'?'text':'string');await db.query("INSERT INTO platform_settings (setting_group,setting_key,setting_value,value_type,is_public,updated_by_master_admin_id) VALUES ('contact_payment',?,?,?,?,?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value),value_type=VALUES(value_type),is_public=VALUES(is_public),updated_by_master_admin_id=VALUES(updated_by_master_admin_id)",[key,value,valueType,1,req.auth!.accountId]);}return getPaymentSettingsController(req,res);}
 catch(e){console.error(e);return res.status(500).json({success:false,message:'تعذر حفظ إعدادات التواصل والدفع.'});}
}

export async function getMasterActivityController(req:AuthenticatedRequest,res:Response){
 try{
  const [customers]=await db.query("SELECT id,full_name,username,created_at FROM customers ORDER BY created_at DESC LIMIT 20");
  const [orders]=await db.query("SELECT o.id,o.customer_id,o.payment_code,o.plan_name_snapshot,o.deployment_name_snapshot,o.total_amount,o.currency_code,o.status,o.created_at,c.full_name,c.username FROM payment_orders o JOIN customers c ON c.id=o.customer_id ORDER BY o.created_at DESC LIMIT 30");
  const [events]=await db.query("SELECT e.id,e.payment_order_id,e.event_type,e.to_status,e.created_at,o.payment_code,o.customer_id,o.plan_name_snapshot,c.full_name,c.username FROM payment_order_events e JOIN payment_orders o ON o.id=e.payment_order_id JOIN customers c ON c.id=o.customer_id WHERE e.event_type<>'created' ORDER BY e.created_at DESC LIMIT 30");
  const activity=[...(customers as any[]).map(r=>({id:'customer-'+r.id,type:'account_created',customerId:r.id,customerName:r.full_name,username:r.username,title:'إنشاء حساب جديد',description:'أنشأ حسابًا جديدًا في Radius Lord',createdAt:r.created_at})),...(orders as any[]).map(r=>({id:'order-'+r.id,type:'payment_order_created',customerId:r.customer_id,customerName:r.full_name,username:r.username,title:'اختيار خطة وتوليد كود دفع',description:`اختار خطة ${r.plan_name_snapshot}${r.deployment_name_snapshot?` — ${r.deployment_name_snapshot}`:''}`,paymentCode:r.payment_code,totalAmount:Number(r.total_amount),currency:r.currency_code,status:r.status,createdAt:r.created_at})),...(events as any[]).map(r=>({id:'event-'+r.id,type:r.event_type,customerId:r.customer_id,customerName:r.full_name,username:r.username,title:r.event_type==='sent_to_whatsapp'?'انتقل العميل إلى WhatsApp':r.event_type==='confirmed_paid'?'تم تأكيد الدفع':'تحديث طلب الدفع',description:`طلب الدفع ${r.payment_code}`,paymentCode:r.payment_code,status:r.to_status,createdAt:r.created_at}))].sort((a:any,b:any)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime()).slice(0,40);
  const [summaryRows]=await db.query(`SELECT (SELECT COUNT(*) FROM customers WHERE created_at>=CURRENT_DATE AND created_at<CURRENT_DATE+INTERVAL 1 DAY) new_accounts_today,(SELECT COUNT(*) FROM payment_orders WHERE created_at>=CURRENT_DATE AND created_at<CURRENT_DATE+INTERVAL 1 DAY) payment_orders_today,(SELECT COUNT(*) FROM payment_orders WHERE status='awaiting_confirmation') awaiting_confirmation,(SELECT COUNT(*) FROM payment_orders WHERE paid_at>=CURRENT_DATE AND paid_at<CURRENT_DATE+INTERVAL 1 DAY AND status IN ('paid','completed')) paid_today`);
  const summary=(summaryRows as any[])[0];
  return res.json({success:true,summary:{newAccountsToday:Number(summary.new_accounts_today),paymentOrdersToday:Number(summary.payment_orders_today),awaitingConfirmation:Number(summary.awaiting_confirmation),paidToday:Number(summary.paid_today)},activity});
 }catch(e){console.error('Master activity error:',e);return res.status(500).json({success:false,message:'تعذر تحميل النشاط المباشر حاليًا.'});}
}

export async function createPaymentOrderController(req:AuthenticatedRequest,res:Response){
 const customerId=req.auth!.accountId,planId=Number(req.body?.planId),deploymentOptionId=Number(req.body?.deploymentOptionId),addonIds=Array.isArray(req.body?.addonIds)?req.body.addonIds.map(Number):[];
 if(!Number.isInteger(planId)||planId<1||!Number.isInteger(deploymentOptionId)||deploymentOptionId<1)return res.status(400).json({success:false,message:'بيانات الخطة أو الاستضافة غير صالحة.'});
 let conn;
 try{
  const [plans]=await db.query("SELECT p.id,p.name,p.duration_months,p.max_tenants,p.max_subscribers,p.max_nas,p.price,c.code currency_code FROM payment_plans p LEFT JOIN currencies c ON c.id=p.currency_id WHERE p.id=? AND p.status='active' LIMIT 1",[planId]);const plan=(plans as any[])[0];if(!plan)return res.status(404).json({success:false,message:'الخطة غير متاحة.'});
  const [opts]=await db.query("SELECT o.id,o.deployment_type_id,o.price,dt.name_ar FROM plan_deployment_options o JOIN deployment_types dt ON dt.id=o.deployment_type_id WHERE o.id=? AND o.plan_id=? AND o.status='active' LIMIT 1",[deploymentOptionId,planId]);const opt=(opts as any[])[0];if(!opt)return res.status(400).json({success:false,message:'خيار الاستضافة غير متاح.'});
  let addons:any[]=[];if(addonIds.length){const marks=addonIds.map(()=>'?').join(',');const [rows]=await db.query(`SELECT id,code,name_ar,price FROM plan_addons WHERE plan_id=? AND deployment_type_id=? AND status='active' AND id IN (${marks})`,[planId,opt.deployment_type_id,...addonIds]);addons=rows as any[];if(addons.length!==new Set(addonIds).size)return res.status(400).json({success:false,message:'إحدى القيم المضافة غير متاحة.'});}
  const base=Number(opt.price),addonsTotal=addons.reduce((s,a)=>s+Number(a.price||0),0),total=base+addonsTotal,code=paymentCode();
  conn=await db.pool.getConnection();
  await conn.beginTransaction();
  const [result]:any=await conn.query("INSERT INTO payment_orders (payment_code,customer_id,plan_id,deployment_type_id,payment_purpose,plan_name_snapshot,duration_months_snapshot,deployment_name_snapshot,base_price,addons_total,total_amount,currency_code,addons_snapshot,plan_limits_snapshot,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'pending')",[code,customerId,planId,opt.deployment_type_id,'initial_subscription',plan.name,plan.duration_months,opt.name_ar,base,addonsTotal,total,plan.currency_code||'USD',JSON.stringify(addons.map(a=>({id:a.id,code:a.code,nameAr:a.name_ar,price:Number(a.price)}))),JSON.stringify({maxTenants:Number(plan.max_tenants),maxSubscribers:Number(plan.max_subscribers),maxNas:Number(plan.max_nas)})]);
  await conn.query("INSERT INTO payment_order_events (payment_order_id,event_type,to_status) VALUES (?,'created','pending')",[result.insertId]);
  await conn.commit();
  return res.status(201).json({success:true,paymentOrder:{id:result.insertId,paymentCode:code,purpose:'initial_subscription',planName:plan.name,deploymentName:opt.name_ar,basePrice:base,addonsTotal,totalAmount:total,currency:plan.currency_code||'USD',addons}});
 }catch(e){if(conn)await conn.rollback();console.error('Create payment order error:',(e as any)?.code || 'UNKNOWN');return res.status(500).json({success:false,message:'تعذر إنشاء طلب الدفع.'});}
 finally{conn?.release();}
}

export async function getMyPaymentOrderController(req:AuthenticatedRequest,res:Response){
 try{const code=String(req.params.code??'').trim();const [rows]=await db.query("SELECT id,payment_code,payment_purpose,plan_name_snapshot,duration_months_snapshot,deployment_name_snapshot,base_price,addons_total,total_amount,currency_code,addons_snapshot,status,requested_at,expires_at FROM payment_orders WHERE payment_code=? AND customer_id=? LIMIT 1",[code,req.auth!.accountId]);const r=(rows as any[])[0];if(!r)return res.status(404).json({success:false,message:'طلب الدفع غير موجود.'});return res.json({success:true,paymentOrder:{id:r.id,paymentCode:r.payment_code,purpose:r.payment_purpose,planName:r.plan_name_snapshot,durationMonths:r.duration_months_snapshot,deploymentName:r.deployment_name_snapshot,basePrice:Number(r.base_price),addonsTotal:Number(r.addons_total),totalAmount:Number(r.total_amount),currency:r.currency_code,addons:typeof r.addons_snapshot==='string'?JSON.parse(r.addons_snapshot||'[]'):(r.addons_snapshot||[]),status:r.status,requestedAt:r.requested_at,expiresAt:r.expires_at}});}
 catch(e){console.error(e);return res.status(500).json({success:false,message:'تعذر تحميل طلب الدفع.'});}
}
export async function markPaymentOrderWhatsappController(req:AuthenticatedRequest,res:Response){
 let conn;
 try{
  conn=await db.pool.getConnection();await conn.beginTransaction();
  const code=String(req.params.code??'').trim();
  const [rows]:any=await conn.query("SELECT id,status FROM payment_orders WHERE payment_code=? AND customer_id=? FOR UPDATE",[code,req.auth!.accountId]);
  const order=rows[0];
  if(!order){await conn.rollback();return res.status(404).json({success:false,message:'طلب الدفع غير موجود.'});}
  if(!['pending','awaiting_confirmation'].includes(order.status)){await conn.rollback();return res.status(409).json({success:false,message:'حالة طلب الدفع لا تسمح بهذه العملية.'});}
  if(order.status==='pending'){
    await conn.query("UPDATE payment_orders SET status='awaiting_confirmation' WHERE id=?",[order.id]);
    await conn.query("INSERT INTO payment_order_events (payment_order_id,event_type,from_status,to_status) VALUES (?,'sent_to_whatsapp','pending','awaiting_confirmation')",[order.id]);
  }
  await conn.commit();return res.json({success:true,status:'awaiting_confirmation'});
 }catch(error){if(conn)await conn.rollback();console.error('WhatsApp payment status failed:',(error as any)?.code || 'UNKNOWN');return res.status(500).json({success:false,message:'تعذر تحديث طلب الدفع.'});}
 finally{conn?.release();}
}

export async function listPaymentOrdersController(req:AuthenticatedRequest,res:Response){
 try{const [rows]=await db.query(`SELECT po.id,po.payment_code,po.payment_purpose,po.plan_name_snapshot,po.deployment_name_snapshot,po.total_amount,po.currency_code,po.status,po.requested_at,po.paid_at,po.completed_at,c.full_name customer_name,c.email customer_email FROM payment_orders po JOIN customers c ON c.id=po.customer_id ORDER BY po.id DESC`);return res.json({success:true,paymentOrders:(rows as any[]).map(r=>({id:r.id,paymentCode:r.payment_code,purpose:r.payment_purpose,planName:r.plan_name_snapshot,deploymentName:r.deployment_name_snapshot,totalAmount:Number(r.total_amount),currency:r.currency_code,status:r.status,requestedAt:r.requested_at,paidAt:r.paid_at,completedAt:r.completed_at,customerName:r.customer_name,customerEmail:r.customer_email}))});}
 catch(e){console.error(e);return res.status(500).json({success:false,message:'تعذر تحميل عمليات الدفع.'});}
}
export async function listSubscriptionRequestsController(req:AuthenticatedRequest,res:Response){
 try{
  const customerId=req.params.customerId;
  if(customerId!==undefined&&(!/^[1-9][0-9]*$/.test(customerId)||!Number.isSafeInteger(Number(customerId))))return res.status(400).json({success:false,message:"رقم العميل غير صالح."});
  const [rows]=await db.query(`SELECT po.id,po.customer_id,po.payment_code,po.plan_name_snapshot,po.duration_months_snapshot,po.deployment_name_snapshot,po.addons_snapshot,po.total_amount,po.currency_code,po.status,po.requested_at,po.paid_at,c.full_name customer_name,c.username customer_username,c.email customer_email,te.status environment_status,(SELECT MAX(e.created_at) FROM payment_order_events e WHERE e.payment_order_id=po.id AND e.event_type='sent_to_whatsapp') whatsapp_sent_at FROM payment_orders po JOIN customers c ON c.id=po.customer_id LEFT JOIN tenant_environments te ON te.tenant_id=po.tenant_id WHERE po.payment_purpose='initial_subscription' AND EXISTS (SELECT 1 FROM payment_order_events e2 WHERE e2.payment_order_id=po.id AND e2.event_type='sent_to_whatsapp') ${customerId!==undefined?'AND po.customer_id=?':''} ORDER BY COALESCE(po.paid_at,po.requested_at) DESC,po.id DESC`,customerId!==undefined?[Number(customerId)]:[]);
  return res.json({success:true,subscriptions:(rows as any[]).map(r=>({id:r.id,customerId:r.customer_id,paymentCode:r.payment_code,planName:r.plan_name_snapshot,durationMonths:r.duration_months_snapshot,deploymentName:r.deployment_name_snapshot,addons:typeof r.addons_snapshot==='string'?JSON.parse(r.addons_snapshot||'[]'):(r.addons_snapshot||[]),totalAmount:Number(r.total_amount),currency:r.currency_code,status:r.status,environmentStatus:r.environment_status||null,requestedAt:r.requested_at,whatsappSentAt:r.whatsapp_sent_at,paidAt:r.paid_at,customerName:r.customer_name,customerUsername:r.customer_username,customerEmail:r.customer_email}))});
 }catch(e){console.error('List subscription requests error:',e);return res.status(500).json({success:false,message:'تعذر تحميل طلبات الاشتراك.'});}
}

export async function confirmPaymentOrderController(req:AuthenticatedRequest,res:Response){
 let conn;
 try {
  conn=await db.pool.getConnection();
  await conn.beginTransaction();
  const code=String(req.params.code??'').trim();
  const [rows]:any=await conn.query("SELECT * FROM payment_orders WHERE payment_code=? FOR UPDATE",[code]);
  const order=rows[0];
  if(!order){await conn.rollback();return res.status(404).json({success:false,message:'طلب الدفع غير موجود.'});}
  if(!['pending','awaiting_confirmation'].includes(order.status)){await conn.rollback();return res.status(409).json({success:false,message:'تمت معالجة طلب الدفع مسبقًا أو أن حالته لا تسمح بالتأكيد.'});}
  const central=await ensureCentralSubscription(conn,req,order);
  await conn.query("UPDATE payment_orders SET status='paid',paid_at=CURRENT_TIMESTAMP,confirmed_by_master_admin_id=? WHERE id=?",[req.auth!.accountId,order.id]);
  await conn.query("INSERT INTO payment_order_events (payment_order_id,event_type,from_status,to_status,master_admin_id,metadata) VALUES (?,'confirmed_paid',?,'paid',?,?)",[order.id,order.status,req.auth!.accountId,JSON.stringify({customerId:order.customer_id,totalAmount:String(order.total_amount),currency:order.currency_code})]);
  await writeAuditLog(req,{actionCode:'UPDATE',entityTypeCode:'CUSTOMER',entityId:order.customer_id,tenantId:central.tenantId,description:`تأكيد استلام دفعة ${code} بقيمة ${order.total_amount} ${order.currency_code}`,metadata:{eventType:'payment_confirmed',tenantId:central.tenantId,subscriptionId:central.subscriptionId,paymentOrderId:order.id,paymentCode:code,customerId:order.customer_id,totalAmount:String(order.total_amount),currency:order.currency_code,fromStatus:order.status,toStatus:'paid'}},conn);
  const [confirmed]:any=await conn.query('SELECT paid_at FROM payment_orders WHERE id=?',[order.id]);
  await conn.commit();
  return res.json({success:true,status:'paid',central,paidAt:confirmed[0].paid_at,message:'تم تأكيد استلام الدفعة وتسجيلها في سجل النشاط.'});
 } catch(error) {
  if(conn)await conn.rollback();
  if(error instanceof EnvironmentRequestError)return res.status(error.status).json({success:false,message:error.message});
  if(['ER_NO_SUCH_TABLE','ER_BAD_FIELD_ERROR'].includes((error as any)?.code))return res.status(503).json({success:false,message:'طبّق ترحيل القاعدة المركزية قبل تأكيد الدفع. لم تُحفظ العملية.'});
  console.error('Confirm payment:',error);
  return res.status(500).json({success:false,message:'تعذر تأكيد عملية الدفع وتسجيل نشاطها.'});
 } finally {conn?.release();}
}

export async function getSubscriptionRequestController(req:AuthenticatedRequest,res:Response){
 const id=String(req.params.id??'');
 if(!/^[1-9][0-9]*$/.test(id)||!Number.isSafeInteger(Number(id)))return res.status(400).json({success:false,message:'رقم الاشتراك غير صالح.'});
 try{
  const [rows]=await db.query(`SELECT po.*,c.full_name customer_name,c.username customer_username,c.email customer_email,m.full_name confirmed_by_name,m.username confirmed_by_username FROM payment_orders po JOIN customers c ON c.id=po.customer_id LEFT JOIN master_admins m ON m.id=po.confirmed_by_master_admin_id WHERE po.id=? AND po.payment_purpose='initial_subscription' AND EXISTS (SELECT 1 FROM payment_order_events e WHERE e.payment_order_id=po.id AND e.event_type='sent_to_whatsapp') LIMIT 1`,[Number(id)]);
  const r=(rows as any[])[0];
  if(!r)return res.status(404).json({success:false,message:'طلب الاشتراك غير موجود.'});
  let addons:any[]=[];
  try{const value=typeof r.addons_snapshot==='string'?JSON.parse(r.addons_snapshot):r.addons_snapshot;if(Array.isArray(value))addons=value.filter(a=>a&&typeof a==='object').map(a=>({name:String(a.nameAr||a.name_ar||a.name||a.code||'إضافة'),price:a.price==null?null:String(a.price)}));}catch{}
  let planLimits:null|{maxTenants:number;maxSubscribers:number;maxNas:number}=null;
  try{const value=typeof r.plan_limits_snapshot==='string'?JSON.parse(r.plan_limits_snapshot):r.plan_limits_snapshot;if(value&&['maxTenants','maxSubscribers','maxNas'].every(key=>Number.isSafeInteger(value[key])&&value[key]>=0))planLimits={maxTenants:value.maxTenants,maxSubscribers:value.maxSubscribers,maxNas:value.maxNas};}catch{}
  const environment=await readEnvironmentSummary(db.query,r);
  return res.json({success:true,subscription:{environment,planLimits,id:r.id,customerId:r.customer_id,customerName:r.customer_name,customerUsername:r.customer_username,customerEmail:r.customer_email,paymentCode:r.payment_code,planName:r.plan_name_snapshot,durationMonths:r.duration_months_snapshot,deploymentName:r.deployment_name_snapshot,basePrice:String(r.base_price),addonsTotal:String(r.addons_total),totalAmount:String(r.total_amount),currency:r.currency_code,addons,status:r.status,requestedAt:r.requested_at,paidAt:r.paid_at,confirmedBy:r.confirmed_by_name||r.confirmed_by_username||null}});
 }catch(error){console.error('Subscription details:',error);return res.status(500).json({success:false,message:'تعذر تحميل تفاصيل الاشتراك.'});}
}
