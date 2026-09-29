import { randomBytes } from 'crypto';
import { Response } from 'express';
import { db } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

const publicKeys=['contact_name','whatsapp_number','whatsapp_enabled','whatsapp_button_text','whatsapp_message_template','payment_instructions'];
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
 try{const body=req.body??{};const limits:Record<string,number>={contact_name:80,whatsapp_button_text:100,whatsapp_message_template:1000,payment_instructions:1500};if('whatsapp_number' in body){const phone=String(body.whatsapp_number??'').trim();if(phone&&!/^[0-9]{6,15}$/.test(phone))return res.status(400).json({success:false,message:'رقم WhatsApp يجب أن يحتوي على أرقام إنكليزية فقط من 6 إلى 15 رقمًا.'});if(body.whatsapp_enabled&&!phone)return res.status(400).json({success:false,message:'رقم WhatsApp مطلوب عند تفعيل التواصل عبر WhatsApp.'});}for(const key of publicKeys){if(!(key in body))continue;const value=key==='whatsapp_enabled'?(body[key]?'1':'0'):String(body[key]??'').trim();if(limits[key]&&value.length>limits[key])return res.status(400).json({success:false,message:'إحدى القيم المدخلة أطول من الحد المسموح.'});await db.query("UPDATE platform_settings SET setting_value=?,updated_by_master_admin_id=? WHERE setting_group='contact_payment' AND setting_key=?",[value,req.auth!.accountId,key]);}return getPaymentSettingsController(req,res);}
 catch(e){console.error(e);return res.status(500).json({success:false,message:'تعذر حفظ إعدادات التواصل والدفع.'});}
}
export async function createPaymentOrderController(req:AuthenticatedRequest,res:Response){
 const customerId=req.auth!.accountId,planId=Number(req.body?.planId),deploymentOptionId=Number(req.body?.deploymentOptionId),addonIds=Array.isArray(req.body?.addonIds)?req.body.addonIds.map(Number):[];
 if(!Number.isInteger(planId)||planId<1||!Number.isInteger(deploymentOptionId)||deploymentOptionId<1)return res.status(400).json({success:false,message:'بيانات الخطة أو الاستضافة غير صالحة.'});
 try{
  const [plans]=await db.query("SELECT p.id,p.name,p.duration_months,p.price,c.code currency_code FROM payment_plans p LEFT JOIN currencies c ON c.id=p.currency_id WHERE p.id=? AND p.status='active' LIMIT 1",[planId]);const plan=(plans as any[])[0];if(!plan)return res.status(404).json({success:false,message:'الخطة غير متاحة.'});
  const [opts]=await db.query("SELECT o.id,o.deployment_type_id,dt.name_ar FROM plan_deployment_options o JOIN deployment_types dt ON dt.id=o.deployment_type_id WHERE o.id=? AND o.plan_id=? AND o.status='active' LIMIT 1",[deploymentOptionId,planId]);const opt=(opts as any[])[0];if(!opt)return res.status(400).json({success:false,message:'خيار الاستضافة غير متاح.'});
  let addons:any[]=[];if(addonIds.length){const marks=addonIds.map(()=>'?').join(',');const [rows]=await db.query(`SELECT id,code,name_ar,price FROM plan_addons WHERE plan_id=? AND deployment_type_id=? AND status='active' AND id IN (${marks})`,[planId,opt.deployment_type_id,...addonIds]);addons=rows as any[];if(addons.length!==new Set(addonIds).size)return res.status(400).json({success:false,message:'إحدى القيم المضافة غير متاحة.'});}
  const base=Number(plan.price||0),addonsTotal=addons.reduce((s,a)=>s+Number(a.price||0),0),total=base+addonsTotal,code=paymentCode();
  const [result]:any=await db.query("INSERT INTO payment_orders (payment_code,customer_id,plan_id,deployment_type_id,payment_purpose,plan_name_snapshot,duration_months_snapshot,deployment_name_snapshot,base_price,addons_total,total_amount,currency_code,addons_snapshot,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'pending')",[code,customerId,planId,opt.deployment_type_id,'initial_subscription',plan.name,plan.duration_months,opt.name_ar,base,addonsTotal,total,plan.currency_code||'USD',JSON.stringify(addons.map(a=>({id:a.id,code:a.code,nameAr:a.name_ar,price:Number(a.price)})))]);
  await db.query("INSERT INTO payment_order_events (payment_order_id,event_type,to_status) VALUES (?,'created','pending')",[result.insertId]);
  return res.status(201).json({success:true,paymentOrder:{id:result.insertId,paymentCode:code,purpose:'initial_subscription',planName:plan.name,deploymentName:opt.name_ar,basePrice:base,addonsTotal,totalAmount:total,currency:plan.currency_code||'USD',addons}});
 }catch(e){console.error('Create payment order error:',e);return res.status(500).json({success:false,message:'تعذر إنشاء طلب الدفع.'});}
}

