import {requireInfrastructureReady,InfrastructureNotReady} from '../services/infrastructure-health.service';
import type { Response } from 'express';
import { db } from '../config/db';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import { writeAuditLog } from '../services/audit.service';
import { ensureCentralSubscription, readEnvironmentSummary, EnvironmentRequestError } from '../services/subscription-environment.service';

export async function requestEnvironmentController(req: AuthenticatedRequest, res: Response) {
  const id=String(req.params.id ?? '');
  if (!/^[1-9][0-9]*$/.test(id) || !Number.isSafeInteger(Number(id))) return res.status(400).json({success:false,message:'رقم الاشتراك غير صالح.'});
  let conn;
  try {
    conn=await db.pool.getConnection();
    await conn.beginTransaction();
    const [orders]:any=await conn.query('SELECT * FROM payment_orders WHERE id=? FOR UPDATE',[Number(id)]);
    const order=orders[0];
    if (!order) throw new EnvironmentRequestError(404,'طلب الاشتراك غير موجود.');
    if (!['paid','completed'].includes(order.status)) throw new EnvironmentRequestError(409,'يجب تأكيد الدفع قبل طلب إنشاء البيئة.');
    let initial=await readEnvironmentSummary((sql,params)=>conn!.query(sql,params),order);
    // Repeated clicks on an active request are successful reads, not new jobs/events.
    if (initial.registered && initial.job && ['queued','running'].includes(initial.job.status)) {
      await conn.commit();
      return res.json({success:true,environment:initial,message:'طلب إنشاء البيئة مسجل بالفعل.'});
    }
    if(!initial.canRequest&&!initial.blockedReason?.startsWith('افحص صحة البنية التحتية'))throw new EnvironmentRequestError(409,initial.blockedReason||'حالة البيئة لا تسمح بطلب الإنشاء.');
    const [deployment]:any=await conn.query('SELECT code FROM deployment_types WHERE id=?',[order.deployment_type_id]);
    if(deployment[0]?.code!=='shared_cloud')throw new EnvironmentRequestError(409,'مسار التوليد الحالي مخصص للكلاود المشتركة فقط.');
    await requireInfrastructureReady(initial.environmentId);
    initial=await readEnvironmentSummary((sql,params)=>conn!.query(sql,params),order);
    if (!initial.canRequest) throw new EnvironmentRequestError(409,initial.blockedReason || 'حالة البيئة لا تسمح بطلب الإنشاء.');
    const central=await ensureCentralSubscription(conn,req,order);
    order.tenant_id=central.tenantId;order.subscription_id=central.subscriptionId;
    const summary=await readEnvironmentSummary((sql,params)=>conn!.query(sql,params),order);
    if (!summary.canRequest) throw new EnvironmentRequestError(409,summary.blockedReason || 'حالة البيئة لا تسمح بطلب الإنشاء.');
    const key=`initial-environment:${central.environmentId}:${central.subscriptionId}`;
    const [jobs]:any=await conn.query('SELECT id,status FROM environment_provisioning_jobs WHERE idempotency_key=? FOR UPDATE',[key]);
    let jobId=jobs[0]?.id;
    if (jobs[0] && jobs[0].status !== 'failed') throw new EnvironmentRequestError(409,'يوجد طلب إنشاء سابق يحتاج متابعة؛ لن تُنشأ مهمة مكررة.');
    if (jobId) {
      await conn.query("UPDATE environment_provisioning_jobs SET status='queued',available_at=CURRENT_TIMESTAMP,lock_token=NULL,locked_until=NULL,finished_at=NULL,error_code=NULL,error_message=NULL WHERE id=?",[jobId]);
    } else {
      const [job]:any=await conn.query("INSERT INTO environment_provisioning_jobs (tenant_id,environment_id,subscription_id,payment_order_id,requested_by_master_admin_id,idempotency_key,status) VALUES (?,?,?,?,?,?,'queued')",[central.tenantId,central.environmentId,central.subscriptionId,order.id,req.auth!.accountId,key]);
      jobId=job.insertId;
    }
    await writeAuditLog(req,{actionCode:jobs[0]?'UPDATE':'CREATE',entityTypeCode:'PROVISIONING_JOB',entityId:jobId,tenantId:central.tenantId,description:jobs[0]?'إعادة طلب تجهيز البيئة بعد فشل المحاولة':'تسجيل طلب إنشاء البيئة بعد تأكيد الدفع',metadata:{eventType:jobs[0]?'environment_request_retried':'environment_requested',paymentOrderId:order.id,subscriptionId:central.subscriptionId,environmentId:central.environmentId,jobId}},conn);
    const environment=await readEnvironmentSummary((sql,params)=>conn!.query(sql,params),order);
    await conn.commit();
    return res.status(202).json({success:true,environment,message:'تم تسجيل طلب إنشاء البيئة؛ ستتولى خدمة التجهيز تنفيذه تلقائيًا. لم تبدأ مدة الاشتراك.'});
  } catch(error) {
    if (conn) await conn.rollback();
    if (error instanceof InfrastructureNotReady) return res.status(409).json({success:false,message:error.message});
    if (error instanceof EnvironmentRequestError) return res.status(error.status).json({success:false,message:error.message});
    if (['ER_NO_SUCH_TABLE','ER_BAD_FIELD_ERROR'].includes((error as any)?.code)) return res.status(503).json({success:false,message:'طبّق ترحيل القاعدة المركزية قبل طلب إنشاء البيئة.'});
    console.error('Environment request failed:',(error as any)?.code || 'UNKNOWN');
    return res.status(500).json({success:false,message:'تعذر تسجيل طلب إنشاء البيئة. لم تُحفظ العملية.'});
  } finally {conn?.release();}
}
