import {withNetwork} from './network-runtime.service';
import {managerAccess} from './network-manager-access.service';

function invalid(field:string):never{const error:any=new Error('PPPOE_LINE_INPUT');error.fields={[field]:'تحقق من القيمة المدخلة.'};throw error;}
function integer(value:any,field:string){const number=Number(value);if(!Number.isSafeInteger(number)||number<1)invalid(field);return number;}
async function principal(app:any,scope:any){const access=await managerAccess(app,scope.managerId,scope.authVersion);if(access.role!=='principal')throw new Error('NETWORK_AUTH');return access;}

async function ensureRadiusGroup(app:any,version:any){
 const rate=(value:any)=>{const n=BigInt(String(value));if(n%1000000000n===0n)return n/1000000000n+'G';if(n%1000000n===0n)return n/1000000n+'M';if(n%1000n===0n)return n/1000n+'k';return String(n);};
 const [rates]:any=await app.query("SELECT id FROM radgroupreply WHERE groupname=? AND attribute='Mikrotik-Rate-Limit' LIMIT 1",[version.radius_group_name]);
 if(!rates.length)await app.query("INSERT INTO radgroupreply(groupname,attribute,op,value) VALUES(?,'Mikrotik-Rate-Limit','=',?)",[version.radius_group_name,rate(version.upload_bps)+'/'+rate(version.download_bps)]);
 const [sessions]:any=await app.query("SELECT id FROM radgroupcheck WHERE groupname=? AND attribute='Simultaneous-Use' LIMIT 1",[version.radius_group_name]);
 if(!sessions.length)await app.query("INSERT INTO radgroupcheck(groupname,attribute,op,value) VALUES(?,'Simultaneous-Use',':=',?)",[version.radius_group_name,String(version.simultaneous_sessions)]);
 const radius=typeof version.radius_snapshot==='string'?JSON.parse(version.radius_snapshot):version.radius_snapshot||{};
 if(radius.framed_pool){const [pool]:any=await app.query("SELECT id FROM radgroupreply WHERE groupname=? AND attribute='Framed-Pool' LIMIT 1",[version.radius_group_name]);if(!pool.length)await app.query("INSERT INTO radgroupreply(groupname,attribute,op,value) VALUES(?,'Framed-Pool','=',?)",[version.radius_group_name,String(radius.framed_pool)]);}
 if(radius.mikrotik_group){const [group]:any=await app.query("SELECT id FROM radgroupreply WHERE groupname=? AND attribute='Mikrotik-Group' LIMIT 1",[version.radius_group_name]);if(!group.length)await app.query("INSERT INTO radgroupreply(groupname,attribute,op,value) VALUES(?,'Mikrotik-Group','=',?)",[version.radius_group_name,String(radius.mikrotik_group)]);}
}

const packagesSql=`SELECT p.id package_id,p.name,p.package_type,p.base_price,p.offer_price,p.offer_ends_at,p.currency_code,p.is_gift,
 v.id package_version_id,v.version_no,v.radius_group_name,v.service_snapshot,v.radius_snapshot,
 JSON_UNQUOTE(JSON_EXTRACT(v.service_snapshot,'$.download_bps')) download_bps,
 JSON_UNQUOTE(JSON_EXTRACT(v.service_snapshot,'$.upload_bps')) upload_bps,
 NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v.service_snapshot,'$.quota_bytes')),'null') quota_bytes,
 JSON_UNQUOTE(JSON_EXTRACT(v.service_snapshot,'$.simultaneous_sessions')) simultaneous_sessions,
 JSON_UNQUOTE(JSON_EXTRACT(v.service_snapshot,'$.validity_mode')) validity_mode,
 JSON_UNQUOTE(JSON_EXTRACT(v.service_snapshot,'$.duration_value')) duration_value,
 JSON_UNQUOTE(JSON_EXTRACT(v.service_snapshot,'$.units.time.name_ar')) duration_unit_name,
 JSON_UNQUOTE(JSON_EXTRACT(v.service_snapshot,'$.duration_unit_id')) duration_unit_id,
 JSON_UNQUOTE(JSON_EXTRACT(v.service_snapshot,'$.starts_at')) starts_at,
 JSON_UNQUOTE(JSON_EXTRACT(v.service_snapshot,'$.grace_days')) grace_days,
 JSON_UNQUOTE(JSON_EXTRACT(v.service_snapshot,'$.graceSource')) grace_source,
 JSON_UNQUOTE(JSON_EXTRACT(v.service_snapshot,'$.globalGraceDays')) global_grace_days
 FROM pppoe_packages p JOIN pppoe_package_versions v ON v.id=(SELECT x.id FROM pppoe_package_versions x WHERE x.package_id=p.id ORDER BY x.version_no DESC LIMIT 1)
 WHERE p.owner_manager_id=? AND p.is_enabled=1 AND p.archived_at IS NULL AND p.package_type NOT IN('daily','addon') ORDER BY p.id DESC`;

export async function readPppoeLinePackages(scope:any){return withNetwork(scope,async app=>{await principal(app,scope);const [[packages],[servers]]:any=await Promise.all([app.query(packagesSql,[scope.managerId]),app.query("SELECT n.id nas_id,COALESCE(NULLIF(l.name,''),NULLIF(n.shortname,''),n.nasname) name,n.nasname address FROM lord_nas l JOIN nas n ON n.id=l.radius_nas_id WHERE l.archived_at IS NULL AND l.is_enabled=1 AND FIND_IN_SET('ppp',l.radius_services)>0 ORDER BY l.name,l.id")]);return {packages,servers};});}

