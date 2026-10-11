-- Targeted copy for the existing customer database. Do not use for another tenant.
USE `rl_tenant_zone_000003`;

-- Existing CUSTOMER database only. MySQL 8.0.46.
-- Phase 1: additive schema expansion. No environment provisioning changes.
-- Select the tenant database in your SQL client BEFORE running this whole file.
-- Take a backup and pause application writes first. Do not run with --force.
-- DDL commits implicitly: failures require inspection/resume, not transaction rollback.
-- Scope columns stay nullable during compatibility transition; OLD access rules remain.

DELIMITER $$
DROP PROCEDURE IF EXISTS `rl_tenant_zone_000003`.`rl_customer_expand_v1`$$
CREATE PROCEDURE `rl_tenant_zone_000003`.`rl_customer_expand_v1`()
BEGIN
 DECLARE acquired INT DEFAULT 0;
 DECLARE lock_name VARCHAR(64);
 DECLARE table_count INT DEFAULT 0;
 DECLARE col_count INT DEFAULT 0;
 DECLARE done INT DEFAULT 0;
 DECLARE target_table VARCHAR(64);
 DECLARE target_column VARCHAR(64);
 DECLARE column_definition TEXT;
 DECLARE additions CURSOR FOR
  SELECT 'network_settings','contact_email','VARCHAR(254) NULL'
  UNION ALL SELECT 'network_settings','address','TEXT NULL'
  UNION ALL SELECT 'network_settings','latitude','DECIMAL(10,7) NULL'
  UNION ALL SELECT 'network_settings','longitude','DECIMAL(10,7) NULL'
  UNION ALL SELECT 'network_settings','government_license_number','VARCHAR(100) NULL'
  UNION ALL SELECT 'network_settings','logo_reference','VARCHAR(500) NULL'
  UNION ALL SELECT 'network_settings','internal_notes','TEXT NULL'
  UNION ALL SELECT 'managers','account_role','ENUM(''principal'',''center_employee'',''agent'',''agent_employee'') NULL'
  UNION ALL SELECT 'managers','scope_id','BIGINT UNSIGNED NULL'
  UNION ALL SELECT 'managers','parent_agent_manager_id','BIGINT UNSIGNED NULL'
  UNION ALL SELECT 'managers','contact_email','VARCHAR(254) NULL'
  UNION ALL SELECT 'permission_groups','scope_id','BIGINT UNSIGNED NULL'
  UNION ALL SELECT 'customers','scope_id','BIGINT UNSIGNED NULL'
  UNION ALL SELECT 'customers','assigned_manager_id','BIGINT UNSIGNED NULL'
  UNION ALL SELECT 'customer_categories','scope_id','BIGINT UNSIGNED NULL'
  UNION ALL SELECT 'customer_category_memberships','scope_id','BIGINT UNSIGNED NULL';
 DECLARE CONTINUE HANDLER FOR NOT FOUND SET done=1;
 DECLARE EXIT HANDLER FOR SQLEXCEPTION
 BEGIN
  IF acquired=1 THEN DO RELEASE_LOCK(lock_name); END IF;
  RESIGNAL;
 END;

 IF DATABASE() IS NULL OR DATABASE()='lord_radius_core' THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Select an existing isolated customer database; central database refused';
 END IF;
 IF EXISTS(SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN('tenants','master_admins','payment_orders','tenant_databases')) THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Central platform tables found; upgrade refused';
 END IF;
 SELECT COUNT(*) INTO table_count FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN('network_settings','network_contact_numbers','platform_subscription','managers','permissions','permission_groups','permission_group_permissions','customers','customer_categories','customer_category_memberships','activity_log');
 IF table_count<>11 THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Required tenant foundation tables missing; inspect schema before upgrade';
 END IF;
 SET lock_name=CONCAT('rl-expand:',LEFT(SHA2(DATABASE(),256),40));
 SELECT GET_LOCK(lock_name,0) INTO acquired;
 IF COALESCE(acquired,0)<>1 THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Another schema expansion is running';
 END IF;

 -- Add only missing fields. Existing fields are not overwritten on rerun.
 OPEN additions;
 expansion_loop: LOOP
  FETCH additions INTO target_table,target_column,column_definition;
  IF done=1 THEN LEAVE expansion_loop; END IF;
  SELECT COUNT(*) INTO col_count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=target_table AND COLUMN_NAME=target_column;
  IF col_count=0 THEN
   SET @rl_expand_sql=CONCAT('ALTER TABLE `',target_table,'` ADD COLUMN `',target_column,'` ',column_definition);
   PREPARE rl_expand_statement FROM @rl_expand_sql;
   EXECUTE rl_expand_statement;
   DEALLOCATE PREPARE rl_expand_statement;
  END IF;
 END LOOP;
 CLOSE additions;

 CREATE TABLE IF NOT EXISTS network_scopes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  scope_kind ENUM('center','agent','legacy_private') NOT NULL,
  name VARCHAR(150) NOT NULL,
  owner_manager_id BIGINT UNSIGNED NULL,
  is_enabled TINYINT(1) NOT NULL DEFAULT 1,
  created_by_manager_id BIGINT UNSIGNED NULL,
  archived_at DATETIME NULL,
  archived_by_manager_id BIGINT UNSIGNED NULL,
  center_guard TINYINT UNSIGNED GENERATED ALWAYS AS(CASE WHEN scope_kind='center' THEN 1 ELSE NULL END) STORED,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_scope_one_center(center_guard),
  UNIQUE KEY uq_scope_kind_owner(scope_kind,owner_manager_id),
  UNIQUE KEY uq_scope_id_owner(id,owner_manager_id),
  CONSTRAINT chk_scope_name CHECK(CHAR_LENGTH(TRIM(name))>0),
  CONSTRAINT chk_scope_owner CHECK((scope_kind='center' AND owner_manager_id IS NULL) OR (scope_kind IN('agent','legacy_private') AND owner_manager_id IS NOT NULL)),
  CONSTRAINT chk_scope_enabled CHECK(is_enabled IN(0,1)),
  CONSTRAINT fk_scope_owner FOREIGN KEY(owner_manager_id) REFERENCES managers(id) ON DELETE RESTRICT,
  CONSTRAINT fk_scope_creator FOREIGN KEY(created_by_manager_id) REFERENCES managers(id) ON DELETE RESTRICT,
  CONSTRAINT fk_scope_archiver FOREIGN KEY(archived_by_manager_id) REFERENCES managers(id) ON DELETE RESTRICT
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

 CREATE TABLE IF NOT EXISTS manager_contact_numbers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  manager_id BIGINT UNSIGNED NOT NULL,
  phone VARCHAR(20) NOT NULL,
  label VARCHAR(80) NULL,
  display_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_manager_extra_phone(manager_id,phone),
  CONSTRAINT chk_manager_extra_phone CHECK(CHAR_LENGTH(TRIM(phone))>0),
  CONSTRAINT fk_extra_phone_manager FOREIGN KEY(manager_id) REFERENCES managers(id) ON DELETE RESTRICT
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

 CREATE TABLE IF NOT EXISTS network_service_areas (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  address TEXT NULL,
  latitude DECIMAL(10,7) NULL,
  longitude DECIMAL(10,7) NULL,
  scope_id BIGINT UNSIGNED NULL COMMENT 'Optional agent scope; one area has at most one agent, an agent may have many areas',
  status ENUM('active','inactive','planned') NOT NULL DEFAULT 'planned',
  notes TEXT NULL,
  created_by_manager_id BIGINT UNSIGNED NOT NULL,
  archived_at DATETIME NULL,
  archived_by_manager_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_service_area_scope_status(scope_id,status,archived_at),
  CONSTRAINT chk_service_area_name CHECK(CHAR_LENGTH(TRIM(name))>0),
  CONSTRAINT chk_service_area_coordinates CHECK((latitude IS NULL AND longitude IS NULL) OR (latitude IS NOT NULL AND longitude IS NOT NULL AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)),
  CONSTRAINT fk_service_area_scope FOREIGN KEY(scope_id) REFERENCES network_scopes(id) ON DELETE RESTRICT,
  CONSTRAINT fk_service_area_creator FOREIGN KEY(created_by_manager_id) REFERENCES managers(id) ON DELETE RESTRICT,
  CONSTRAINT fk_service_area_archiver FOREIGN KEY(archived_by_manager_id) REFERENCES managers(id) ON DELETE RESTRICT
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

 -- A CHECK applies to fields in this row only. Agent role / area scope checks
 -- and cross-row subordinate grant limits must be enforced by the new backend.
 IF NOT EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='network_settings' AND CONSTRAINT_NAME='chk_network_coordinates') THEN
  ALTER TABLE network_settings ADD CONSTRAINT chk_network_coordinates CHECK((latitude IS NULL AND longitude IS NULL) OR (latitude IS NOT NULL AND longitude IS NOT NULL AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180));
 END IF;

 -- Intentionally do NOT seed agent grants, classify accounts, migrate owners,
 -- replace category membership FKs, or populate partially enforced scopes here.
 -- This preserves the running application's current authorization behavior.
 DO RELEASE_LOCK(lock_name);
 SET acquired=0;
 SET @rl_expand_sql=NULL;
END$$
CALL `rl_tenant_zone_000003`.`rl_customer_expand_v1`()$$
DROP PROCEDURE `rl_tenant_zone_000003`.`rl_customer_expand_v1`$$
DELIMITER ;

-- Read-only inspection after successful expansion; these are NOT functional tests.
SELECT DATABASE() AS customer_database;
SELECT TABLE_NAME,COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA=DATABASE() AND
 ((TABLE_NAME='network_settings' AND COLUMN_NAME IN('contact_email','address','latitude','longitude','government_license_number','logo_reference','internal_notes'))
 OR (TABLE_NAME='managers' AND COLUMN_NAME IN('account_role','scope_id','parent_agent_manager_id','contact_email'))
 OR (TABLE_NAME='customers' AND COLUMN_NAME IN('scope_id','assigned_manager_id')))
ORDER BY TABLE_NAME,ORDINAL_POSITION;
SELECT TABLE_NAME FROM information_schema.TABLES
WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN('network_scopes','network_service_areas','manager_contact_numbers');
