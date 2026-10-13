import {withNetwork} from './network-runtime.service';
import {managerAccess} from './network-manager-access.service';

type CategoryManager={id:number;full_name:string;manager_type:string;account_role:string|null;is_enabled:number;archived_at:string|null};

const normalizeIds=(value:any)=>Array.from(new Set((Array.isArray(value)?value:[]).map(Number))) as number[];
export async function networkCategories(scope:any,input?:any){
 return withNetwork(scope,async app=>{
  const action=input?.action||'view';
  if(!['view','create','update','archive','restore','bulk_archive','bulk_restore','bulk_assign'].includes(action))throw new Error('CATEGORY_INPUT');
  const access=await managerAccess(app,scope.managerId,scope.authVersion);
  const permissionAction=action==='bulk_assign'?'update':action.startsWith('bulk_')?action.slice(5):action;
  if(access.role!=='principal'&&!access.permissions.includes('categories.'+permissionAction))throw new Error('NETWORK_AUTH');
  const principal=access.role==='principal';
  // Agent employees work with the agent's customer and category ownership.
  const ownerManagerId=access.role==='agent_employee'?Number(access.manager.parent_agent_manager_id):Number(access.manager.id);
  if(!principal&&(!Number.isSafeInteger(ownerManagerId)||ownerManagerId<1))throw new Error('NETWORK_AUTH');

  if(action==='view'){
   const where=principal?'':'WHERE EXISTS(SELECT 1 FROM customer_category_manager_assignments x WHERE x.category_id=c.id AND x.manager_id=?)';
   const [rows]:any=await app.query(`SELECT c.id,c.name,c.description,c.manager_id,c.created_by_manager_id,c.archived_at,
      (SELECT COUNT(DISTINCT x.customer_id) FROM customer_category_memberships x WHERE x.category_id=c.id) AS subscriber_count
    FROM customer_categories c ${where} ORDER BY c.id DESC LIMIT 200`,principal?[]:[ownerManagerId]);
   let managers:CategoryManager[]=[];
   if(principal){
    const [available]:any=await app.query(`SELECT id,full_name,manager_type,account_role,is_enabled,archived_at
     FROM managers
     WHERE manager_type='principal' OR account_role IN('center_employee','agent')
     ORDER BY CASE WHEN account_role='agent' THEN 0 WHEN account_role='center_employee' THEN 1 ELSE 2 END,full_name,id`);
    managers=available;
   }
   const owners=new Map<number,CategoryManager[]>();
   if(rows.length){
    const ids=rows.map((row:any)=>Number(row.id));
    const [assigned]:any=await app.query(`SELECT a.category_id,m.id,m.full_name,m.manager_type,m.account_role,m.is_enabled,m.archived_at
     FROM customer_category_manager_assignments a JOIN managers m ON m.id=a.manager_id
     WHERE a.category_id IN (${ids.map(()=>'?').join(',')}) ORDER BY m.full_name,m.id`,ids);
    for(const row of assigned){const key=Number(row.category_id);const list=owners.get(key)||[];list.push({id:Number(row.id),full_name:row.full_name,manager_type:row.manager_type,account_role:row.account_role,is_enabled:Number(row.is_enabled),archived_at:row.archived_at});owners.set(key,list);}
   }
   let actorOwner:any=null;
   if(!principal){
    const [ownerRows]:any=await app.query('SELECT id,full_name FROM managers WHERE id=?',[ownerManagerId]);
    actorOwner=ownerRows[0]?{id:ownerManagerId,full_name:ownerRows[0].full_name,role:access.role}:null;
   }
   return {items:rows.map((row:any)=>({...row,managers:owners.get(Number(row.id))||[]})),managers,actorOwner};
  }

  if(action==='bulk_assign'){
   if(!principal)throw new Error('NETWORK_AUTH');
   const ids=normalizeIds(input.ids),managerIds=normalizeIds(input.managerIds);
   if(!ids.length||ids.length>200||ids.some(value=>!Number.isSafeInteger(value)||value<1))throw new Error('CATEGORY_BULK_INPUT');
   if(!managerIds.length||managerIds.some(value=>!Number.isSafeInteger(value)||value<1))throw new Error('CATEGORY_MANAGERS_REQUIRED');
   await app.beginTransaction();
   try{
    const [categories]:any=await app.query(`SELECT id,name,description,manager_id,created_by_manager_id,archived_at FROM customer_categories WHERE id IN (${ids.map(()=>'?').join(',')}) AND archived_at IS NULL FOR UPDATE`,ids);
    if(categories.length!==ids.length)throw new Error('CATEGORY_BULK_NOT_FOUND');
    const [validManagers]:any=await app.query(`SELECT id FROM managers WHERE id IN (${managerIds.map(()=>'?').join(',')}) AND (manager_type='principal' OR account_role IN('center_employee','agent')) AND is_enabled=1 AND archived_at IS NULL FOR UPDATE`,managerIds);
    if(validManagers.length!==managerIds.length)throw new Error('CATEGORY_MANAGER_INVALID');
    const [currentRows]:any=await app.query(`SELECT category_id,manager_id FROM customer_category_manager_assignments WHERE category_id IN (${ids.map(()=>'?').join(',')}) ORDER BY category_id,manager_id FOR UPDATE`,ids);
    const currentByCategory=new Map<number,Set<number>>();
    for(const row of currentRows){const categoryId=Number(row.category_id),set=currentByCategory.get(categoryId)||new Set<number>();set.add(Number(row.manager_id));currentByCategory.set(categoryId,set);}
    for(const managerId of managerIds){
     const pending=categories.filter((row:any)=>!currentByCategory.get(Number(row.id))?.has(managerId));
     if(!pending.length)continue;
     const pendingIds=pending.map((row:any)=>Number(row.id));
     const [selectedNameConflicts]:any=await app.query(`SELECT name FROM customer_categories WHERE id IN (${pendingIds.map(()=>'?').join(',')}) GROUP BY name HAVING COUNT(*)>1 LIMIT 1`,pendingIds);
     if(selectedNameConflicts.length)throw new Error('CATEGORY_NAME_CONFLICT');
     const names=Array.from(new Set(pending.map((row:any)=>String(row.name))));
     const [conflicts]:any=await app.query(`SELECT c.id FROM customer_categories c JOIN customer_category_manager_assignments a ON a.category_id=c.id WHERE a.manager_id=? AND c.name IN (${names.map(()=>'?').join(',')}) AND c.id NOT IN (${ids.map(()=>'?').join(',')}) LIMIT 1`,[managerId,...names,...ids]);
     if(conflicts.length)throw new Error('CATEGORY_NAME_CONFLICT');
    }
    const actor=JSON.stringify({id:access.manager.id,full_name:access.manager.full_name,role:access.role});
    let affected=0;
    for(const category of categories){
     const id=Number(category.id);
     const current=Array.from(currentByCategory.get(id)||new Set<number>());
     for(const managerId of managerIds)if(!current.includes(managerId)){
      await app.query('INSERT INTO customer_category_manager_assignments(category_id,manager_id,assigned_by_manager_id) VALUES(?,?,?)',[id,managerId,scope.managerId]);
      affected++;
     }
     const [afterRows]:any=await app.query('SELECT manager_id FROM customer_category_manager_assignments WHERE category_id=? ORDER BY manager_id',[id]);
     await app.query(`INSERT INTO activity_log(actor_manager_id,actor_snapshot,actor_kind,action_code,target_type,target_id,before_data,after_data,result)
      VALUES(?,?,'manager','categories.assign','customer_category',?,?,?,'success')`,[scope.managerId,actor,id,JSON.stringify({...category,managerIds:current}),JSON.stringify({...category,managerIds:afterRows.map((row:any)=>Number(row.manager_id))})]);
    }
    await app.commit();
    return {success:true,affected};
   }catch(error){
    await app.rollback();
    try{await app.query(`INSERT INTO activity_log(actor_manager_id,actor_kind,action_code,target_type,result,failure_code) VALUES(?,'manager','categories.assign','customer_category','failed','CATEGORY_BULK_REJECTED')`,[scope.managerId]);}
    catch{console.error('[categories] bulk assignment audit unavailable');}
    throw error;
   }
  }
  if(action==='bulk_archive'||action==='bulk_restore'){
   const ids=normalizeIds(input.ids);
   if(!ids.length||ids.length>200||ids.some(value=>!Number.isSafeInteger(value)||value<1))throw new Error('CATEGORY_BULK_INPUT');
   const archive=action==='bulk_archive';
   await app.beginTransaction();
   try{
    const [rows]:any=await app.query(`SELECT c.id,c.name,c.description,c.manager_id,c.created_by_manager_id,c.archived_at
      FROM customer_categories c
      WHERE c.id IN (${ids.map(()=>'?').join(',')})
       AND c.archived_at ${archive?'IS NULL':'IS NOT NULL'}
       ${principal?'':'AND EXISTS(SELECT 1 FROM customer_category_manager_assignments a WHERE a.category_id=c.id AND a.manager_id=?)'}
      FOR UPDATE`,principal?ids:[...ids,ownerManagerId]);
    if(rows.length!==ids.length)throw new Error('CATEGORY_BULK_NOT_FOUND');
    const actor=JSON.stringify({id:access.manager.id,full_name:access.manager.full_name,role:access.role});
    for(const row of rows){
     const id=Number(row.id);
     if(archive)await app.query('UPDATE customer_categories SET archived_at=CURRENT_TIMESTAMP,archived_by_manager_id=? WHERE id=?',[scope.managerId,id]);
     else await app.query('UPDATE customer_categories SET archived_at=NULL,archived_by_manager_id=NULL WHERE id=?',[id]);
     const [assigned]:any=await app.query('SELECT manager_id FROM customer_category_manager_assignments WHERE category_id=? ORDER BY manager_id',[id]);
     const [saved]:any=await app.query('SELECT id,name,description,manager_id,created_by_manager_id,archived_at FROM customer_categories WHERE id=?',[id]);
     await app.query(`INSERT INTO activity_log(actor_manager_id,actor_snapshot,actor_kind,action_code,target_type,target_id,before_data,after_data,result)
      VALUES(?,?,'manager',?,'customer_category',?,?,?,'success')`,[
       scope.managerId,actor,'categories.'+(archive?'archive':'restore'),id,JSON.stringify(row),
       JSON.stringify({...saved[0],managerIds:assigned.map((entry:any)=>Number(entry.manager_id))})
     ]);
    }
    await app.commit();
    return {success:true,affected:rows.length};
   }catch(error){
    await app.rollback();
    try{await app.query(`INSERT INTO activity_log(actor_manager_id,actor_kind,action_code,target_type,result,failure_code)
      VALUES(?,'manager',?,'customer_category','failed','CATEGORY_BULK_REJECTED')`,[scope.managerId,'categories.'+action]);}
    catch{console.error('[categories] bulk audit unavailable');}
    throw error;
   }
  }
  await app.beginTransaction();
  try{
   const id=Number(input.id);
   let before:any=null;
   let principalManagerId:number|null=null;
   if(action==='create'||action==='update'){
    const [principalRows]:any=await app.query("SELECT id FROM managers WHERE manager_type='principal' AND is_enabled=1 AND archived_at IS NULL LIMIT 1");
    principalManagerId=Number(principalRows[0]?.id);
    if(!Number.isSafeInteger(principalManagerId)||principalManagerId<1)throw new Error('CATEGORY_MANAGER_INVALID');
   }
   if(action!=='create'){
    if(!Number.isSafeInteger(id)||id<1)throw new Error('CATEGORY_INPUT');
    const [found]:any=await app.query(`SELECT c.id,c.name,c.description,c.manager_id,c.created_by_manager_id,c.archived_at
      FROM customer_categories c
      WHERE c.id=? ${principal?'':'AND EXISTS(SELECT 1 FROM customer_category_manager_assignments a WHERE a.category_id=c.id AND a.manager_id=?)'}
      FOR UPDATE`,principal?[id]:[id,ownerManagerId]);
    before=found[0];
    if(!before||action==='restore'&&!before.archived_at||action!=='restore'&&before.archived_at)throw new Error('CATEGORY_NOT_FOUND');
    const [assigned]:any=await app.query('SELECT manager_id FROM customer_category_manager_assignments WHERE category_id=? ORDER BY manager_id FOR UPDATE',[id]);
    before.managerIds=assigned.map((row:any)=>Number(row.manager_id));
   }

   if(action==='create'||action==='update'){
    const name=String(input.name||'').trim(),description=String(input.description||'').trim();
    if(!name||name.length>100||description.length>5000)throw new Error('CATEGORY_INPUT');
    let managerIds=principal?normalizeIds(input.managerIds):[ownerManagerId];
    if(action==='create'&&principalManagerId!==null){
     // Every new category is visible to the principal; other assignments remain optional.
     managerIds=Array.from(new Set([principalManagerId,...managerIds]));
    }
    if(action==='update'&&principalManagerId!==null&&before?.managerIds?.includes(principalManagerId)&&!managerIds.includes(principalManagerId)){
     throw new Error('CATEGORY_PRINCIPAL_ASSIGNMENT_REQUIRED');
    }
    if(!managerIds.length||managerIds.some(value=>!Number.isSafeInteger(value)||value<1))throw new Error('CATEGORY_MANAGERS_REQUIRED');
    if(principal){
     const [valid]:any=await app.query(`SELECT id FROM managers
      WHERE id IN (${managerIds.map(()=>'?').join(',')})
       AND (manager_type='principal' OR account_role IN('center_employee','agent'))
       AND (is_enabled=1 AND archived_at IS NULL OR id IN (${(before?.managerIds||[]).length?(before.managerIds as number[]).map(()=>'?').join(','):'NULL'}))
      FOR UPDATE`,[...managerIds,...(before?.managerIds||[])]);
     if(valid.length!==managerIds.length)throw new Error('CATEGORY_MANAGER_INVALID');
    }
    const duplicateParams=[...managerIds,name,...(action==='update'?[id]:[])];
    const duplicateExcept=action==='update'?' AND c.id<>?':'';
    const [duplicates]:any=await app.query(`SELECT c.id FROM customer_categories c
      JOIN customer_category_manager_assignments a ON a.category_id=c.id
      WHERE a.manager_id IN (${managerIds.map(()=>'?').join(',')}) AND c.name=?${duplicateExcept} LIMIT 1`,duplicateParams);
    if(duplicates.length)throw new Error('CATEGORY_NAME_CONFLICT');

    let categoryId=id;
    if(action==='create'){
     const [created]:any=await app.query('INSERT INTO customer_categories(manager_id,name,description,created_by_manager_id) VALUES(?,?,?,?)',[managerIds[0],name,description||null,scope.managerId]);
     categoryId=Number(created.insertId);
     for(const managerId of managerIds)await app.query('INSERT INTO customer_category_manager_assignments(category_id,manager_id,assigned_by_manager_id) VALUES(?,?,?)',[categoryId,managerId,scope.managerId]);
    }else{
     await app.query('UPDATE customer_categories SET name=?,description=? WHERE id=?',[name,description||null,id]);
     if(principal){
      const current=before.managerIds as number[];
      const removed=current.filter(value=>!managerIds.includes(value));
      for(const managerId of removed){
       const [members]:any=await app.query('SELECT 1 FROM customer_category_memberships WHERE category_id=? AND manager_id=? LIMIT 1 FOR UPDATE',[id,managerId]);
       if(members.length)throw new Error('CATEGORY_HAS_MEMBERS');
       await app.query('DELETE FROM customer_category_manager_assignments WHERE category_id=? AND manager_id=?',[id,managerId]);
      }
      for(const managerId of managerIds)if(!current.includes(managerId))await app.query('INSERT INTO customer_category_manager_assignments(category_id,manager_id,assigned_by_manager_id) VALUES(?,?,?)',[id,managerId,scope.managerId]);
     }
    }
    const [saved]:any=await app.query('SELECT id,name,description,manager_id,created_by_manager_id,archived_at FROM customer_categories WHERE id=?',[categoryId]);
    const [assigned]:any=await app.query('SELECT manager_id FROM customer_category_manager_assignments WHERE category_id=? ORDER BY manager_id',[categoryId]);
    before=before||null;
    await app.query(`INSERT INTO activity_log(actor_manager_id,actor_snapshot,actor_kind,action_code,target_type,target_id,before_data,after_data,result)
      VALUES(?,?,'manager',?,'customer_category',?,?,?,'success')`,[
       scope.managerId,JSON.stringify({id:access.manager.id,full_name:access.manager.full_name,role:access.role}),
       'categories.'+action,categoryId,before?JSON.stringify(before):null,
       JSON.stringify({...saved[0],managerIds:assigned.map((row:any)=>Number(row.manager_id))})
      ]);
   }else{
    if(action==='archive')await app.query('UPDATE customer_categories SET archived_at=CURRENT_TIMESTAMP,archived_by_manager_id=? WHERE id=?',[scope.managerId,id]);
    else await app.query('UPDATE customer_categories SET archived_at=NULL,archived_by_manager_id=NULL WHERE id=?',[id]);
    const [saved]:any=await app.query('SELECT id,name,description,manager_id,created_by_manager_id,archived_at FROM customer_categories WHERE id=?',[id]);
    const [assignedAfter]:any=await app.query('SELECT manager_id FROM customer_category_manager_assignments WHERE category_id=? ORDER BY manager_id',[id]);
    await app.query(`INSERT INTO activity_log(actor_manager_id,actor_snapshot,actor_kind,action_code,target_type,target_id,before_data,after_data,result)
      VALUES(?,?,'manager',?,'customer_category',?,?,?,'success')`,[
       scope.managerId,JSON.stringify({id:access.manager.id,full_name:access.manager.full_name,role:access.role}),
       'categories.'+action,id,JSON.stringify(before),JSON.stringify({...saved[0],managerIds:assignedAfter.map((row:any)=>Number(row.manager_id))})
      ]);
   }
   await app.commit();
   return {success:true};
  }catch(error){
   await app.rollback();
   try{
    await app.query(`INSERT INTO activity_log(actor_manager_id,actor_kind,action_code,target_type,result,failure_code)
      VALUES(?,'manager',?,'customer_category','failed','CATEGORY_REJECTED')`,[scope.managerId,'categories.'+action]);
   }catch{console.error('[categories] audit unavailable');}
   throw error;
  }
 });
}
