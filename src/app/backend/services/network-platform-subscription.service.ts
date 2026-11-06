import {db} from '../config/db';
import {withNetwork,validateLocalLicense} from './network-runtime.service';
import {readPrivateSetting,savePrivateSetting} from './radius-provision.service';

// Shared central settings only; no tenant data or credentials in this cache.
let cached:{until:number;value:any}|null=null;
let settingsFlight:Promise<any>|null=null;
async function renewalSettings(){
 if(cached&&cached.until>Date.now())return cached.value;
 if(settingsFlight)return settingsFlight;
 settingsFlight=(async()=>{
  const [saved,[rows]]:any=await Promise.all([
   readPrivateSetting('subscription_notifications','renewal'),
   db.query("SELECT setting_key,setting_value FROM platform_settings WHERE setting_group='contact_payment' AND is_public=1 AND setting_key IN ('whatsapp_number','whatsapp_enabled','support_email','support_phone_primary')")
  ]);
  const contact=Object.fromEntries(rows.map((r:any)=>[r.setting_key,r.setting_value]));
  const days=Number(saved?.expiryDays),phone=String(contact.whatsapp_number||'').replace(/^\+/,''),email=String(contact.support_email||'');
  const value={expiryDays:Number.isInteger(days)&&days>=1&&days<=90?days:7,
   whatsapp:contact.whatsapp_enabled==='1'&&/^[1-9][0-9]{6,14}$/.test(phone)?phone:null,
   email:/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)?email:null,
   phone:/^\+?[1-9][0-9]{6,14}$/.test(String(contact.support_phone_primary||''))?contact.support_phone_primary:null};
  cached={until:Date.now()+60000,value};return value;
 })();
 try{return await settingsFlight;}finally{settingsFlight=null;}
}
export async function subscriptionPresentation(scope:any,license:any,timezone:string){
 // Validate the saved IANA zone; never silently substitute the browser's local zone.
 try{new Intl.DateTimeFormat('en',{timeZone:timezone}).format();}catch{throw new Error('NETWORK_TIMEZONE_INVALID');}
 const settings=await renewalSettings();
 const expiresAt=license.canonicalExpiresAt,startsAt=license.canonicalStartsAt;
 const remainingMs=expiresAt?Date.parse(expiresAt)-Date.now():null;
 return {tenantId:Number(scope.tenant_id),subscriptionId:Number(scope.subscription_id),timezone,
  startsAt,expiresAt,restricted:license.subscription_status==='expired'||remainingMs!==null&&remainingMs<=0,serverNow:new Date().toISOString(),reminderDays:settings.expiryDays,
  reminder:license.subscription_status==='expired'?'expired':remainingMs===null?null:remainingMs<=0?'expired':remainingMs<=settings.expiryDays*86400000?'soon':null,
  contact:{whatsapp:settings.whatsapp,email:settings.email,phone:settings.phone}};
}
export async function readPlatformSubscription(scope:any){
 return withNetwork(scope,async app=>{
  const license=await validateLocalLicense(app,scope,false,true);
  const [settings]:any=await app.query('SELECT timezone FROM network_settings WHERE id=1');
  if(!settings[0]?.timezone)throw new Error('NETWORK_TIMEZONE_INVALID');
  const details=await subscriptionPresentation(scope,license,settings[0].timezone);
  // Only on opening this page; the navbar/session poll never performs these counts.
  const [counts]:any=await app.query({sql:`SELECT
   (SELECT COUNT(*) FROM pppoe_accounts WHERE archived_at IS NULL) pppoe,
   (SELECT COUNT(*) FROM lord_nas WHERE archived_at IS NULL) nas,
   (SELECT COUNT(*) FROM hotspot_accounts WHERE archived_at IS NULL) hotspot`,timeout:5000});
  const capacity=(used:any,limit:any)=>{used=Number(used);limit=Number(limit);return {used,limit,available:limit===0?null:Math.max(0,limit-used),overLimit:limit>0&&used>limit};};
  const [request,upgrade]=await Promise.all([readPrivateSetting('subscription_renewal_requests','tenant_'+scope.tenant_id),readPrivateSetting('subscription_upgrade_requests','tenant_'+scope.tenant_id)]);
  const current=request&&Number(request.subscriptionId)===Number(scope.subscription_id)&&request.expiresAt===details.expiresAt;
  return {...details,planName:license.plan_name_snapshot,license:license.license_number,status:license.subscription_status,
   durationMonths:Number(license.duration_months_snapshot),syncVersion:Number(license.sync_version),
   pppoe:capacity(counts[0].pppoe,license.max_pppoe_accounts),nas:capacity(counts[0].nas,Number(license.base_max_nas)===0?0:Number(license.base_max_nas)+Number(license.additional_nas_capacity)),
   hotspotAccounts:Number(counts[0].hotspot),upgradeRequest:pendingUpgrade(upgrade,scope,license),renewalRequest:current?{status:'requested',requestedAt:request.requestedAt}:null};
 });
}
export async function requestPlatformRenewal(scope:any){
 // Serialize only this tenant's short request; no router calls and no schema changes.
 const conn=await db.pool.getConnection();let acquired=false;
 try{
  const key='subscription-renewal:'+scope.tenant_id;
  const [locks]:any=await conn.query('SELECT GET_LOCK(?,0) acquired',[key]);
  if(!Number(locks[0]?.acquired))throw new Error('RENEWAL_REQUEST_BUSY');acquired=true;
  return await withNetwork(scope,async app=>{
   const license=await validateLocalLicense(app,scope,false,true);
   const existing=await readPrivateSetting('subscription_renewal_requests','tenant_'+scope.tenant_id);
   if(existing&&Number(existing.subscriptionId)===Number(scope.subscription_id)&&existing.expiresAt===license.canonicalExpiresAt)return {status:'requested',requestedAt:existing.requestedAt};
   const settings=await renewalSettings();if(license.subscription_status!=='expired'&&Date.parse(license.canonicalExpiresAt)-Date.now()>settings.expiryDays*86400000)throw new Error('RENEWAL_NOT_DUE');
   const requestedAt=new Date().toISOString();
   await savePrivateSetting('subscription_renewal_requests','tenant_'+scope.tenant_id,{tenantId:Number(scope.tenant_id),subscriptionId:Number(scope.subscription_id),environmentId:Number(scope.environment_id),managerId:scope.managerId,planName:license.plan_name_snapshot,expiresAt:license.canonicalExpiresAt,requestedAt,status:'requested'});
   try{await app.query("INSERT INTO activity_log(actor_manager_id,actor_kind,action_code,target_type,target_id,after_data,result) VALUES(?,'manager','platform.subscription.renewal.request','platform_subscription',1,?,'success')",[scope.managerId,JSON.stringify({subscriptionId:Number(scope.subscription_id),requestedAt})]);}catch{console.error('[subscription-renewal]',{tenantId:scope.tenant_id,result:'audit_unavailable'});}
   return {status:'requested',requestedAt};
  });
 }finally{try{if(acquired)await conn.query('SELECT RELEASE_LOCK(?)',['subscription-renewal:'+scope.tenant_id]);}finally{conn.release();}}
}


