import {withNetwork} from './network-runtime.service';
import {managerAccess} from './network-manager-access.service';
import {disconnectPppoeSessions} from './network-radius-disconnect.service';

const quotaCursors=new Map<string,number>();

function dateValue(value:any):Date{
 if(value instanceof Date)return new Date(value.getTime());
 const text=String(value??'');
 const date=new Date(/[zZ]|[+-]\d\d:\d\d$/.test(text)?text:text.replace(' ','T')+'Z');
 if(!Number.isFinite(date.getTime()))throw new Error('PPPOE_LIFECYCLE_TIME');
 return date;
}
function localParts(date:Date,zone:string){return Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'numeric',day:'numeric',hour:'numeric',minute:'numeric',second:'numeric',hourCycle:'h23'}).formatToParts(date).filter(part=>part.type!=='literal').map(part=>[part.type,Number(part.value)])) as any;}
function resolveLocal(parts:any,zone:string){
 const utc=(value:any)=>Date.UTC(value.year,value.month-1,value.day,value.hour||0,value.minute||0,value.second||0);
 let result=new Date(utc(parts));
 for(let index=0;index<5;index++){const offset=utc(parts)-utc(localParts(result,zone));if(!offset)return result;result=new Date(result.getTime()+offset);}
 throw new Error('PPPOE_LIFECYCLE_TIMEZONE');
}
export function parsePppoeLocalDateTime(value:any,zone:string){
 const match=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(String(value??''));
 if(!match)throw new Error('PPPOE_LINE_EXPIRY_INVALID');
 const [,yearText,monthText,dayText,hourText,minuteText,secondText]=match,parts={year:Number(yearText),month:Number(monthText),day:Number(dayText),hour:Number(hourText),minute:Number(minuteText),second:Number(secondText||0)};
 if(parts.year<1900||parts.month<1||parts.month>12||parts.day<1||parts.day>new Date(Date.UTC(parts.year,parts.month,0)).getUTCDate()||parts.hour>23||parts.minute>59||parts.second>59)throw new Error('PPPOE_LINE_EXPIRY_INVALID');
 let date:Date;try{date=resolveLocal(parts,zone);const resolved=localParts(date,zone);if((['year','month','day','hour','minute','second'] as const).some(key=>resolved[key]!==parts[key]))throw new Error('invalid local time');}catch{throw new Error('PPPOE_LINE_EXPIRY_INVALID');}
 return date;
}
function addCalendarMonths(start:Date,months:number,zone:string){
 const parts=localParts(start,zone),next=new Date(Date.UTC(parts.year,parts.month-1+months,1));
 const year=next.getUTCFullYear(),month=next.getUTCMonth()+1,day=Math.min(parts.day,new Date(Date.UTC(year,month,0)).getUTCDate());
 return resolveLocal({...parts,year,month,day},zone);
}
export function pppoeExpiry(startValue:any,service:any,zone:string){
 if(service?.expires_at_override)return dateValue(service.expires_at_override);
 const start=dateValue(startValue),mode=String(service.validity_mode||'duration'),parts=localParts(start,zone);
 if(mode==='calendar_monthly'){
  const month=parts.month===12?1:parts.month+1,year=parts.month===12?parts.year+1:parts.year;
  return resolveLocal({year,month,day:1,hour:0,minute:0,second:0},zone);
 }
 if(mode==='fixed_day'){
  const day=Number(service.expiry_day),[hour,minute,second=0]=String(service.expiry_time||'00:00:00').split(':').map(Number);
  if(!Number.isInteger(day)||day<1||day>31||!Number.isInteger(hour)||hour<0||hour>23||!Number.isInteger(minute)||minute<0||minute>59)throw new Error('PPPOE_LIFECYCLE_POLICY');
  let year=parts.year,month=parts.month;
  const candidate=()=>resolveLocal({year,month,day:Math.min(day,new Date(Date.UTC(year,month,0)).getUTCDate()),hour,minute,second},zone);
  let expiry=candidate();if(expiry<=start){month++;if(month===13){month=1;year++;}expiry=candidate();}return expiry;
 }
 if(mode!=='duration')throw new Error('PPPOE_LIFECYCLE_POLICY');
 const amount=Number(service.duration_value),unit=service.units?.time;
 if(!Number.isInteger(amount)||amount<1||!unit)throw new Error('PPPOE_LIFECYCLE_POLICY');
 if(unit.calculation_kind==='calendar')return addCalendarMonths(start,amount,zone);
 const seconds=Number(unit.seconds_per_unit);if(!Number.isFinite(seconds)||seconds<=0)throw new Error('PPPOE_LIFECYCLE_POLICY');
 return new Date(start.getTime()+amount*seconds*1000);
}
function sqlDate(date:Date){return date.toISOString().slice(0,23).replace('T',' ');}
async function principal(app:any,scope:any){const access=await managerAccess(app,scope.managerId,scope.authVersion);if(access.role!=='principal')throw new Error('NETWORK_AUTH');return access;}
async function systemEvent(app:any,action:string,accountId:number,identityId:number,data:any){await app.query("INSERT INTO activity_log(actor_kind,action_code,target_type,target_id,account_id,after_data,result) VALUES('system',?,'pppoe_account',?,?,?,'success')",[action,accountId,identityId,JSON.stringify(data)]);}
async function markRejected(app:any,username:string,reject:boolean){
 await app.query("DELETE FROM radcheck WHERE username=? AND attribute='Auth-Type' AND value='Reject'",[username]);
 if(reject)await app.query("INSERT INTO radcheck(username,attribute,op,value) VALUES(?,'Auth-Type',':=','Reject')",[username]);
 if(reject)await app.query("DELETE FROM radreply WHERE username=? AND attribute='Session-Timeout'",[username]);
}
async function setSessionTimeout(app:any,username:string,end:Date){
 const seconds=Math.max(1,Math.ceil((end.getTime()-Date.now())/1000));
 await app.query("DELETE FROM radreply WHERE username=? AND attribute='Session-Timeout'",[username]);
 await app.query("INSERT INTO radreply(username,attribute,op,value) VALUES(?,'Session-Timeout',':=',?)",[username,String(seconds)]);
}
function radiusRate(value:any){const n=BigInt(String(value)),g=BigInt(1000000000),m=BigInt(1000000),k=BigInt(1000);if(n%g===BigInt(0))return n/g+'G';if(n%m===BigInt(0))return n/m+'M';if(n%k===BigInt(0))return n/k+'k';return String(n);}
async function applyReducedSpeed(app:any,row:any,username:string,service:any){
 const group='rlr_'+String(row.id);
 const [membership]:any=await app.query('SELECT id FROM radusergroup WHERE username=? AND groupname=? LIMIT 1',[username,group]);
 if(membership.length)return false;
 const [base]:any=await app.query('SELECT radius_group_name FROM pppoe_package_versions WHERE id=?',[row.package_version_id]);
 if(!base[0])throw new Error('PPPOE_LIFECYCLE_PROFILE');
 const download=service.reduced_download_bps,upload=service.reduced_upload_bps;
 if(!download||!upload)throw new Error('PPPOE_LIFECYCLE_POLICY');
 const reduced=radiusRate(upload)+'/'+radiusRate(download),source=base[0].radius_group_name;
 const [replyRows]:any=await app.query("SELECT attribute,op,value FROM radgroupreply WHERE groupname=?",[source]);
 if(replyRows.length){
  const values=replyRows.map((item:any)=>[group,item.attribute,item.op,item.attribute==='Mikrotik-Rate-Limit'?reduced:item.value]);
  await app.query('INSERT INTO radgroupreply(groupname,attribute,op,value) VALUES '+values.map(()=>'(?,?,?,?)').join(','),values.flat());
 }
 if(!replyRows.some((item:any)=>item.attribute==='Mikrotik-Rate-Limit'))await app.query("INSERT INTO radgroupreply(groupname,attribute,op,value) VALUES(?,'Mikrotik-Rate-Limit','=',?)",[group,reduced]);
 const [checks]:any=await app.query('SELECT attribute,op,value FROM radgroupcheck WHERE groupname=?',[source]);
 if(checks.length){const values=checks.map((item:any)=>[group,item.attribute,item.op,item.value]);await app.query('INSERT INTO radgroupcheck(groupname,attribute,op,value) VALUES '+values.map(()=>'(?,?,?,?)').join(','),values.flat());}
 const [changed]:any=await app.query('UPDATE radusergroup SET groupname=? WHERE username=? AND groupname=?',[group,username,source]);
 if(!changed.affectedRows)await app.query('INSERT INTO radusergroup(username,groupname,priority) VALUES(?,?,1)',[username,group]);
 return true;
}
async function recordActivation(app:any,sub:any,username:string,startedAt:Date,zone:string){
 const service=typeof sub.effective_service_snapshot==='string'?JSON.parse(sub.effective_service_snapshot):sub.effective_service_snapshot;
 const expiresAt=pppoeExpiry(startedAt,service,zone),graceDays=Math.max(0,Number(sub.grace_days_snapshot||0));
 const graceEnds=graceDays?new Date(expiresAt.getTime()+graceDays*86400000):expiresAt;
 const [clock]:any=await app.query('SELECT UTC_TIMESTAMP(6) AS now_utc');
 if(graceEnds.getTime()<=dateValue(clock[0].now_utc).getTime()){
  await app.query("UPDATE pppoe_subscriptions SET lifecycle='ended',ended_at=UTC_TIMESTAMP(6),activated_at=?,expires_at=?,grace_expires_at=? WHERE id=? AND lifecycle='pending'",[sqlDate(startedAt),sqlDate(expiresAt),graceDays?sqlDate(graceEnds):null,sub.id]);
  await markRejected(app,username,true);return {lifecycle:'ended',expiresAt:sqlDate(expiresAt)};
 }
 await app.query("UPDATE pppoe_subscriptions SET lifecycle='active',activated_at=?,expires_at=?,grace_expires_at=? WHERE id=? AND lifecycle='pending'",[sqlDate(startedAt),sqlDate(expiresAt),graceDays?sqlDate(graceEnds):null,sub.id]);
 await markRejected(app,username,false);
 await setSessionTimeout(app,username,graceEnds);
 return {lifecycle:'active',expiresAt:sqlDate(expiresAt),graceExpiresAt:graceDays?sqlDate(graceEnds):null};
}

