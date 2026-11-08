import {spawn} from 'child_process';
import {mkdir,readFile,readdir,writeFile,rename,open} from 'fs/promises';
import {isAbsolute,join,relative} from 'path';
import {randomUUID} from 'crypto';
import {db} from '../config/db';

const branch='work/subscriptions-customer-details';
const versionPattern=/^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
type Target={url:string;host:string;user:string;port:number;path:string};
type Release={schemaChanges?:string[];version:string;commit:string;changes:string;createdAt:string;actorId:number;status:string;target:Target;remote?:any;updatedAt:string};
export class GitReleaseError extends Error{
 constructor(public status:number,message:string){super(message);}
}
function configuration(){
 const repo=process.env.RADIUS_GIT_RELEASE_REPO,state=process.env.RADIUS_GIT_RELEASE_STATE_DIR;
 if(process.env.RADIUS_GIT_RELEASE_ENABLED!=='1'||!repo||!state||!isAbsolute(repo)||!isAbsolute(state))return null;
 const inside=relative(repo,state);
 if(!inside.startsWith('..')&&!isAbsolute(inside))return null;
 return {repo,state};
}
function run(command:string,args:string[],cwd?:string,timeout=20000){
 return new Promise<string>((resolve,reject)=>{
  const child=spawn(command,args,{cwd,shell:false,windowsHide:true,env:{...process.env,GIT_TERMINAL_PROMPT:'0',GIT_SSH_COMMAND:'ssh -oBatchMode=yes -oStrictHostKeyChecking=yes'}});
  let result='',failed=false;
  const timer=setTimeout(()=>{failed=true;child.kill();reject(new GitReleaseError(504,'انتهت مهلة الاتصال أو الأمر. حدّث السجل للتحقق من نتيجة الإرسال.'));},timeout);
  const collect=(chunk:Buffer)=>{
   result+=chunk.toString('utf8');
   if(Buffer.byteLength(result)>4*1024*1024){failed=true;child.kill();clearTimeout(timer);reject(new GitReleaseError(502,'تجاوز خرج العملية الحجم المسموح.'));}
  };
  child.stdout.on('data',collect);
  // Keep remote command errors separate from the JSON response and out of release metadata.
  child.stderr.on('data',()=>{});
  child.on('error',()=>{clearTimeout(timer);if(!failed)reject(new GitReleaseError(503,'تعذر تشغيل Git أو SSH. تحقق من تهيئة جهاز الإصدار.'));});
  child.on('close',code=>{clearTimeout(timer);if(failed)return;code===0?resolve(result.trim()):reject(new GitReleaseError(502,'تعذرت العملية. تحقق من اتصال SSH وصلاحيات مستودع الاستضافة.'));});
 });
}
function target(url:string):Target{
 let host='',user='',port=22,path='';
 if(url.startsWith('ssh://')){
  const parsed=new URL(url);
  if(parsed.password||parsed.search||parsed.hash)throw new GitReleaseError(422,'وجهة hosting يجب أن تكون اتصال Git عبر SSH.');
  host=parsed.hostname;user=parsed.username;port=Number(parsed.port||22);path=parsed.pathname;
 }else{
  const match=/^([a-z_][a-z0-9_-]*)@([a-z0-9.-]+):(\/[a-zA-Z0-9_./-]+)$/.exec(url);
  if(match){[,user,host,path]=match;}
 }
 if(!/^[a-z_][a-z0-9_-]*$/.test(user)||!/^[a-z0-9][a-z0-9.-]*$/i.test(host)||!Number.isInteger(port)||port<1||port>65535||
  !/^\/[a-zA-Z0-9_./-]+\.git$/.test(path)||path.split('/').includes('..'))throw new GitReleaseError(422,'استخدم وجهة hosting عبر SSH باسم مستخدم ومسار مطلق ينتهي بـ .git.');
 return {url,host,user,port,path};
}
const quote=(value:string)=>"'"+value.replace(/'/g,"'\\''")+"'";
async function remote(t:Target,operation:'inspect'|'status',version?:string){
 const command=['python3',t.path+'/hooks/radius-deploy.py',operation,...(version?[version]:[])].map(quote).join(' ');
 const output=await run('ssh',['-oBatchMode=yes','-oStrictHostKeyChecking=yes','-p',String(t.port),t.user+'@'+t.host,command],undefined,25000);
 try{return JSON.parse(output);}catch{throw new GitReleaseError(502,'تعذر قراءة حالة عامل النشر على الاستضافة.');}
}
function version(value:unknown){
 if(typeof value!=='string'||value.length>32||!versionPattern.test(value))throw new GitReleaseError(422,'أدخل رقم إصدار مثل v1.4.0.');
 return 'v'+value.replace(/^v/,'');
}
async function save(root:string,release:Release){
 const temporary=join(root,'.'+randomUUID()+'.json');
 await writeFile(temporary,JSON.stringify(release,null,2),{mode:0o600,flag:'wx'});
 await rename(temporary,join(root,release.version+'.json'));
}
async function read(root:string,name:string):Promise<Release>{
 try{return JSON.parse(await readFile(join(root,version(name)+'.json'),'utf8'));}
 catch(error){if(error instanceof GitReleaseError)throw error;throw new GitReleaseError(404,'الإصدار غير موجود في سجل جهازك.');}
}
async function source(){
 const config=configuration();
 if(!config)throw new GitReleaseError(503,'الإرسال متاح بعد إعداد نسخة التطوير المحلية ووجهة الاستضافة.');
 const [head,currentBranch,status,url,origin]=await Promise.all([
  run('git',['rev-parse','HEAD'],config.repo),
  run('git',['branch','--show-current'],config.repo),
  run('git',['status','--porcelain=v1','--untracked-files=all'],config.repo),
  run('git',['remote','get-url','hosting'],config.repo),
  run('git',['remote','get-url','origin'],config.repo),
 ]);
 if(!/^[a-f0-9]{40}$/.test(head)||!/[/:]radius2026lord-cloud\/Radius-Lord(?:\.git)?$/i.test(origin))throw new GitReleaseError(409,'اختر مجلد مستودع Radius Lord المعتمد.');
 return {...config,commit:head,branch:currentBranch,dirty:status?status.split('\n'):[],target:target(url)};
}
export async function getGitReleases(){
 const config=configuration();
 if(!config)return {enabled:false,releases:[],source:null};
 await mkdir(config.state,{recursive:true,mode:0o700});
 const names=(await readdir(config.state)).filter(name=>/^v\d+\.\d+\.\d+\.json$/.test(name));
 const releases=await Promise.all(names.map(async name=>JSON.parse(await readFile(join(config.state,name),'utf8')) as Release));
 let info=null,sourceError='';
 try{const s=await source();info={commit:s.commit,branch:s.branch,dirty:s.dirty.slice(0,50),dirtyCount:s.dirty.length,target:s.target.host+':'+s.target.path};}
 catch(error){sourceError=error instanceof Error?error.message:'تعذر قراءة المجلد المحلي.';}
 return {enabled:true,source:info,sourceError,releases:releases.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(({target,...release})=>release)};
}
export async function prepareGitRelease(body:any,actorId:number){
 const s=await source(),name=version(body?.version),changes=String(body?.changes??'').trim();
 if(!changes||changes.length>4000||body?.tested!==true)throw new GitReleaseError(422,'أضف سجل التغييرات وأكد تجربة الإصدار محليًا.');
 if(s.branch!==branch||s.dirty.length)throw new GitReleaseError(409,'احفظ تعديلاتك على الفرع المعتمد ونظّف المجلد قبل تجهيز الإصدار.');
 const inspected=await remote(s.target,'inspect');
 if(!inspected.ready)throw new GitReleaseError(409,'الاستضافة تحتاج استكمال الجاهزية. راجع فحص الخادم.');
 if(inspected.currentCommit&&!/^[a-f0-9]{40}$/.test(inspected.currentCommit))throw new GitReleaseError(502,'معرّف الإصدار المشغّل على الاستضافة غير صالح.');
 const tracked=await run('git',['ls-tree','-r','--name-only',s.commit],s.repo);
 if(tracked.split('\n').some(path=>/^(?:.*\/)?\.env(?:\..*)?$/.test(path)&&!/[.](example|sample|template)$/.test(path)))throw new GitReleaseError(409,'استبعد ملفات البيئة الخاصة من Git قبل إرسال الإصدار.');
 await run('git',['var','GIT_COMMITTER_IDENT'],s.repo);
 const existing=await remote(s.target,'status',name);
 if(existing.status!=='not_received')throw new GitReleaseError(409,'رقم الإصدار موجود على الاستضافة. اختر رقمًا جديدًا.');
 const diff=inspected.currentCommit
  ?await run('git',['diff','--name-only',String(inspected.currentCommit),s.commit],s.repo)
  :await run('git',['ls-tree','-r','--name-only',s.commit],s.repo);
 const schemaChanges=diff.split('\n').filter(path=>path.endsWith('.sql')||path.includes('/migrations/'));
 if(schemaChanges.length&&!inspected.migrationReady)throw new GitReleaseError(409,'الإصدار يتضمن تغييرات قاعدة بيانات. جهّز عامل الترحيل على الاستضافة قبل الإرسال.');
 const release:Release={schemaChanges,version:name,commit:s.commit,changes,actorId,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),status:'prepared',target:s.target};
 await mkdir(s.state,{recursive:true,mode:0o700});
 const file=await open(join(s.state,name+'.json'),'wx',0o600).catch(()=>{throw new GitReleaseError(409,'رقم الإصدار مستخدم في سجل جهازك.');});
 try{await file.writeFile(JSON.stringify(release,null,2));}finally{await file.close();}
 return {release:{...release,target:undefined},preflight:{...inspected,schemaChanges}};
}
export async function inspectGitHosting(){
 const s=await source();
 return remote(s.target,'inspect');
}
export async function sendGitRelease(name:string,expectedCommit:unknown){
 const s=await source(),release=await read(s.state,name);
 if(expectedCommit!==release.commit||s.commit!==release.commit||s.dirty.length||s.branch!==branch||s.target.url!==release.target.url)throw new GitReleaseError(409,'تغير المصدر أو وجهة الاستضافة. جهّز إصدارًا جديدًا للمراجعة.');
 if(!['prepared','delivery_unknown'].includes(release.status))throw new GitReleaseError(409,'الإصدار أُرسل مسبقًا. حدّث حالته من السجل.');
 const lock=await db.pool.getConnection();
 let acquired=false;
 try{
  const [locks]:any=await lock.query("SELECT GET_LOCK('lord-git-release-upload',0) acquired");
  acquired=Number(locks[0]?.acquired)===1;
 }catch(error){lock.destroy();throw error;}
 if(!acquired){lock.release();throw new GitReleaseError(409,'توجد عملية إرسال قيد التنفيذ.');}
 release.status='sending';release.updatedAt=new Date().toISOString();
 try{await save(s.state,release);}catch(error){
  try{await lock.query("SELECT RELEASE_LOCK('lord-git-release-upload')");lock.release();}catch{lock.destroy();}
  throw error;
 }
 void (async()=>{
  try{
   const reference='refs/tags/radius-release/'+release.version;
   const manifest=JSON.stringify({version:release.version,commit:release.commit,changes:release.changes,createdAt:release.createdAt,actorId:release.actorId});
   // Reuse an identical local tag after an interrupted delivery.
   let exists=false;
   const old=await run('git',['for-each-ref','--format=%(contents)',reference],s.repo);
   if(old){if(old!==manifest)throw new GitReleaseError(409,'وسم الإصدار المحلي مختلف. استخدم رقمًا جديدًا.');exists=true;}
   if(!exists)await run('git',['tag','-a','radius-release/'+release.version,release.commit,'-m',manifest],s.repo);
   await run('git',['push','hosting',reference+':'+reference],s.repo,180000);
   release.status='received';
  }catch{release.status='delivery_unknown';}
  finally{
   release.updatedAt=new Date().toISOString();
   try{await save(s.state,release);}finally{
    try{await lock.query("SELECT RELEASE_LOCK('lord-git-release-upload')");lock.release();}catch{lock.destroy();}
   }
  }
 })().catch(()=>{});
 return {version:release.version,status:'sending'};
}
export async function refreshGitRelease(name:string){
 const config=configuration();
 if(!config)throw new GitReleaseError(503,'هذا الإجراء متاح على جهاز الإصدار المحلي.');
 const release=await read(config.state,name);
 if(release.status==='prepared')return {...release,target:undefined};
 const result=await remote(release.target,'status',release.version);
 if(result.commit&&result.commit!==release.commit)throw new GitReleaseError(409,'معرّف الإصدار على الاستضافة مختلف عن الإصدار المحلي.');
 if(result.status==='not_received'&&release.status==='sending'){
  const [locks]:any=await db.query("SELECT IS_FREE_LOCK('lord-git-release-upload') available");
  if(Number(locks[0]?.available)===1){release.status='delivery_unknown';release.updatedAt=new Date().toISOString();await save(config.state,release);}
 }
 if(result.status!=='not_received'){
  release.remote=result;release.status=result.status;release.updatedAt=new Date().toISOString();
  await save(config.state,release);
 }
 return {...release,target:undefined};
}
export async function getHostedGitReleases(){
 const root=process.env.RADIUS_HOST_RELEASE_ROOT;
 if(!root||!isAbsolute(root))return [];
 const names=await readdir(join(root,'status')).catch(error=>{if(error.code==='ENOENT')return [];throw error;});
 const records=await Promise.all(names.filter(name=>/^v\d+\.\d+\.\d+\.json$/.test(name)).map(async name=>JSON.parse(await readFile(join(root,'status',name),'utf8'))));
 return records.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
}