function pendingUpgrade(request:any,scope:any,license:any){
 if(!request||request.status!=='requested'||Number(request.subscriptionId)!==Number(scope.subscription_id))return null;
 const pppoe=Number(license.max_pppoe_accounts),nas=Number(license.base_max_nas)===0?0:Number(license.base_max_nas)+Number(license.additional_nas_capacity);
 const waitingPppoe=request.requestedPppoeLimit!==null&&pppoe!==0&&Number(request.requestedPppoeLimit)>pppoe;
 const waitingNas=request.requestedNasLimit!==null&&nas!==0&&Number(request.requestedNasLimit)>nas;
 return waitingPppoe||waitingNas?request:null;
}
export async function requestPlatformUpgrade(scope:any,input:any){
 const mode=String(input?.mode||'');if(!['pppoe','nas','both'].includes(mode))throw new Error('UPGRADE_REQUEST_INPUT');
 const target=(value:any,max:number)=>{if(typeof value!=='number'||!Number.isSafeInteger(value)||value<1||value>max)throw new Error('UPGRADE_REQUEST_INPUT');return value;};
 const requestedPppoeLimit=mode==='nas'?null:target(input.requestedPppoeLimit,Number.MAX_SAFE_INTEGER);
 const requestedNasLimit=mode==='pppoe'?null:target(input.requestedNasLimit,4294967295);
 if(typeof input.includeRenewal!=='boolean')throw new Error('UPGRADE_REQUEST_INPUT');
 const conn=await db.pool.getConnection();let acquired=false;
 try{
  const [locks]:any=await conn.query('SELECT GET_LOCK(?,0) acquired',['subscription-upgrade:'+scope.tenant_id]);
  if(!Number(locks[0]?.acquired))throw new Error('UPGRADE_REQUEST_BUSY');acquired=true;
  return await withNetwork(scope,async app=>{
   const license=await validateLocalLicense(app,scope,false,true);
   const currentPppoeLimit=Number(license.max_pppoe_accounts),currentNasLimit=Number(license.base_max_nas)===0?0:Number(license.base_max_nas)+Number(license.additional_nas_capacity);
   const saved=await readPrivateSetting('subscription_upgrade_requests','tenant_'+scope.tenant_id),existing=pendingUpgrade(saved,scope,license);
   if(existing){if(existing.requestedPppoeLimit===requestedPppoeLimit&&existing.requestedNasLimit===requestedNasLimit&&existing.includeRenewal===input.includeRenewal)return existing;throw new Error('UPGRADE_REQUEST_PENDING');}
   if(requestedPppoeLimit!==null&&(currentPppoeLimit===0||requestedPppoeLimit<=currentPppoeLimit)||requestedNasLimit!==null&&(currentNasLimit===0||requestedNasLimit<=currentNasLimit))throw new Error('UPGRADE_REQUEST_LIMIT');
   const settings=await renewalSettings();const due=license.subscription_status==='expired'||Date.parse(license.canonicalExpiresAt)-Date.now()<=settings.expiryDays*86400000;
   if(input.includeRenewal&&!due)throw new Error('UPGRADE_RENEWAL_NOT_DUE');
   const request={status:'requested',tenantId:Number(scope.tenant_id),subscriptionId:Number(scope.subscription_id),environmentId:Number(scope.environment_id),managerId:scope.managerId,planName:license.plan_name_snapshot,expiresAt:license.canonicalExpiresAt,requestedAt:new Date().toISOString(),currentPppoeLimit,currentNasLimit,requestedPppoeLimit,requestedNasLimit,includeRenewal:input.includeRenewal};
   await savePrivateSetting('subscription_upgrade_requests','tenant_'+scope.tenant_id,request);
   try{await app.query("INSERT INTO activity_log(actor_manager_id,actor_kind,action_code,target_type,target_id,after_data,result) VALUES(?,'manager','platform.subscription.upgrade.request','platform_subscription',1,?,'success')",[scope.managerId,JSON.stringify(request)]);}catch{console.error('[subscription-upgrade]',{tenantId:scope.tenant_id,result:'audit_unavailable'});}
   return request;
  });
 }finally{try{if(acquired)await conn.query('SELECT RELEASE_LOCK(?)',['subscription-upgrade:'+scope.tenant_id]);}finally{conn.release();}}
}