export async function activatePppoeLine(scope:any,value:any){
 return withNetwork(scope,async app=>{await app.beginTransaction();try{
  await principal(app,scope);const id=Number(value);if(!Number.isSafeInteger(id)||id<1)throw new Error('PPPOE_LINE_INPUT');
  const [rows]:any=await app.query("SELECT a.id,a.radius_identity_id,a.admin_status,a.created_at,r.current_username username,s.* FROM pppoe_accounts a JOIN radius_identities r ON r.id=a.radius_identity_id JOIN pppoe_subscriptions s ON s.account_id=a.id AND s.service_role='base' AND s.lifecycle='pending' WHERE a.id=? AND a.archived_at IS NULL FOR UPDATE",[id]);
  const sub=rows[0];if(!sub)throw new Error('PPPOE_LINE_NOT_PENDING');if(sub.admin_status!=='enabled')throw new Error('PPPOE_LINE_DISABLED');
  const service=typeof sub.effective_service_snapshot==='string'?JSON.parse(sub.effective_service_snapshot):sub.effective_service_snapshot;
  const [settings]:any=await app.query('SELECT timezone FROM network_settings WHERE id=1');const zone=settings[0]?.timezone||'Asia/Damascus';
  const startsAt=service.starts_at;
  if(startsAt==='first_connection'){
   await markRejected(app,sub.username,false);
   const [actor]:any=await app.query('SELECT id,full_name FROM managers WHERE id=?',[scope.managerId]);
   await app.query("INSERT INTO activity_log(actor_manager_id,actor_snapshot,actor_kind,action_code,target_type,target_id,account_id,after_data,result) VALUES(?,?,'manager','pppoe.line.enable','pppoe_account',?,?,?,'success')",[scope.managerId,JSON.stringify({id:actor[0]?.id,full_name:actor[0]?.full_name}),id,sub.radius_identity_id,JSON.stringify({lifecycle:'pending',startsAt:'first_connection'})]);
   await app.commit();return {success:true,id,lifecycle:'pending',awaitingFirstConnection:true};
  }
  let startedAt:Date;
  if(startsAt==='creation')startedAt=dateValue(sub.created_at);
  else{const [clock]:any=await app.query('SELECT UTC_TIMESTAMP(6) AS now_utc');startedAt=dateValue(clock[0].now_utc);}
  const result=await recordActivation(app,sub,sub.username,startedAt,zone);
  const [actor]:any=await app.query('SELECT id,full_name FROM managers WHERE id=?',[scope.managerId]);
  await app.query("INSERT INTO activity_log(actor_manager_id,actor_snapshot,actor_kind,action_code,target_type,target_id,account_id,after_data,result) VALUES(?,?,'manager',?,'pppoe_account',?,?,?,'success')",[scope.managerId,JSON.stringify({id:actor[0]?.id,full_name:actor[0]?.full_name}),result.lifecycle==='active'?'pppoe.line.activate':'pppoe.line.expire',id,sub.radius_identity_id,JSON.stringify({lifecycle:result.lifecycle,expiresAt:result.expiresAt})]);
  await app.commit();return {success:true,id,...result};
 }catch(error){await app.rollback();throw error;}});
}
export async function setPppoeLineStatus(scope:any,value:any,statusValue:any){
 return withNetwork(scope,async app=>{await app.beginTransaction();try{
  const access=await principal(app,scope),id=Number(value),status=String(statusValue);if(!Number.isSafeInteger(id)||id<1||!['enabled','disabled'].includes(status))throw new Error('PPPOE_LINE_INPUT');
  const [rows]:any=await app.query("SELECT a.id,a.admin_status,a.radius_identity_id,r.current_username username,s.lifecycle,s.expires_at,s.grace_expires_at,JSON_UNQUOTE(JSON_EXTRACT(s.effective_service_snapshot,'$.starts_at')) starts_at FROM pppoe_accounts a JOIN radius_identities r ON r.id=a.radius_identity_id LEFT JOIN pppoe_subscriptions s ON s.account_id=a.id AND s.live_role='base' WHERE a.id=? AND a.archived_at IS NULL FOR UPDATE",[id]);
  const row=rows[0];if(!row)throw new Error('PPPOE_LINE_UNAVAILABLE');
  if(status==='enabled'&&!['active','pending'].includes(row.lifecycle))throw new Error('PPPOE_LINE_NOT_ACTIVE');
  const due=row.lifecycle==='active'&&dateValue(row.grace_expires_at||row.expires_at).getTime()<=Date.now();
  if(status==='enabled'&&due)throw new Error('PPPOE_LINE_EXPIRED');
  await app.query('UPDATE pppoe_accounts SET admin_status=? WHERE id=?',[status,id]);
  const keepLocked=status==='disabled'||due||row.lifecycle!=='active'&&row.starts_at!=='first_connection';
  await markRejected(app,row.username,keepLocked);
  if(status==='enabled'&&!due&&row.lifecycle==='active')await setSessionTimeout(app,row.username,dateValue(row.grace_expires_at||row.expires_at));
  const [actor]:any=await app.query('SELECT id,full_name FROM managers WHERE id=?',[scope.managerId]);
  await app.query("INSERT INTO activity_log(actor_manager_id,actor_snapshot,actor_kind,action_code,target_type,target_id,account_id,before_data,after_data,result) VALUES(?,?,'manager',?,'pppoe_account',?,?,?,?, 'success')",[scope.managerId,JSON.stringify({id:actor[0]?.id,full_name:actor[0]?.full_name}),status==='disabled'?'pppoe.line.disable':'pppoe.line.enable',id,row.radius_identity_id,JSON.stringify({status:row.admin_status}),JSON.stringify({status})]);
  await app.commit();let disconnectPending=false;if(status==='disabled')try{const result=await disconnectPppoeSessions(scope,app,row.username);disconnectPending=result.acknowledged<result.attempted;}catch{disconnectPending=true;}return {success:true,id,status,disconnectPending};
 }catch(error){await app.rollback();throw error;}});
}

