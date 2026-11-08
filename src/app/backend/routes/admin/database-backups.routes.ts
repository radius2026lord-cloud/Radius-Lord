import {requestVerification,verificationSummary} from '../../services/database-backup-verification.service';
import {createReadStream} from 'fs';
import {archiveSnapshot,archivePreview,beginArchive,readArchive,archiveDownload} from '../../services/database-backup-archive.service';
import {backupFilename} from '../../services/database-backup-filename.service';
import {listBackupBatches,backupBatchDetails,retryBackupBatch,type BackupBatchFilters} from '../../services/database-backup-batches.service';
import {Router,type Response} from 'express';
import {pipeline} from 'stream/promises';
import {requireAccountType,type AuthenticatedRequest} from '../../middleware/auth.middleware';
import {requireAuthOrigin} from '../../middleware/auth-origin.middleware';
import {backupPolicy,restartFailedBackup,BackupError,saveBackupPolicy,requestBackups,backupForDownload,retryDelivery,reconcileBackup} from '../../services/database-backups.service';
import {CloudError,cloudPublic,saveCloudSettings,testCloud,beginDriveConnection,finishDriveConnection} from '../../services/database-backup-cloud.service';
import {backupStream,backupRemote} from '../../services/database-backup-remote.service';
import {writeMasterAdminAuditLog} from '../../services/audit.service';
import {renewVerifiedSession,writeSessionCookie} from '../../services/session-policy.service';
import {env} from '../../config/env';

