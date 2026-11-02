import {withNetwork} from './network-runtime.service';
import {managerAccess} from './network-manager-access.service';

const joins=` FROM hotspot_accounts a JOIN radius_identities r ON r.id=a.radius_identity_id
 LEFT JOIN hotspot_batch_cards bc ON bc.account_id=a.id
 LEFT JOIN hotspot_card_batches b ON b.id=bc.batch_id
 LEFT JOIN hotspot_service_periods sp ON sp.id=(SELECT latest.id FROM hotspot_service_periods latest WHERE latest.account_id=a.id ORDER BY latest.created_at DESC,latest.id DESC LIMIT 1)
 LEFT JOIN hotspot_package_versions v ON v.id=sp.package_version_id
 LEFT JOIN hotspot_packages p ON p.id=v.package_id
 LEFT JOIN hotspot_period_usage u ON u.period_id=sp.id`;
const state=`CASE WHEN a.status='disabled' THEN 'disabled'
 WHEN sp.lifecycle='cancelled' THEN 'cancelled'
 WHEN sp.quota_allowance_bytes IS NOT NULL AND COALESCE(u.upload_bytes,0)+COALESCE(u.download_bytes,0)>=sp.quota_allowance_bytes THEN 'quota'
 WHEN sp.lifecycle='ended' OR (sp.expires_at IS NOT NULL AND sp.expires_at<=UTC_TIMESTAMP(6)) OR (sp.time_allowance_seconds IS NOT NULL AND COALESCE(u.used_seconds,0)>=sp.time_allowance_seconds+sp.carried_seconds) THEN 'expired'
 WHEN sp.lifecycle='pending' THEN 'pending' WHEN sp.lifecycle='active' THEN 'active' ELSE 'unknown' END`;
function positive(value:any,fallback:number){const n=Number(value);return Number.isSafeInteger(n)&&n>0?n:fallback;}
export async function readHotspotCards(scope:any,input:any={},lookup=false){
 return withNetwork(scope,async app=>{
  const access=await managerAccess(app,scope.managerId,scope.authVersion);
  if(access.role!=='principal')throw new Error('NETWORK_AUTH');
  const query=String(input.search||'').trim().slice(0,64),page=lookup?1:Math.min(100000,positive(input.page,1)),limit=[50,100,150].includes(Number(input.pageSize))?Number(input.pageSize):50;
  if(lookup&&!query)throw new Error('HOTSPOT_CARD_INPUT');
  const where=['a.archived_at IS NULL',"(a.account_kind='standalone' OR a.owner_manager_id=?)"],params:any[]=[scope.managerId];
  if(query){where.push(lookup?'r.current_username=?':"r.current_username LIKE ? ESCAPE '='");params.push(lookup?query:'%'+query.replace(/[=%_]/g,c=>'='+c)+'%');}
  if(!lookup&&input.packageId){where.push('p.id=?');params.push(positive(input.packageId,0));}
  if(!lookup&&input.batchId){where.push('bc.batch_id=?');params.push(positive(input.batchId,0));}
  if(!lookup&&['disabled','cancelled','quota','expired','pending','active','unknown'].includes(input.status)){where.push('('+state+')=?');params.push(input.status);}
  const clause=' WHERE '+where.join(' AND ');
  const sort=({id:'a.id',username:'r.current_username',usage:'(COALESCE(u.upload_bytes,0)+COALESCE(u.download_bytes,0))',expiry:'sp.expires_at'} as Record<string,string>)[String(input.sort)]||'a.id',direction=input.direction==='asc'?'ASC':'DESC';
  const [items]:any=await app.query(`SELECT a.id,a.account_kind,r.current_username username,bc.serial_no,b.id batch_id,b.name batch_name,p.id package_id,p.name package_name,${state} state,sp.activated_at,sp.expires_at,sp.ended_at,sp.duration_mode,sp.quota_allowance_bytes,sp.time_allowance_seconds,sp.carried_seconds,COALESCE(u.upload_bytes,0) upload_bytes,COALESCE(u.download_bytes,0) download_bytes,COALESCE(u.used_seconds,0) used_seconds,u.updated_at usage_updated_at`+joins+clause+` ORDER BY ${sort} ${direction},a.id ${direction} LIMIT ? OFFSET ?`,[...params,lookup?1:limit,(page-1)*limit]);
  const [settings]:any=await app.query('SELECT timezone FROM network_settings WHERE id=1');
  if(lookup)return {items,timezone:settings[0]?.timezone||'Asia/Damascus'};
  const [counts]:any=await app.query('SELECT COUNT(*) total'+joins+clause,params);
  if(input.batchId)return {items,total:Number(counts[0].total),page,pageSize:limit,packages:[],batches:[],timezone:settings[0]?.timezone||'Asia/Damascus'};
  const [packages]:any=await app.query('SELECT id,name FROM hotspot_packages WHERE owner_manager_id=? ORDER BY name',[scope.managerId]);
  const [batches]:any=await app.query('SELECT id,name FROM hotspot_card_batches WHERE owner_manager_id=? ORDER BY id DESC LIMIT 1000',[scope.managerId]);
  return {items,total:Number(counts[0].total),page,pageSize:limit,packages,batches,timezone:settings[0]?.timezone||'Asia/Damascus'};
 });
}

