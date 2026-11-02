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
  const query=String(input.search||'').trim().slice(0,64),page=lookup?1:Math.min(100000,positive(input.page,1)),limit=50;
  if(lookup&&!query)throw new Error('HOTSPOT_CARD_INPUT');
  const where=['a.archived_at IS NULL',"(a.account_kind='standalone' OR a.owner_manager_id=?)"],params:any[]=[scope.managerId];
  if(query){where.push(lookup?'r.current_username=?':"r.current_username LIKE ? ESCAPE '='");params.push(lookup?query:'%'+query.replace(/[=%_]/g,c=>'='+c)+'%');}
  if(!lookup&&input.packageId){where.push('p.id=?');params.push(positive(input.packageId,0));}
  if(!lookup&&input.batchId){where.push('bc.batch_id=?');params.push(positive(input.batchId,0));}
  if(!lookup&&['disabled','cancelled','quota','expired','pending','active','unknown'].includes(input.status)){where.push('('+state+')=?');params.push(input.status);}
  const clause=' WHERE '+where.join(' AND ');
  const [items]:any=await app.query(`SELECT a.id,a.account_kind,r.current_username username,bc.serial_no,b.id batch_id,b.name batch_name,p.id package_id,p.name package_name,${state} state,sp.activated_at,sp.expires_at,sp.ended_at,sp.duration_mode,sp.quota_allowance_bytes,sp.time_allowance_seconds,sp.carried_seconds,COALESCE(u.upload_bytes,0) upload_bytes,COALESCE(u.download_bytes,0) download_bytes,COALESCE(u.used_seconds,0) used_seconds,u.updated_at usage_updated_at`+joins+clause+' ORDER BY a.id DESC LIMIT ? OFFSET ?',[...params,lookup?1:limit,(page-1)*limit]);
  const [settings]:any=await app.query('SELECT timezone FROM network_settings WHERE id=1');
  if(lookup)return {items,timezone:settings[0]?.timezone||'Asia/Damascus'};
  const [counts]:any=await app.query('SELECT COUNT(*) total'+joins+clause,params);
  const [packages]:any=await app.query('SELECT id,name FROM hotspot_packages WHERE owner_manager_id=? ORDER BY name',[scope.managerId]);
  const [batches]:any=await app.query('SELECT id,name FROM hotspot_card_batches WHERE owner_manager_id=? ORDER BY id DESC LIMIT 1000',[scope.managerId]);
  return {items,total:Number(counts[0].total),page,pageSize:limit,packages,batches,timezone:settings[0]?.timezone||'Asia/Damascus'};
 });
}
