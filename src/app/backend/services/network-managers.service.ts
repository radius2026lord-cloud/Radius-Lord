import {createHash} from 'crypto';
import {invalidateNetworkManager} from './network-session-version.service';
import bcrypt from 'bcryptjs';
import {db} from '../config/db';
import {withNetwork,validateLocalLicense} from './network-runtime.service';

const managerFields='id,full_name,username,manager_type,permission_group_id,is_enabled,phone,notes';
export async function readManagers(scope:any){return withNetwork(scope,async app=>{
 const [managers]=await app.query(`SELECT ${managerFields} FROM managers WHERE archived_at IS NULL ORDER BY manager_type,id`);
 const [groups]=await app.query('SELECT id,name,description,is_enabled FROM permission_groups WHERE archived_at IS NULL ORDER BY name');
 const [permissions]=await app.query('SELECT id,code,name_ar,module FROM permissions WHERE principal_only=0 AND is_enabled=1 ORDER BY module,id');
 const [grants]=await app.query('SELECT permission_group_id,permission_id FROM permission_group_permissions');
 return {managers,groups,permissions,grants};
});}
export async function mutateManagers(scope:any,input:any){
 const action=String(input?.action),id=Number(input?.id),central=await db.pool.getConnection();let locked=false;
 try{
 const [lock]:any=await central.query("SELECT GET_LOCK('radius-lord:manager-credentials',0) acquired");if(!lock[0]?.acquired)throw new Error('عملية أخرى قيد الحفظ، أعد المحاولة.');locked=true;
 return await withNetwork(scope,async app=>{await app.beginTransaction();try{
 await validateLocalLicense(app,scope);
 const [actors]:any=await app.query("SELECT id,full_name,password_hash FROM managers WHERE id=? AND manager_type='principal' AND is_enabled=1 AND archived_at IS NULL FOR UPDATE",[scope.managerId]);if(!actors[0]||scope.authVersion!==createHash('sha256').update(actors[0].password_hash).digest('hex'))throw new Error('NETWORK_AUTH');delete actors[0].password_hash;
 let before:any=null,after:any=null,target='manager',targetId=id;
 if(['create','update','toggle','password'].includes(action)){
 if(action!=='create'){if(!Number.isSafeInteger(id)||id<1)throw new Error('المستخدم غير صالح.');const [rows]:any=await app.query(`SELECT ${managerFields} FROM managers WHERE id=? AND manager_type='subordinate' AND archived_at IS NULL FOR UPDATE`,[id]);before=rows[0];if(!before)throw new Error('هذه العملية متاحة للمستخدم الفرعي فقط.');}
 if(action==='create'||action==='update'){
 const name=String(input.fullName||'').trim(),username=String(input.username||'').trim().toLowerCase(),phone=String(input.phone||'').trim(),notes=String(input.notes||'').trim(),group=Number(input.groupId);
 if(!name||name.length>150||! /^[a-z][a-z0-9_.-]{2,63}$/.test(username)||username.startsWith('setup_')||phone.length>20||notes.length>5000)throw new Error('تحقق من الاسم واسم المستخدم والهاتف والملاحظات.');
 const [groups]:any=await app.query('SELECT id FROM permission_groups WHERE id=? AND is_enabled=1 AND archived_at IS NULL FOR UPDATE',[group]);if(!groups[0])throw new Error('اختر مجموعة صلاحيات مفعّلة.');
 
 const [reserved]:any=await central.query(`SELECT 1 FROM master_admins WHERE username=? OR email=? UNION ALL SELECT 1 FROM customers WHERE username=? OR email=? UNION ALL SELECT 1 FROM platform_settings WHERE setting_group='environment_runtime' AND (JSON_UNQUOTE(JSON_EXTRACT(setting_value,'$.username'))=? OR JSON_UNQUOTE(JSON_EXTRACT(setting_value,'$.pendingUsername'))=?) UNION ALL SELECT 1 FROM platform_settings WHERE setting_group='network_manager_directory' AND JSON_UNQUOTE(JSON_EXTRACT(setting_value,'$.username'))=? AND NOT (JSON_UNQUOTE(JSON_EXTRACT(setting_value,'$.environmentId'))=? AND JSON_UNQUOTE(JSON_EXTRACT(setting_value,'$.managerId'))=?) LIMIT 1`,[username,username,username,username,username,username,username,String(scope.environment_id),String(action==='create'?0:id)]);
 const [local]:any=await app.query('SELECT id FROM managers WHERE username=? AND id<>?',[username,action==='create'?0:id]);if(reserved.length||local.length)throw new Error('اسم المستخدم مستخدم بالفعل.');
 if(action==='create'){const password=String(input.password||'');if(password.length<8||password.length>128)throw new Error('كلمة المرور يجب أن تكون من 8 إلى 128 محرفًا.');const hash=await bcrypt.hash(password,12);const [created]:any=await app.query("INSERT INTO managers(full_name,username,password_hash,manager_type,permission_group_id,phone,notes,created_by_manager_id) VALUES(?,?,?,'subordinate',?,?,?,?)",[name,username,hash,group,phone||null,notes||null,scope.managerId]);targetId=Number(created.insertId);}else await app.query('UPDATE managers SET full_name=?,username=?,permission_group_id=?,phone=?,notes=? WHERE id=?',[name,username,group,phone||null,notes||null,id]);
 // Reserve the alias before local commit. A failed local transaction leaves an inert
 // reservation, never a valid account. Old aliases cannot authenticate after rename.
 const directory=JSON.stringify({slug:scope.slug,username,environmentId:Number(scope.environment_id),managerId:targetId});
 await central.query("INSERT INTO platform_settings(setting_group,setting_key,setting_value) VALUES('network_manager_directory',?,?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)",['alias_'+username,directory]);
 }else if(action==='toggle')await app.query('UPDATE managers SET is_enabled=? WHERE id=?',[before.is_enabled?0:1,id]);
 else {const password=String(input.password||'');if(password.length<8||password.length>128)throw new Error('كلمة المرور يجب أن تكون من 8 إلى 128 محرفًا.');await app.query('UPDATE managers SET password_hash=? WHERE id=?',[await bcrypt.hash(password,12),id]);}
 if(action!=='create')await invalidateNetworkManager(central,scope,id);
 const [rows]:any=await app.query(`SELECT ${managerFields} FROM managers WHERE id=?`,[targetId]);after=rows[0];
 }else if(['group-create','group-update','group-toggle'].includes(action)){
 target='permission_group';if(action!=='group-create'){const [rows]:any=await app.query('SELECT id,name,description,is_enabled FROM permission_groups WHERE id=? AND archived_at IS NULL FOR UPDATE',[id]);before=rows[0];if(!before)throw new Error('مجموعة الصلاحيات غير متاحة.');}
 if(action==='group-toggle')await app.query('UPDATE permission_groups SET is_enabled=? WHERE id=?',[before.is_enabled?0:1,id]);else {
 const name=String(input.name||'').trim(),description=String(input.description||'').trim();if(!name||name.length>100||description.length>5000)throw new Error('تحقق من اسم المجموعة ووصفها.');
 const ids=Array.from(new Set((Array.isArray(input.permissions)?input.permissions:[]).map(Number))) as number[];if(ids.some(n=>!Number.isSafeInteger(n)||n<1)||ids.length>500)throw new Error('الصلاحيات غير صالحة.');
 if(ids.length){const [valid]:any=await app.query(`SELECT id FROM permissions WHERE principal_only=0 AND is_enabled=1 AND id IN (${ids.map(()=>'?').join(',')}) FOR UPDATE`,ids);if(valid.length!==ids.length)throw new Error('لا يمكن منح صلاحيات المدير الرئيسي.');}
 if(action==='group-create'){const [created]:any=await app.query('INSERT INTO permission_groups(name,description) VALUES(?,?)',[name,description||null]);targetId=Number(created.insertId);}else await app.query('UPDATE permission_groups SET name=?,description=? WHERE id=?',[name,description||null,id]);
 const [previous]=await app.query('SELECT permission_id FROM permission_group_permissions WHERE permission_group_id=?',[targetId]);if(before)before.permissions=previous;
 await app.query('DELETE FROM permission_group_permissions WHERE permission_group_id=?',[targetId]);for(const permissionId of ids)await app.query('INSERT INTO permission_group_permissions(permission_group_id,permission_id) VALUES(?,?)',[targetId,permissionId]);
 }
 const [members]:any=await app.query("SELECT id FROM managers WHERE permission_group_id=? AND manager_type='subordinate'",[targetId]);for(const member of members)await invalidateNetworkManager(central,scope,Number(member.id));
 const [rows]:any=await app.query('SELECT id,name,description,is_enabled FROM permission_groups WHERE id=?',[targetId]);after=rows[0];const [grants]=await app.query('SELECT permission_id FROM permission_group_permissions WHERE permission_group_id=?',[targetId]);after.permissions=grants;
 }else throw new Error('العملية غير صالحة.');
 await app.query("INSERT INTO activity_log(actor_manager_id,actor_snapshot,actor_kind,action_code,target_type,target_id,before_data,after_data,result) VALUES(?,?,'manager',?,?,?,?,?,'success')",[scope.managerId,JSON.stringify(actors[0]),'managers.'+action,target,targetId,before?JSON.stringify(before):null,JSON.stringify(after)]);
 await app.commit();return {success:true};
 }catch(e){await app.rollback();
 // Failed attempts contain only the action and a generic reason, never submitted credentials.
 try{await app.query("INSERT INTO activity_log(actor_manager_id,actor_kind,action_code,target_type,result,failure_code,failure_reason) VALUES(?,'manager',?,'manager','failed','MANAGEMENT_REJECTED','Operation rejected')",[scope.managerId,'managers.'+(['create','update','toggle','password','group-create','group-update','group-toggle'].includes(action)?action:'invalid')]);}catch{console.error('[network-managers] failure audit unavailable');}throw e;}});
 }finally{if(locked)await central.query("SELECT RELEASE_LOCK('radius-lord:manager-credentials')");central.release();}
}