export async function renewPppoeLine(scope:any,value:any){
 return withNetwork(scope,async app=>{await app.beginTransaction();let username='';let identityId=0;let accountId=Number(value);let disconnectPending=false;try{
  await principal(app,scope);if(!Number.isSafeInteger(accountId)||accountId<1)throw new Error('PPPOE_LINE_INPUT');
  const [rows]:any=await app.query("SELECT a.id,a.admin_status,a.radius_identity_id,r.current_username username,s.id subscription_id,s.lifecycle,s.package_version_id,s.expires_at,s.grace_expires_at FROM pppoe_accounts a JOIN radius_identities r ON r.id=a.radius_identity_id JOIN pppoe_subscriptions s ON s.id=(SELECT latest.id FROM pppoe_subscriptions latest WHERE latest.account_id=a.id AND latest.service_role='base' ORDER BY latest.id DESC LIMIT 1) WHERE a.id=? AND a.archived_at IS NULL FOR UPDATE",[accountId]);
  const old=rows[0];if(!old)throw new Error('PPPOE_LINE_UNAVAILABLE');username=String(old.username);identityId=Number(old.radius_identity_id);
  if(old.lifecycle==='pending')throw new Error('PPPOE_LINE_RENEW_PENDING');
  const [clock]:any=await app.query('SELECT UTC_TIMESTAMP(6) AS now_utc');const now=dateValue(clock[0].now_utc);
  if(old.lifecycle==='active'&&dateValue(old.grace_expires_at||old.expires_at)>now)throw new Error('PPPOE_LINE_RENEW_ACTIVE');
  if(!['active','ended'].includes(String(old.lifecycle)))throw new Error('PPPOE_LINE_RENEW_UNAVAILABLE');
  const [profileRows]:any=await app.query("SELECT p.id package_id,p.name,p.base_price,p.offer_price,p.offer_ends_at,p.currency_code,p.is_gift,v.id package_version_id,v.version_no,v.radius_group_name,v.service_snapshot FROM pppoe_package_versions oldv JOIN pppoe_packages p ON p.id=oldv.package_id JOIN pppoe_package_versions v ON v.package_id=p.id AND v.version_no=(SELECT MAX(latest.version_no) FROM pppoe_package_versions latest WHERE latest.package_id=p.id) WHERE oldv.id=? AND p.is_enabled=1 AND p.archived_at IS NULL FOR UPDATE",[old.package_version_id]);
  const profile=profileRows[0];if(!profile)throw new Error('PPPOE_LINE_RENEW_PROFILE_UNAVAILABLE');
  const service=typeof profile.service_snapshot==='string'?JSON.parse(profile.service_snapshot):profile.service_snapshot;
  const [settings]:any=await app.query('SELECT timezone FROM network_settings WHERE id=1');const zone=String(settings[0]?.timezone||'Asia/Damascus');
  delete service.expires_at_override;service.starts_at='activation';service.timezone=zone;
  const activatedAt=now,expiresAt=pppoeExpiry(activatedAt,service,zone);
  const graceDays=Math.max(0,Number(service.grace_days||0));
  const [policy]:any=await app.query('SELECT grace_policy,global_grace_days FROM network_settings WHERE id=1');const graceSource=policy[0]?.grace_policy==='global'?'global':'package';const effectiveGraceDays=graceSource==='global'?Math.max(0,Number(policy[0]?.global_grace_days||0)):graceDays;const effectiveGraceEnds=effectiveGraceDays?new Date(expiresAt.getTime()+effectiveGraceDays*86400000):expiresAt;
  const gifted=Number(profile.is_gift)===1,basePrice=String(profile.base_price),offerActive=profile.offer_price!==null&&profile.offer_price!==undefined&&profile.offer_ends_at&&dateValue(profile.offer_ends_at)>now;
  const offerPrice=offerActive?String(profile.offer_price):null,effectivePrice=gifted?'0.00':offerActive?offerPrice:basePrice;
  await app.query("UPDATE pppoe_subscriptions SET lifecycle='ended',ended_at=COALESCE(ended_at,UTC_TIMESTAMP(6)) WHERE id=? AND lifecycle IN('active','ended')",[old.subscription_id]);
  const quota=service.quota_bytes??null;
  const [created]:any=await app.query("INSERT INTO pppoe_subscriptions(account_id,package_version_id,service_role,parent_subscription_id,created_by,event_type,previous_subscription_id,renewal_mode,base_price_snapshot,offer_price_snapshot,offer_ends_at_snapshot,effective_price_snapshot,currency_code,is_gift_snapshot,grace_source_snapshot,grace_days_snapshot,effective_service_snapshot,quota_allowance_bytes,lifecycle,activated_at,expires_at,grace_expires_at) VALUES(?,?,'base',NULL,?,'renewal',?,'normal',?,?,?,?,?,?,?,?,?,?,'active',?,?,?)",[accountId,profile.package_version_id,scope.managerId,old.subscription_id,basePrice,offerPrice,offerActive?profile.offer_ends_at:null,effectivePrice,profile.currency_code,gifted?1:0,graceSource,effectiveGraceDays,JSON.stringify(service),quota,sqlDate(activatedAt),sqlDate(expiresAt),effectiveGraceDays?sqlDate(effectiveGraceEnds):null]);
  await app.query('INSERT INTO pppoe_subscription_usage(subscription_id,upload_bytes,download_bytes) VALUES(?,0,0)',[created.insertId]);
  await app.query('DELETE FROM radusergroup WHERE username=?',[username]);await app.query('INSERT INTO radusergroup(username,groupname,priority) VALUES(?,?,1)',[username,profile.radius_group_name]);
  const keepLocked=old.admin_status!=='enabled';await markRejected(app,username,keepLocked);if(!keepLocked)await setSessionTimeout(app,username,effectiveGraceEnds);
  const [actor]:any=await app.query('SELECT id,full_name FROM managers WHERE id=?',[scope.managerId]);
  await app.query("INSERT INTO activity_log(actor_manager_id,actor_snapshot,actor_kind,action_code,target_type,target_id,account_id,before_data,after_data,result) VALUES(?,?,'manager','pppoe.line.renew','pppoe_account',?,?,?,?, 'success')",[scope.managerId,JSON.stringify({id:actor[0]?.id,full_name:actor[0]?.full_name}),accountId,identityId,JSON.stringify({subscriptionId:Number(old.subscription_id),lifecycle:old.lifecycle,expiresAt:old.expires_at}),JSON.stringify({subscriptionId:Number(created.insertId),packageVersionId:Number(profile.package_version_id),packageName:profile.name,versionNo:Number(profile.version_no),lifecycle:'active',expiresAt:sqlDate(expiresAt)})]);
  await app.commit();try{const result=await disconnectPppoeSessions(scope,app,username,true);disconnectPending=result.acknowledged<result.attempted;}catch{disconnectPending=true;}
  return {success:true,id:accountId,subscriptionId:Number(created.insertId),packageName:profile.name,expiresAt:sqlDate(expiresAt),disconnectPending};
 }catch(error){await app.rollback();throw error;}});
}