export async function createPppoeLine(scope:any,input:any){
 return withNetwork(scope,async app=>{await app.beginTransaction();try{
  const access=await principal(app,scope),customerId=integer(input.customerId,'customerId'),versionId=integer(input.packageVersionId,'packageVersionId');
  const lineName=String(input.lineName??'').trim();if(lineName.length>150)invalid('lineName');
  const allowedNasId=input.allowedNasId==null||input.allowedNasId===''?null:integer(input.allowedNasId,'allowedNasId');
  const username=String(input.username??'').trim().toLowerCase();if(!/^[a-z0-9_.@-]{1,64}$/.test(username))invalid('username');
  const password=String(input.password??'');if(!password||password.length>64||/[\u0000-\u001f\u007f\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/u.test(password))invalid('password');
  const [customers]:any=await app.query("SELECT id,first_name,last_name FROM customers WHERE id=? AND archived_at IS NULL FOR UPDATE",[customerId]);if(!customers[0])throw new Error('PPPOE_LINE_CUSTOMER_UNAVAILABLE');
  const [nasRows]:any=await app.query("SELECT n.id,n.nasname FROM lord_nas l JOIN nas n ON n.id=l.radius_nas_id WHERE l.archived_at IS NULL AND l.is_enabled=1 AND FIND_IN_SET('ppp',l.radius_services)>0 ORDER BY l.id FOR UPDATE");
  if(!nasRows.length)throw new Error('PPPOE_LINE_NAS_REQUIRED');
  if(!allowedNasId)invalid('allowedNasId');
  let allowedNas:any=null;
  if(allowedNasId){allowedNas=nasRows.find((nas:any)=>Number(nas.id)===allowedNasId);if(!allowedNas)throw new Error('PPPOE_LINE_NAS_UNAVAILABLE');}
  const [versions]:any=await app.query(`${packagesSql.replace('ORDER BY p.id DESC','AND v.id=? ORDER BY p.id DESC')} FOR UPDATE`,[scope.managerId,versionId]);const version=versions[0];if(!version)throw new Error('PPPOE_LINE_PACKAGE_UNAVAILABLE');
  let graceDays=Number(version.grace_days||0);const graceSource=version.grace_source==='global'?'global':'package';if(graceSource==='global')graceDays=Number(version.global_grace_days||0);
  const [identity]:any=await app.query("INSERT INTO radius_identities(service_kind) VALUES('pppoe')");const identityId=Number(identity.insertId);
  try{await app.query('INSERT INTO radius_username_reservations(username,radius_identity_id) VALUES(?,?)',[username,identityId]);}catch(error:any){if(error?.code==='ER_DUP_ENTRY')throw new Error('PPPOE_LINE_USERNAME_TAKEN');throw error;}
  await app.query('UPDATE radius_identities SET current_username=? WHERE id=?',[username,identityId]);
  const [account]:any=await app.query("INSERT INTO pppoe_accounts(customer_id,radius_identity_id,line_name,admin_status,allowed_nas_id,created_by) VALUES(?,?,?,'enabled',?,?)",[customerId,identityId,lineName||null,allowedNasId,scope.managerId]);const accountId=Number(account.insertId);
  await ensureRadiusGroup(app,version);
  await app.query("INSERT INTO radcheck(username,attribute,op,value) VALUES(?,'Cleartext-Password',':=',?)",[username,password]);
  if(allowedNas)await app.query("INSERT INTO radcheck(username,attribute,op,value) VALUES(?,'NAS-IP-Address','==',?)",[username,String(allowedNas.nasname)]);
  await app.query('INSERT INTO radusergroup(username,groupname,priority) VALUES(?,?,1)',[username,version.radius_group_name]);
  const service=typeof version.service_snapshot==='string'?JSON.parse(version.service_snapshot):version.service_snapshot;
  const offerActive=version.offer_price!==null&&version.offer_price!==undefined&&version.offer_ends_at&&new Date(version.offer_ends_at).getTime()>Date.now();
  const gifted=Number(version.is_gift)===1,basePrice=String(version.base_price),effectivePrice=gifted?'0.00':offerActive?String(version.offer_price):basePrice;
  const [subscription]:any=await app.query("INSERT INTO pppoe_subscriptions(account_id,package_version_id,service_role,parent_subscription_id,created_by,event_type,renewal_mode,base_price_snapshot,offer_price_snapshot,offer_ends_at_snapshot,effective_price_snapshot,currency_code,is_gift_snapshot,grace_source_snapshot,grace_days_snapshot,effective_service_snapshot,quota_allowance_bytes,lifecycle) VALUES(?,?,'base',NULL,?,'activation','normal',?,?,?,?,?,?,?,?,?,?,'pending')",[accountId,versionId,scope.managerId,basePrice,offerActive?String(version.offer_price):null,offerActive?version.offer_ends_at:null,effectivePrice,version.currency_code,gifted?1:0,graceSource,graceDays,JSON.stringify(service),version.quota_bytes]);
  await app.query('INSERT INTO pppoe_subscription_usage(subscription_id,upload_bytes,download_bytes) VALUES(?,0,0)',[subscription.insertId]);
  await app.query("INSERT INTO activity_log(actor_manager_id,actor_snapshot,actor_kind,action_code,target_type,target_id,customer_id,account_id,after_data,result) VALUES(?,?,'manager','pppoe.line.create','pppoe_account',?,?,?,?, 'success')",[scope.managerId,JSON.stringify({id:access.manager.id,full_name:access.manager.full_name}),accountId,customerId,identityId,JSON.stringify({customerId,packageVersionId:versionId,lineName:lineName||null,username,allowedNasId,subscriptionId:Number(subscription.insertId)})]);
  await app.commit();return {success:true,item:{id:accountId,username,line_name:lineName||null,package_name:version.name,version_no:Number(version.version_no),lifecycle:'pending'}};
 }catch(error){await app.rollback();throw error;}});
}
