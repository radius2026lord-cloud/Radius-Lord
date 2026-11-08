import {randomUUID,createHash} from 'crypto';
import {open,mkdir,rm,readdir,stat,statfs,type FileHandle} from 'fs/promises';
import {join} from 'path';
import {tmpdir} from 'os';
import {db} from '../config/db';
import {backupPolicy,ensureBackupSchema,parse,BackupError} from './database-backups.service';
import {backupStream} from './database-backup-remote.service';
import {backupFilename} from './database-backup-filename.service';

type Snapshot={batchId:string;timezone:string;createdAt:string;total:number;available:number;unavailable:number;bytes:number;items:any[]};
type Task={id:string;actor:number;batchId:string;state:'preparing'|'ready'|'failed';completed:number;total:number;unavailable:number;current:string;error?:string;filename:string;path:string;expiresAt:number;readers:number};
const tasks=new Map<string,Task>();
const root=join(tmpdir(),'radius-lord-backup-archives');
export async function archiveSnapshot(batchId:string):Promise<Snapshot>{
 await ensureBackupSchema();
 if(!batchId||batchId.length>128)throw new BackupError(422,'معرّف الحزمة غير صالح.');
 const policy=await backupPolicy();
 const [rows]:any=await db.query(`WITH ranked AS (SELECT j.*,ROW_NUMBER() OVER(PARTITION BY kind,server_id,database_name ORDER BY created_at DESC,id DESC) target_rank FROM database_backup_jobs j WHERE batch_key=?)
 SELECT *,DATE_FORMAT(created_at,'%Y-%m-%dT%H:%i:%sZ') created_at FROM ranked WHERE target_rank=1 ORDER BY name,database_name`,[batchId]);
 if(!rows.length)throw new BackupError(404,'الحزمة غير موجودة.');
 const names=new Set<string>();
 const items=rows.map((r:any)=>{
  const metadata=parse<any>(r.metadata,{});
  const available=r.status==='succeeded'&&!r.removed_at&&Number.isSafeInteger(metadata.bytes)&&metadata.bytes>0&&/^[a-f0-9]{64}$/.test(metadata.sha256??'');
  let filename=backupFilename({...r,metadata},policy.timezone);
  if(names.has(filename))filename=filename.replace('.sql.gz','_s'+r.server_id+'_'+r.id.slice(0,8)+'.sql.gz');
  names.add(filename);
  return {id:r.id,serverId:Number(r.server_id),database:r.database_name,network:r.name,status:r.status,available,filename,metadata,reason:available?null:r.removed_at?'أزيل ملف الخادم':r.status==='failed'?'تعذّر النسخ':'النسخة غير مكتملة أو غير متاحة'};
 });
 const available=items.filter((i:any)=>i.available);
 return {batchId,timezone:policy.timezone,createdAt:new Date().toISOString(),total:items.length,available:available.length,unavailable:items.length-available.length,bytes:available.reduce((n:number,i:any)=>n+i.metadata.bytes,0),items};
}
export function archivePreview(snapshot:Snapshot){
 return {batchId:snapshot.batchId,total:snapshot.total,available:snapshot.available,unavailable:snapshot.unavailable,bytes:snapshot.bytes,timezone:snapshot.timezone};
}
const crcTable=Array.from({length:256},(_,value)=>{let crc=value;for(let i=0;i<8;i++)crc=crc&1?0xedb88320^(crc>>>1):crc>>>1;return crc>>>0;});
function crcUpdate(crc:number,chunk:Buffer){for(const byte of chunk)crc=crcTable[(crc^byte)&255]^(crc>>>8);return crc>>>0;}
type Entry={name:Buffer;offset:number;size:number;crc:number};
class Zip64Writer{
 private position=0;private entries:Entry[]=[];
 constructor(private file:FileHandle){}
 private async put(data:Buffer,at=this.position,advance=true){
  let written=0;while(written<data.length){const result=await this.file.write(data,written,data.length-written,at+written);if(!result.bytesWritten)throw Error('ARCHIVE_DISK');written+=result.bytesWritten;}
  if(advance)this.position+=data.length;
 }
 async entry(name:string,source:AsyncIterable<Buffer>,expected?:{bytes:number;sha256:string},signal?:AbortSignal){
  const filename=Buffer.from(name),offset=this.position;
  const header=Buffer.alloc(30);header.writeUInt32LE(0x04034b50);header.writeUInt16LE(45,4);header.writeUInt16LE(0x800,6);header.writeUInt16LE(33,12);header.writeUInt32LE(0xffffffff,18);header.writeUInt32LE(0xffffffff,22);header.writeUInt16LE(filename.length,26);header.writeUInt16LE(20,28);
  const extra=Buffer.alloc(20);extra.writeUInt16LE(1);extra.writeUInt16LE(16,2);
  await this.put(header);await this.put(filename);const sizePosition=this.position+4;await this.put(extra);
  let size=0,crc=0xffffffff;const sha=createHash('sha256');
  for await(const chunk of source){if(signal?.aborted)throw Error('ARCHIVE_TIMEOUT');size+=chunk.length;if(expected&&size>expected.bytes)throw Error('ARCHIVE_INTEGRITY');sha.update(chunk);crc=crcUpdate(crc,chunk);await this.put(chunk);}
  if(expected&&(size!==expected.bytes||sha.digest('hex')!==expected.sha256))throw Error('ARCHIVE_INTEGRITY');
  crc=(crc^0xffffffff)>>>0;
  const checksum=Buffer.alloc(4);checksum.writeUInt32LE(crc);await this.put(checksum,offset+14,false);
  const sizes=Buffer.alloc(16);sizes.writeBigUInt64LE(BigInt(size));sizes.writeBigUInt64LE(BigInt(size),8);await this.put(sizes,sizePosition,false);
  this.entries.push({name:filename,offset,size,crc});
 }
 async finish(){
  const start=this.position;
  for(const entry of this.entries){
   const header=Buffer.alloc(46);header.writeUInt32LE(0x02014b50);header.writeUInt16LE(45,4);header.writeUInt16LE(45,6);header.writeUInt16LE(0x800,8);header.writeUInt16LE(33,14);header.writeUInt32LE(entry.crc,16);header.writeUInt32LE(0xffffffff,20);header.writeUInt32LE(0xffffffff,24);header.writeUInt16LE(entry.name.length,28);header.writeUInt16LE(28,30);header.writeUInt32LE(0xffffffff,42);
   const extra=Buffer.alloc(28);extra.writeUInt16LE(1);extra.writeUInt16LE(24,2);extra.writeBigUInt64LE(BigInt(entry.size),4);extra.writeBigUInt64LE(BigInt(entry.size),12);extra.writeBigUInt64LE(BigInt(entry.offset),20);
   await this.put(header);await this.put(entry.name);await this.put(extra);
  }
  const centralSize=this.position-start,zip64Offset=this.position;
  const end64=Buffer.alloc(56);end64.writeUInt32LE(0x06064b50);end64.writeBigUInt64LE(44n,4);end64.writeUInt16LE(45,12);end64.writeUInt16LE(45,14);end64.writeBigUInt64LE(BigInt(this.entries.length),24);end64.writeBigUInt64LE(BigInt(this.entries.length),32);end64.writeBigUInt64LE(BigInt(centralSize),40);end64.writeBigUInt64LE(BigInt(start),48);await this.put(end64);
  const locator=Buffer.alloc(20);locator.writeUInt32LE(0x07064b50);locator.writeBigUInt64LE(BigInt(zip64Offset),8);locator.writeUInt32LE(1,16);await this.put(locator);
  const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(0xffff,8);end.writeUInt16LE(0xffff,10);end.writeUInt32LE(0xffffffff,12);end.writeUInt32LE(0xffffffff,16);await this.put(end);
  await this.file.sync();
 }
}
function publicTask(task:Task){return {id:task.id,state:task.state,completed:task.completed,total:task.total,unavailable:task.unavailable,current:task.current,error:task.error,filename:task.filename,expiresAt:new Date(task.expiresAt).toISOString()};}
async function cleanupOld(){
 await mkdir(root,{recursive:true,mode:0o700});
 for(const item of await readdir(root,{withFileTypes:true})){
  if(!item.isDirectory()||!/^[a-f0-9-]{36}$/.test(item.name)||tasks.has(item.name))continue;
  const path=join(root,item.name);const info=await stat(path);
  if(Date.now()-info.mtimeMs>86400000)await rm(path,{recursive:true,force:true});
 }
}
function expire(task:Task){
 const timer=setTimeout(()=>{if(task.readers){task.expiresAt=Date.now()+60000;expire(task);return;}tasks.delete(task.id);void rm(join(root,task.id),{recursive:true,force:true}).catch(()=>{});},Math.max(1000,task.expiresAt-Date.now()));timer.unref();
}
async function prepare(task:Task,snapshot:Snapshot){
 let file:FileHandle|undefined,transfer:Awaited<ReturnType<typeof backupStream>>|undefined;
 const controller=new AbortController(),timeout=setTimeout(()=>{controller.abort();transfer?.close();},2*60*60*1000);timeout.unref();
 try{
  await cleanupOld();const space=await statfs(root);
  if(Number(space.bavail)*Number(space.bsize)<snapshot.bytes+128*1024**2)throw Error('ARCHIVE_SPACE');
  const folder=join(root,task.id);await mkdir(folder,{mode:0o700});file=await open(task.path,'wx',0o600);
  const writer=new Zip64Writer(file);
  for(const item of snapshot.items.filter((i:any)=>i.available)){
   if(controller.signal.aborted)throw Error('ARCHIVE_TIMEOUT');
   task.current=item.database;
   transfer=await backupStream(item.serverId,item.id);
   try{await writer.entry(item.filename,transfer.stream as AsyncIterable<Buffer>,{bytes:item.metadata.bytes,sha256:item.metadata.sha256},controller.signal);}finally{transfer.close();transfer=undefined;}
   task.completed++;
  }
  task.current='manifest.json';
  const manifest={batchId:snapshot.batchId,preparedAt:snapshot.createdAt,timezone:snapshot.timezone,files:snapshot.items.map((i:any)=>({database:i.database,network:i.network,backupId:i.id,status:i.status,included:i.available,filename:i.available?i.filename:null,startedAt:i.metadata.startedAt??null,timezone:i.metadata.timezone??snapshot.timezone,sha256:i.available?i.metadata.sha256:null,reason:i.reason}))};
  async function* manifestSource(){yield Buffer.from(JSON.stringify(manifest,null,2));}
  await writer.entry('manifest.json',manifestSource());await writer.finish();await file.close();file=undefined;
  task.state='ready';task.current='';task.expiresAt=Date.now()+30*60*1000;
 }catch(error){
  task.state='failed';task.error=(error as Error).message==='ARCHIVE_SPACE'?'المساحة المؤقتة غير كافية لتجهيز الحزمة.':(error as Error).message==='ARCHIVE_INTEGRITY'?'لم تطابق إحدى النسخ بصمتها. أُوقف تجهيز الحزمة.':controller.signal.aborted?'انتهت مهلة تجهيز الحزمة. أعد المحاولة.':'تعذّر جلب إحدى النسخ من الخادم. تحقق من الاتصال وتوفر الملفات ثم أعد التجهيز.';
  task.current='';task.expiresAt=Date.now()+10*60*1000;await file?.close().catch(()=>{});await rm(join(root,task.id),{recursive:true,force:true}).catch(()=>{});
 }finally{clearTimeout(timeout);transfer?.close();expire(task);}
}
export async function beginArchive(batchId:string,actor:number){
 if([...tasks.values()].some(task=>task.state==='preparing'))throw new BackupError(409,'يجري تجهيز حزمة أخرى. انتظر اكتمالها لتخفيف الضغط.');
 const snapshot=await archiveSnapshot(batchId);
 if(!snapshot.available)throw new BackupError(409,'لا توجد ملفات نسخ متاحة في الحزمة.');
 // Recheck after the database read so parallel requests cannot both start.
 if([...tasks.values()].some(task=>task.state==='preparing'))throw new BackupError(409,'يجري تجهيز حزمة أخرى. أعد المحاولة لاحقًا.');
 const old=[...tasks.values()].filter(t=>t.actor===actor&&t.state!=='preparing'&&!t.readers);
 while([...tasks.values()].filter(t=>t.actor===actor).length>=3&&old.length){const previous=old.shift()!;tasks.delete(previous.id);void rm(join(root,previous.id),{recursive:true,force:true}).catch(()=>{});}
 const own=[...tasks.values()].filter(t=>t.actor===actor);
 if(own.length>=3||tasks.size>=10)throw new BackupError(429,'توجد حزم مجهّزة مؤقتًا. نزّلها أو انتظر انتهاء صلاحيتها.');
 const id=randomUUID(),task:Task={id,actor,batchId,state:'preparing',completed:0,total:snapshot.available,unavailable:snapshot.unavailable,current:'',filename:backupFilename({id,database_name:'radius_backup_batch',created_at:snapshot.createdAt,metadata:{timezone:snapshot.timezone}}).replace('.sql.gz','_'+id.slice(0,8)+'.zip'),path:join(root,id,'bundle.zip'),expiresAt:Date.now()+2*60*60*1000,readers:0};
 tasks.set(id,task);void prepare(task,snapshot);
 return publicTask(task);
}
export function readArchive(id:string,actor:number){const task=tasks.get(id);if(!task||task.actor!==actor||task.expiresAt<Date.now())throw new BackupError(404,'انتهت صلاحية الحزمة المؤقتة. أعد تجهيزها.');return publicTask(task);}
export async function archiveDownload(id:string,actor:number){
 const task=tasks.get(id);readArchive(id,actor);
 if(!task||task.state!=='ready')throw new BackupError(409,'الحزمة غير جاهزة للتنزيل.');
 task.readers++;
 try{const info=await stat(task.path);return {path:task.path,filename:task.filename,bytes:info.size,batchId:task.batchId,close:()=>{task.readers=Math.max(0,task.readers-1);}};}
 catch(error){task.readers--;throw error;}
}