export async function disconnectPppoeLine(scope:any,value:any){
 return withNetwork(scope,async app=>{await principal(app,scope);const id=Number(value);if(!Number.isSafeInteger(id)||id<1)throw new Error('PPPOE_LINE_INPUT');
  const [rows]:any=await app.query("SELECT a.id,a.radius_identity_id,a.allowed_nas_id,r.current_username username FROM pppoe_accounts a JOIN radius_identities r ON r.id=a.radius_identity_id WHERE a.id=? AND a.archived_at IS NULL LIMIT 1",[id]);const row=rows[0];if(!row)throw new Error('PPPOE_LINE_UNAVAILABLE');
  const result=await disconnectPppoeSessions(scope,app,String(row.username),true,'ppp',row.allowed_nas_id==null?null:Number(row.allowed_nas_id));const [actor]:any=await app.query('SELECT id,full_name FROM managers WHERE id=?',[scope.managerId]);
  const disconnectPending=result.acknowledged<result.attempted||(result.attempted>0&&!result.verified)||(result.apiFailures||0)>0;
  await app.query("INSERT INTO activity_log(actor_manager_id,actor_snapshot,actor_kind,action_code,target_type,target_id,account_id,after_data,result) VALUES(?,?,'manager','pppoe.line.disconnect','pppoe_account',?,?,?,?)",[scope.managerId,JSON.stringify({id:actor[0]?.id,full_name:actor[0]?.full_name}),id,row.radius_identity_id,JSON.stringify(result),disconnectPending?'failed':'success']);
  return {success:!disconnectPending,id,...result,disconnectPending};
 });
}

