import {randomBytes} from 'crypto';
import bcrypt from 'bcryptjs';
import type {Response} from 'express';
import {db} from '../config/db';
import type {AuthenticatedRequest} from '../middleware/auth.middleware';
import {writeAuditLog} from '../services/audit.service';
import {requireInfrastructureReady,InfrastructureNotReady} from '../services/infrastructure-health.service';
import {ensureCentralSubscription,EnvironmentRequestError,validLimits} from '../services/subscription-environment.service';

const planSql=`SELECT p.id,p.name,p.duration_months,p.max_tenants,p.max_subscribers,p.max_nas,c.code currency_code
 FROM payment_plans p LEFT JOIN currencies c ON c.id=p.currency_id
 WHERE p.status='active' AND EXISTS(
  SELECT 1 FROM plan_deployment_options o JOIN deployment_types d ON d.id=o.deployment_type_id
  WHERE o.plan_id=p.id AND o.status='active' AND d.code='shared_cloud'
 )`;

export async function listManualEnvironmentPlans(_req:AuthenticatedRequest,res:Response){
 res.set('Cache-Control','no-store');
 try{const [plans]=await db.query(planSql+' ORDER BY p.name,p.id');return res.json({plans});}
 catch{return res.status(503).json({message:'تعذر تحميل الخطط المتاحة للتجهيز.'});}
}

