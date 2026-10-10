import {readInfrastructureReport} from './infrastructure-health.service';
import { randomBytes } from 'crypto';
import type { PoolConnection } from 'mysql2/promise';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import { writeAuditLog } from './audit.service';

export class EnvironmentRequestError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function parseSnapshot(value: unknown): any {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return null; }
}
export function validLimits(value: unknown) {
  const limits = parseSnapshot(value);
  return limits && ['maxTenants','maxSubscribers','maxNas'].every(key => Number.isSafeInteger(limits[key]) && limits[key] >= 0) ? {maxTenants:limits.maxTenants,maxSubscribers:limits.maxSubscribers,maxNas:limits.maxNas} : null;
}

// Called only with the payment row locked, in the same transaction as confirmation.
// Repeated calls reuse the recorded network; legacy links must be explicitly consistent.
export async function ensureCentralSubscription(conn: PoolConnection, req: AuthenticatedRequest, order: any) {
  if (order.payment_purpose !== 'initial_subscription') {
    throw new EnvironmentRequestError(409, 'هذا المسار مخصص للاشتراك الأول. معالجة التجديد والإضافات ليست مفعّلة بعد.');
  }
  if (!order.deployment_type_id || !Number.isSafeInteger(order.duration_months_snapshot) || order.duration_months_snapshot < 1) {
    throw new EnvironmentRequestError(409, 'بيانات الاستضافة أو مدة الشراء ناقصة؛ راجع الطلب قبل المتابعة.');
  }
  const [owners]: any = await conn.query('SELECT id,full_name FROM customers WHERE id=? FOR UPDATE', [order.customer_id]);
  if (!owners[0]) throw new EnvironmentRequestError(409, 'مالك طلب الدفع غير موجود.');
  let createdPeriod=false;
  let tenantId = order.tenant_id;
  let subscriptionId = order.subscription_id;
  if (subscriptionId) {
    const [periods]: any = await conn.query('SELECT * FROM subscriptions WHERE id=? FOR UPDATE', [subscriptionId]);
    const period = periods[0];
    if (!period || (tenantId && tenantId !== period.tenant_id)) throw new EnvironmentRequestError(409, 'ربط الشبكة والاشتراك يحتاج مراجعة.');
    tenantId = period.tenant_id;
    const [networks]: any = await conn.query('SELECT * FROM tenants WHERE id=? FOR UPDATE', [tenantId]);
    if (!networks[0] || networks[0].customer_id !== order.customer_id) throw new EnvironmentRequestError(409, 'ملكية الشبكة القديمة تحتاج تثبيتًا قبل المتابعة.');
    if (period.status !== 'pending' || period.starts_at || period.expires_at || networks[0].archived_at) throw new EnvironmentRequestError(409,'الاشتراك ليس بانتظار التجهيز الأول أو أن الشبكة مؤرشفة.');
    if (period.plan_id !== order.plan_id || period.deployment_type_id !== order.deployment_type_id || period.duration_months_snapshot !== order.duration_months_snapshot || JSON.stringify(validLimits(period.plan_limits_snapshot)) !== JSON.stringify(validLimits(order.plan_limits_snapshot))) {
      throw new EnvironmentRequestError(409, 'نسخة الاشتراك لا تطابق طلب الدفع؛ يلزم مراجعة الربط القديم.');
    }
  } else {
    // Never attach another purchase to an existing network by name or owner alone.
    if (tenantId) throw new EnvironmentRequestError(409, 'الشبكة مرتبطة بالطلب دون اشتراك؛ راجع الربط قبل المتابعة.');
    const license = 'RL-' + randomBytes(16).toString('hex').toUpperCase();
    const slug = 'network-' + randomBytes(12).toString('hex');
    const [network]: any = await conn.query("INSERT INTO tenants (customer_id,license_number,name,slug,status) VALUES (?,?,?,?,'disabled')", [order.customer_id,license,owners[0].full_name,slug]);
    tenantId = network.insertId;
    const limits = validLimits(order.plan_limits_snapshot);
    const [period]: any = await conn.query("INSERT INTO subscriptions (tenant_id,plan_id,deployment_type_id,plan_limits_snapshot,duration_months_snapshot,status,starts_at,expires_at) VALUES (?,?,?,?,?,'pending',NULL,NULL)", [tenantId,order.plan_id,order.deployment_type_id,limits ? JSON.stringify(limits) : null,order.duration_months_snapshot]);
    subscriptionId = period.insertId;
    createdPeriod=true;
    await conn.query("INSERT INTO subscription_licenses (tenant_id,subscription_id,license_key,status) VALUES (?,?,?,'pending')", [tenantId,subscriptionId,license]);
  }
  await conn.query('UPDATE payment_orders SET tenant_id=?,subscription_id=? WHERE id=?', [tenantId,subscriptionId,order.id]);
  if (createdPeriod) {
    const addons=parseSnapshot(order.addons_snapshot) ?? [];
    if (!Array.isArray(addons)) throw new EnvironmentRequestError(409,'نسخة الإضافات المحفوظة غير صالحة؛ راجع الطلب.');
    for (const addon of addons) {
      if (!Number.isSafeInteger(addon?.id) || addon.id<1 || addon.price == null || !Number.isFinite(Number(addon.price)) || Number(addon.price)<0) throw new EnvironmentRequestError(409,'بيانات إحدى الإضافات القديمة ناقصة؛ راجع الطلب.');
      const [definitions]:any=await conn.query('SELECT id FROM plan_addons WHERE id=? AND plan_id=? AND deployment_type_id=?',[addon.id,order.plan_id,order.deployment_type_id]);
      if (!definitions[0]) throw new EnvironmentRequestError(409,'تعريف إضافة مشتراة غير موجود أو تغير ربطه؛ يلزم مراجعة الطلب.');
      const [purchase]:any=await conn.query("INSERT INTO subscription_addons (tenant_id,subscription_id,plan_addon_id,payment_order_id,addon_code_snapshot,addon_name_snapshot,quantity,nas_capacity_increment,unit_price_snapshot,currency_code_snapshot,status) VALUES (?,?,?,?,?,?,1,0,?,?,'pending')",[tenantId,subscriptionId,addon.id,order.id,String(addon.code || '').slice(0,60),String(addon.nameAr || addon.name_ar || addon.code || '').slice(0,150),String(addon.price),order.currency_code]);
      await writeAuditLog(req,{actionCode:'CREATE',entityTypeCode:'SUBSCRIPTION_ADDON',entityId:purchase.insertId,tenantId,description:'حفظ إضافة مشتراة ضمن الاشتراك المنتظر',metadata:{paymentOrderId:order.id,subscriptionId,planAddonId:addon.id}},conn);
    }
  }
  const [licenses]: any = await conn.query('SELECT l.license_key,l.subscription_id,t.license_number FROM subscription_licenses l JOIN tenants t ON t.id=l.tenant_id WHERE l.tenant_id=? FOR UPDATE', [tenantId]);
  if (!licenses[0] || licenses[0].license_key !== licenses[0].license_number || licenses[0].subscription_id !== subscriptionId) throw new EnvironmentRequestError(409, 'الرخصة لا تطابق شبكة واشتراك الطلب؛ راجع السجل قبل المتابعة.');
  const [environments]: any = await conn.query('SELECT id,deployment_type_id FROM tenant_environments WHERE tenant_id=? FOR UPDATE', [tenantId]);
  let environmentId = environments[0]?.id;
  if (environmentId && environments[0].deployment_type_id !== order.deployment_type_id) throw new EnvironmentRequestError(409, 'استضافة البيئة لا تطابق الاستضافة المحفوظة عند الشراء.');
  if (!environmentId) {
    const [environment]: any = await conn.query("INSERT INTO tenant_environments (tenant_id,deployment_type_id,status) VALUES (?,?,'pending')", [tenantId,order.deployment_type_id]);
    environmentId = environment.insertId;
    await writeAuditLog(req,{actionCode:'CREATE',entityTypeCode:'TENANT_ENVIRONMENT',entityId:environmentId,tenantId,description:createdPeriod?'تثبيت الشبكة والاشتراك والرخصة وسجل البيئة دون بدء المدة':'إضافة سجل بيئة بانتظار طلب الإنشاء',metadata:{eventType:'environment_registered',paymentOrderId:order.id,subscriptionId,networkCreated:createdPeriod,licenseNumber:licenses[0].license_key}},conn);
  }
  return {tenantId,subscriptionId,environmentId,licenseNumber:licenses[0].license_key};
}