export async function readPppoeLineUsageHistory(scope:any,value:any){
 return withNetwork(scope,async app=>{await principal(app,scope);const id=Number(value);if(!Number.isSafeInteger(id)||id<1)throw new Error('PPPOE_LINE_INPUT');
  const [rows]:any=await app.query("SELECT a.id,a.customer_id,r.current_username username,s.id subscription_id,s.expires_at,COALESCE(u.upload_bytes,0) upload_bytes,COALESCE(u.download_bytes,0) download_bytes FROM pppoe_accounts a JOIN radius_identities r ON r.id=a.radius_identity_id LEFT JOIN pppoe_subscriptions s ON s.id=(SELECT latest.id FROM pppoe_subscriptions latest WHERE latest.account_id=a.id AND latest.service_role='base' ORDER BY latest.id DESC LIMIT 1) LEFT JOIN pppoe_subscription_usage u ON u.subscription_id=s.id WHERE a.id=? AND a.archived_at IS NULL",[id]);const line=rows[0];if(!line)throw new Error('PPPOE_LINE_UNAVAILABLE');
  const [sessions]:any=await app.query('SELECT acctstarttime started_at,acctupdatetime updated_at,acctstoptime stopped_at,acctsessiontime session_seconds,COALESCE(acctinputoctets,0) upload_bytes,COALESCE(acctoutputoctets,0) download_bytes,framedipaddress framed_ip,nasipaddress nas_ip,callingstationid calling_station_id,acctterminatecause terminate_cause FROM radacct WHERE username=? ORDER BY COALESCE(acctstoptime,acctupdatetime,acctstarttime) DESC,radacctid DESC LIMIT 50',[line.username]);
  return {line:{id:Number(line.id),customerId:Number(line.customer_id),username:String(line.username),subscriptionId:line.subscription_id?Number(line.subscription_id):null,expiresAt:line.expires_at,uploadBytes:String(line.upload_bytes),downloadBytes:String(line.download_bytes)},sessions};
 });
}

export async function updatePppoeLineExpiry(scope:any,value:any,input:any){
 return withNetwork(scope,async app=>{await app.beginTransaction();try{
  await principal(app,scope);const id=Number(value);if(!Number.isSafeInteger(id)||id<1)throw new Error('PPPOE_LINE_INPUT');
  const [settings]:any=await app.query('SELECT timezone,grace_policy,global_grace_days FROM network_settings WHERE id=1');const zone=String(settings[0]?.timezone||'Asia/Damascus');
  const expiry=parsePppoeLocalDateTime(input?.expiresAt,zone);const [clock]:any=await app.query('SELECT UTC_TIMESTAMP(6) now_utc');if(expiry<=dateValue(clock[0].now_utc))throw new Error('PPPOE_LINE_EXPIRY_INVALID');
  const [rows]:any=await app.query("SELECT a.id,a.admin_status,a.radius_identity_id,r.current_username username,s.id subscription_id,s.lifecycle,s.expires_at,s.grace_expires_at,s.grace_source_snapshot,s.grace_days_snapshot FROM pppoe_accounts a JOIN radius_identities r ON r.id=a.radius_identity_id JOIN pppoe_subscriptions s ON s.id=(SELECT latest.id FROM pppoe_subscriptions latest WHERE latest.account_id=a.id AND latest.service_role='base' ORDER BY latest.id DESC LIMIT 1) WHERE a.id=? AND a.archived_at IS NULL FOR UPDATE",[id]);const row=rows[0];if(!row)throw new Error('PPPOE_LINE_UNAVAILABLE');if(row.lifecycle!=='active')throw new Error('PPPOE_LINE_EXPIRY_UNAVAILABLE');
  const graceDays=row.grace_source_snapshot==='global'?Math.max(0,Number(settings[0]?.global_grace_days||0)):Math.max(0,Number(row.grace_days_snapshot||0));const grace=graceDays?new Date(expiry.getTime()+graceDays*86400000):null;
  await app.query('UPDATE pppoe_subscriptions SET expires_at=?,grace_expires_at=? WHERE id=?',[sqlDate(expiry),grace?sqlDate(grace):null,row.subscription_id]);if(row.admin_status==='enabled')await setSessionTimeout(app,row.username,grace||expiry);await markRejected(app,row.username,row.admin_status!=='enabled');
  const [actor]:any=await app.query('SELECT id,full_name FROM managers WHERE id=?',[scope.managerId]);await app.query("INSERT INTO activity_log(actor_manager_id,actor_snapshot,actor_kind,action_code,target_type,target_id,account_id,before_data,after_data,result) VALUES(?,?,'manager','pppoe.subscription.expiry.update','pppoe_account',?,?,?,?, 'success')",[scope.managerId,JSON.stringify({id:actor[0]?.id,full_name:actor[0]?.full_name}),id,row.radius_identity_id,JSON.stringify({expiresAt:row.expires_at,graceExpiresAt:row.grace_expires_at}),JSON.stringify({expiresAt:sqlDate(expiry),graceExpiresAt:grace?sqlDate(grace):null,timezone:zone})]);
  await app.commit();return {success:true,id,expiresAt:sqlDate(expiry),graceExpiresAt:grace?sqlDate(grace):null,serviceTimezone:zone};
 }catch(error){await app.rollback();throw error;}});
}

