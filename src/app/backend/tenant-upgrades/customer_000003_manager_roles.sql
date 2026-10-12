-- Existing customer only. Back up first and pause backend writes while applying.
-- Execute this whole file; DDL is not transactionally reversible.
USE `rl_tenant_zone_000003`;
DELIMITER $$
DROP PROCEDURE IF EXISTS `rl_tenant_zone_000003`.`rl_manager_roles_v2`$$
CREATE PROCEDURE `rl_tenant_zone_000003`.`rl_manager_roles_v2`()
BEGIN
 DECLARE remaining INT DEFAULT 0;
 DECLARE pending_count INT DEFAULT 0;
 DECLARE manager_id BIGINT UNSIGNED;
 DECLARE old_group BIGINT UNSIGNED;
 DECLARE new_group BIGINT UNSIGNED;
 DECLARE private_scope BIGINT UNSIGNED;
 DECLARE center_scope BIGINT UNSIGNED;
 DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
 IF DATABASE()<>'rl_tenant_zone_000003' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Wrong database'; END IF;
 START TRANSACTION;
 SELECT COUNT(*) INTO pending_count FROM managers WHERE account_role IS NULL;
 INSERT INTO network_scopes(scope_kind,name) VALUES('center','المركز') ON DUPLICATE KEY UPDATE id=id;
 SELECT id INTO center_scope FROM network_scopes WHERE scope_kind='center';
 UPDATE managers SET account_role='principal',scope_id=center_scope WHERE manager_type='principal' AND account_role IS NULL;
 -- Preserve each existing employee's ownership. Never merge old customers into center.
 SELECT COUNT(*) INTO remaining FROM managers WHERE manager_type='subordinate' AND account_role IS NULL;
 WHILE remaining>0 DO
  SELECT id,permission_group_id INTO manager_id,old_group FROM managers WHERE manager_type='subordinate' AND account_role IS NULL ORDER BY id LIMIT 1;
  INSERT INTO network_scopes(scope_kind,name,owner_manager_id) SELECT 'legacy_private',CONCAT('نطاق سابق: ',LEFT(full_name,130)),id FROM managers WHERE id=manager_id ON DUPLICATE KEY UPDATE id=id;
  SELECT id INTO private_scope FROM network_scopes WHERE scope_kind='legacy_private' AND owner_manager_id=manager_id;
  INSERT INTO permission_groups(name,description,is_enabled,scope_id) SELECT CONCAT(LEFT(name,65),' [legacy-',manager_id,']'),description,is_enabled,private_scope FROM permission_groups WHERE id=old_group;
  SET new_group=LAST_INSERT_ID();
  INSERT INTO permission_group_permissions(permission_group_id,permission_id) SELECT new_group,permission_id FROM permission_group_permissions WHERE permission_group_id=old_group;
  UPDATE managers SET account_role='center_employee',scope_id=private_scope,permission_group_id=new_group WHERE id=manager_id;
  UPDATE customers SET scope_id=private_scope,assigned_manager_id=manager_id WHERE customers.manager_id=manager_id AND scope_id IS NULL;
  UPDATE customer_categories SET scope_id=private_scope WHERE customer_categories.manager_id=manager_id AND scope_id IS NULL;
  UPDATE customer_category_memberships SET scope_id=private_scope WHERE customer_category_memberships.manager_id=manager_id AND scope_id IS NULL;
  SELECT COUNT(*) INTO remaining FROM managers WHERE manager_type='subordinate' AND account_role IS NULL;
 END WHILE;
 IF pending_count>0 THEN UPDATE permission_groups SET scope_id=center_scope WHERE scope_id IS NULL; END IF;
 UPDATE customers c JOIN managers m ON m.id=c.manager_id SET c.scope_id=m.scope_id,c.assigned_manager_id=m.id WHERE c.scope_id IS NULL;
 UPDATE customer_categories c JOIN managers m ON m.id=c.manager_id SET c.scope_id=m.scope_id WHERE c.scope_id IS NULL;
 UPDATE customer_category_memberships c JOIN managers m ON m.id=c.manager_id SET c.scope_id=m.scope_id WHERE c.scope_id IS NULL;
 INSERT INTO permissions(code,name_ar,module,principal_only,is_enabled) VALUES
 ('agents.staff.manage','إدارة موظفي الوكيل','agents',0,1),
 ('agents.staff_groups.manage','إدارة مجموعات موظفي الوكيل','agents',0,1),
 ('customers.view_center_scope','عرض نطاق المركز كاملًا','customers',0,1)
 ON DUPLICATE KEY UPDATE code=VALUES(code);
 IF pending_count>0 THEN INSERT INTO activity_log(actor_kind,action_code,target_type,after_data,result) VALUES('system','schema.manager_roles_v2','network',JSON_OBJECT('classifiedAccounts',pending_count),'success'); END IF;
 COMMIT;
 -- Scope-local names allow different agents to use the same group name.
 IF NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='permission_groups' AND COLUMN_NAME='scope_name_guard') THEN
  ALTER TABLE permission_groups ADD COLUMN scope_name_guard BIGINT UNSIGNED GENERATED ALWAYS AS(COALESCE(scope_id,0)) STORED;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='permission_groups' AND INDEX_NAME='uq_group_scope_name') THEN
  ALTER TABLE permission_groups ADD UNIQUE KEY uq_group_scope_name(scope_name_guard,name);
 END IF;
 IF EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='permission_groups' AND INDEX_NAME='uq_permission_group_name') THEN
  ALTER TABLE permission_groups DROP INDEX uq_permission_group_name;
 END IF;
END$$
CALL `rl_tenant_zone_000003`.`rl_manager_roles_v2`()$$
DROP PROCEDURE `rl_tenant_zone_000003`.`rl_manager_roles_v2`$$
DELIMITER ;