export type EnvironmentSummary = {
  registered:boolean;canRequest:boolean;blockedReason:string|null;
  tenantId?:number;subscriptionId?:number;networkName?:string;licenseNumber?:string;licenseStatus?:string;
  subscriptionStatus?:string;startsAt?:string|null;expiresAt?:string|null;environmentId?:number;
  status?:string;systemUrl?:string|null;readyAt?:string|null;
  job?:{id:number;status:string;currentStep:string|null;attemptCount:number;errorCode:string|null}|null;
  canSendDetails?:boolean;
  health?:{databaseName:string|null;reportedAt:string|null;lastSeenAt:string|null;onlineUsers:number|null;activeSessions:number|null;databaseStatus:string;radiusStatus:string};
};
// Read one network summary from core; never fan out to customer databases.
async function readEnvironmentSummaryCore(query: (sql: string, params?: any[]) => Promise<any>, order: any): Promise<EnvironmentSummary> {
  if (!order.tenant_id || !order.subscription_id) {
    const blockedReason = !['paid','completed'].includes(order.status) ? 'يتاح إنشاء البيئة بعد تأكيد الدفع.' : !validLimits(order.plan_limits_snapshot) ? 'حدود الشراء القديمة غير محفوظة؛ راجع الطلب قبل التجهيز.' : !order.deployment_type_id || !Number.isSafeInteger(order.duration_months_snapshot) || order.duration_months_snapshot < 1 ? 'بيانات الاستضافة أو مدة الشراء ناقصة.' : null;
    return {registered:false,canRequest:!blockedReason,blockedReason};
  }
  const [rows]: any = await query(`SELECT t.id tenant_id,t.name,t.license_number,t.customer_id,t.status tenant_status,t.archived_at tenant_archived_at,
    s.id subscription_id,s.plan_id,s.status subscription_status,s.starts_at,s.expires_at,s.plan_limits_snapshot,s.duration_months_snapshot,s.deployment_type_id,
    e.id environment_id,e.deployment_type_id environment_deployment_type_id,e.status environment_status,e.system_url,e.ready_at,e.archived_at environment_archived_at,
    l.license_key,l.status license_status,l.subscription_id license_subscription_id,
    d.db_name,h.reported_at,h.last_seen_at,h.online_users_count,h.active_sessions_count,h.database_status,h.radius_status,
    (SELECT COUNT(*) FROM environment_notifications n WHERE n.environment_id=e.id AND n.subscription_id=s.id AND n.status IN ('pending','failed') AND n.initial_username IS NOT NULL AND n.initial_password_encrypted IS NOT NULL AND n.credentials_expires_at>CURRENT_TIMESTAMP) notification_ready,
    j.id job_id,j.status job_status,j.current_step,j.error_code,j.error_message,j.attempt_count
    FROM tenants t JOIN subscriptions s ON s.tenant_id=t.id AND s.id=?
    LEFT JOIN subscription_licenses l ON l.tenant_id=t.id
    LEFT JOIN tenant_environments e ON e.tenant_id=t.id
    LEFT JOIN tenant_databases d ON d.id=e.tenant_database_id AND d.tenant_id=t.id
    LEFT JOIN tenant_environment_status h ON h.environment_id=e.id
    LEFT JOIN environment_provisioning_jobs j ON j.id=(SELECT MAX(j2.id) FROM environment_provisioning_jobs j2 WHERE j2.environment_id=e.id)
    WHERE t.id=? LIMIT 1`, [order.subscription_id,order.tenant_id]);
  const r = rows[0];
  if (!r) return {registered:false,canRequest:false,blockedReason:'الربط المركزي يحتاج مراجعة.'};
  let blockedReason: string | null = null;
  if (!['paid','completed'].includes(order.status)) blockedReason='يتاح إنشاء البيئة بعد تأكيد الدفع.';
  else if (r.customer_id !== order.customer_id || r.license_key !== r.license_number || r.license_subscription_id !== r.subscription_id) blockedReason='ملكية الشبكة أو الرخصة تحتاج مراجعة.';
  else if (!['active','disabled'].includes(r.tenant_status) || r.license_status !== 'pending') blockedReason='حالة الشبكة أو الرخصة لا تسمح بالتجهيز الأول.';
  else if (r.tenant_archived_at || r.environment_archived_at) blockedReason='الشبكة أو البيئة مؤرشفة.';
  else if (!validLimits(r.plan_limits_snapshot) || !validLimits(order.plan_limits_snapshot)) blockedReason='حدود الشراء القديمة غير محفوظة؛ يلزم تثبيتها دون استخدام حدود الخطة الحالية تلقائيًا.';
  else if (r.plan_id !== order.plan_id || (r.environment_id && r.environment_deployment_type_id !== order.deployment_type_id) || r.deployment_type_id !== order.deployment_type_id || r.duration_months_snapshot !== order.duration_months_snapshot || JSON.stringify(validLimits(r.plan_limits_snapshot)) !== JSON.stringify(validLimits(order.plan_limits_snapshot))) blockedReason='نسخة الاشتراك لا تطابق بيانات الشراء.';
  else if (r.subscription_status !== 'pending' || r.starts_at || r.expires_at) blockedReason='الاشتراك لم يعد بانتظار التجهيز.';
  else if (r.environment_status === 'ready') blockedReason='البيئة جاهزة بالفعل.';
  else if (['queued','running'].includes(r.job_status)) blockedReason='يوجد طلب إنشاء قيد المتابعة.';
  else if (r.environment_status === 'provisioning') blockedReason='البيئة قيد التجهيز.';
  return {registered:true,tenantId:r.tenant_id,subscriptionId:r.subscription_id,networkName:r.name,licenseNumber:r.license_number,licenseStatus:r.license_status,
    subscriptionStatus:r.subscription_status,startsAt:r.starts_at,expiresAt:r.expires_at,environmentId:r.environment_id,status:r.environment_status || 'pending',systemUrl:r.system_url,readyAt:r.ready_at,
    canSendDetails:process.env.ENVIRONMENT_NOTIFICATION_WORKER_ENABLED==='true'&&r.environment_status==='ready'&&r.job_status==='success'&&r.subscription_status==='active'&&r.license_status==='active'&&Boolean(r.system_url)&&r.database_status==='healthy'&&r.radius_status==='healthy'&&Boolean(r.reported_at)&&Date.now()-new Date(r.reported_at).getTime()>=0&&Date.now()-new Date(r.reported_at).getTime()<90000&&Boolean(r.expires_at)&&new Date(r.expires_at).getTime()>Date.now()&&r.notification_ready>0,
    canRequest:!blockedReason,blockedReason,job:r.job_id ? {id:r.job_id,status:r.job_status,currentStep:r.current_step,attemptCount:r.attempt_count,errorCode:r.error_code} : null,
    health:{databaseName:r.db_name||null,reportedAt:r.reported_at,lastSeenAt:r.last_seen_at,onlineUsers:r.online_users_count,activeSessions:r.active_sessions_count,databaseStatus:r.database_status || 'unknown',radiusStatus:r.radius_status || 'unknown'}};
}

export async function readEnvironmentSummary(query:(sql:string,params?:any[])=>Promise<any>,order:any):Promise<EnvironmentSummary>{
 const summary=await readEnvironmentSummaryCore(query,order);
 if(!summary.canRequest)return summary;
 const [types]:any=await query('SELECT code FROM deployment_types WHERE id=?',[order.deployment_type_id]);
 if(types[0]?.code!=='shared_cloud')return {...summary,canRequest:false,blockedReason:'مسار التوليد الحالي مخصص للكلاود المشتركة فقط.'};
 const report=await readInfrastructureReport();
 if(!report?.ready)return {...summary,canRequest:false,blockedReason:'افحص صحة البنية التحتية وأكمل جميع الشروط؛ صلاحية الفحص دقيقة واحدة.'};
 return summary;
}
