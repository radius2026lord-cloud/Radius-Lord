import {readPrivateSetting,savePrivateSetting} from './radius-provision.service';
import {db} from '../config/db';
import {networkScope,validateLocalLicense,withNetwork} from './network-runtime.service';
import {writeLocalLicense} from './environment-bootstrap.service';
import {readNetworkOvpn,reserveNetworkNasCapacity} from './network-ovpn.service';
import {validLimits} from './subscription-environment.service';

const paymentGroup='subscription_upgrade_payment';
type TransferMethod={name:string;transferCode:string};

export async function readUpgradePaymentSettings(){
 const saved=await readPrivateSetting(paymentGroup,'settings');
 const methods:TransferMethod[]=Array.isArray(saved?.methods)?saved.methods:
  saved?.transferCode?[{name:'تحويل',transferCode:String(saved.transferCode)}]:[];
 return {methods};
}
export async function saveUpgradePaymentSettings(input:unknown){
 const entries=(input as {methods?:unknown}|null)?.methods;
 if(!Array.isArray(entries)||entries.length>30)throw Error('UPGRADE_PAYMENT_SETTINGS');
 const methods:TransferMethod[]=entries.map(entry=>{
  if(typeof entry?.name!=='string'||typeof entry?.transferCode!=='string')throw Error('UPGRADE_PAYMENT_SETTINGS');
  const name=entry.name.trim(),transferCode=entry.transferCode.trim();
  if(!name||name.length>80||!transferCode||transferCode.length>100||/[\x00-\x1f\x7f]/.test(name+transferCode))throw Error('UPGRADE_PAYMENT_SETTINGS');
  return {name,transferCode};
 });
 if(new Set(methods.map(method=>method.name.toLowerCase())).size!==methods.length)throw Error('UPGRADE_PAYMENT_SETTINGS');
 const settings={methods};
 await savePrivateSetting(paymentGroup,'settings',settings);
 return settings;
}

const groups={renewal:'subscription_renewal_requests',upgrade:'subscription_upgrade_requests'} as const;
type Kind=keyof typeof groups;
const parse=(value:any)=>typeof value==='string'?JSON.parse(value):value;

export async function listSubscriptionChanges(){
 const [rows]:any=await db.query(`SELECT t.name networkName,t.id tenantId,p.setting_group,p.setting_value,s.duration_months_snapshot durationMonths
 FROM platform_settings p JOIN tenants t ON p.setting_key=CONCAT('tenant_',t.id)
 LEFT JOIN subscriptions s ON s.tenant_id=t.id AND s.id=JSON_UNQUOTE(JSON_EXTRACT(p.setting_value,'$.subscriptionId'))
 WHERE p.setting_group IN (?,?) AND t.archived_at IS NULL`,Object.values(groups));
 return rows.map((row:any)=>{
  const request=parse(row.setting_value);
  const {target,managerId,approvedBy,...visible}=request;
  return {...visible,tenantId:Number(row.tenantId),networkName:row.networkName,durationMonths:Number(row.durationMonths)||null,kind:row.setting_group===groups.renewal?'renewal':'upgrade'};
 }).sort((a:any,b:any)=>String(b.requestedAt).localeCompare(String(a.requestedAt)));
}

function extendMonths(base:Date,months:number){
 const result=new Date(base);const day=result.getUTCDate();
 result.setUTCDate(1);result.setUTCMonth(result.getUTCMonth()+months);
 const last=new Date(result);last.setUTCMonth(last.getUTCMonth()+1,0);
 result.setUTCDate(Math.min(day,last.getUTCDate()));
 return result.toISOString();
}

