import {randomBytes,randomUUID,createHash} from 'crypto';
import {createReadStream,createWriteStream} from 'fs';
import {mkdir,rm,writeFile,statfs,readdir,stat} from 'fs/promises';
import {join} from 'path';
import {tmpdir} from 'os';
import {Readable} from 'stream';
import {pipeline} from 'stream/promises';
import {db} from '../config/db';
import {env} from '../config/env';
import {encryptProvisioningSecret as encrypt,decryptProvisioningSecret as decrypt} from './provisioning-secrets.service';
import {backupStream} from './database-backup-remote.service';
import type {BackupJob} from './database-backups.service';

type Cloud={telegram:{enabled:boolean;tokenEncrypted?:string;chatId:string;lastTest?:any};drive:{enabled:boolean;clientId:string;secretEncrypted?:string;refreshEncrypted?:string;folderId?:string;generation:string;lastTest?:any}};
export class CloudError extends Error{constructor(public code:string,public message:string){super(message);this.name='CloudError';}}
function parse(value:any){return typeof value==='string'?JSON.parse(value):value;}
async function read():Promise<Cloud>{
 const [rows]:any=await db.query("SELECT setting_value FROM platform_settings WHERE setting_group='database_backup_cloud' AND setting_key='connections'");
 return rows[0]?parse(rows[0].setting_value):{telegram:{enabled:false,chatId:''},drive:{enabled:false,clientId:'',generation:randomUUID()}};
}
async function save(config:Cloud){await db.query("INSERT INTO platform_settings(setting_group,setting_key,setting_value,value_type,is_public) VALUES('database_backup_cloud','connections',?,'json',0) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)",[JSON.stringify(config)]);}
const callback=()=>new URL('/api/admin/platform-settings/database-backups/drive/callback',env.FRONTEND_URL).href;
export async function cloudPublic(){
 const config=await read();
 return {telegram:{enabled:config.telegram.enabled,chatId:config.telegram.chatId,configured:Boolean(config.telegram.tokenEncrypted),lastTest:config.telegram.lastTest},
 drive:{enabled:config.drive.enabled,clientId:config.drive.clientId,configured:Boolean(config.drive.secretEncrypted),connected:Boolean(config.drive.refreshEncrypted&&config.drive.folderId),folderId:config.drive.folderId,callbackUrl:callback(),lastTest:config.drive.lastTest}};
}
export async function cloudDestinationsReady(destinations:string[]){
 const config=await read();
 for(const destination of destinations){
  if(destination==='telegram'){
   if(!config.telegram.enabled||!config.telegram.tokenEncrypted||!config.telegram.chatId)throw new CloudError('TELEGRAM_SETUP','أكمل إعداد تلجرام وفعّله أولًا.');
  }else if(destination==='drive'){
   if(!config.drive.enabled||!config.drive.refreshEncrypted||!config.drive.folderId||!config.drive.secretEncrypted)throw new CloudError('DRIVE_SETUP','اربط Google Drive وفعّله أولًا.');
  }else throw new CloudError('DESTINATION_INPUT','وجهة الرفع غير صالحة.');
 }
}
async function locked<T>(work:(config:Cloud)=>Promise<T>){
 const connection=await db.pool.getConnection();let acquired=false;
 try{
  const [rows]:any=await connection.query("SELECT GET_LOCK('lord-backup-cloud-settings',0) acquired");acquired=Number(rows[0]?.acquired)===1;
  if(!acquired)throw new CloudError('CLOUD_BUSY','يجري تحديث إعدادات الرفع. أعد المحاولة.');
  return await work(await read());
 }finally{try{if(acquired)await connection.query("SELECT RELEASE_LOCK('lord-backup-cloud-settings')");connection.release();}catch{connection.destroy();}}
}
export async function saveCloudSettings(body:any){
 return locked(async config=>{
  const telegram=body.telegram,drive=body.drive;
  if(!telegram||!drive)throw new CloudError('CLOUD_INPUT','أكمل إعدادات الوجهات.');
  const chatId=String(telegram.chatId??'').trim(),token=String(telegram.token??'').trim();
  if(chatId&&!/^(?:-?\d{1,20}|@[a-zA-Z][a-zA-Z0-9_]{4,63})$/.test(chatId)||token&&!/^\d{5,20}:[A-Za-z0-9_-]{20,150}$/.test(token))throw new CloudError('CLOUD_INPUT','تحقق من رمز البوت ومعرّف محادثة تلجرام.');
  const clientId=String(drive.clientId??'').trim(),secret=String(drive.clientSecret??'').trim();
  if(clientId&&!/^[A-Za-z0-9._-]+\.apps\.googleusercontent\.com$/.test(clientId)||secret.length>512)throw new CloudError('CLOUD_INPUT','تحقق من بيانات تطبيق Google.');
  if(chatId!==config.telegram.chatId||token)delete config.telegram.lastTest;
  config.telegram={...config.telegram,enabled:telegram.enabled===true,chatId,...(token?{tokenEncrypted:encrypt(token)}:{})};
  if(config.telegram.enabled&&(!config.telegram.tokenEncrypted||!chatId))throw new CloudError('CLOUD_INPUT','أكمل بيانات تلجرام قبل تفعيله.');
  if(clientId!==config.drive.clientId||secret){
   config.drive={enabled:false,clientId,generation:randomUUID(),...(secret?{secretEncrypted:encrypt(secret)}:clientId===config.drive.clientId?{secretEncrypted:config.drive.secretEncrypted}:{})};
  }
  config.drive.enabled=drive.enabled===true;
  if(config.drive.enabled&&(!clientId||!config.drive.secretEncrypted))throw new CloudError('CLOUD_INPUT','أكمل بيانات تطبيق Google قبل تفعيله.');
  await save(config);
  return cloudPublic();
 });
}
export async function beginDriveConnection(actorId:number){
 const config=await read(),drive=config.drive;
 if(!drive.clientId||!drive.secretEncrypted)throw new CloudError('DRIVE_SETUP','احفظ بيانات تطبيق Google أولًا.');
 const state=randomBytes(32).toString('hex');
 await db.query("INSERT INTO platform_settings(setting_group,setting_key,setting_value,value_type,is_public) VALUES('database_backup_oauth',?,?,'json',0)",[state,JSON.stringify({actorId,generation:drive.generation,expiresAt:Date.now()+600000})]);
 await db.query("DELETE FROM platform_settings WHERE setting_group='database_backup_oauth' AND CAST(JSON_EXTRACT(setting_value,'$.expiresAt') AS UNSIGNED)<? LIMIT 100",[Date.now()]);
 const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
 url.search=new URLSearchParams({client_id:drive.clientId,redirect_uri:callback(),response_type:'code',scope:'https://www.googleapis.com/auth/drive.file',access_type:'offline',prompt:'consent',state}).toString();
 return {url:url.href};
}
async function jsonRequest(url:string,init?:RequestInit){
 const response=await fetch(url,{...init,signal:init?.signal??AbortSignal.timeout(20000)});
 const value=await response.json().catch(()=>null);
 if(!response.ok)throw new CloudError('CLOUD_REQUEST_FAILED','تعذر الاتصال بالوجهة السحابية. تحقق من الربط والصلاحيات والمساحة.');
 return value;
}
export async function finishDriveConnection(state:string,code:string,actorId:number){
 if(!/^[a-f0-9]{64}$/.test(state)||!code||code.length>4096)throw new CloudError('DRIVE_STATE','طلب ربط Google غير صالح.');
 return locked(async config=>{
  const [rows]:any=await db.query("SELECT setting_value FROM platform_settings WHERE setting_group='database_backup_oauth' AND setting_key=?",[state]);
  const proof=rows[0]?parse(rows[0].setting_value):null;
  if(!proof||proof.actorId!==actorId||proof.expiresAt<Date.now()||proof.generation!==config.drive.generation)throw new CloudError('DRIVE_STATE','انتهت صلاحية طلب الربط. ابدأ الربط مجددًا.');
  const [deleted]:any=await db.query("DELETE FROM platform_settings WHERE setting_group='database_backup_oauth' AND setting_key=? AND setting_value=?",[state,rows[0].setting_value]);
  if(deleted.affectedRows!==1)throw new CloudError('DRIVE_STATE','طلب الربط مستخدم مسبقًا.');
  const token=await jsonRequest('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({client_id:config.drive.clientId,client_secret:decrypt(config.drive.secretEncrypted!),code,grant_type:'authorization_code',redirect_uri:callback()})});
  if(!token.refresh_token)throw new CloudError('DRIVE_AUTH','أعد الربط مع السماح بالوصول دون اتصال.');
  const headers={Authorization:'Bearer '+token.access_token};
  const query=new URLSearchParams({q:"trashed = false and mimeType = 'application/vnd.google-apps.folder' and appProperties has { key='radiusBackupFolder' and value='true' }",fields:'files(id)',pageSize:'1'});
  const folders=await jsonRequest('https://www.googleapis.com/drive/v3/files?'+query,{headers});
  const folder=folders.files?.[0]??await jsonRequest('https://www.googleapis.com/drive/v3/files?fields=id',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({name:'Radius Lord Backups',mimeType:'application/vnd.google-apps.folder',appProperties:{radiusBackupFolder:'true'}})});
  config.drive={...config.drive,enabled:true,refreshEncrypted:encrypt(token.refresh_token),folderId:folder.id};
  await save(config);
 });
}
async function driveAccess(config:Cloud){
 const drive=config.drive;
 if(!drive.secretEncrypted||!drive.refreshEncrypted)throw new CloudError('DRIVE_AUTH','أعد ربط Google Drive.');
 const result=await jsonRequest('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({client_id:drive.clientId,client_secret:decrypt(drive.secretEncrypted),refresh_token:decrypt(drive.refreshEncrypted),grant_type:'refresh_token'})});
 if(!result.access_token)throw new CloudError('DRIVE_AUTH','أعد ربط Google Drive.');
 return result.access_token as string;
}
type Artifact={id:string;name:string;bytes:number;sha256:string;md5:string;filename:string};
type Delivery={status:string;fileId?:string;messageId?:number;sessionEncrypted?:string;error?:string;attempts?:number};
async function telegramUpload(config:Cloud,path:string,artifact:Artifact){
 if(artifact.bytes>50000000)throw new CloudError('TELEGRAM_TOO_LARGE','النسخة تتجاوز حد تلجرام البالغ 50 MB. استخدم Google Drive أو التنزيل المحلي.');
 const boundary='radius-'+randomUUID();
 const field=(name:string,value:string)=>'--'+boundary+'\r\nContent-Disposition: form-data; name="'+name+'"\r\n\r\n'+value+'\r\n';
 const head=Buffer.from(field('chat_id',config.telegram.chatId)+field('caption','Radius Lord · '+artifact.name+'\nSHA256: '+artifact.sha256)+'--'+boundary+'\r\nContent-Disposition: form-data; name="document"; filename="'+artifact.filename+'"\r\nContent-Type: application/octet-stream\r\n\r\n');
 const tail=Buffer.from('\r\n--'+boundary+'--\r\n');
 const stream=Readable.from((async function*(){yield head;for await(const chunk of createReadStream(path))yield chunk;yield tail;})());
 let response:Response;
 try{
  response=await fetch('https://api.telegram.org/bot'+decrypt(config.telegram.tokenEncrypted!)+'/sendDocument',{method:'POST',headers:{'Content-Type':'multipart/form-data; boundary='+boundary,'Content-Length':String(head.length+artifact.bytes+tail.length)},body:stream as any,duplex:'half',signal:AbortSignal.timeout(600000)} as RequestInit&{duplex:string});
 }catch{throw new CloudError('TELEGRAM_DELIVERY_UNKNOWN','تعذر تأكيد وصول الملف إلى تلجرام. راجع المحادثة قبل إعادة الرفع.');}
 const result=await response.json().catch(()=>null);
 if(response.status>=500||response.ok&&!result?.ok)throw new CloudError('TELEGRAM_DELIVERY_UNKNOWN','تعذر تأكيد وصول الملف إلى تلجرام. راجع المحادثة قبل إعادة الرفع.');
 if(!response.ok||!result?.ok)throw new CloudError('TELEGRAM_SEND_FAILED','رفض تلجرام رفع الملف. تحقق من البوت والمحادثة والصلاحيات.');
 if(!result.result?.document?.file_id)throw new CloudError('TELEGRAM_DELIVERY_UNKNOWN','تعذر تأكيد وصول الملف إلى تلجرام. راجع المحادثة.');
 if(result.result.document.file_size!==undefined&&Number(result.result.document.file_size)!==artifact.bytes)throw new CloudError('TELEGRAM_SIZE_MISMATCH','حجم الملف على تلجرام لا يطابق النسخة.');
 return {status:'succeeded',messageId:result.result.message_id} as Delivery;
}
async function driveUpload(config:Cloud,path:string,artifact:Artifact,previous:Delivery,persist:(value:Delivery)=>Promise<void>){
 const access=await driveAccess(config),headers={Authorization:'Bearer '+access};
 let value={...previous,status:'uploading'};
 if(!value.fileId){
  const ids=await jsonRequest('https://www.googleapis.com/drive/v3/files/generateIds?count=1&space=drive&type=files',{headers});
  value.fileId=ids.ids[0];await persist(value);
 }else{
  const existing=await fetch('https://www.googleapis.com/drive/v3/files/'+value.fileId+'?fields=id,size,md5Checksum',{headers,signal:AbortSignal.timeout(20000)});
  if(existing.ok){const file=await existing.json();if(Number(file.size)===artifact.bytes&&file.md5Checksum===artifact.md5)return {...value,status:'succeeded',sessionEncrypted:undefined};}
 }
 let offset=0,session=value.sessionEncrypted?decrypt(value.sessionEncrypted):'';
 if(session){
  const uri=new URL(session);
  if(uri.protocol!=='https:'||!['www.googleapis.com','drive.googleapis.com'].includes(uri.hostname))throw new CloudError('DRIVE_SESSION','جلسة رفع Google غير صالحة.');
  const probe=await fetch(session,{method:'PUT',headers:{...headers,'Content-Length':'0','Content-Range':'bytes */'+artifact.bytes},redirect:'manual',signal:AbortSignal.timeout(20000)});
  if(probe.ok){const file=await probe.json();if(Number(file.size)===artifact.bytes&&file.md5Checksum===artifact.md5)return {...value,status:'succeeded',sessionEncrypted:undefined};}
  if(probe.status===308){const match=/bytes=0-(\d+)/.exec(probe.headers.get('Range')??'');offset=match?Number(match[1])+1:0;}
  else session='';
 }
 if(!session){
  const response=await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,size,md5Checksum',{method:'POST',headers:{...headers,'Content-Type':'application/json','X-Upload-Content-Type':'application/octet-stream','X-Upload-Content-Length':String(artifact.bytes)},body:JSON.stringify({id:value.fileId,name:artifact.filename,parents:[config.drive.folderId],appProperties:{radiusBackupId:artifact.id,sha256:artifact.sha256}}),signal:AbortSignal.timeout(20000)});
  session=response.headers.get('Location')??'';
  if(!response.ok||!session)throw new CloudError('DRIVE_START_FAILED','تعذر بدء رفع Google Drive.');
  value.sessionEncrypted=encrypt(session);await persist(value);offset=0;
 }
 if(offset>=artifact.bytes)throw new CloudError('DRIVE_UPLOAD_FAILED','تعذر تأكيد اكتمال رفع Google Drive.');
 const response=await fetch(session,{method:'PUT',headers:{...headers,'Content-Type':'application/octet-stream','Content-Length':String(artifact.bytes-offset),'Content-Range':'bytes '+offset+'-'+(artifact.bytes-1)+'/'+artifact.bytes},body:createReadStream(path,{start:offset}) as any,duplex:'half',redirect:'manual',signal:AbortSignal.timeout(1200000)} as RequestInit&{duplex:string});
 if(!response.ok)throw new CloudError('DRIVE_UPLOAD_FAILED','تعذر إكمال رفع Google Drive. يمكن استكمال المحاولة من السجل.');
 const file=await response.json();
 if(Number(file.size)!==artifact.bytes||file.md5Checksum!==artifact.md5)throw new CloudError('DRIVE_CHECKSUM','بيانات الملف على Google Drive لا تطابق النسخة.');
 return {...value,status:'succeeded',sessionEncrypted:undefined};
}
let lastCleanup=0;
export async function deliverBackup(job:BackupJob){
 const owner=randomUUID(),transferRoot=join(tmpdir(),'radius-lord-backup-transfers');
 await mkdir(transferRoot,{recursive:true,mode:0o700});
 if(Date.now()-lastCleanup>3600000){
  lastCleanup=Date.now();
  for(const name of await readdir(transferRoot)){
   if(!/^[a-f0-9-]{73}$/.test(name))continue;
   const old=join(transferRoot,name);
   const details=await stat(old).catch(()=>null);
   if(details&&Date.now()-details.mtimeMs>86400000)await rm(old,{recursive:true,force:true}).catch(()=>{});
  }
 }
 const root=join(transferRoot,job.id+'-'+owner);
 const path=join(root,'payload.sql.gz');
 const deliveries={...job.deliveries};
 async function persist(destination:string,value:Delivery){
  deliveries[destination]=value;
  const [updated]:any=await db.query("UPDATE database_backup_jobs SET deliveries=? WHERE id=? AND delivery_owner=?",[JSON.stringify(deliveries),job.id,owner]);
  if(!updated.affectedRows)throw new CloudError('CLOUD_LEASE_LOST','انتقلت متابعة الرفع إلى عامل آخر.');
 }
 await db.query("UPDATE database_backup_jobs SET delivery_state='running',delivery_owner=? WHERE id=?",[owner,job.id]);
 try{
  const config=await read();
  const pending=job.destinations.filter(destination=>!['succeeded','failed','unknown'].includes(deliveries[destination]?.status));
  for(const destination of pending){
   if(destination==='telegram'&&deliveries.telegram?.status==='uploading')await persist(destination,{status:'unknown',error:'TELEGRAM_DELIVERY_UNKNOWN'});
  }
  const remaining=pending.filter(destination=>deliveries[destination]?.status!=='unknown');
  if(remaining.length){
   const space=await statfs(tmpdir());
   if(Number(space.bavail)*Number(space.bsize)<job.metadata.bytes+128*1024*1024)throw new CloudError('TRANSFER_DISK','لا توجد مساحة مؤقتة كافية لنقل النسخة.');
   await mkdir(root,{recursive:true,mode:0o700});await rm(path,{force:true});
   const download=await backupStream(job.server_id,job.id);
   try{await pipeline(download.stream,createWriteStream(path,{flags:'wx',mode:0o600}));}finally{download.close();}
   const digest=createHash('sha256');
   for await(const chunk of createReadStream(path))digest.update(chunk);
   if(digest.digest('hex')!==job.metadata.sha256)throw new CloudError('TRANSFER_CHECKSUM','بصمة النسخة المنقولة غير مطابقة.');
   const artifact={id:job.id,name:job.name,bytes:job.metadata.bytes,sha256:job.metadata.sha256,md5:job.metadata.md5,filename:'radius-backup-'+job.id+'.sql.gz'};
   for(const destination of remaining){
    try{
     await cloudDestinationsReady([destination]);
     const previous=deliveries[destination]??{status:'pending'};
     const uploading={...previous,status:'uploading',attempts:(previous.attempts??0)+1};await persist(destination,uploading);
     const result=destination==='telegram'?await telegramUpload(config,path,artifact):await driveUpload(config,path,artifact,uploading,value=>persist(destination,value));
     await persist(destination,{...result,error:undefined});
    }catch(error){
     if(error instanceof CloudError&&error.code==='CLOUD_LEASE_LOST')throw error;
     const code=error instanceof CloudError?error.code:'CLOUD_UPLOAD_FAILED';
     await persist(destination,{...deliveries[destination],status:code==='TELEGRAM_DELIVERY_UNKNOWN'?'unknown':'failed',error:code});
    }
   }
  }
 }catch(error){
  if(error instanceof CloudError&&error.code==='CLOUD_LEASE_LOST')throw error;
  for(const destination of job.destinations)if(!['succeeded','unknown','failed'].includes(deliveries[destination]?.status))await persist(destination,{...deliveries[destination],status:'failed',error:error instanceof CloudError?error.code:'CLOUD_TRANSFER_FAILED'});
 }finally{await rm(root,{recursive:true,force:true}).catch(()=>{});}
 const done=job.destinations.every(destination=>deliveries[destination]?.status==='succeeded');
 await db.query("UPDATE database_backup_jobs SET deliveries=?,delivery_state=? WHERE id=? AND delivery_owner=?",[JSON.stringify(deliveries),done?'done':'attention',job.id,owner]);
}
export async function testCloud(destination:string){
 await cloudDestinationsReady([destination]);
 const config=await read(),id=randomUUID(),root=join(tmpdir(),'radius-lord-cloud-test',id),path=join(root,'test.txt');
 const content=Buffer.from('Radius Lord backup destination test\n'+new Date().toISOString());
 await mkdir(root,{recursive:true,mode:0o700});await writeFile(path,content,{mode:0o600});
 const artifact={id,name:'فحص وجهة النسخ الاحتياطي',bytes:content.length,sha256:createHash('sha256').update(content).digest('hex'),md5:createHash('md5').update(content).digest('hex'),filename:'radius-connection-test.txt'};
 try{
  if(destination==='telegram')await telegramUpload(config,path,artifact);
  else await driveUpload(config,path,artifact,{status:'pending'},async()=>{});
  await locked(async latest=>{
   const same=destination==='telegram'?latest.telegram.tokenEncrypted===config.telegram.tokenEncrypted&&latest.telegram.chatId===config.telegram.chatId:latest.drive.refreshEncrypted===config.drive.refreshEncrypted&&latest.drive.folderId===config.drive.folderId;
   if(!same)throw new CloudError('CLOUD_SETTINGS_CHANGED','تغيرت إعدادات الوجهة أثناء التجربة. أعد الفحص.');
   latest[destination as 'telegram'|'drive'].lastTest={ok:true,at:new Date().toISOString()};await save(latest);
  });
 }catch(error){
  await locked(async latest=>{
   const same=destination==='telegram'?latest.telegram.tokenEncrypted===config.telegram.tokenEncrypted&&latest.telegram.chatId===config.telegram.chatId:latest.drive.refreshEncrypted===config.drive.refreshEncrypted&&latest.drive.folderId===config.drive.folderId;
   if(same){latest[destination as 'telegram'|'drive'].lastTest={ok:false,at:new Date().toISOString()};await save(latest);}
  }).catch(()=>{});
  throw error;
 }finally{await rm(root,{recursive:true,force:true});}
 return {message:'نجح رفع ملف التجربة إلى الوجهة.'};
}