export async function getMyPaymentOrderController(req:AuthenticatedRequest,res:Response){
 try{const code=String(req.params.code??'').trim();const [rows]=await db.query("SELECT id,payment_code,payment_purpose,plan_name_snapshot,duration_months_snapshot,deployment_name_snapshot,base_price,addons_total,total_amount,currency_code,addons_snapshot,status,requested_at,expires_at FROM payment_orders WHERE payment_code=? AND customer_id=? LIMIT 1",[code,req.auth!.accountId]);const r=(rows as any[])[0];if(!r)return res.status(404).json({success:false,message:'طلب الدفع غير موجود.'});return res.json({success:true,paymentOrder:{id:r.id,paymentCode:r.payment_code,purpose:r.payment_purpose,planName:r.plan_name_snapshot,durationMonths:r.duration_months_snapshot,deploymentName:r.deployment_name_snapshot,basePrice:Number(r.base_price),addonsTotal:Number(r.addons_total),totalAmount:Number(r.total_amount),currency:r.currency_code,addons:typeof r.addons_snapshot==='string'?JSON.parse(r.addons_snapshot||'[]'):(r.addons_snapshot||[]),status:r.status,requestedAt:r.requested_at,expiresAt:r.expires_at}});}
 catch(e){console.error(e);return res.status(500).json({success:false,message:'تعذر تحميل طلب الدفع.'});}
}
export async function markPaymentOrderWhatsappController(req:AuthenticatedRequest,res:Response){
 try{const code=String(req.params.code??'').trim();const [rows]=await db.query("SELECT id,status FROM payment_orders WHERE payment_code=? AND customer_id=? LIMIT 1",[code,req.auth!.accountId]);const r=(rows as any[])[0];if(!r)return res.status(404).json({success:false,message:'طلب الدفع غير موجود.'});if(!['pending','awaiting_confirmation'].includes(r.status))return res.status(409).json({success:false,message:'حالة طلب الدفع لا تسمح بهذه العملية.'});if(r.status==='pending'){await db.query("UPDATE payment_orders SET status='awaiting_confirmation' WHERE id=?",[r.id]);await db.query("INSERT INTO payment_order_events (payment_order_id,event_type,from_status,to_status) VALUES (?,'sent_to_whatsapp','pending','awaiting_confirmation')",[r.id]);}return res.json({success:true,status:'awaiting_confirmation'});}
 catch(e){console.error(e);return res.status(500).json({success:false,message:'تعذر تحديث طلب الدفع.'});}
}

export async function listPaymentOrdersController(req:AuthenticatedRequest,res:Response){
 try{const [rows]=await db.query(`SELECT po.id,po.payment_code,po.payment_purpose,po.plan_name_snapshot,po.deployment_name_snapshot,po.total_amount,po.currency_code,po.status,po.requested_at,po.paid_at,po.completed_at,c.full_name customer_name,c.email customer_email FROM payment_orders po JOIN customers c ON c.id=po.customer_id ORDER BY po.id DESC`);return res.json({success:true,paymentOrders:(rows as any[]).map(r=>({id:r.id,paymentCode:r.payment_code,purpose:r.payment_purpose,planName:r.plan_name_snapshot,deploymentName:r.deployment_name_snapshot,totalAmount:Number(r.total_amount),currency:r.currency_code,status:r.status,requestedAt:r.requested_at,paidAt:r.paid_at,completedAt:r.completed_at,customerName:r.customer_name,customerEmail:r.customer_email}))});}
 catch(e){console.error(e);return res.status(500).json({success:false,message:'تعذر تحميل عمليات الدفع.'});}
}
export async function confirmPaymentOrderController(req:AuthenticatedRequest,res:Response){
 const conn=await db.getConnection();
 try{await conn.beginTransaction();const code=String(req.params.code??'').trim();const [rows]:any=await conn.query("SELECT id,status FROM payment_orders WHERE payment_code=? FOR UPDATE",[code]);const r=rows[0];if(!r){await conn.rollback();return res.status(404).json({success:false,message:'طلب الدفع غير موجود.'});}if(!['pending','awaiting_confirmation'].includes(r.status)){await conn.rollback();return res.status(409).json({success:false,message:'تمت معالجة طلب الدفع مسبقًا أو أن حالته لا تسمح بالتأكيد.'});}await conn.query("UPDATE payment_orders SET status='paid',paid_at=CURRENT_TIMESTAMP,confirmed_by_master_admin_id=? WHERE id=?",[req.auth!.accountId,r.id]);await conn.query("INSERT INTO payment_order_events (payment_order_id,event_type,from_status,to_status,master_admin_id) VALUES (?,'confirmed_paid',?,'paid',?)",[r.id,r.status,req.auth!.accountId]);await conn.commit();return res.json({success:true,status:'paid',message:'تم تأكيد استلام الدفعة.'});}
 catch(e){await conn.rollback();console.error(e);return res.status(500).json({success:false,message:'تعذر تأكيد عملية الدفع.'});}finally{conn.release();}
}