export async function applySubscriptionChange(tenantId:number,kind:Kind,requestedAt:string,months:number,adminId:number,upgradeAmount:unknown,upgradeCurrency:unknown,transferMethod:unknown,transferCode:unknown){
 if(!Number.isSafeInteger(tenantId)||tenantId<1||!Object.prototype.hasOwnProperty.call(groups,kind)||!requestedAt)throw Error('CHANGE_INPUT');
 const connection=await db.pool.getConnection(),locks:string[]=[];
 const key='tenant_'+tenantId,group=groups[kind];
 try{
  for(const name of ['radius-lord:database-provisioner','subscription-renewal:'+tenantId,'subscription-upgrade:'+tenantId]){
   const [rows]:any=await connection.query('SELECT GET_LOCK(?,0) acquired',[name]);
   if(!Number(rows[0]?.acquired))throw Error('CHANGE_BUSY');
   locks.push(name);
  }
  const [rows]:any=await connection.query('SELECT setting_group,setting_value FROM platform_settings WHERE setting_group IN (?,?) AND setting_key=?',[groups.renewal,groups.upgrade,key]);
  const request=parse(rows.find((row:any)=>row.setting_group===group)?.setting_value);
  if(!request||request.requestedAt!==requestedAt)throw Error('CHANGE_STALE');
  if(request.status==='applied')return request.applied;
  if(!['requested','applying'].includes(request.status))throw Error('CHANGE_STALE');
  const competing=rows.find((row:any)=>row.setting_group!==group&&parse(row.setting_value)?.status==='applying');
  if(competing)throw Error('CHANGE_BUSY');
  const renew=kind==='renewal'||request.includeRenewal===true;
  if(renew&&request.status==='requested'&&(!Number.isInteger(months)||months<1||months>120))throw Error('CHANGE_INPUT');
  const [tenant]:any=await connection.query('SELECT slug FROM tenants WHERE id=? AND archived_at IS NULL',[tenantId]);
  if(!tenant[0])throw Error('CHANGE_STALE');
  const scope=await networkScope(tenant[0].slug,false,true);
  if(Number(scope.subscription_id)!==Number(request.subscriptionId)||Number(scope.environment_id)!==Number(request.environmentId))throw Error('CHANGE_STALE');
  const [subscriptions]:any=await connection.query('SELECT plan_limits_snapshot FROM subscriptions WHERE id=? AND tenant_id=?',[scope.subscription_id,tenantId]);
  const limits=validLimits(subscriptions[0]?.plan_limits_snapshot);
  if(!limits)throw Error('CHANGE_LIMITS');
  const save=async(value:any)=>connection.query('UPDATE platform_settings SET setting_value=? WHERE setting_group=? AND setting_key=?',[JSON.stringify(value),group,key]);
  let target=request.target;
  await withNetwork(scope,async app=>{
   const license=await validateLocalLicense(app,scope,false,true);
   const maxSubscribers=Number(license.max_pppoe_accounts),maxNas=Number(license.base_max_nas),additionalNas=Number(license.additional_nas_capacity);
   if(!target){
    if(renew&&request.expiresAt!==license.canonicalExpiresAt)throw Error('CHANGE_STALE');
    const nasTotal=maxNas===0?0:maxNas+additionalNas;
    const requestedPppoe=kind==='upgrade'?request.requestedPppoeLimit:null;
    const requestedNas=kind==='upgrade'?request.requestedNasLimit:null;
    if(requestedPppoe!==null&&(!Number.isSafeInteger(requestedPppoe)||requestedPppoe<1)||requestedNas!==null&&(!Number.isSafeInteger(requestedNas)||requestedNas<1||requestedNas>4294967295))throw Error('CHANGE_STALE');
    if(requestedPppoe!==null&&(maxSubscribers===0||requestedPppoe<=maxSubscribers)||requestedNas!==null&&(nasTotal===0||requestedNas<=nasTotal))throw Error('CHANGE_STALE');
    const oldEnd=Date.parse(license.canonicalExpiresAt),now=Date.now();
    if(!renew&&(oldEnd<=now||license.subscription_status==='expired'))throw Error('CHANGE_RENEW_FIRST');
    let upgradePayment=null;
    if(kind==='upgrade'){
     if(typeof upgradeAmount!=='string'||!/^(?:0|[1-9][0-9]{0,9})(?:\.[0-9]{1,2})?$/.test(upgradeAmount))throw Error('UPGRADE_AMOUNT_INPUT');
     const [whole,fraction='']=upgradeAmount.split('.');
     const amount=whole+'.'+fraction.padEnd(2,'0');
     if(Number(amount)>0){
      const settings=await readUpgradePaymentSettings();
      if(typeof upgradeCurrency!=='string'||!/^[A-Z]{3}$/.test(upgradeCurrency))throw Error('UPGRADE_CURRENCY_INPUT');
      const method=settings.methods.find(item=>item.name===transferMethod&&item.transferCode===transferCode);
      if(!method)throw Error('UPGRADE_PAYMENT_SETTINGS');
      upgradePayment={amount,currency:upgradeCurrency,methodName:method.name,transferCode:method.transferCode};
     }
    }
    target={
     version:Number(license.sync_version),planName:license.plan_name_snapshot,
     duration:renew?months:Number(license.duration_months_snapshot),
     startsAt:renew&&oldEnd<=now?new Date(Math.floor(now/1000)*1000).toISOString():license.canonicalStartsAt,
     expiresAt:renew?extendMonths(new Date(Math.max(oldEnd,Math.floor(now/1000)*1000)),months):license.canonicalExpiresAt,
     maxSubscribers:requestedPppoe??maxSubscribers,maxNas:requestedNas===null?maxNas:requestedNas-additionalNas,additionalNas,
     reserveNas:requestedNas!==null,upgradePayment,
    };
    // Persist the exact target before writing the tenant so retries cannot extend twice.
    await save({...request,status:'applying',target,approvedBy:adminId});
   }
   const matches=(value:any)=>value.canonicalStartsAt===target.startsAt&&value.canonicalExpiresAt===target.expiresAt&&Number(value.max_pppoe_accounts)===target.maxSubscribers&&Number(value.base_max_nas)===target.maxNas&&Number(value.additional_nas_capacity)===target.additionalNas&&Number(value.duration_months_snapshot)===target.duration&&value.subscription_status==='active';
   if(matches(license))return;
   if(Number(license.sync_version)!==target.version)throw Error('CHANGE_STALE');
   const snapshot=target.reserveNas?await readNetworkOvpn(app):null;
   if(target.reserveNas){
    if(!snapshot||snapshot.environmentId!==Number(scope.environment_id)||snapshot.tenantId!==tenantId||snapshot.subscriptionId!==Number(scope.subscription_id))throw Error('CHANGE_NAS_SCOPE');
    await reserveNetworkNasCapacity(connection,scope,snapshot,target.maxNas+target.additionalNas);
   }
   await app.beginTransaction();
   try{
    await app.query('SELECT id FROM platform_subscription WHERE id=1 FOR UPDATE');
    const locked=await validateLocalLicense(app,scope,false,true);
    if(Number(locked.sync_version)!==target.version)throw Error('CHANGE_STALE');
    await writeLocalLicense(app,{...scope,plan_limits_snapshot:{...limits,maxSubscribers:target.maxSubscribers,maxNas:target.maxNas},plan_name_snapshot:target.planName,duration_months_snapshot:target.duration,additionalNas:target.additionalNas},'active',new Date(target.startsAt),new Date(target.expiresAt));
    if(snapshot)await app.query('UPDATE network_ovpn_settings SET configuration_snapshot=?,synced_at=NOW(6) WHERE id=1',[JSON.stringify({...snapshot,maxNas:target.maxNas,additionalNas:target.additionalNas})]);
    const verified=await validateLocalLicense(app,scope,false,true);
    if(!matches(verified))throw Error('CHANGE_VERIFY');
    await app.commit();
   }catch(error){await app.rollback();throw error;}
  });
  const applied={upgradePayment:target.upgradePayment??null,renewed:renew,upgraded:kind==='upgrade',expiresAt:target.expiresAt,maxSubscribers:target.maxSubscribers,maxNas:target.maxNas===0?0:target.maxNas+target.additionalNas,appliedAt:new Date().toISOString()};
  await connection.beginTransaction();
  try{
   await connection.query("UPDATE subscriptions SET status='active',starts_at=?,expires_at=?,duration_months_snapshot=?,plan_limits_snapshot=? WHERE id=? AND tenant_id=?",[new Date(target.startsAt),new Date(target.expiresAt),target.duration,JSON.stringify({...limits,maxSubscribers:target.maxSubscribers,maxNas:target.maxNas}),scope.subscription_id,tenantId]);
   await connection.query("UPDATE subscription_licenses SET status='active' WHERE subscription_id=? AND tenant_id=?",[scope.subscription_id,tenantId]);
   await save({...request,status:'applied',target,approvedBy:request.approvedBy??adminId,applied});
   if(applied.upgradePayment){
    await connection.query("INSERT INTO platform_settings (setting_group,setting_key,setting_value,value_type,is_public) VALUES ('subscription_upgrade_receipts',?,?,'json',0) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)",[key,JSON.stringify({appliedAt:applied.appliedAt,...applied.upgradePayment})]);
   }
   if(kind==='upgrade'&&renew){
    const renewal=parse(rows.find((row:any)=>row.setting_group===groups.renewal)?.setting_value);
    if(renewal?.status==='requested'&&renewal.expiresAt===request.expiresAt&&Number(renewal.subscriptionId)===Number(scope.subscription_id)){
     await connection.query('UPDATE platform_settings SET setting_value=? WHERE setting_group=? AND setting_key=?',[JSON.stringify({...renewal,status:'applied',applied}),groups.renewal,key]);
    }
   }
   await connection.commit();
  }catch(error){await connection.rollback();throw error;}
  return applied;
 }finally{
  try{for(const name of locks.reverse())await connection.query('SELECT RELEASE_LOCK(?)',[name]);connection.release();}
  catch{connection.destroy();}
 }
}
