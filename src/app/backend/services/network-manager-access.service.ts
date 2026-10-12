import {createHash} from 'crypto';
// Read role and scope from the tenant on every request; JWT claims never grant roles.
export async function managerAccess(app:any,id:number,authVersion?:string){
 const [rows]:any=await app.query('SELECT * FROM managers WHERE id=? AND is_enabled=1 AND archived_at IS NULL',[id]);const manager=rows[0];
 if(!manager||authVersion&&authVersion!==createHash('sha256').update(manager.password_hash).digest('hex'))throw new Error('NETWORK_AUTH');
 const role=manager.account_role||(manager.manager_type==='principal'?'principal':'center_employee');
 if(!['principal','center_employee','agent','agent_employee'].includes(role)||(role==='principal')!==(manager.manager_type==='principal'))throw new Error('NETWORK_AUTH');
 let permissions:string[]=[];
 if(role!=='principal'){
 const [groups]:any=await app.query('SELECT id FROM permission_groups WHERE id=? AND is_enabled=1 AND archived_at IS NULL',[manager.permission_group_id]);if(!groups.length)throw new Error('NETWORK_AUTH');
 const [grants]:any=await app.query('SELECT p.code FROM permissions p JOIN permission_group_permissions g ON g.permission_id=p.id WHERE g.permission_group_id=? AND p.is_enabled=1 AND p.principal_only=0',[manager.permission_group_id]);permissions=grants.map((p:any)=>p.code);
 if(manager.scope_id){const [scopes]:any=await app.query('SELECT * FROM network_scopes WHERE id=? AND is_enabled=1 AND archived_at IS NULL',[manager.scope_id]);if(!scopes[0])throw new Error('NETWORK_AUTH');if(role==='agent'&&(scopes[0].scope_kind!=='agent'||Number(scopes[0].owner_manager_id)!==Number(manager.id)))throw new Error('NETWORK_AUTH');}
 if(role==='agent'&&!manager.scope_id)throw new Error('NETWORK_AUTH');
 if(role==='agent_employee'){
 const [parents]:any=await app.query("SELECT id FROM managers WHERE id=? AND account_role='agent'",[manager.parent_agent_manager_id]);if(!parents[0])throw new Error('NETWORK_AUTH');const parent=await managerAccess(app,Number(manager.parent_agent_manager_id));
 if(parent.role!=='agent'||!manager.scope_id||Number(parent.manager.scope_id)!==Number(manager.scope_id))throw new Error('NETWORK_AUTH');
 permissions=permissions.filter(code=>parent.permissions.includes(code));
 }
 }
 return {manager,role,permissions};
}
export async function managementAccess(app:any,scope:any,groups=false){const access=await managerAccess(app,scope.managerId,scope.authVersion);if(access.role!=='principal'&&(access.role!=='agent'||!access.permissions.includes(groups?'agents.staff_groups.manage':'agents.staff.manage')))throw new Error('NETWORK_AUTH');return access;}
