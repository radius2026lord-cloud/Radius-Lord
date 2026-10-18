import {withNetwork} from './network-runtime.service';
import {managerAccess} from './network-manager-access.service';

const ipv4=(value:any)=>{
 const parts=String(value??'').trim().split('.');
 if(parts.length!==4||parts.some(part=>!/^\d{1,3}$/.test(part)||Number(part)>255))throw new Error('EQUIPMENT_INPUT');
 return parts.reduce((total,part)=>(total*256+Number(part))>>>0,0);
};
const ipText=(value:number)=>[value>>>24,(value>>>16)&255,(value>>>8)&255,value&255].join('.');
function cidrRange(value:any){
 const match=/^([^/]+)\/(\d{1,2})$/.exec(String(value??'').trim());
 if(!match)throw new Error('EQUIPMENT_POOL_INPUT');
 const address=ipv4(match[1]),prefix=Number(match[2]);
 if(prefix<8||prefix>30)throw new Error('EQUIPMENT_POOL_INPUT');
 const size=2**(32-prefix),network=Math.floor(address/size)*size,broadcast=network+size-1;
 return {prefix,network,broadcast,first:network+1,last:broadcast-1};
}
function integer(value:any,field='id'){const n=Number(value);if(!Number.isSafeInteger(n)||n<1)throw new Error(field==='id'?'EQUIPMENT_INPUT':'EQUIPMENT_INPUT');return n;}
function clean(value:any,max:number){return String(value??'').trim().slice(0,max);}
async function principal(app:any,scope:any){const access=await managerAccess(app,scope.managerId,scope.authVersion);if(access.role!=='principal')throw new Error('NETWORK_AUTH');return access;}
async function insertDevice(app:any,scope:any,input:any,role:'ap'|'station',customerId:number|null){
 const poolId=integer(input.poolId,'poolId');
 const [poolRows]:any=await app.query('SELECT id,name,gateway_ipv4,range_start_ipv4,range_end_ipv4,excluded_ipv4,is_enabled FROM equipment_ip_pools WHERE id=? FOR UPDATE',[poolId]);
 const pool=poolRows[0];if(!pool||Number(pool.is_enabled)!==1)throw new Error('EQUIPMENT_POOL_UNAVAILABLE');
 const name=clean(input.name,150),model=clean(input.model,100),serial=clean(input.serialNumber,120),mac=clean(input.macAddress,17).toUpperCase();
 const vendor=String(input.vendor||'');
 if(!name||!['ubnt','mimosa','mikrotik','other'].includes(vendor)||serial.length>120||model.length>100||mac&& !/^(?:[0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(mac))throw new Error('EQUIPMENT_INPUT');
 if(role==='station'&&!customerId)throw new Error('EQUIPMENT_INPUT');
 if(input.parentApId){
  if(role!=='station')throw new Error('EQUIPMENT_INPUT');
  const [aps]:any=await app.query("SELECT id FROM network_equipment_devices WHERE id=? AND device_role='ap' AND status<>'retired' FOR UPDATE",[integer(input.parentApId)]);
  if(!aps[0])throw new Error('EQUIPMENT_AP_UNAVAILABLE');
 }
 const [usedRows]:any=await app.query('SELECT management_ipv4 FROM network_equipment_devices WHERE pool_id=? AND management_ipv4 IS NOT NULL FOR UPDATE',[poolId]);
 const excluded=Array.isArray(pool.excluded_ipv4)?pool.excluded_ipv4:JSON.parse(String(pool.excluded_ipv4||'[]'));
 const occupied=new Set<number>([Number(pool.gateway_ipv4),...excluded.map(ipv4),...usedRows.map((row:any)=>Number(row.management_ipv4))]);
 const start=Number(pool.range_start_ipv4),end=Number(pool.range_end_ipv4);let candidate=start;
 const ordered=Array.from(occupied).filter(value=>value>=start&&value<=end).sort((a,b)=>a-b);
 for(const value of ordered){if(value===candidate)candidate++;else if(value>candidate)break;}
 if(candidate>end)throw new Error('EQUIPMENT_POOL_EXHAUSTED');
 const address=clean(input.address,1000),notes=clean(input.notes,1000);
 const lat=input.latitude==null||input.latitude===''?null:Number(input.latitude),lon=input.longitude==null||input.longitude===''?null:Number(input.longitude);
 if((lat===null)!==(lon===null)||lat!==null&&(!Number.isFinite(lat)||lat < -90||lat > 90)||lon!==null&&(!Number.isFinite(lon)||lon < -180||lon > 180))throw new Error('EQUIPMENT_INPUT');
 const [inserted]:any=await app.query('INSERT INTO network_equipment_devices(device_role,customer_id,pool_id,management_ipv4,vendor,model,name,serial_number,mac_address,parent_ap_id,address,latitude,longitude,notes,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[role,customerId,poolId,candidate,vendor,model||null,name,serial||null,mac||null,input.parentApId?integer(input.parentApId):null,address||null,lat,lon,notes||null,scope.managerId]);
 return {id:Number(inserted.insertId),role,customerId,poolId,managementIp:ipText(candidate),vendor,model:model||null,name,serialNumber:serial||null,macAddress:mac||null,parentApId:input.parentApId?Number(input.parentApId):null};
}

export async function readNetworkEquipment(scope:any){
 return withNetwork(scope,async app=>{
  await principal(app,scope);
  const [[pools],[devices]]:any=await Promise.all([
   app.query('SELECT id,name,cidr,INET_NTOA(gateway_ipv4) gateway,INET_NTOA(range_start_ipv4) range_start,INET_NTOA(range_end_ipv4) range_end,excluded_ipv4,is_enabled,created_at FROM equipment_ip_pools ORDER BY name,id'),
   app.query(`SELECT d.id,d.device_role,d.customer_id,c.first_name,c.last_name,d.pool_id,p.name pool_name,INET_NTOA(d.management_ipv4) management_ip,INET_NTOA(d.last_management_ipv4) last_management_ip,d.vendor,d.model,d.name,d.serial_number,d.mac_address,d.parent_ap_id,ap.name parent_ap_name,d.status,d.address,d.latitude,d.longitude,d.notes,d.created_at,pa.id pppoe_account_id,r.current_username pppoe_username,pa.line_name
    FROM network_equipment_devices d JOIN equipment_ip_pools p ON p.id=d.pool_id LEFT JOIN customers c ON c.id=d.customer_id LEFT JOIN network_equipment_devices ap ON ap.id=d.parent_ap_id LEFT JOIN pppoe_accounts pa ON pa.station_device_id=d.id AND pa.archived_at IS NULL LEFT JOIN radius_identities r ON r.id=pa.radius_identity_id ORDER BY d.id DESC LIMIT 1000`)
  ]);
  return {pools:pools.map((row:any)=>({...row,excluded_ipv4:typeof row.excluded_ipv4==='string'?JSON.parse(row.excluded_ipv4):row.excluded_ipv4,is_enabled:Number(row.is_enabled)})),devices};
 });
}

export async function searchEquipmentCustomers(scope:any,value:any){
 const query=clean(value,100);if(query.length<2)return {items:[]};
 return withNetwork(scope,async app=>{await principal(app,scope);const like='%'+query.replace(/[\\%_]/g,'\\$&')+'%';const [rows]:any=await app.query(`SELECT id,first_name,last_name,phone FROM customers WHERE archived_at IS NULL AND (CONCAT_WS(' ',first_name,last_name) LIKE ? OR phone LIKE ?) ORDER BY first_name,last_name,id LIMIT 30`,[like,like]);return {items:rows};});
}

export async function readCustomerEquipmentOptions(scope:any,value:any){
 const customerId=integer(value);
 return withNetwork(scope,async app=>{await principal(app,scope);const [customers]:any=await app.query('SELECT id FROM customers WHERE id=? AND archived_at IS NULL',[customerId]);if(!customers[0])throw new Error('EQUIPMENT_CUSTOMER_UNAVAILABLE');const [[rows],[aps]]:any=await Promise.all([app.query(`SELECT d.id,d.name,d.vendor,d.model,INET_NTOA(d.management_ipv4) management_ip,d.serial_number,d.parent_ap_id,ap.name parent_ap_name
  FROM network_equipment_devices d LEFT JOIN network_equipment_devices ap ON ap.id=d.parent_ap_id
  WHERE d.device_role='station' AND d.customer_id=? AND d.status='active' AND d.management_ipv4 IS NOT NULL
   AND NOT EXISTS(SELECT 1 FROM pppoe_accounts p WHERE p.station_device_id=d.id AND p.archived_at IS NULL)
  ORDER BY d.name,d.id`,[customerId]),app.query("SELECT id,name,vendor,model,INET_NTOA(management_ipv4) management_ip FROM network_equipment_devices WHERE device_role='ap' AND status='active' AND management_ipv4 IS NOT NULL ORDER BY name,id")]);
 const [pools]:any=await app.query('SELECT id,name,cidr,INET_NTOA(range_start_ipv4) range_start,INET_NTOA(range_end_ipv4) range_end FROM equipment_ip_pools WHERE is_enabled=1 ORDER BY name,id');return {stations:rows,pools,aps};});
}

export async function mutateNetworkEquipment(scope:any,input:any){
 const action=String(input?.action||'');
 if(!['pool.create','pool.update','pool.enabled','device.create','device.update','device.status'].includes(action))throw new Error('EQUIPMENT_INPUT');
 return withNetwork(scope,async app=>{
  const access=await principal(app,scope);
  if(action==='pool.create'){
   const name=clean(input.name,120),cidr=String(input.cidr||'').trim(),range=cidrRange(cidr),gateway=ipv4(input.gateway),start=ipv4(input.rangeStart),end=ipv4(input.rangeEnd);
   const exclusions=Array.from(new Set((Array.isArray(input.excludedIps)?input.excludedIps:[]).map(ipv4))) as number[];
   if(!name||start<range.first||end>range.last||start>end||gateway<range.first||gateway>range.last||exclusions.length>256||exclusions.some(ip=>ip<start||ip>end||ip===gateway))throw new Error('EQUIPMENT_POOL_INPUT');
   await app.beginTransaction();try{
    const [existing]:any=await app.query('SELECT name,gateway_ipv4,range_start_ipv4,range_end_ipv4 FROM equipment_ip_pools FOR UPDATE');
    if(existing.some((row:any)=>String(row.name).toLocaleLowerCase()===name.toLocaleLowerCase()))throw new Error('EQUIPMENT_POOL_NAME_TAKEN');
    if(existing.some((row:any)=>start<=Number(row.range_end_ipv4)&&end>=Number(row.range_start_ipv4)||gateway===Number(row.gateway_ipv4)||gateway>=Number(row.range_start_ipv4)&&gateway<=Number(row.range_end_ipv4)||Number(row.gateway_ipv4)>=start&&Number(row.gateway_ipv4)<=end))throw new Error('EQUIPMENT_POOL_OVERLAP');
    const [result]:any=await app.query('INSERT INTO equipment_ip_pools(name,cidr,gateway_ipv4,range_start_ipv4,range_end_ipv4,excluded_ipv4,created_by) VALUES(?,?,?,?,?,?,?)',[name,cidr,gateway,start,end,JSON.stringify(exclusions.map(ipText)),scope.managerId]);
    await app.query("INSERT INTO activity_log(actor_manager_id,actor_snapshot,actor_kind,action_code,target_type,target_id,after_data,result) VALUES(?,?,'manager','equipment.pool.create','equipment_ip_pool',?,?, 'success')",[scope.managerId,JSON.stringify({id:access.manager.id,full_name:access.manager.full_name}),Number(result.insertId),JSON.stringify({name,cidr,gateway:ipText(gateway),rangeStart:ipText(start),rangeEnd:ipText(end),excludedIps:exclusions.map(ipText)})]);
    await app.commit();return {success:true,id:Number(result.insertId)};
   }catch(error){await app.rollback();throw error;}
  }
  if(action==='pool.update'){
   const id=integer(input.id),name=clean(input.name,120),cidr=String(input.cidr||'').trim(),range=cidrRange(cidr),gateway=ipv4(input.gateway),start=ipv4(input.rangeStart),end=ipv4(input.rangeEnd);
   const exclusions=Array.from(new Set((Array.isArray(input.excludedIps)?input.excludedIps:[]).map(ipv4))) as number[];
   if(!name||start<range.first||end>range.last||start>end||gateway<range.first||gateway>range.last||exclusions.length>256||exclusions.some(ip=>ip<start||ip>end||ip===gateway))throw new Error('EQUIPMENT_POOL_INPUT');
   await app.beginTransaction();try{
    const [pools]:any=await app.query('SELECT id,name,gateway_ipv4,range_start_ipv4,range_end_ipv4 FROM equipment_ip_pools WHERE id=? FOR UPDATE',[id]);const pool=pools[0];if(!pool)throw new Error('EQUIPMENT_POOL_UNAVAILABLE');
    const [others]:any=await app.query('SELECT id,name,gateway_ipv4,range_start_ipv4,range_end_ipv4 FROM equipment_ip_pools WHERE id<>? FOR UPDATE',[id]);
    if(others.some((row:any)=>String(row.name).toLocaleLowerCase()===name.toLocaleLowerCase()))throw new Error('EQUIPMENT_POOL_NAME_TAKEN');
    if(others.some((row:any)=>start<=Number(row.range_end_ipv4)&&end>=Number(row.range_start_ipv4)||gateway===Number(row.gateway_ipv4)||gateway>=Number(row.range_start_ipv4)&&gateway<=Number(row.range_end_ipv4)||Number(row.gateway_ipv4)>=start&&Number(row.gateway_ipv4)<=end))throw new Error('EQUIPMENT_POOL_OVERLAP');
    const [devices]:any=await app.query('SELECT management_ipv4 FROM network_equipment_devices WHERE pool_id=? AND management_ipv4 IS NOT NULL FOR UPDATE',[id]);
    if(devices.some((row:any)=>Number(row.management_ipv4)<start||Number(row.management_ipv4)>end||Number(row.management_ipv4)===gateway||exclusions.includes(Number(row.management_ipv4))))throw new Error('EQUIPMENT_POOL_HAS_DEVICES');
    await app.query('UPDATE equipment_ip_pools SET name=?,cidr=?,gateway_ipv4=?,range_start_ipv4=?,range_end_ipv4=?,excluded_ipv4=? WHERE id=?',[name,cidr,gateway,start,end,JSON.stringify(exclusions.map(ipText)),id]);
    await app.commit();return {success:true,id};
   }catch(error){await app.rollback();throw error;}
  }
  if(action==='pool.enabled'){
   const id=integer(input.id),enabled=input.enabled===true||input.enabled===1;
   const [result]:any=await app.query('UPDATE equipment_ip_pools SET is_enabled=? WHERE id=?',[enabled?1:0,id]);if(!result.affectedRows)throw new Error('EQUIPMENT_POOL_UNAVAILABLE');return {success:true};
  }
  if(action==='device.create'){
   const role=input.role==='station'?'station':input.role==='ap'?'ap':null;if(!role)throw new Error('EQUIPMENT_INPUT');
   const customerId=role==='station'?integer(input.customerId,'customerId'):null;
   await app.beginTransaction();try{
    if(customerId){const [customer]:any=await app.query('SELECT id FROM customers WHERE id=? AND archived_at IS NULL FOR UPDATE',[customerId]);if(!customer[0])throw new Error('EQUIPMENT_CUSTOMER_UNAVAILABLE');}
    const device=await insertDevice(app,scope,input,role,customerId);
    await app.query("INSERT INTO activity_log(actor_manager_id,actor_snapshot,actor_kind,action_code,target_type,target_id,customer_id,after_data,result) VALUES(?,?,'manager','equipment.device.create','network_equipment_device',?,?,?,'success')",[scope.managerId,JSON.stringify({id:access.manager.id,full_name:access.manager.full_name}),device.id,customerId,JSON.stringify(device)]);
    await app.commit();return {success:true,item:device};
   }catch(error){await app.rollback();throw error;}
  }
  if(action==='device.update'){
   const id=integer(input.id),name=clean(input.name,150),model=clean(input.model,100),serial=clean(input.serialNumber,120),mac=clean(input.macAddress,17).toUpperCase(),vendor=String(input.vendor||''),parentApId=input.parentApId==null||input.parentApId===''?null:integer(input.parentApId);
   if(!name||!['ubnt','mimosa','mikrotik','other'].includes(vendor)||serial.length>120||model.length>100||mac&&!/^(?:[0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(mac))throw new Error('EQUIPMENT_INPUT');
   await app.beginTransaction();try{
    const [rows]:any=await app.query('SELECT id,device_role,status FROM network_equipment_devices WHERE id=? FOR UPDATE',[id]);const current=rows[0];if(!current)throw new Error('EQUIPMENT_DEVICE_UNAVAILABLE');if(current.status==='retired')throw new Error('EQUIPMENT_DEVICE_RETIRED');
    if(parentApId){if(current.device_role!=='station')throw new Error('EQUIPMENT_INPUT');const [aps]:any=await app.query("SELECT id FROM network_equipment_devices WHERE id=? AND device_role='ap' AND status='active' FOR UPDATE",[parentApId]);if(!aps[0])throw new Error('EQUIPMENT_AP_UNAVAILABLE');}
    await app.query('UPDATE network_equipment_devices SET name=?,vendor=?,model=?,serial_number=?,mac_address=?,parent_ap_id=?,address=?,notes=? WHERE id=?',[name,vendor,model||null,serial||null,mac||null,parentApId,clean(input.address,1000)||null,clean(input.notes,1000)||null,id]);
    await app.query("INSERT INTO activity_log(actor_manager_id,actor_snapshot,actor_kind,action_code,target_type,target_id,after_data,result) VALUES(?,?,'manager','equipment.device.update','network_equipment_device',?,?, 'success')",[scope.managerId,JSON.stringify({id:access.manager.id,full_name:access.manager.full_name}),id,JSON.stringify({name,vendor,model:model||null,serialNumber:serial||null,macAddress:mac||null,parentApId,address:clean(input.address,1000)||null,notes:clean(input.notes,1000)||null})]);
    await app.commit();return {success:true};
   }catch(error){await app.rollback();throw error;}
  }
  const id=integer(input.id);const status=String(input.status||'');if(!['active','maintenance','retired'].includes(status))throw new Error('EQUIPMENT_INPUT');
  await app.beginTransaction();try{
   const [devices]:any=await app.query('SELECT id,status,management_ipv4 FROM network_equipment_devices WHERE id=? FOR UPDATE',[id]);const device=devices[0];if(!device)throw new Error('EQUIPMENT_DEVICE_UNAVAILABLE');
   if(status==='retired'&&device.status!=='retired'){
    const [lines]:any=await app.query('SELECT id FROM pppoe_accounts WHERE station_device_id=? AND archived_at IS NULL LIMIT 1 FOR UPDATE',[id]);if(lines.length)throw new Error('EQUIPMENT_DEVICE_IN_USE');
    await app.query('UPDATE network_equipment_devices SET status=?,last_management_ipv4=management_ipv4,management_ipv4=NULL WHERE id=?',[status,id]);
   }else if(device.status==='retired'&&status!=='retired')throw new Error('EQUIPMENT_DEVICE_RETIRED');
   else await app.query('UPDATE network_equipment_devices SET status=? WHERE id=?',[status,id]);
   await app.query("INSERT INTO activity_log(actor_manager_id,actor_snapshot,actor_kind,action_code,target_type,target_id,before_data,after_data,result) VALUES(?,?,'manager','equipment.device.status','network_equipment_device',?,?,?,'success')",[scope.managerId,JSON.stringify({id:access.manager.id,full_name:access.manager.full_name}),id,JSON.stringify({status:device.status,managementIp:device.management_ipv4==null?null:ipText(Number(device.management_ipv4))}),JSON.stringify({status,managementIp:status==='retired'?null:device.management_ipv4==null?null:ipText(Number(device.management_ipv4))})]);
   await app.commit();return {success:true};
  }catch(error){await app.rollback();throw error;}
 });
}

export async function createEquipmentStationForPppoe(app:any,scope:any,customerId:number,input:any){
 const [customer]:any=await app.query('SELECT id FROM customers WHERE id=? AND archived_at IS NULL FOR UPDATE',[customerId]);if(!customer[0])throw new Error('EQUIPMENT_CUSTOMER_UNAVAILABLE');
 return insertDevice(app,scope,input,'station',customerId);
}
