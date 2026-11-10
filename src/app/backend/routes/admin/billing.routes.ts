import {listMasterNetworkIncidents} from '../../services/master-network-incidents.service';
import {listMasterNetworkHealth,requestMasterNetworkHealth} from '../../services/master-network-health.service';
import {checkMasterNetworkConnections,NetworkCheckError} from '../../services/master-network-tunnels.service';
import {manageNetworkAccess,RecoveryError} from '../../services/network-access-recovery.service';
import {requireAuthOrigin} from '../../middleware/auth-origin.middleware';
import {createManualEnvironment,listManualEnvironmentPlans} from '../../controllers/manual-environment.controller';
import {applySubscriptionChange,listSubscriptionChanges,readUpgradePaymentSettings,saveUpgradePaymentSettings} from '../../services/master-subscription-changes.service';
import {listMasterNetworks,getSubscriptionReminderSettings,saveSubscriptionReminderSettings} from '../../controllers/master-networks.controller';
import {deleteEnvironment} from '../../controllers/environment-delete.controller';
import {requestEnvironmentNotification} from '../../controllers/environment-notification.controller';
import { Router } from 'express';
import { authenticate,requireAccountType } from '../../middleware/auth.middleware';
import { getMySubscriptionsController,createPaymentOrderController,getMyPaymentOrderController,getPaymentSettingsController,getPublicPaymentSettingsController,listPaymentOrdersController,listSubscriptionRequestsController,getSubscriptionRequestController,markPaymentOrderWhatsappController,confirmPaymentOrderController,updatePaymentSettingsController,getMasterActivityController } from '../../controllers/billing.controller';
import { getCollectionReportController } from '../../controllers/payment-reports.controller';
import { requestEnvironmentController } from '../../controllers/environment.controller';
import { listSubscriptionPaymentsController } from '../../controllers/subscription-payments.controller';
const router=Router();
router.get('/admin/network-incidents',authenticate,requireAccountType('master_admin'),async(req,res)=>{
 res.set('Cache-Control','no-store');try{return res.json(await listMasterNetworkIncidents(req.query));}
 catch(error){return res.status(error instanceof RangeError?400:503).json({message:error instanceof RangeError?'خيارات تصفية سجل الأعطال غير صالحة.':'تعذر تحميل سجل أعطال الشبكات.'});}
});
router.get('/admin/network-health',authenticate,requireAccountType('master_admin'),async(_req,res)=>{
 res.set('Cache-Control','no-store');try{return res.json(await listMasterNetworkHealth());}catch{return res.status(503).json({message:'تعذر تحميل صحة الشبكات.'});}
});
router.post('/admin/network-health/:environmentId/check',authenticate,requireAccountType('master_admin'),requireAuthOrigin,async(req,res)=>{
 const raw=req.params.environmentId;if(!/^[1-9][0-9]*$/.test(raw)||!Number.isSafeInteger(Number(raw)))return res.status(400).json({message:'معرّف البيئة غير صالح.'});
 try{await requestMasterNetworkHealth(Number(raw));return res.status(202).json({message:'أُدرج طلب التحديث. تظهر نتائج قاعدة البيانات وAPI تدريجيًا؛ فحص OVPN يتبع دورة CHR الدورية.'});}
 catch(error){return res.status((error as Error)?.message==='NETWORK_HEALTH_NOT_READY'?409:503).json({message:'تعذر طلب الفحص؛ تأكد من جاهزية البيئة.'});}
});

router.get('/admin/manual-environment/plans',authenticate,requireAccountType('master_admin'),listManualEnvironmentPlans);
router.post('/admin/manual-environment',authenticate,requireAccountType('master_admin'),createManualEnvironment);
router.get('/admin/subscription-changes',authenticate,requireAccountType('master_admin'),async(_req,res)=>{
 try{res.set('Cache-Control','no-store');return res.json({items:await listSubscriptionChanges(),paymentSettings:await readUpgradePaymentSettings()});}
 catch{return res.status(503).json({message:'تعذر تحميل طلبات التجديد والترقية.'});}
});
router.get('/admin/subscription-changes/payment-settings',authenticate,requireAccountType('master_admin'),async(_req,res)=>{
 res.set('Cache-Control','no-store');
 try{return res.json({paymentSettings:await readUpgradePaymentSettings()});}
 catch{return res.status(503).json({message:'تعذر تحميل إعدادات طرق الدفع.'});}
});
router.put('/admin/subscription-changes/payment-settings',authenticate,requireAccountType('master_admin'),async(req,res)=>{
 try{return res.json({paymentSettings:await saveUpgradePaymentSettings(req.body)});}
 catch(error){if((error as Error).message==='UPGRADE_PAYMENT_SETTINGS')return res.status(400).json({message:'أدخل اسمًا فريدًا ورمز تحويل لكل طريقة دفع. الحد الأقصى 30 طريقة.'});return res.status(503).json({message:'تعذر حفظ إعدادات التحويل.'});}
});
router.post('/admin/subscription-changes/:tenantId/:kind/apply',authenticate,requireAccountType('master_admin'),async(req,res)=>{
 const {kind}=req.params;
 if(kind!=='renewal'&&kind!=='upgrade')return res.status(400).json({message:'نوع الطلب غير صالح.'});
 try{
  const result=await applySubscriptionChange(Number(req.params.tenantId),kind,String(req.body?.requestedAt??''),Number(req.body?.months),(req as import('../../middleware/auth.middleware').AuthenticatedRequest).auth!.accountId,req.body?.upgradeAmount,req.body?.upgradeCurrency,req.body?.transferMethod,req.body?.transferCode);
  return res.json({result});
 }catch(error){
  const code=(error as Error).message;
  const messages:Record<string,string>={
   UPGRADE_AMOUNT_INPUT:'أدخل قيمة ترقية صحيحة، أو صفرًا للترقية المجانية.',
   UPGRADE_CURRENCY_INPUT:'اختر عملة الترقية.',
   UPGRADE_PAYMENT_SETTINGS:'طريقة التحويل غير متاحة أو تغيرت. حدّث الطلب واختر طريقة من القائمة.',
   CHANGE_INPUT:'اختر مدة تمديد من شهر إلى 120 شهرًا.',
   CHANGE_STALE:'تغير الطلب أو الرخصة. حدّث القائمة وراجع الطلب.',
   CHANGE_BUSY:'تجري معالجة عملية أخرى. أعد المحاولة بعد اكتمالها.',
   CHANGE_RENEW_FIRST:'جدّد الاشتراك المنتهي قبل اعتماد ترقية السعة.',
  };
  console.error('[subscription-change]',{tenantId:Number(req.params.tenantId),code:code.startsWith('CHANGE_')?code:'APPLY_FAILED'});
  return res.status(code==='CHANGE_INPUT'?400:409).json({message:messages[code]||'تعذر إكمال التطبيق والتحقق. حدّث القائمة ثم استكمل العملية من الطلب نفسه.'});
 }
});