export async function createManualEnvironment(req:AuthenticatedRequest,res:Response){
 const body=req.body??{},requestId=String(body.requestId??'');
 const networkName=String(body.networkName??'').trim();
 const fullName=String(body.fullName??'').trim(),email=String(body.email??'').trim().toLowerCase();
 const phone=String(body.phone??'').replace(/\s+/g,''),country=String(body.country??'').trim();
 const password=typeof body.password==='string'?body.password:'';
 const existing=body.customerMode==='existing',custom=body.planMode==='custom';
 if(!['new','existing'].includes(body.customerMode)||!['plan','custom'].includes(body.planMode)||!/^[a-f0-9]{32}$/.test(requestId)||!networkName||networkName.length>150||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
  return res.status(400).json({message:'راجع اسم الشبكة والبريد الإلكتروني وخيارات الطلب.'});
 }
 if(!existing&&(!fullName||fullName.length>150||!/^\+?[0-9]{7,15}$/.test(phone)||!country||country.length>100||password.length<8||Buffer.byteLength(password,'utf8')>72)){
  return res.status(400).json({message:'أدخل اسم العميل والدولة ورقم هاتف دوليًا، وكلمة مرور من 8 أحرف على الأقل وبحد أقصى 72 بايت.'});
 }
 const paymentCode='MAN-RL-'+requestId;
 let conn:Awaited<ReturnType<typeof db.pool.getConnection>>|undefined;
 try{
  const [previous]:any=await db.query("SELECT id FROM payment_orders WHERE payment_code=? AND status='manual_authorized'",[paymentCode]);
  if(previous[0])return res.json({orderId:previous[0].id});
  await requireInfrastructureReady();
  const passwordHash=existing?null:await bcrypt.hash(password,12);
  conn=await db.pool.getConnection();
  await conn.beginTransaction();
  const [deployment]:any=await conn.query("SELECT id,name_ar FROM deployment_types WHERE code='shared_cloud' LIMIT 1");
  if(!deployment[0])throw new EnvironmentRequestError(409,'الاستضافة المشتركة غير مهيأة.');
  let planId:number|null=null,planName='اشتراك مخصص',currency='USD';
  let duration=Number(body.duration),limits=null;
  if(custom){
   if(typeof body.duration!=='number'||typeof body.maxPppoe!=='number'||typeof body.maxNas!=='number'||!Number.isSafeInteger(body.maxNas)||body.maxNas<0||body.maxNas>1024)throw new EnvironmentRequestError(400,'أدخل حدودًا صحيحة. الحد المخصص لأجهزة NAS من 0 إلى 1024.');
   limits=validLimits({maxTenants:0,maxSubscribers:body.maxPppoe,maxNas:body.maxNas});
  }else{
   planId=Number(body.planId);
   if(!Number.isSafeInteger(planId)||planId<1)throw new EnvironmentRequestError(400,'اختر خطة صالحة.');
   const [plans]:any=await conn.query(planSql+' AND p.id=?',[planId]);
   const plan=plans[0];
   if(!plan)throw new EnvironmentRequestError(409,'الخطة غير متاحة للاستضافة المشتركة.');
   duration=Number(plan.duration_months);planName=plan.name;currency=plan.currency_code||'USD';
   limits=validLimits({maxTenants:Number(plan.max_tenants),maxSubscribers:Number(plan.max_subscribers),maxNas:Number(plan.max_nas)});
  }
  if(!limits||!Number.isSafeInteger(duration)||duration<1||duration>120)throw new EnvironmentRequestError(400,'أدخل حدودًا صحيحة ومدة من شهر إلى 120 شهرًا.');
  let customerId:number;
  if(existing){
   const [customers]:any=await conn.query("SELECT id FROM customers WHERE email=? AND status='active' FOR UPDATE",[email]);
   if(!customers[0])throw new EnvironmentRequestError(404,'لم يُعثر على عميل نشط بهذا البريد.');
   customerId=Number(customers[0].id);
  }else{
   const [duplicates]:any=await conn.query('SELECT id FROM customers WHERE email=? OR phone=? LIMIT 1',[email,phone]);
   if(duplicates[0])throw new EnvironmentRequestError(409,'البريد أو الهاتف مستخدم. اختر عميلًا موجودًا بالبريد المسجل.');
   const [result]:any=await conn.query('INSERT INTO customers (full_name,email,username,phone,country,password_hash) VALUES (?,?,?,?,?,?)',[fullName,email,'rl_'+randomBytes(8).toString('hex'),phone,country,passwordHash]);
   customerId=Number(result.insertId);
  }
  if(limits.maxTenants>0){
   const [networks]:any=await conn.query('SELECT COUNT(*) total FROM tenants WHERE customer_id=? AND archived_at IS NULL',[customerId]);
   if(Number(networks[0].total)>=limits.maxTenants)throw new EnvironmentRequestError(409,'بلغ العميل حد الشبكات في الخطة المختارة.');
  }
  const [result]:any=await conn.query(`INSERT INTO payment_orders
   (payment_code,customer_id,plan_id,deployment_type_id,payment_purpose,plan_name_snapshot,duration_months_snapshot,deployment_name_snapshot,currency_code,addons_snapshot,plan_limits_snapshot,status)
   VALUES (?,?,?,?,'initial_subscription',?,?,?,?,?,?,'manual_authorized')`,
   [paymentCode,customerId,planId,deployment[0].id,planName,duration,deployment[0].name_ar,currency,JSON.stringify([]),JSON.stringify(limits)]);
  const order={id:result.insertId,customer_id:customerId,plan_id:planId,deployment_type_id:deployment[0].id,payment_purpose:'initial_subscription',duration_months_snapshot:duration,plan_limits_snapshot:limits,addons_snapshot:[],currency_code:currency};
  const central=await ensureCentralSubscription(conn,req,order);
  await conn.query('UPDATE tenants SET name=? WHERE id=?',[networkName,central.tenantId]);
  const [job]:any=await conn.query(`INSERT INTO environment_provisioning_jobs
   (tenant_id,environment_id,subscription_id,payment_order_id,requested_by_master_admin_id,idempotency_key,status)
   VALUES (?,?,?,?,?,?,'queued')`,[central.tenantId,central.environmentId,central.subscriptionId,order.id,req.auth!.accountId,`initial-environment:${central.environmentId}:${central.subscriptionId}`]);
  await writeAuditLog(req,{actionCode:'CREATE',entityTypeCode:'PROVISIONING_JOB',entityId:job.insertId,tenantId:central.tenantId,description:'اعتماد إداري لتجهيز بيئة دون تسجيل دفعة',metadata:{eventType:'manual_environment_requested',customerId,subscriptionId:central.subscriptionId,environmentId:central.environmentId,paymentOrderId:order.id,custom}},conn);
  await conn.commit();
  return res.status(202).json({orderId:order.id,message:'تم تسجيل طلب توليد البيئة.'});
 }catch(error){
  if(conn)await conn.rollback().catch(()=>{});
  if(error instanceof InfrastructureNotReady)return res.status(409).json({message:error.message,code:error.code});
  if(error instanceof EnvironmentRequestError)return res.status(error.status).json({message:error.message});
  const code=(error as {code?:string}).code;
  if(code==='ER_DUP_ENTRY'){
   const [previous]:any=await db.query("SELECT id FROM payment_orders WHERE payment_code=? AND status='manual_authorized'",[paymentCode]).catch(()=>[[]]);
   if(previous[0])return res.json({orderId:previous[0].id});
   return res.status(409).json({message:'البريد الإلكتروني أو الهاتف مستخدم مسبقًا.'});
  }
  if(['ER_BAD_NULL_ERROR','ER_TRUNCATED_WRONG_VALUE_FOR_FIELD','WARN_DATA_TRUNCATED'].includes(code??''))return res.status(503).json({message:'تحقق من تطبيق ترحيل التجهيز اليدوي على القاعدة المركزية.'});
  console.error('[manual-environment]',{code:code||'UNKNOWN'});
  return res.status(500).json({message:'تعذر تسجيل طلب التجهيز. يمكنك إعادة المحاولة من النموذج نفسه.'});
 }finally{conn?.release();}
}
