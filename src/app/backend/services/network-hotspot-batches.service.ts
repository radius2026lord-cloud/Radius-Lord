import {randomInt} from 'crypto';
import {withNetwork} from './network-runtime.service';
import {managerAccess} from './network-manager-access.service';

const ALPHABETS={letters:'abcdefghjkmnpqrstuvwxyz',alphanumeric:'abcdefghjkmnpqrstuvwxyz23456789'} as const;
type AlphabetKind=keyof typeof ALPHABETS;
function invalid(field:string):never{const error:any=new Error('HOTSPOT_BATCH_INPUT');error.fields={[field]:'تحقق من القيمة المدخلة.'};throw error;}
function integer(value:any,min:number,max:number,field:string){const n=Number(value);if(!Number.isSafeInteger(n)||n<min||n>max)invalid(field);return n;}
function token(length:number,alphabet:string){let value='';for(let i=0;i<length;i++)value+=alphabet[randomInt(alphabet.length)];return value;}
function rate(value:any){const n=BigInt(String(value));if(n%1000000000n===0n)return (n/1000000000n)+'G';if(n%1000000n===0n)return (n/1000000n)+'M';if(n%1000n===0n)return (n/1000n)+'k';return String(n);}
function valuesSql(rows:any[][]){return rows.map(()=> '('+rows[0].map(()=>'?').join(',')+')').join(',');}
async function ensureRadiusGroup(app:any,version:any){
 const rateLimit=rate(version.upload_bps)+'/'+rate(version.download_bps);
 const [rates]:any=await app.query("SELECT id FROM radgroupreply WHERE groupname=? AND attribute='Mikrotik-Rate-Limit' LIMIT 1",[version.radius_group_name]);
 if(!rates.length)await app.query("INSERT INTO radgroupreply(groupname,attribute,op,value) VALUES(?,'Mikrotik-Rate-Limit','=',?)",[version.radius_group_name,rateLimit]);
 const [sessions]:any=await app.query("SELECT id FROM radgroupcheck WHERE groupname=? AND attribute='Simultaneous-Use' LIMIT 1",[version.radius_group_name]);
 if(!sessions.length)await app.query("INSERT INTO radgroupcheck(groupname,attribute,op,value) VALUES(?,'Simultaneous-Use',':=',?)",[version.radius_group_name,String(version.simultaneous_sessions)]);
}
async function principalAccess(app:any,scope:any){const access=await managerAccess(app,scope.managerId,scope.authVersion);if(access.role!=='principal')throw new Error('NETWORK_AUTH');return access;}
export async function readHotspotBatches(scope:any){
 return withNetwork(scope,async app=>{
  await principalAccess(app,scope);
  const [[items],[packages]]:any=await Promise.all([
   app.query("SELECT b.id,b.name,b.quantity,b.login_mode,b.unit_price,b.currency_code,b.is_gift,b.created_at,p.name package_name,v.version_no,COUNT(bc.account_id) card_count,SUM(CASE WHEN a.status='enabled' AND a.archived_at IS NULL THEN 1 ELSE 0 END) enabled_count FROM hotspot_card_batches b JOIN hotspot_package_versions v ON v.id=b.package_version_id JOIN hotspot_packages p ON p.id=v.package_id LEFT JOIN hotspot_batch_cards bc ON bc.batch_id=b.id LEFT JOIN hotspot_accounts a ON a.id=bc.account_id WHERE b.owner_manager_id=? GROUP BY b.id,b.name,b.quantity,b.login_mode,b.unit_price,b.currency_code,b.is_gift,b.created_at,p.name,v.version_no ORDER BY b.id DESC LIMIT 200",[scope.managerId]),
   app.query("SELECT p.id package_id,p.name,p.base_price,p.currency_code,v.id package_version_id,v.version_no,v.radius_group_name,v.download_bps,v.upload_bps,v.quota_bytes,v.duration_value,v.duration_unit_id,v.duration_mode,v.simultaneous_sessions,t.code duration_unit_code,t.name_ar duration_unit_name,t.seconds_per_unit,t.actual_usage_seconds FROM hotspot_packages p JOIN hotspot_package_versions v ON v.id=(SELECT latest.id FROM hotspot_package_versions latest WHERE latest.package_id=p.id ORDER BY latest.version_no DESC LIMIT 1) JOIN time_units t ON t.id=v.duration_unit_id WHERE p.owner_manager_id=? AND p.is_enabled=1 AND p.archived_at IS NULL ORDER BY p.id DESC",[scope.managerId])
  ]);
  return {items,packages};
 });
}
export async function readHotspotBatchCards(scope:any,batchIdValue:any){
 return withNetwork(scope,async app=>{
  await principalAccess(app,scope);
  const batchId=integer(batchIdValue,1,Number.MAX_SAFE_INTEGER,'batchId');
  const [batches]:any=await app.query("SELECT b.id,b.name,b.quantity,b.login_mode,b.unit_price,b.currency_code,b.is_gift,b.created_at,p.name package_name,v.version_no,v.duration_value,v.duration_mode,t.name_ar duration_unit_name FROM hotspot_card_batches b JOIN hotspot_package_versions v ON v.id=b.package_version_id JOIN hotspot_packages p ON p.id=v.package_id JOIN time_units t ON t.id=v.duration_unit_id WHERE b.id=? AND b.owner_manager_id=?",[batchId,scope.managerId]);
  if(!batches[0])throw new Error('HOTSPOT_BATCH_UNAVAILABLE');
  const [cards]:any=await app.query("SELECT bc.serial_no,a.id account_id,a.status,r.current_username username,MAX(CASE WHEN rc.attribute='Cleartext-Password' THEN rc.value END) password FROM hotspot_batch_cards bc JOIN hotspot_accounts a ON a.id=bc.account_id JOIN radius_identities r ON r.id=a.radius_identity_id LEFT JOIN radcheck rc ON rc.username=r.current_username WHERE bc.batch_id=? AND bc.owner_manager_id=? GROUP BY bc.account_id,bc.serial_no,a.id,a.status,r.current_username ORDER BY bc.serial_no",[batchId,scope.managerId]);
  return {batch:batches[0],cards};
 });
}
export async function createHotspotBatch(scope:any,input:any){
 return withNetwork(scope,async app=>{
  await app.beginTransaction();
  try{
   const access=await principalAccess(app,scope);
   const name=String(input.name??'').trim();
   if(!name||name.length>150)invalid('name');
   const quantity=integer(input.quantity,1,500,'quantity');
   const loginMode=String(input.loginMode);
   if(!['code','username_password'].includes(loginMode))invalid('loginMode');
   if(typeof input.isGift!=='boolean')invalid('isGift');
   const usernamePrefix=String(input.usernamePrefix??'').trim().toLowerCase();
   if(!/^[a-z0-9_-]*$/.test(usernamePrefix)||usernamePrefix.length>16)invalid('usernamePrefix');
   const usernameLength=integer(input.usernameLength,6,32,'usernameLength');
   if(usernameLength-usernamePrefix.length<4)invalid('usernamePrefix');
   const passwordLength=loginMode==='code'?usernameLength:integer(input.passwordLength,6,32,'passwordLength');
   const alphabetKind=String(input.alphabet??'alphanumeric') as AlphabetKind;
   if(!Object.prototype.hasOwnProperty.call(ALPHABETS,alphabetKind))invalid('alphabet');
   const alphabet=ALPHABETS[alphabetKind];
   const versionId=integer(input.packageVersionId,1,Number.MAX_SAFE_INTEGER,'packageVersionId');
   const [rows]:any=await app.query("SELECT p.id package_id,p.name package_name,p.base_price,p.currency_code,p.owner_manager_id,v.id package_version_id,v.version_no,v.radius_group_name,v.download_bps,v.upload_bps,v.quota_bytes,v.duration_value,v.duration_unit_id,v.duration_mode,v.simultaneous_sessions,t.code duration_unit_code,t.name_ar duration_unit_name,t.seconds_per_unit,t.actual_usage_seconds FROM hotspot_package_versions v JOIN hotspot_packages p ON p.id=v.package_id JOIN time_units t ON t.id=v.duration_unit_id WHERE v.id=? AND p.owner_manager_id=? AND p.is_enabled=1 AND p.archived_at IS NULL AND v.id=(SELECT latest.id FROM hotspot_package_versions latest WHERE latest.package_id=p.id ORDER BY latest.version_no DESC LIMIT 1) FOR UPDATE",[versionId,scope.managerId]);
   const version=rows[0];if(!version)throw new Error('HOTSPOT_BATCH_PACKAGE_UNAVAILABLE');
   const generationOptions={usernamePrefix,usernameLength,passwordLength,format:loginMode==='code'?'single-code':'username-password',alphabet:alphabetKind};
   const price= input.isGift?'0.00':String(version.base_price);
   const [created]:any=await app.query("INSERT INTO hotspot_card_batches(package_version_id,name,quantity,owner_manager_id,created_by,login_mode,generation_options,unit_price,currency_code,is_gift) VALUES(?,?,?,?,?,?,?,?,?,?)",[versionId,name,quantity,scope.managerId,scope.managerId,loginMode,JSON.stringify(generationOptions),price,version.currency_code,input.isGift?1:0]);
   const batchId=Number(created.insertId);
   const credentials:any[]=[],seen=new Set<string>(),identityIds:number[]=[];
   for(let serial=1;serial<=quantity;serial++){
    let username='',password='',identityId=0;
    for(let attempt=0;attempt<12;attempt++){
     username=usernamePrefix+token(usernameLength-usernamePrefix.length,alphabet);if(seen.has(username))continue;
     password=loginMode==='code'?username:token(passwordLength,alphabet);
     const [identity]:any=await app.query("INSERT INTO radius_identities(service_kind) VALUES('hotspot')");
     identityId=Number(identity.insertId);
     try{
      await app.query("INSERT INTO radius_username_reservations(username,radius_identity_id) VALUES(?,?)",[username,identityId]);
      await app.query("UPDATE radius_identities SET current_username=? WHERE id=?",[username,identityId]);
      break;
     }catch(error:any){
      if(error?.code!=='ER_DUP_ENTRY')throw error;
      await app.query("DELETE FROM radius_identities WHERE id=?",[identityId]);identityId=0;
     }
    }
    if(!identityId)throw new Error('HOTSPOT_BATCH_GENERATION');
    seen.add(username);identityIds.push(identityId);credentials.push({serial_no:serial,username,password,status:'enabled'});
   }
   await ensureRadiusGroup(app,version);
   const accountIds:number[]=[];
   for(const identityId of identityIds){
    const [account]:any=await app.query("INSERT INTO hotspot_accounts(radius_identity_id,account_kind,owner_manager_id,created_by,login_mode,status,bind_first_mac) VALUES(?,'batch',?,?,?,'enabled',0)",[identityId,scope.managerId,scope.managerId,loginMode]);
    accountIds.push(Number(account.insertId));
   }
   const batchCards=accountIds.map((accountId,index)=>[accountId,'batch',batchId,scope.managerId,index+1]);
   await app.query("INSERT INTO hotspot_batch_cards(account_id,account_kind,batch_id,owner_manager_id,serial_no) VALUES "+valuesSql(batchCards),batchCards.flat());
   const checkRows=credentials.map(card=>[card.username,'Cleartext-Password',':=',card.password]);
   await app.query("INSERT INTO radcheck(username,attribute,op,value) VALUES "+valuesSql(checkRows),checkRows.flat());
   const groupRows=credentials.map(card=>[card.username,version.radius_group_name,1]);
   await app.query("INSERT INTO radusergroup(username,groupname,priority) VALUES "+valuesSql(groupRows),groupRows.flat());
   const seconds=version.duration_mode==='connected_time'?BigInt(String(version.actual_usage_seconds||0))*BigInt(version.duration_value):null;
   if(version.duration_mode==='connected_time'&&(!seconds||seconds<=0n))throw new Error('HOTSPOT_BATCH_PACKAGE_UNAVAILABLE');
   const unitSnapshot=JSON.stringify({code:version.duration_unit_code,seconds_per_unit:version.seconds_per_unit,actual_usage_seconds:version.actual_usage_seconds});
   const periodRows=accountIds.map(accountId=>[accountId,versionId,null,'issue',scope.managerId,null,null,null,version.duration_mode,version.duration_value,version.duration_unit_id,seconds?.toString()||null,0,version.quota_bytes,price,version.currency_code,input.isGift?1:0,unitSnapshot,'pending']);
   await app.query("INSERT INTO hotspot_service_periods(account_id,package_version_id,previous_period_id,event_type,created_by,activated_at,ended_at,expires_at,duration_mode,duration_value,duration_unit_id,time_allowance_seconds,carried_seconds,quota_allowance_bytes,price_snapshot,currency_code,is_gift,unit_snapshot,lifecycle) VALUES "+valuesSql(periodRows),periodRows.flat());
   await app.query("INSERT INTO hotspot_period_usage(period_id,upload_bytes,download_bytes,used_seconds) SELECT id,0,0,0 FROM hotspot_service_periods WHERE account_id IN ("+accountIds.map(()=>'?').join(',')+") AND lifecycle='pending'",accountIds);
   const [batchRows]:any=await app.query("SELECT b.id,b.name,b.quantity,b.login_mode,b.unit_price,b.currency_code,b.is_gift,b.created_at,p.name package_name,v.version_no,v.duration_value,v.duration_mode,t.name_ar duration_unit_name FROM hotspot_card_batches b JOIN hotspot_package_versions v ON v.id=b.package_version_id JOIN hotspot_packages p ON p.id=v.package_id JOIN time_units t ON t.id=v.duration_unit_id WHERE b.id=? AND b.owner_manager_id=?",[batchId,scope.managerId]);
   const [actor]:any=await app.query("SELECT id,full_name FROM managers WHERE id=?",[scope.managerId]);
   await app.query("INSERT INTO activity_log(actor_manager_id,actor_snapshot,actor_kind,action_code,target_type,target_id,before_data,after_data,result) VALUES(?,?,'manager','hotspot.batches.create','hotspot_batch',?,NULL,?,'success')",[scope.managerId,JSON.stringify({id:actor[0]?.id,full_name:actor[0]?.full_name}),batchId,JSON.stringify({name,quantity,packageVersionId:versionId,loginMode,isGift:input.isGift})]);
   await app.commit();
   return {success:true,id:batchId,batch:batchRows[0],cards:credentials};
  }catch(error){await app.rollback();throw error;}
 });
}