router.get('/admin/subscription-reminders',authenticate,requireAccountType('master_admin'),getSubscriptionReminderSettings);
router.put('/admin/subscription-reminders',authenticate,requireAccountType('master_admin'),saveSubscriptionReminderSettings);
router.get('/admin/networks',authenticate,requireAccountType('master_admin'),listMasterNetworks);
router.post('/admin/networks/:slug/connection-check',authenticate,requireAccountType('master_admin'),requireAuthOrigin,async(req,res)=>{
 res.set('Cache-Control','no-store');
 try{
  const result=await checkMasterNetworkConnections(String(req.params.slug));
  return res.json(result);
 }catch(error){
  if(error instanceof NetworkCheckError){
   if(error.retryAfter)res.set('Retry-After',String(error.retryAfter));
   return res.status(error.status).json({message:error.message,retryAfter:error.retryAfter});
  }
  console.error('[master-network-check]',{code:(error as {code?:string})?.code||'UNAVAILABLE'});
  return res.status(503).json({message:'تعذر إتمام فحص الاتصال. أعد المحاولة بعد قليل.'});
 }
});
router.get('/admin/networks/:slug/access-recovery',authenticate,requireAccountType('master_admin'),async(req,res)=>{
 res.set('Cache-Control','no-store');
 try{return res.json(await manageNetworkAccess(req,String(req.params.slug),'read'));}
 catch(e){return res.status(e instanceof RecoveryError?e.status:409).json({message:e instanceof RecoveryError?e.message:'تعذر قراءة بيانات مدير الشبكة.'});}
});
router.post('/admin/networks/:slug/access-recovery',authenticate,requireAccountType('master_admin'),requireAuthOrigin,async(req,res)=>{
 res.set('Cache-Control','no-store');
 const action=req.body?.action;
 if(action!=='issue'&&action!=='revoke')return res.status(422).json({message:'إجراء الاستعادة غير صالح.'});
 try{return res.json(await manageNetworkAccess(req,String(req.params.slug),action));}
 catch(e){return res.status(e instanceof RecoveryError?e.status:409).json({message:e instanceof RecoveryError?e.message:'تعذر إكمال إجراء الاستعادة. حدّث البيانات وأعد المحاولة.'});}
});
router.get('/admin/subscriptions/:id/payments',authenticate,requireAccountType('master_admin'),listSubscriptionPaymentsController);
router.delete('/admin/subscriptions/:id/environment',authenticate,requireAccountType('master_admin'),deleteEnvironment);
router.post('/admin/subscriptions/:id/environment/send-details',authenticate,requireAccountType('master_admin'),requestEnvironmentNotification);
router.post('/admin/subscriptions/:id/environment',authenticate,requireAccountType('master_admin'),requestEnvironmentController);
router.get('/admin/collection-report',authenticate,requireAccountType('master_admin'),getCollectionReportController);
router.get('/settings/public',authenticate,requireAccountType('customer'),getPublicPaymentSettingsController);
router.post('/orders',authenticate,requireAccountType('customer'),createPaymentOrderController);
router.get('/subscriptions/mine',authenticate,requireAccountType('customer'),getMySubscriptionsController);
router.get('/orders/:code',authenticate,requireAccountType('customer'),getMyPaymentOrderController);
router.post('/orders/:code/whatsapp',authenticate,requireAccountType('customer'),markPaymentOrderWhatsappController);
router.get('/admin/activity',authenticate,requireAccountType('master_admin'),getMasterActivityController);
router.get('/admin/orders',authenticate,requireAccountType('master_admin'),listPaymentOrdersController);
router.get('/admin/subscriptions/:id',authenticate,requireAccountType('master_admin'),getSubscriptionRequestController);
router.get('/admin/subscriptions',authenticate,requireAccountType('master_admin'),listSubscriptionRequestsController);
router.get('/admin/customers/:customerId/subscriptions',authenticate,requireAccountType('master_admin'),listSubscriptionRequestsController);
router.post('/admin/orders/:code/confirm',authenticate,requireAccountType('master_admin'),confirmPaymentOrderController);
router.get('/settings',authenticate,requireAccountType('master_admin'),getPaymentSettingsController);
router.patch('/settings',authenticate,requireAccountType('master_admin'),updatePaymentSettingsController);
export default router;