export async function endPppoeSubscription(scope:any,value:any){
 return withNetwork(scope,async app=>{await app.beginTransaction();let username='';let pendingDisconnect=false;try{
  await principal(app,scope);const id=Number(value);if(!Number.isSafeInteger(id)||id<1)throw new Error('PPPOE_LINE_INPUT');
  const [rows]:any=await app.query("SELECT a.id,a.customer_id,a.radius_identity_id,r.current_username username,s.id subscription_id,s.lifecycle,s.expires_at FROM pppoe_accounts a JOIN radius_identities r ON r.id=a.radius_identity_id JOIN pppoe_subscriptions s ON s.id=(SELECT latest.id FROM pppoe_subscriptions latest WHERE latest.account_id=a.id AND latest.service_role='base' ORDER BY latest.id DESC LIMIT 1) WHERE a.id=? AND a.archived_at IS NULL FOR UPDATE",[id]);
  const row=rows[0];if(!row)throw new Error('PPPOE_LINE_UNAVAILABLE');if(!['pending','active'].includes(String(row.lifecycle)))throw new Error('PPPOE_LINE_END_UNAVAILABLE');username=String(row.username);
  await app.query("UPDATE pppoe_subscriptions SET lifecycle='ended',ended_at=UTC_TIMESTAMP(6) WHERE id=? AND lifecycle IN('pending','active')",[row.subscription_id]);
  await markRejected(app,username,true);
  const [actor]:any=await app.query('SELECT id,full_name FROM managers WHERE id=?',[scope.managerId]);
  await app.query("INSERT INTO activity_log(actor_manager_id,actor_snapshot,actor_kind,action_code,target_type,target_id,customer_id,account_id,before_data,after_data,result) VALUES(?,?,'manager','pppoe.subscription.end','pppoe_account',?,?,?,?,?,'success')",[scope.managerId,JSON.stringify({id:actor[0]?.id,full_name:actor[0]?.full_name}),id,row.customer_id,row.radius_identity_id,JSON.stringify({subscriptionId:Number(row.subscription_id),lifecycle:row.lifecycle,expiresAt:row.expires_at}),JSON.stringify({subscriptionId:Number(row.subscription_id),lifecycle:'ended'})]);
  await app.commit();try{const result=await disconnectPppoeSessions(scope,app,username,true);pendingDisconnect=result.acknowledged<result.attempted;}catch{pendingDisconnect=true;}
  return {success:true,id,subscriptionId:Number(row.subscription_id),disconnectPending:pendingDisconnect};
 }catch(error){await app.rollback();throw error;}});
}

export async function archivePppoeLine(scope:any,value:any){
 return withNetwork(scope,async app=>{await app.beginTransaction();let username='';try{const access=await principal(app,scope),id=Number(value);if(!Number.isSafeInteger(id)||id<1)throw new Error('PPPOE_LINE_INPUT');
  const [rows]:any=await app.query("SELECT a.id,a.radius_identity_id,a.admin_status,r.current_username username FROM pppoe_accounts a JOIN radius_identities r ON r.id=a.radius_identity_id WHERE a.id=? AND a.archived_at IS NULL FOR UPDATE",[id]);const row=rows[0];if(!row)throw new Error('PPPOE_LINE_UNAVAILABLE');username=String(row.username);
  await app.query("UPDATE pppoe_accounts SET admin_status='disabled',archived_at=UTC_TIMESTAMP(6),archived_by=? WHERE id=?",[scope.managerId,id]);
  await app.query("UPDATE pppoe_subscriptions SET lifecycle='cancelled',ended_at=COALESCE(ended_at,UTC_TIMESTAMP(6)) WHERE account_id=? AND lifecycle IN('pending','active')",[id]);await markRejected(app,username,true);
  const [actor]:any=await app.query('SELECT id,full_name FROM managers WHERE id=?',[scope.managerId]);
  await app.query("INSERT INTO activity_log(actor_manager_id,actor_snapshot,actor_kind,action_code,target_type,target_id,account_id,before_data,after_data,result) VALUES(?,?,'manager','pppoe.line.archive','pppoe_account',?,?,?,?, 'success')",[scope.managerId,JSON.stringify({id:actor[0]?.id,full_name:actor[0]?.full_name}),id,row.radius_identity_id,JSON.stringify({status:row.admin_status}),JSON.stringify({archived:true,status:'disabled'})]);
  await app.commit();let disconnectPending=false;try{const result=await disconnectPppoeSessions(scope,app,username,true);disconnectPending=result.acknowledged<result.attempted;}catch{disconnectPending=true;}return {success:true,id,disconnectPending};
 }catch(error){await app.rollback();throw error;}});
}

