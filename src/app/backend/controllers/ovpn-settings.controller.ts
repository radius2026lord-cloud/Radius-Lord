import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'crypto';
import { isIP } from 'net';
import jwt from 'jsonwebtoken';
import type { PoolConnection } from 'mysql2/promise';
import { Response } from 'express';
import { db } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { writeAuditLog } from '../services/audit.service';
import { ApiConnection, RouterApi } from '../services/routeros-api.service';
import { inspectRouter, preflightInventory, provisionRouter, validateProvision } from '../services/ovpn-provision.service';

type Settings=Record<string,unknown>;
function key(){const raw=process.env.GATEWAY_ENCRYPTION_KEY??'';if(!/^[a-f0-9]{64}$/i.test(raw))throw new Error('عيّن GATEWAY_ENCRYPTION_KEY على الخادم قبل حفظ بيانات الاتصال.');return Buffer.from(raw,'hex');}
function encrypt(value:string){const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key(),iv),data=Buffer.concat([c.update(value,'utf8'),c.final()]);return ['v1',iv.toString('base64'),c.getAuthTag().toString('base64'),data.toString('base64')].join(':');}
function decrypt(value:string){try{const [v,iv,tag,data]=value.split(':');if(v!=='v1')throw new Error();const c=createDecipheriv('aes-256-gcm',key(),Buffer.from(iv,'base64'));c.setAuthTag(Buffer.from(tag,'base64'));return Buffer.concat([c.update(Buffer.from(data,'base64')),c.final()]).toString('utf8');}catch{throw new Error('تعذر فك بيانات الاتصال؛ تحقق من مفتاح التشفير.');}}
function safeRow(row:any){return {id:row.id,...JSON.parse(row.settings_json),has_api_password:Boolean(row.api_password_encrypted)};}
function errorMessage(e:unknown,fallback:string){return e instanceof Error && !('code' in e)?e.message:fallback;}
function connectionHash(value:ApiConnection){return createHmac('sha256',key()).update(JSON.stringify(value)).digest('hex');}
function hash(value:unknown){return createHash('sha256').update(JSON.stringify(value)).digest('hex');}
async function config(req:AuthenticatedRequest):Promise<{id:number|null;settings:Settings;connection:ApiConnection}>{
 const b=req.body??{},id=req.params.id?Number(req.params.id):null;
 if(id!==null&&(!Number.isSafeInteger(id)||id<1))throw new Error('معرّف الخادم غير صالح.');
 let saved:any;
 if(id){const [rows]=await db.query('SELECT * FROM ovpn_gateways WHERE id=?',[id]);saved=(rows as any[])[0];if(!saved)throw new Error('الخادم غير موجود.');}
 const old=saved?JSON.parse(saved.settings_json):{};
 const host=typeof b.api_host==='string'?b.api_host.trim():'',username=typeof b.api_username==='string'?b.api_username.trim():'',name=typeof b.name==='string'?b.name.trim():'',port=Number(b.api_port);
 if(!name||name.length>100||!username||username.length>100||(!isIP(host)&&!/^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(host))||!Number.isInteger(port)||port<1||port>65535||typeof b.api_tls!=='boolean')throw new Error('أدخل اسم الخادم وعنوان API وبيانات الاتصال الصحيحة.');
 if(b.api_password!==undefined&&(typeof b.api_password!=='string'||b.api_password.length>512))throw new Error('كلمة المرور غير صالحة.');
 const same=old.api_host===host&&old.api_port===port&&old.api_username===username&&old.api_tls===b.api_tls;
 const password=b.api_password||(same&&saved?.api_password_encrypted?decrypt(saved.api_password_encrypted):'');
 if(!password)throw new Error('أدخل كلمة المرور؛ بيانات الاتصال الجديدة تحتاج فحصًا جديدًا.');
 key();
 return {id,settings:{...old,...(same?{}:{enabled:false,provision_state:'draft'}),name,api_host:host,api_port:port,api_username:username,api_tls:b.api_tls},connection:{host,port,username,password,secure:b.api_tls}};
}
async function persist(req:AuthenticatedRequest,id:number|null,settings:Settings,password:string,description:string){
 const connection=await db.pool.getConnection();
 try{await connection.beginTransaction();let savedId=id;
 if(id)await connection.query('UPDATE ovpn_gateways SET settings_json=?,api_password_encrypted=?,updated_by_master_admin_id=? WHERE id=?',[JSON.stringify(settings),encrypt(password),req.auth!.accountId,id]);
 else{const [r]=await connection.query('INSERT INTO ovpn_gateways (settings_json,api_password_encrypted,updated_by_master_admin_id) VALUES (?,?,?)',[JSON.stringify(settings),encrypt(password),req.auth!.accountId]);savedId=(r as any).insertId;}
 await writeAuditLog(req,{actionCode:id?'UPDATE':'CREATE',entityTypeCode:'PLATFORM_SETTINGS',entityId:savedId,description,metadata:{settingGroup:'nas_ovpn',provisionState:settings.provision_state??null}},connection);
 await connection.commit();return savedId!;
 }catch(e){await connection.rollback();throw e;}finally{connection.release();}
}
export async function getOvpnSettings(req:AuthenticatedRequest,res:Response){try{const [rows]=await db.query('SELECT * FROM ovpn_gateways ORDER BY id DESC');return res.json({gateways:(rows as any[]).map(safeRow)});}catch{return res.status(500).json({message:'تعذر تحميل الخوادم؛ تأكد من تطبيق ترحيل ovpn_gateways.'});}}
export async function inspectOvpnGateway(req:AuthenticatedRequest,res:Response){
 let api:RouterApi|undefined;
 try{const c=await config(req);api=await RouterApi.connect(c.connection);const inventory=await inspectRouter(api);
 const verified=jwt.sign({kind:'ovpn-inspect',admin:req.auth!.accountId,id:c.id,connectionHash:connectionHash(c.connection),inventoryHash:hash(inventory)},key(),{expiresIn:'15m',algorithm:'HS256'});
 await writeAuditLog(req,{actionCode:'UPDATE',entityTypeCode:'PLATFORM_SETTINGS',entityId:c.id,description:'فحص اتصال خادم OpenVPN وقراءة الإعدادات',metadata:{result:'success',routerVersion:inventory.version}});
 return res.json({success:true,inventory,verified,checked_at:new Date().toISOString()});
 }catch(e){return res.status(400).json({message:errorMessage(e,'تعذر فحص الخادم أو حفظ سجل النشاط.')});}finally{api?.close();}
}
function verify(req:AuthenticatedRequest,c:Awaited<ReturnType<typeof config>>){try{const p=jwt.verify(String(req.body?.verified??''),key(),{algorithms:['HS256']}) as any;if(p.kind!=='ovpn-inspect'||p.admin!==req.auth!.accountId||p.id!==c.id||p.connectionHash!==connectionHash(c.connection))throw new Error();return p;}catch{throw new Error('أعد فحص الاتصال؛ نتيجة الفحص منتهية أو بيانات الاتصال تغيرت.');}}
export async function updateOvpnSettings(req:AuthenticatedRequest,res:Response){
 try{const c=await config(req);verify(req,c);const settings={...c.settings,last_checked_at:new Date().toISOString(),connection_status:'reachable',enabled:c.settings.enabled??false,provision_state:c.settings.provision_state??'draft'};
 const id=await persist(req,c.id,settings,c.connection.password,'حفظ بيانات اتصال خادم OpenVPN');return res.json({settings:{id,...settings,has_api_password:true}});
 }catch(e){return res.status(400).json({message:errorMessage(e,'تعذر حفظ الخادم.')});}
}
export async function applyOvpnGateway(req:AuthenticatedRequest,res:Response){
 let api:RouterApi|undefined,lock:PoolConnection|undefined,id:number|null=null,step='validation',modified=false;
 try{
 const c=await config(req);id=c.id;if(!id)throw new Error('احفظ بيانات الاتصال أولًا.');const proof=verify(req,c),options=validateProvision(req.body);
 lock=await db.pool.getConnection();const lockName=`ovpn:${hash(c.connection.host).slice(0,50)}`;
 const [result]=await lock.query('SELECT GET_LOCK(?,0) acquired',[lockName]);if(!(result as any[])[0]?.acquired)throw new Error('هناك تجهيز آخر لهذا الخادم؛ انتظر اكتماله.');
 api=await RouterApi.connect(c.connection);const inventory=await inspectRouter(api);
 if(hash(inventory)!==proof.inventoryHash)throw new Error('إعدادات MikroTik تغيرت بعد الفحص؛ أعد الفحص قبل التطبيق.');
 preflightInventory(inventory,options);
 const starting={...c.settings,...options,ovpn_protocol:'tcp',enabled:false,provision_state:'applying',last_step:'starting'};
 await persist(req,id,starting,c.connection.password,'بدء إعداد خادم OpenVPN عبر API');
 const after=await provisionRouter(api,inventory,options,async next=>{step=next;modified=true;await persist(req,id,{...starting,last_step:next},c.connection.password,`تجهيز خادم OpenVPN: ${next}`);});
 const finished={...starting,enabled:true,provision_state:'ready',last_step:'complete',router_version:after.version,last_checked_at:new Date().toISOString(),connection_status:'reachable'};
 await persist(req,id,finished,c.connection.password,'اكتمال إعداد خادم OpenVPN عبر API');return res.json({settings:{id,...finished,has_api_password:true}});
 }catch(e){const message=errorMessage(e,'تعذر تجهيز الخادم أو حفظ نتيجته.');
 if(id&&modified){try{const [rows]=await db.query('SELECT settings_json FROM ovpn_gateways WHERE id=?',[id]);const old=JSON.parse((rows as any[])[0].settings_json);await db.query('UPDATE ovpn_gateways SET settings_json=? WHERE id=?',[JSON.stringify({...old,enabled:false,provision_state:'failed',last_step:step,last_error:message}),id]);await writeAuditLog(req,{actionCode:'UPDATE',entityTypeCode:'PLATFORM_SETTINGS',entityId:id,description:'تعذر إكمال إعداد خادم OpenVPN',metadata:{step,result:'failed'}});}catch{/* No secrets or raw router errors are logged. */}}
 return res.status(400).json({message:modified?`${message} قد تكون بعض العناصر أُنشئت؛ أعد الفحص ثم استكمل بنفس الأسماء.`:message});
 }finally{api?.close();if(lock){try{await lock.query('SELECT RELEASE_ALL_LOCKS()');}finally{lock.release();}}}
}