const router=Router();
router.use(requireAccountType('master_admin'),requireAuthOrigin);
function action(work:(req:AuthenticatedRequest,res:Response)=>Promise<unknown>){
 return async(req:import('express').Request,res:Response)=>{
  res.set('Cache-Control','no-store');
  try{return res.json(await work(req as AuthenticatedRequest,res));}
  catch(error){return res.status(error instanceof BackupError?error.status:error instanceof CloudError?422:503).json({message:error instanceof BackupError||error instanceof CloudError?error.message:'تعذر إكمال عملية النسخ. راجع اتصال الخادم ثم أعد المحاولة.'});}
 };
}
async function audit(req:AuthenticatedRequest,operation:string,description:string,metadata?:unknown){
 await writeMasterAdminAuditLog(req,req.auth!.accountId,{actionCode:'UPDATE',entityTypeCode:'DATABASE_SERVER',description,metadata:{operation,details:metadata}});
}
function filters(req:AuthenticatedRequest):BackupBatchFilters{
 const value:Record<string,string>={};
 for(const key of ['q','status','kind','trigger','date','from','to','timeFrom','timeTo','server','network','destination','delivery','sort'])value[key]=typeof req.query[key]==='string'?String(req.query[key]):'';
 return value;
}
function pageNumber(req:AuthenticatedRequest){const page=Number(req.query.page??1);if(!Number.isInteger(page)||page<1||page>10000)throw new BackupError(422,'رقم الصفحة غير صالح.');return page;}
router.get('/health',action(()=>verificationSummary()));
router.post('/:id/verify-restore',action(req=>{if(req.body?.confirmed!==true)throw new BackupError(422,'راجع بيانات الفحص وأكّد المتابعة.');return requestVerification(String(req.params.id),String(req.body?.requestId??''),req);}));
router.get('/',action(req=>listBackupBatches(pageNumber(req),filters(req))));
router.get('/batches/:key',action(req=>backupBatchDetails(String(req.params.key),pageNumber(req),filters(req))));
router.post('/batches/:key/retry',action(req=>retryBackupBatch(String(req.params.key),String(req.body?.requestId??''),req)));
router.get('/batches/:key/download-preview',action(async req=>archivePreview(await archiveSnapshot(String(req.params.key)))));
router.post('/batches/:key/archive',action(async req=>{await audit(req,'backup_archive_prepare','طلب تجهيز تنزيل حزمة النسخ',{batchId:String(req.params.key)});return beginArchive(String(req.params.key),req.auth!.accountId);}));
router.get('/archives/:id',action(async req=>readArchive(String(req.params.id),req.auth!.accountId)));
router.get('/archives/:id/download',async(req,res)=>{
 if(downloads>=2)return res.status(429).json({message:'توجد تنزيلات قيد التنفيذ. أعد المحاولة بعد قليل.'});
 downloads++;let archive:Awaited<ReturnType<typeof archiveDownload>>|undefined;
 try{
  archive=await archiveDownload(String(req.params.id),(req as AuthenticatedRequest).auth!.accountId);
  await audit(req as AuthenticatedRequest,'backup_archive_download','تنزيل حزمة نسخ احتياطي',{batchId:archive.batchId});
  res.set({'Cache-Control':'no-store','Content-Type':'application/zip','Content-Length':String(archive.bytes),'Content-Disposition':'attachment; filename="'+archive.filename+'"'});
  await pipeline(createReadStream(archive.path),res);
 }catch(error){if(res.headersSent)res.destroy();else{res.removeHeader('Content-Length');res.removeHeader('Content-Disposition');res.status(error instanceof BackupError?error.status:503).json({message:error instanceof BackupError?error.message:'تعذّر تنزيل الحزمة. أعد تجهيزها.'});}}
 finally{archive?.close();downloads--;}
});
router.put('/policy',action(async req=>{const policy=await saveBackupPolicy(req.body);await audit(req,'backup_policy','تعديل جدولة النسخ الاحتياطي وسياسة الاحتفاظ');return {policy};}));
router.post('/:id/restart',action(req=>restartFailedBackup(String(req.params.id),String(req.body?.requestId??''),req)));
router.post('/run',action(req=>requestBackups(req.body,req)));
router.post('/inspect',action(async req=>{
 const serverId=Number(req.body?.serverId);
 if(!Number.isSafeInteger(serverId)||serverId<1)throw new BackupError(422,'اختر خادمًا للفحص.');
 return backupRemote(serverId,'inspect','00000000-0000-0000-0000-000000000000');
}));
router.get('/cloud',action(()=>cloudPublic()));
router.put('/cloud',action(async req=>{const value=await saveCloudSettings(req.body);await audit(req,'backup_cloud_settings','تعديل إعدادات رفع النسخ السحابي');return value;}));
router.post('/cloud/:destination/test',action(async req=>{
 const destination=String(req.params.destination);if(!['telegram','drive'].includes(destination))throw new BackupError(422,'الوجهة غير صالحة.');
 const result=await testCloud(destination);await audit(req,'backup_cloud_test','تجربة رفع ملف إلى وجهة النسخ الاحتياطي',{destination});return result;
}));
router.post('/drive/connect',action(async(req,res)=>{
 const result=await beginDriveConnection(req.auth!.accountId);
 if(req.auth?.sessionClaims){const renewed=renewVerifiedSession(req.auth.sessionClaims,0);writeSessionCookie(res,'central',renewed.token,renewed.maxAge);}
 return result;
}));
router.get('/drive/callback',async(req,res)=>{
 res.set('Cache-Control','no-store');
 try{await finishDriveConnection(String(req.query.state??''),String(req.query.code??''),(req as AuthenticatedRequest).auth!.accountId);await audit(req as AuthenticatedRequest,'backup_drive_connected','ربط Google Drive لرفع النسخ الاحتياطي');res.redirect(new URL('/Dashboard/system/backups?tab=cloud&drive=connected',env.FRONTEND_URL).href);}
 catch{res.redirect(new URL('/Dashboard/system/backups?tab=cloud&drive=failed',env.FRONTEND_URL).href);}
});
router.post('/:id/check',action(req=>reconcileBackup(String(req.params.id))));
router.post('/:id/retry',action(async req=>{await retryDelivery(String(req.params.id),String(req.body?.destination));await audit(req,'backup_delivery_retry','إعادة محاولة رفع نسخة احتياطية',{backupId:req.params.id,destination:req.body?.destination});return {message:'أُضيفت محاولة الرفع إلى الطابور.'};}));
let downloads=0;
router.get('/:id/download',async(req,res)=>{
 let transfer:Awaited<ReturnType<typeof backupStream>>|undefined;
 if(downloads>=2)return res.status(429).json({message:'توجد تنزيلات قيد التنفيذ. أعد المحاولة بعد قليل.'});
 downloads++;
 try{
  const value=await backupForDownload(String(req.params.id));
  const filename=backupFilename(value,(await backupPolicy()).timezone);
  await audit(req as AuthenticatedRequest,'backup_download','تنزيل نسخة احتياطية',{backupId:value.id,tenantId:value.tenant_id});
  transfer=await backupStream(Number(value.server_id),value.id);
  res.set({'Cache-Control':'no-store','Content-Type':'application/gzip','Content-Length':String(value.metadata.bytes),'Content-Disposition':'attachment; filename="'+filename+'"','X-Backup-SHA256':value.metadata.sha256});
  const close=()=>transfer?.close();res.once('close',close);
  try{await pipeline(transfer.stream,res);}finally{res.removeListener('close',close);}
 }catch(error){
  if(res.headersSent)res.destroy();
  else{res.removeHeader('Content-Length');res.removeHeader('Content-Disposition');res.status(error instanceof BackupError?error.status:503).json({message:error instanceof BackupError?error.message:'تعذر تنزيل النسخة. تحقق من اتصال SSH وسلامة الملف.'});}
 }finally{transfer?.close();downloads--;}
});
export default router;