export async function processPppoeLifecycle(scope:any){
 return withNetwork(scope,async app=>{
  let changed=0;const forceDisconnectUsers=new Set<string>();
  const [settings]:any=await app.query('SELECT timezone FROM network_settings WHERE id=1');const zone=settings[0]?.timezone||'Asia/Damascus';
  const [firstConnections]:any=await app.query("SELECT s.id,a.id account_id,a.radius_identity_id,r.current_username username,MIN(ra.acctstarttime) first_started FROM pppoe_subscriptions s JOIN pppoe_accounts a ON a.id=s.account_id JOIN radius_identities r ON r.id=a.radius_identity_id JOIN radacct ra ON ra.username=r.current_username WHERE s.lifecycle='pending' AND s.service_role='base' AND a.admin_status='enabled' AND a.archived_at IS NULL AND JSON_UNQUOTE(JSON_EXTRACT(s.effective_service_snapshot,'$.starts_at'))='first_connection' AND NOT EXISTS(SELECT 1 FROM radcheck rc WHERE rc.username=r.current_username AND rc.attribute='Auth-Type' AND rc.value='Reject') GROUP BY s.id,a.id,a.radius_identity_id,r.current_username ORDER BY s.id LIMIT 25");
  for(const row of firstConnections){await app.beginTransaction();try{const [locked]:any=await app.query("SELECT * FROM pppoe_subscriptions WHERE id=? AND lifecycle='pending' FOR UPDATE",[row.id]);if(locked[0]){const activated=await recordActivation(app,locked[0],row.username,dateValue(row.first_started),zone);if(activated.lifecycle==='active')forceDisconnectUsers.add(row.username);await systemEvent(app,activated.lifecycle==='active'?'pppoe.line.first_connection':'pppoe.line.expire',Number(row.account_id),Number(row.radius_identity_id),{lifecycle:activated.lifecycle,expiresAt:activated.expiresAt});changed++;}await app.commit();}catch(error){await app.rollback();throw error;}}
  const [firstAuthSessions]:any=await app.query("SELECT DISTINCT r.current_username username FROM pppoe_subscriptions s JOIN pppoe_accounts a ON a.id=s.account_id JOIN radius_identities r ON r.id=a.radius_identity_id JOIN radacct ra ON ra.username=r.current_username AND ra.acctstoptime IS NULL AND COALESCE(ra.acctupdatetime,ra.acctstarttime)>=UTC_TIMESTAMP(6)-INTERVAL 6 MINUTE WHERE s.lifecycle='active' AND s.service_role='base' AND JSON_UNQUOTE(JSON_EXTRACT(s.effective_service_snapshot,'$.starts_at'))='first_connection' AND ra.acctstarttime<=s.activated_at AND a.admin_status='enabled' AND a.archived_at IS NULL");
  for(const row of firstAuthSessions)forceDisconnectUsers.add(String(row.username));
  const quotaCursorKey=String(scope.tenant_id)+':'+String(scope.environment_id),quotaCursor=quotaCursors.get(quotaCursorKey)||0;
  let [quotaLines]:any=await app.query("SELECT s.id,s.account_id,s.package_version_id,s.activated_at,s.quota_allowance_bytes,s.effective_service_snapshot,a.radius_identity_id,r.current_username username,COALESCE(u.upload_bytes,0) upload_bytes,COALESCE(u.download_bytes,0) download_bytes FROM pppoe_subscriptions s JOIN pppoe_accounts a ON a.id=s.account_id JOIN radius_identities r ON r.id=a.radius_identity_id JOIN pppoe_subscription_usage u ON u.subscription_id=s.id WHERE s.lifecycle='active' AND s.service_role='base' AND s.quota_allowance_bytes IS NOT NULL AND a.admin_status='enabled' AND a.archived_at IS NULL AND s.id>? ORDER BY s.id LIMIT 100",[quotaCursor]);
  if(!quotaLines.length&&quotaCursor>0){quotaCursors.set(quotaCursorKey,0);[quotaLines]=await app.query("SELECT s.id,s.account_id,s.package_version_id,s.activated_at,s.quota_allowance_bytes,s.effective_service_snapshot,a.radius_identity_id,r.current_username username,COALESCE(u.upload_bytes,0) upload_bytes,COALESCE(u.download_bytes,0) download_bytes FROM pppoe_subscriptions s JOIN pppoe_accounts a ON a.id=s.account_id JOIN radius_identities r ON r.id=a.radius_identity_id JOIN pppoe_subscription_usage u ON u.subscription_id=s.id WHERE s.lifecycle='active' AND s.service_role='base' AND s.quota_allowance_bytes IS NOT NULL AND a.admin_status='enabled' AND a.archived_at IS NULL ORDER BY s.id LIMIT 100");}
  if(quotaLines.length)quotaCursors.set(quotaCursorKey,Number(quotaLines[quotaLines.length-1].id));
  for(const line of quotaLines){await app.beginTransaction();try{
   const [locked]:any=await app.query("SELECT id,account_id,package_version_id,activated_at,quota_allowance_bytes,effective_service_snapshot FROM pppoe_subscriptions WHERE id=? AND lifecycle='active' FOR UPDATE",[line.id]);
   if(locked[0]){
    const [sessions]:any=await app.query("SELECT acctuniqueid,acctstarttime,acctupdatetime,acctstoptime,COALESCE(acctinputoctets,0) input_bytes,COALESCE(acctoutputoctets,0) output_bytes FROM radacct WHERE username=? AND acctstarttime IS NOT NULL ORDER BY acctstarttime,radacctid",[line.username]);
    const activatedAt=dateValue(locked[0].activated_at);
    for(const session of sessions){
     const inputEnd=BigInt(String(session.input_bytes)),outputEnd=BigInt(String(session.output_bytes));
     const [prior]:any=await app.query('SELECT segment_end,input_end,output_end FROM pppoe_accounting_segments WHERE acctuniqueid=? ORDER BY id DESC LIMIT 1',[session.acctuniqueid]);
     let start=dateValue(prior[0]?.segment_end||session.acctstarttime),inputStart=BigInt(String(prior[0]?.input_end??0)),outputStart=BigInt(String(prior[0]?.output_end??0));
     if(!prior[0]&&start<activatedAt){start=activatedAt;inputStart=inputEnd;outputStart=outputEnd;}
     if(inputEnd<inputStart||outputEnd<outputStart)continue;
     const [clock]:any=await app.query('SELECT UTC_TIMESTAMP(6) AS now_utc');
     let end=dateValue(session.acctstoptime||session.acctupdatetime||clock[0].now_utc);
     if(end<=start)end=dateValue(clock[0].now_utc);if(end<=start)continue;
     const deltaUpload=inputEnd-inputStart,deltaDownload=outputEnd-outputStart;
     if(deltaUpload===BigInt(0)&&deltaDownload===BigInt(0)&&prior[0])continue;
     const [inserted]:any=await app.query('INSERT IGNORE INTO pppoe_accounting_segments(subscription_id,acctuniqueid,segment_start,segment_end,input_start,input_end,output_start,output_end) VALUES(?,?,?,?,?,?,?,?)',[locked[0].id,session.acctuniqueid,start,end,inputStart.toString(),inputEnd.toString(),outputStart.toString(),outputEnd.toString()]);
     if(inserted.affectedRows){await app.query('UPDATE pppoe_subscription_usage SET upload_bytes=upload_bytes+?,download_bytes=download_bytes+?,updated_at=UTC_TIMESTAMP(6) WHERE subscription_id=?',[deltaUpload.toString(),deltaDownload.toString(),locked[0].id]);}
    }
    const [usage]:any=await app.query('SELECT upload_bytes,download_bytes FROM pppoe_subscription_usage WHERE subscription_id=?',[locked[0].id]);
    const used=BigInt(String(usage[0].upload_bytes))+BigInt(String(usage[0].download_bytes)),allowance=BigInt(String(locked[0].quota_allowance_bytes));
    if(used>=allowance){
     const service=typeof locked[0].effective_service_snapshot==='string'?JSON.parse(locked[0].effective_service_snapshot):locked[0].effective_service_snapshot;
     if(service.quota_exhaustion_action==='reduce_speed'){const changedSpeed=await applyReducedSpeed(app,locked[0],line.username,service);if(changedSpeed){forceDisconnectUsers.add(line.username);await systemEvent(app,'pppoe.line.quota_reduce',Number(line.account_id),Number(line.radius_identity_id),{subscriptionId:Number(line.id),usedBytes:used.toString(),quotaBytes:allowance.toString()});}}
     else{await app.query("UPDATE pppoe_subscriptions SET lifecycle='ended',ended_at=UTC_TIMESTAMP(6) WHERE id=? AND lifecycle='active'",[locked[0].id]);await markRejected(app,line.username,true);await systemEvent(app,'pppoe.line.quota_stop',Number(line.account_id),Number(line.radius_identity_id),{subscriptionId:Number(line.id),usedBytes:used.toString(),quotaBytes:allowance.toString()});}
     changed++;
    }
   }
   await app.commit();
  }catch(error){await app.rollback();throw error;}}
  const [pending]:any=await app.query("SELECT s.id,s.account_id,s.created_at,s.effective_service_snapshot,s.grace_days_snapshot,a.radius_identity_id,r.current_username username FROM pppoe_subscriptions s JOIN pppoe_accounts a ON a.id=s.account_id JOIN radius_identities r ON r.id=a.radius_identity_id WHERE s.lifecycle='pending' AND s.service_role='base' AND (JSON_UNQUOTE(JSON_EXTRACT(s.effective_service_snapshot,'$.starts_at'))='creation' OR JSON_UNQUOTE(JSON_EXTRACT(s.effective_service_snapshot,'$.validity_mode'))='calendar_monthly') ORDER BY s.id LIMIT 25");
  for(const row of pending){await app.beginTransaction();try{const [locked]:any=await app.query("SELECT * FROM pppoe_subscriptions WHERE id=? AND lifecycle='pending' FOR UPDATE",[row.id]);if(locked[0]){const service=typeof locked[0].effective_service_snapshot==='string'?JSON.parse(locked[0].effective_service_snapshot):locked[0].effective_service_snapshot;const [clock]:any=await app.query('SELECT UTC_TIMESTAMP(6) AS now_utc');const expiry=pppoeExpiry(row.created_at,service,zone),graceDays=Number(row.grace_days_snapshot||0),end=graceDays?new Date(expiry.getTime()+graceDays*86400000):expiry;if(end<=dateValue(clock[0].now_utc)){await app.query("UPDATE pppoe_subscriptions SET lifecycle='ended',ended_at=UTC_TIMESTAMP(6) WHERE id=?",[row.id]);await markRejected(app,row.username,true);await systemEvent(app,'pppoe.line.expire',Number(row.account_id),Number(row.radius_identity_id),{subscriptionId:Number(row.id),lifecycle:'ended'});changed++;}}await app.commit();}catch(error){await app.rollback();throw error;}}
  const [expired]:any=await app.query("SELECT s.id,s.account_id,a.radius_identity_id,r.current_username username FROM pppoe_subscriptions s JOIN pppoe_accounts a ON a.id=s.account_id JOIN radius_identities r ON r.id=a.radius_identity_id WHERE s.lifecycle='active' AND s.service_role='base' AND COALESCE(s.grace_expires_at,s.expires_at)<=UTC_TIMESTAMP(6) ORDER BY s.expires_at,s.id LIMIT 50");
  for(const row of expired){await app.beginTransaction();try{const [locked]:any=await app.query("SELECT id FROM pppoe_subscriptions WHERE id=? AND lifecycle='active' AND COALESCE(grace_expires_at,expires_at)<=UTC_TIMESTAMP(6) FOR UPDATE",[row.id]);if(locked[0]){await app.query("UPDATE pppoe_subscriptions SET lifecycle='ended',ended_at=UTC_TIMESTAMP(6) WHERE id=?",[row.id]);await markRejected(app,row.username,true);await systemEvent(app,'pppoe.line.expire',Number(row.account_id),Number(row.radius_identity_id),{subscriptionId:Number(row.id),lifecycle:'ended'});changed++;}await app.commit();}catch(error){await app.rollback();throw error;}}
  if(forceDisconnectUsers.size)try{await disconnectPppoeSessions(scope,app,Array.from(forceDisconnectUsers),true);}catch{}
  try{await disconnectPppoeSessions(scope,app);}catch{}
  return changed;
 });
}

