import {randomInt} from 'crypto';
import {withNetwork} from './network-runtime.service';
import {managerAccess} from './network-manager-access.service';
const USER={digits:'0123456789',alphanumeric:'abcdefghjkmnpqrstuvwxyz23456789'} as const;
function invalid(field:string):never{const e:any=new Error('HOTSPOT_STANDALONE_INPUT');e.fields={[field]:'تحقق من القيمة المدخلة.'};throw e;}
function integer(v:any,min:number,max:number,field:string){const n=Number(v);if(!Number.isSafeInteger(n)||n<min||n>max)invalid(field);return n;}
function token(n:number,alphabet:string){let s='';for(let i=0;i<n;i++)s+=alphabet[randomInt(alphabet.length)];return s;}
function rate(v:any){const n=BigInt(String(v));if(n%1000000000n===0n)return n/1000000000n+'G';if(n%1000000n===0n)return n/1000000n+'M';if(n%1000n===0n)return n/1000n+'k';return String(n);}
async function principal(app:any,scope:any){const a=await managerAccess(app,scope.managerId,scope.authVersion);if(a.role!=='principal')throw new Error('NETWORK_AUTH');}
async function ensureGroup(app:any,v:any){const [r]:any=await app.query("SELECT id FROM radgroupreply WHERE groupname=? AND attribute='Mikrotik-Rate-Limit' LIMIT 1",[v.radius_group_name]);if(!r.length)await app.query("INSERT INTO radgroupreply(groupname,attribute,op,value) VALUES(?,'Mikrotik-Rate-Limit','=',?)",[v.radius_group_name,rate(v.upload_bps)+'/'+rate(v.download_bps)]);const [s]:any=await app.query("SELECT id FROM radgroupcheck WHERE groupname=? AND attribute='Simultaneous-Use' LIMIT 1",[v.radius_group_name]);if(!s.length)await app.query("INSERT INTO radgroupcheck(groupname,attribute,op,value) VALUES(?,'Simultaneous-Use',':=',?)",[v.radius_group_name,String(v.simultaneous_sessions)]);}
const packagesSql="SELECT p.id package_id,p.name,p.base_price,p.currency_code,v.id package_version_id,v.version_no,v.radius_group_name,v.download_bps,v.upload_bps,v.quota_bytes,v.duration_value,v.duration_unit_id,v.duration_mode,v.simultaneous_sessions,t.code duration_unit_code,t.name_ar duration_unit_name,t.seconds_per_unit,t.actual_usage_seconds FROM hotspot_packages p JOIN hotspot_package_versions v ON v.id=(SELECT x.id FROM hotspot_package_versions x WHERE x.package_id=p.id ORDER BY x.version_no DESC LIMIT 1) JOIN time_units t ON t.id=v.duration_unit_id WHERE p.owner_manager_id=? AND p.is_enabled=1 AND p.archived_at IS NULL ORDER BY p.id DESC";
export async function searchHotspotStandaloneCustomers(scope:any,value:any,customerValue?:any){return withNetwork(scope,async app=>{await principal(app,scope);const customerId=customerValue==null||customerValue===''?null:integer(customerValue,1,Number.MAX_SAFE_INTEGER,'customerId');if(customerId){const [items]:any=await app.query("SELECT id,first_name,last_name,phone FROM customers WHERE id=? AND archived_at IS NULL",[customerId]);return {items};}const s=String(value??'').trim().slice(0,100),like='%'+s+'%';const [items]:any=await app.query("SELECT id,first_name,last_name,phone FROM customers WHERE archived_at IS NULL AND (?='' OR first_name LIKE ? OR last_name LIKE ? OR CONCAT_WS(' ',first_name,last_name) LIKE ? OR phone LIKE ?) ORDER BY id DESC LIMIT 100",[s,like,like,like,like]);return {items};});}
export async function readHotspotStandalone(scope:any){return withNetwork(scope,async app=>{await principal(app,scope);const [[items],[packages]]:any=await Promise.all([app.query("SELECT a.id,a.status,a.login_mode,a.bind_first_mac,a.created_at,r.current_username username,c.id customer_id,c.first_name,c.last_name,c.phone,sp.lifecycle,sp.expires_at,sp.price_snapshot,sp.currency_code,sp.is_gift,COALESCE(u.upload_bytes,0) upload_bytes,COALESCE(u.download_bytes,0) download_bytes,COALESCE(u.used_seconds,0) used_seconds,sp.quota_allowance_bytes,p.name package_name,v.version_no FROM hotspot_accounts a JOIN hotspot_standalone_cards sc ON sc.account_id=a.id JOIN customers c ON c.id=sc.customer_id JOIN radius_identities r ON r.id=a.radius_identity_id LEFT JOIN hotspot_service_periods sp ON sp.live_account_id=a.id LEFT JOIN hotspot_package_versions v ON v.id=sp.package_version_id LEFT JOIN hotspot_packages p ON p.id=v.package_id LEFT JOIN hotspot_period_usage u ON u.period_id=sp.id WHERE a.account_kind='standalone' AND a.archived_at IS NULL ORDER BY a.id DESC LIMIT 200"),app.query(packagesSql,[scope.managerId])]);return {items,packages};});}
export async function readHotspotStandaloneAccount(scope:any,value:any){
 return withNetwork(scope,async app=>{await principal(app,scope);const id=integer(value,1,Number.MAX_SAFE_INTEGER,'id');
  const [items]:any=await app.query("SELECT a.id,a.status,a.login_mode,a.bind_first_mac,a.created_at,r.current_username username,MAX(CASE WHEN rc.attribute='Cleartext-Password' THEN rc.value END) password,CONCAT_WS(' ',c.first_name,c.last_name) customer_name,c.id customer_id,sp.lifecycle,sp.id period_id,sp.quota_allowance_bytes,COALESCE(u.upload_bytes,0) upload_bytes,COALESCE(u.download_bytes,0) download_bytes,COALESCE(u.used_seconds,0) used_seconds,p.name package_name,v.version_no FROM hotspot_accounts a JOIN hotspot_standalone_cards sc ON sc.account_id=a.id JOIN customers c ON c.id=sc.customer_id JOIN radius_identities r ON r.id=a.radius_identity_id LEFT JOIN radcheck rc ON rc.username=r.current_username LEFT JOIN hotspot_service_periods sp ON sp.live_account_id=a.id LEFT JOIN hotspot_package_versions v ON v.id=sp.package_version_id LEFT JOIN hotspot_packages p ON p.id=v.package_id LEFT JOIN hotspot_period_usage u ON u.period_id=sp.id WHERE a.id=? AND a.account_kind='standalone' AND a.archived_at IS NULL GROUP BY a.id,a.status,a.login_mode,a.bind_first_mac,a.created_at,r.current_username,c.first_name,c.last_name,c.id,sp.lifecycle,sp.id,sp.quota_allowance_bytes,u.upload_bytes,u.download_bytes,u.used_seconds,p.name,v.version_no",[id]);
  if(!items[0])throw new Error('HOTSPOT_STANDALONE_UNAVAILABLE');
  const [sessions]:any=await app.query("SELECT radacctid,acctsessionid,nasipaddress,nasportid,acctstarttime,acctupdatetime,acctstoptime,acctsessiontime,acctinputoctets,acctoutputoctets,callingstationid,framedipaddress,acctterminatecause FROM radacct WHERE username=? ORDER BY COALESCE(acctstoptime,acctupdatetime,acctstarttime) DESC,radacctid DESC LIMIT 50",[items[0].username]);
  const [history]:any=await app.query("SELECT id,actor_snapshot,action_code,JSON_UNQUOTE(JSON_EXTRACT(before_data,'$.status')) before_status,JSON_UNQUOTE(JSON_EXTRACT(after_data,'$.status')) after_status,JSON_UNQUOTE(JSON_EXTRACT(after_data,'$.packageVersionId')) package_version_id,occurred_at,result FROM activity_log WHERE customer_id=? OR account_id=(SELECT radius_identity_id FROM hotspot_accounts WHERE id=?) ORDER BY id DESC LIMIT 100",[items[0].customer_id,id]);
  return {item:items[0],sessions,history};
 });
}
export async function setHotspotStandaloneStatus(scope:any,value:any,statusValue:any){
 return withNetwork(scope,async app=>{await app.beginTransaction();try{
  await principal(app,scope);const id=integer(value,1,Number.MAX_SAFE_INTEGER,'id'),status=String(statusValue);
  if(status!=='enabled'&&status!=='disabled')invalid('status');
  const [rows]:any=await app.query("SELECT a.id,a.status,a.radius_identity_id,r.current_username username,sc.customer_id FROM hotspot_accounts a JOIN hotspot_standalone_cards sc ON sc.account_id=a.id JOIN radius_identities r ON r.id=a.radius_identity_id WHERE a.id=? AND a.account_kind='standalone' AND a.archived_at IS NULL FOR UPDATE",[id]);
  if(!rows[0])throw new Error('HOTSPOT_STANDALONE_UNAVAILABLE');
  const before=rows[0].status;
  if(before!==status){
   await app.query("UPDATE hotspot_accounts SET status=? WHERE id=?",[status,id]);
   await app.query("DELETE FROM radcheck WHERE username=? AND attribute='Auth-Type' AND value='Reject'",[rows[0].username]);
   if(status==='disabled')await app.query("INSERT INTO radcheck(username,attribute,op,value) VALUES(?,'Auth-Type',':=','Reject')",[rows[0].username]);
   const [actor]:any=await app.query("SELECT id,full_name FROM managers WHERE id=?",[scope.managerId]);
   await app.query("INSERT INTO activity_log(actor_manager_id,actor_snapshot,actor_kind,action_code,target_type,target_id,customer_id,account_id,before_data,after_data,result) VALUES(?,?,'manager',?,'hotspot_account',?,?,?,?,?,'success')",[scope.managerId,JSON.stringify({id:actor[0]?.id,full_name:actor[0]?.full_name}),status==='disabled'?'hotspot.standalone.disable':'hotspot.standalone.enable',id,rows[0].customer_id,rows[0].radius_identity_id,JSON.stringify({status:before}),JSON.stringify({status})]);
  }
  await app.commit();return {success:true,id,status};
 }catch(error){await app.rollback();throw error;}});
}
export async function exportHotspotStandalone(scope:any,values:any){return withNetwork(scope,async app=>{await principal(app,scope);if(!Array.isArray(values)||!values.length||values.length>200)invalid('ids');const ids=[...new Set(values.map((v:any)=>integer(v,1,Number.MAX_SAFE_INTEGER,'ids')))];const [items]:any=await app.query("SELECT a.id,CONCAT_WS(' ',c.first_name,c.last_name) customer_name,c.phone,r.current_username username,MAX(CASE WHEN rc.attribute='Cleartext-Password' THEN rc.value END) password,a.login_mode,p.name package_name,v.version_no FROM hotspot_accounts a JOIN hotspot_standalone_cards sc ON sc.account_id=a.id JOIN customers c ON c.id=sc.customer_id JOIN radius_identities r ON r.id=a.radius_identity_id LEFT JOIN radcheck rc ON rc.username=r.current_username LEFT JOIN hotspot_service_periods sp ON sp.live_account_id=a.id LEFT JOIN hotspot_package_versions v ON v.id=sp.package_version_id LEFT JOIN hotspot_packages p ON p.id=v.package_id WHERE a.account_kind='standalone' AND a.archived_at IS NULL AND a.id IN ("+ids.map(()=>'?').join(',')+") GROUP BY a.id,c.first_name,c.last_name,c.phone,r.current_username,a.login_mode,p.name,v.version_no",ids);return {items};});}
export async function createHotspotStandalone(scope:any,input:any){
 return withNetwork(scope,async app=>{
  await app.beginTransaction();
  try{
   await principal(app,scope);
   const customerId=integer(input.customerId,1,Number.MAX_SAFE_INTEGER,'customerId');
   const versionId=integer(input.packageVersionId,1,Number.MAX_SAFE_INTEGER,'packageVersionId');
   const mode=String(input.loginMode);
   if(!['code','username_password'].includes(mode)||typeof input.isGift!=='boolean'||typeof input.bindFirstMac!=='boolean')invalid('loginMode');
   const manualUsername=input.username!==undefined&&input.username!==null;
   let username='',password='',identityId=0;
   if(manualUsername){
    username=String(input.username).trim().toLowerCase();
    if(!/^[a-z0-9_.@-]{1,64}$/.test(username))invalid('username');
    password=mode==='code'?username:String(input.password??'');
    if(mode==='username_password'&&(Array.from(password).length>15||/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/u.test(password)))invalid('password');
   }
   const [cs]:any=await app.query("SELECT id,first_name,last_name FROM customers WHERE id=? AND archived_at IS NULL FOR UPDATE",[customerId]);
   if(!cs[0])throw new Error('HOTSPOT_STANDALONE_CUSTOMER_UNAVAILABLE');
   const [vs]:any=await app.query("SELECT p.id package_id,p.name package_name,p.base_price,p.currency_code,v.id package_version_id,v.version_no,v.radius_group_name,v.download_bps,v.upload_bps,v.quota_bytes,v.duration_value,v.duration_unit_id,v.duration_mode,v.simultaneous_sessions,t.code duration_unit_code,t.name_ar duration_unit_name,t.seconds_per_unit,t.actual_usage_seconds FROM hotspot_package_versions v JOIN hotspot_packages p ON p.id=v.package_id JOIN time_units t ON t.id=v.duration_unit_id WHERE v.id=? AND p.owner_manager_id=? AND p.is_enabled=1 AND p.archived_at IS NULL AND v.id=(SELECT x.id FROM hotspot_package_versions x WHERE x.package_id=p.id ORDER BY x.version_no DESC LIMIT 1) FOR UPDATE",[versionId,scope.managerId]);
   const v=vs[0];
   if(!v)throw new Error('HOTSPOT_STANDALONE_PACKAGE_UNAVAILABLE');
   if(manualUsername){
    const [created]:any=await app.query("INSERT INTO radius_identities(service_kind) VALUES('hotspot')");
    identityId=Number(created.insertId);
    try{await app.query("INSERT INTO radius_username_reservations(username,radius_identity_id) VALUES(?,?)",[username,identityId]);}
    catch(error:any){if(error?.code==='ER_DUP_ENTRY')throw new Error('HOTSPOT_STANDALONE_USERNAME_TAKEN');throw error;}
    await app.query("UPDATE radius_identities SET current_username=? WHERE id=?",[username,identityId]);
   }else{
    const prefix=String(input.usernamePrefix??'').trim().toLowerCase(),length=integer(input.usernameLength,4,32,'usernameLength');
    if(!/^[a-z0-9_-]*$/.test(prefix)||prefix.length>16||(prefix.length>0&&prefix.length<3)||length-prefix.length<3)invalid('usernamePrefix');
    const ua=String(input.usernameAlphabet??'alphanumeric') as keyof typeof USER,pa=String(input.passwordAlphabet??'alphanumeric') as keyof typeof USER;
    if(!Object.prototype.hasOwnProperty.call(USER,ua)||!Object.prototype.hasOwnProperty.call(USER,pa)||(ua==='digits'&&!/^[0-9]*$/.test(prefix)))invalid('usernameAlphabet');
    const pwlen=mode==='code'?length:integer(input.passwordLength,4,32,'passwordLength');
    for(let i=0;i<12;i++){
     username=prefix+token(length-prefix.length,USER[ua]);
     const [created]:any=await app.query("INSERT INTO radius_identities(service_kind) VALUES('hotspot')");
     identityId=Number(created.insertId);
     try{
      await app.query("INSERT INTO radius_username_reservations(username,radius_identity_id) VALUES(?,?)",[username,identityId]);
      await app.query("UPDATE radius_identities SET current_username=? WHERE id=?",[username,identityId]);
      break;
     }catch(error:any){
      if(error?.code!=='ER_DUP_ENTRY')throw error;
      await app.query("DELETE FROM radius_identities WHERE id=?",[identityId]);
      identityId=0;
     }
    }
    if(!identityId)throw new Error('HOTSPOT_STANDALONE_GENERATION');
    password=mode==='code'?username:token(pwlen,USER[pa]);
   }
   await ensureGroup(app,v);
   const [a]:any=await app.query("INSERT INTO hotspot_accounts(radius_identity_id,account_kind,owner_manager_id,created_by,login_mode,status,bind_first_mac) VALUES(?,'standalone',NULL,?,?,'enabled',?)",[identityId,scope.managerId,mode,input.bindFirstMac?1:0]);
   const accountId=Number(a.insertId);
   await app.query("INSERT INTO hotspot_standalone_cards(account_id,account_kind,customer_id) VALUES(?,'standalone',?)",[accountId,customerId]);
   await app.query("INSERT INTO radcheck(username,attribute,op,value) VALUES(?,'Cleartext-Password',':=',?)",[username,password]);
   await app.query("INSERT INTO radusergroup(username,groupname,priority) VALUES(?,?,1)",[username,v.radius_group_name]);
   const seconds=v.duration_mode==='connected_time'?BigInt(String(v.actual_usage_seconds||0))*BigInt(v.duration_value):null;
   if(v.duration_mode==='connected_time'&&(!seconds||seconds<=0n))throw new Error('HOTSPOT_STANDALONE_PACKAGE_UNAVAILABLE');
   const price=input.isGift?'0.00':String(v.base_price),snapshot=JSON.stringify({code:v.duration_unit_code,seconds_per_unit:v.seconds_per_unit,actual_usage_seconds:v.actual_usage_seconds});
   const [period]:any=await app.query("INSERT INTO hotspot_service_periods(account_id,package_version_id,previous_period_id,event_type,created_by,duration_mode,duration_value,duration_unit_id,time_allowance_seconds,carried_seconds,quota_allowance_bytes,price_snapshot,currency_code,is_gift,unit_snapshot,lifecycle) VALUES(?,?,NULL,'issue',?,?,?,?,?,0,?,?,?,?,?,'pending')",[accountId,versionId,scope.managerId,v.duration_mode,v.duration_value,v.duration_unit_id,seconds?.toString()||null,v.quota_bytes,price,v.currency_code,input.isGift?1:0,snapshot]);
   await app.query("INSERT INTO hotspot_period_usage(period_id,upload_bytes,download_bytes,used_seconds) VALUES(?,0,0,0)",[period.insertId]);
   const [actor]:any=await app.query("SELECT id,full_name FROM managers WHERE id=?",[scope.managerId]);
   await app.query("INSERT INTO activity_log(actor_manager_id,actor_snapshot,actor_kind,action_code,target_type,target_id,customer_id,account_id,after_data,result) VALUES(?,?,'manager','hotspot.standalone.create','hotspot_account',?,?,?,?, 'success')",[scope.managerId,JSON.stringify({id:actor[0]?.id,full_name:actor[0]?.full_name}),accountId,customerId,identityId,JSON.stringify({customerId,packageVersionId:versionId,loginMode:mode,isGift:input.isGift})]);
   await app.commit();
   return {success:true,item:{id:accountId,username,password,login_mode:mode,customer_name:[cs[0].first_name,cs[0].last_name].filter(Boolean).join(' '),package_name:v.package_name,version_no:v.version_no}};
  }catch(error){await app.rollback();throw error;}
 });
}