export async function readHotspotCardBatchOverview(scope:any,input:any={}){
 return withNetwork(scope,async app=>{
  const access=await managerAccess(app,scope.managerId,scope.authVersion);if(access.role!=='principal')throw new Error('NETWORK_AUTH');
  const page=Math.min(100000,positive(input.page,1)),pageSize=[50,100,150].includes(Number(input.pageSize))?Number(input.pageSize):50;
  const where=['b.owner_manager_id=?'],params:any[]=[scope.managerId],query=String(input.search||'').trim().slice(0,150);
  if(query){where.push("b.name LIKE ? ESCAPE '='");params.push('%'+query.replace(/[=%_]/g,c=>'='+c)+'%');}
  if(input.packageId){where.push('p.id=?');params.push(positive(input.packageId,0));}
  if(input.batchId){where.push('b.id=?');params.push(positive(input.batchId,0));}
  if(['code','username_password'].includes(input.loginMode)){where.push('b.login_mode=?');params.push(input.loginMode);}
  if(['0','1'].includes(input.gift)){where.push('b.is_gift=?');params.push(Number(input.gift));}
  const from=' FROM hotspot_card_batches b JOIN hotspot_package_versions v ON v.id=b.package_version_id JOIN hotspot_packages p ON p.id=v.package_id JOIN time_units t ON t.id=v.duration_unit_id WHERE '+where.join(' AND ');
  const sort=({name:'b.name',quantity:'b.quantity',created:'b.id'} as Record<string,string>)[String(input.sort)]||'b.id',direction=input.direction==='asc'?'ASC':'DESC';
  const [items]:any=await app.query('SELECT b.id,b.name,b.quantity,b.login_mode,b.unit_price,b.currency_code,b.is_gift,b.created_at,p.id package_id,p.name package_name,v.version_no,v.download_bps,v.upload_bps,v.quota_bytes,v.duration_value,v.duration_mode,t.name_ar duration_unit_name'+from+` ORDER BY ${sort} ${direction},b.id ${direction} LIMIT ? OFFSET ?`,[...params,pageSize,(page-1)*pageSize]);
  if(items.length){
   // Aggregate only the visible batches, over all their cards (not the card page).
   const [counts]:any=await app.query(`SELECT bc.batch_id,${state} state,COUNT(*) count,SUM(CASE WHEN EXISTS (SELECT 1 FROM hotspot_service_periods used_period WHERE used_period.account_id=a.id AND used_period.activated_at IS NOT NULL) THEN 1 ELSE 0 END) activated_count,SUM(COALESCE(u.upload_bytes,0)+COALESCE(u.download_bytes,0)) used_bytes`+joins+' WHERE a.archived_at IS NULL AND a.owner_manager_id=? AND bc.batch_id IN ('+items.map(()=>'?').join(',')+') GROUP BY bc.batch_id,state',[scope.managerId,...items.map((b:any)=>b.id)]);
   for(const item of items){item.counts={};item.card_count=0;item.activated_count=0;item.used_bytes='0';for(const row of counts.filter((r:any)=>Number(r.batch_id)===Number(item.id))){item.counts[row.state]=Number(row.count);item.card_count+=Number(row.count);item.activated_count+=Number(row.activated_count);item.used_bytes=(BigInt(item.used_bytes)+BigInt(String(row.used_bytes||0))).toString();}}
  }
  const [total]:any=await app.query('SELECT COUNT(*) total'+from,params);
  const [packages]:any=await app.query('SELECT id,name FROM hotspot_packages WHERE owner_manager_id=? ORDER BY name',[scope.managerId]);
  const [settings]:any=await app.query('SELECT timezone FROM network_settings WHERE id=1');
  return {items,total:Number(total[0].total),page,pageSize,packages,timezone:settings[0]?.timezone||'Asia/Damascus'};
 });
}
