import {createHash} from 'crypto';
import mysql from 'mysql2/promise';
import {db} from '../config/db';
import {decryptProvisioningSecret} from './provisioning-secrets.service';
import {readPrivateSetting,savePrivateSetting} from './radius-provision.service';
import {readUbuntuReadiness,inspectInstalledRadius} from './ssh-terminal.service';
import {checkRadiusHealth} from './radius-database-health.service';
import {RouterApi} from './routeros-api.service';

type Check={label:string;passed:boolean;message:string};
type Row={key:string;kind:string;name:string;host:string;status:string;percent:number|null;checkedAt:string|null;responseMs:number|null;checks:Check[];metrics:Record<string,number>;version?:string};
async function inventory(){
 const [databases]:any=await db.query('SELECT * FROM database_servers WHERE archived_at IS NULL ORDER BY id');
 const [ssh]:any=await db.query('SELECT c.*,s.name FROM server_ssh_connections c JOIN database_servers s ON s.id=c.database_server_id WHERE s.archived_at IS NULL ORDER BY c.database_server_id');
 const [radius]:any=await db.query("SELECT id,setting_value FROM platform_settings WHERE setting_group='free_radius' ORDER BY id");
 const [gateways]:any=await db.query('SELECT * FROM ovpn_gateways ORDER BY id');
 const entries=[...databases.map((s:any)=>({key:'database:'+s.id,kind:'database',name:s.name,host:s.host,config:s})),...ssh.map((s:any)=>({key:'ssh:'+s.database_server_id,kind:'ssh',name:s.name,host:s.host,config:s})),...radius.map((s:any)=>{const c=JSON.parse(s.setting_value);return{key:'radius:'+s.id,kind:'radius',name:c.name,host:c.host,config:c};}),...gateways.map((s:any)=>{const c=JSON.parse(s.settings_json);return{key:'ovpn:'+s.id,kind:'ovpn',name:c.name,host:c.api_host,config:{...c,passwordEncrypted:s.api_password_encrypted}};})];
 return {entries,fingerprint:createHash('sha256').update(JSON.stringify(entries)).digest('hex')};
}
export async function readinessSchedule(){const s=await readPrivateSetting('server_readiness','schedule');return{intervalMinutes:[1,5,10,15,30,60].includes(s?.intervalMinutes)?s.intervalMinutes:5};}
export async function readServerReadiness(){
 const current=await inventory(),saved=await readPrivateSetting('server_readiness','report'),schedule=await readinessSchedule();
 const same=saved?.fingerprint===current.fingerprint;
 const stale=!same||!saved?.checkedAt||Date.now()-Date.parse(saved.checkedAt)>=schedule.intervalMinutes*60000;
 const rows=current.entries.map((s:any)=>{const old=same?saved?.rows?.find((r:Row)=>r.key===s.key):undefined;return old?{...old,stale}:{key:s.key,kind:s.kind,name:s.name,host:s.host,status:'not_checked',percent:null,checkedAt:null,responseMs:null,checks:[],metrics:{},stale:true};});
 const [locks]:any=await db.query("SELECT IS_USED_LOCK('radius-lord:server-readiness') busy");
 return{rows,schedule,checking:Boolean(locks[0]?.busy),checkedAt:same?saved?.checkedAt??null:null,nextCheckAt:same&&saved?.checkedAt?new Date(Date.parse(saved.checkedAt)+schedule.intervalMinutes*60000).toISOString():null};
}
export async function checkServerReadiness(){
 const lock=await db.pool.getConnection();let acquired=false;
 try{
  const [taken]:any=await lock.query("SELECT GET_LOCK('radius-lord:server-readiness',0) acquired");acquired=Boolean(taken[0]?.acquired);if(!acquired)return;
  const current=await inventory(),rows:Row[]=[];
  for(const s of current.entries){
   const row:Row={key:s.key,kind:s.kind,name:s.name,host:s.host,status:'not_checked',percent:null,checkedAt:null,responseMs:null,checks:[],metrics:{}};
   const start=Date.now(),c=s.config;
   const add=(label:string,passed:boolean,message:string)=>row.checks.push({label,passed,message});
   try{
    if(s.kind==='database'){
     if(c.tls_ca_reference)throw Error('CUSTOM_CA');
     const connection=await mysql.createConnection({host:c.host,port:c.port,user:c.provisioning_username,password:decryptProvisioningSecret(c.provisioning_password_encrypted),connectTimeout:8000,...(c.tls_required?{ssl:{rejectUnauthorized:true}}:{})});
     try{const [info]:any=await connection.query({sql:'SELECT VERSION() version,@@GLOBAL.max_connections capacity',timeout:5000});add('اتصال MySQL',true,'نجح الاتصال بالحساب المحفوظ.');row.version=info[0].version;add('الإصدار',/^8\./.test(info[0].version)&&!/mariadb/i.test(info[0].version),'يلزم MySQL 8 للتوليد.');
      const [status]:any=await connection.query({sql:"SHOW GLOBAL STATUS WHERE Variable_name IN ('Threads_connected','Uptime')",timeout:5000});const values=Object.fromEntries(status.map((v:any)=>[v.Variable_name,Number(v.Value)]));row.metrics.connections=Math.round(values.Threads_connected*100/Number(info[0].capacity));add('سعة الاتصالات',Number(info[0].capacity)>values.Threads_connected+4,'توفر اتصالات تشغيل إضافية.');add('استقبال البيئات',c.status==='active'&&Boolean(c.accepts_new_environments),'وفق حالة الخادم وخيار استقبال البيئات المحفوظ.');
     }finally{await connection.end().catch(()=>{});}
    }else if(s.kind==='ssh'){
     row.metrics=await readUbuntuReadiness(c.database_server_id);add('اتصال SSH والموارد',true,'اتصال موثوق وقراءة فعلية لموارد Ubuntu.');
    }else if(s.kind==='radius'){
     if(c.sshServerId){try{await inspectInstalledRadius(c.sshServerId);add('تشغيل الخدمة وإعدادها',true,'الخدمة تعمل وفحص الإعداد ناجح.');}catch{add('تشغيل الخدمة وإعدادها',false,'تعذر فحص الخدمة عبر SSH.');}}
     else add('تشغيل الخدمة وإعدادها',false,'لم يُربط اتصال SSH بالخدمة.');
     if(!c.secretEncrypted||!c.testPasswordEncrypted){add('المصادقة',false,'أكمل ربط حساب الاختبار أولًا.');add('المحاسبة وقاعدتها',false,'قاعدة الاختبار غير جاهزة.');}
     else{const h=await checkRadiusHealth(c);add('المصادقة',h.authentication==='accepted','اختبار مستخدم RADIUS المخصص.');add('المحاسبة وقاعدتها',h.accounting==='verified'&&h.database==='verified','التحقق من سجل محاسبة فعلي في قاعدة الاختبار.');}
    }else{
     const api=await RouterApi.connect({host:c.api_host,port:c.api_port,username:c.api_username,password:decryptProvisioningSecret(c.passwordEncrypted),secure:c.api_tls});
     try{const resource=(await api.command('/system/resource/print',{'.proplist':'cpu-load,free-memory,total-memory,free-hdd-space,total-hdd-space,version'}))[0];if(!resource)throw Error('NO_RESOURCE');add('اتصال API',true,'نجح الاتصال بالبوابة.');row.version=resource.version;row.metrics.cpu=Number(resource['cpu-load']);for(const [key,free,total] of [['memory','free-memory','total-memory'],['disk','free-hdd-space','total-hdd-space']]){if(Number(resource[total])>0)row.metrics[key]=Math.round(100*(1-Number(resource[free])/Number(resource[total])));}
      const service=(await api.command('/interface/ovpn-server/server/print')).find(v=>Number(v.port)===Number(c.ovpn_port)&&v.certificate===c.certificate_name&&v['default-profile']===c.ppp_profile);add('خدمة OpenVPN',Boolean(service)&&(['yes','true'].includes(service!.enabled)||['no','false'].includes(service!.disabled)),'تشغيل الخدمة وتطابق المنفذ؛ اختبار النفق يتم عند تجهيز الشبكة.');add('التجهيز المحفوظ',c.enabled===true&&c.provision_state==='ready','تفعيل البوابة واكتمال تجهيزها.');
     }finally{api.close();}
    }
   }catch{add('الاتصال أو صلاحيات الفحص',false,'تعذر إكمال الفحص؛ راجع الاتصال والبيانات والصلاحيات.');}
   row.responseMs=Date.now()-start;row.checkedAt=new Date().toISOString();row.percent=Math.round(100*row.checks.filter(v=>v.passed).length/row.checks.length);row.status=row.percent===100?'ready':row.checks.some(v=>v.passed)?'degraded':'unavailable';rows.push(row);
  }
  const latest=await inventory();if(latest.fingerprint===current.fingerprint)await savePrivateSetting('server_readiness','report',{fingerprint:current.fingerprint,rows,checkedAt:new Date().toISOString()});
 }finally{try{if(acquired)await lock.query("SELECT RELEASE_LOCK('radius-lord:server-readiness')");}finally{lock.release();}}
}
let timer:NodeJS.Timeout|undefined;
export function startServerReadinessWorker(){
 if(timer)return;let running=false;
 const tick=async()=>{if(running)return;running=true;try{const report=await readServerReadiness();if(!report.checking&&report.rows.some((r:any)=>r.stale))await checkServerReadiness();}catch{console.warn('Server readiness check unavailable.');}finally{running=false;}};
 timer=setInterval(()=>void tick(),15000);timer.unref();void tick();return()=>{clearInterval(timer);timer=undefined;};
}
