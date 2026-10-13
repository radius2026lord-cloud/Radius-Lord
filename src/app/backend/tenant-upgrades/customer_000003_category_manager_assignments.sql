-- Allow one subscriber category to be assigned to multiple managers.
-- Existing categories are assigned to their current manager_id before the
-- membership foreign key is moved to the assignment table.
-- Apply only to the isolated tenant database after taking a backup.
USE `rl_tenant_zone_000003`;
DELIMITER $$
DROP PROCEDURE IF EXISTS `rl_tenant_zone_000003`.`rl_category_manager_assignments_v1`$$
CREATE PROCEDURE `rl_tenant_zone_000003`.`rl_category_manager_assignments_v1`()
BEGIN
 DECLARE lock_name VARCHAR(64);
 DECLARE acquired INT DEFAULT 0;
 DECLARE table_count INT DEFAULT 0;
 DECLARE constraint_count INT DEFAULT 0;
 DECLARE EXIT HANDLER FOR SQLEXCEPTION
 BEGIN
  IF acquired=1 THEN DO RELEASE_LOCK(lock_name); END IF;
  RESIGNAL;
 END;

 IF BINARY DATABASE()<>BINARY 'rl_tenant_zone_000003' THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Wrong tenant database';
 END IF;
 IF EXISTS(SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN('tenants','master_admins','payment_orders','tenant_databases')) THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Central database detected; category upgrade refused';
 END IF;
 SELECT COUNT(*) INTO table_count
 FROM information_schema.TABLES
 WHERE TABLE_SCHEMA=DATABASE()
   AND TABLE_NAME IN('managers','customers','customer_categories','customer_category_memberships');
 IF table_count<>4 THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Required tenant category tables are missing';
 END IF;

 SET lock_name=CONCAT('rl-category-map:',LEFT(SHA2(DATABASE(),256),40));
 SELECT GET_LOCK(lock_name,0) INTO acquired;
 IF COALESCE(acquired,0)<>1 THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Another category assignment upgrade is running';
 END IF;

 CREATE TABLE IF NOT EXISTS customer_category_manager_assignments (
  category_id BIGINT UNSIGNED NOT NULL,
  manager_id BIGINT UNSIGNED NOT NULL,
  assigned_by_manager_id BIGINT UNSIGNED NOT NULL,
  assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(category_id,manager_id),
  KEY idx_category_assignment_manager(manager_id,category_id),
  CONSTRAINT fk_category_assignment_category FOREIGN KEY(category_id) REFERENCES customer_categories(id) ON DELETE RESTRICT,
  CONSTRAINT fk_category_assignment_manager FOREIGN KEY(manager_id) REFERENCES managers(id) ON DELETE RESTRICT,
  CONSTRAINT fk_category_assignment_actor FOREIGN KEY(assigned_by_manager_id) REFERENCES managers(id) ON DELETE RESTRICT
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

 INSERT IGNORE INTO customer_category_manager_assignments(category_id,manager_id,assigned_by_manager_id)
 SELECT id,manager_id,created_by_manager_id FROM customer_categories;

 SELECT COUNT(*) INTO constraint_count
 FROM information_schema.REFERENTIAL_CONSTRAINTS
 WHERE CONSTRAINT_SCHEMA=DATABASE()
   AND TABLE_NAME='customer_category_memberships'
   AND CONSTRAINT_NAME='fk_membership_category_owner';
 IF constraint_count>0 THEN
  ALTER TABLE customer_category_memberships DROP FOREIGN KEY fk_membership_category_owner;
 END IF;

 SELECT COUNT(*) INTO constraint_count
 FROM information_schema.STATISTICS
 WHERE TABLE_SCHEMA=DATABASE()
   AND TABLE_NAME='customer_category_memberships'
   AND INDEX_NAME='idx_membership_category_manager';
 IF constraint_count=0 THEN
  ALTER TABLE customer_category_memberships ADD KEY idx_membership_category_manager(category_id,manager_id);
 END IF;

 SELECT COUNT(*) INTO constraint_count
 FROM information_schema.REFERENTIAL_CONSTRAINTS
 WHERE CONSTRAINT_SCHEMA=DATABASE()
   AND TABLE_NAME='customer_category_memberships'
   AND CONSTRAINT_NAME='fk_membership_category_assignment';
 IF constraint_count=0 THEN
  ALTER TABLE customer_category_memberships
   ADD CONSTRAINT fk_membership_category_assignment
   FOREIGN KEY(category_id,manager_id)
   REFERENCES customer_category_manager_assignments(category_id,manager_id)
   ON DELETE RESTRICT;
 END IF;

 DO RELEASE_LOCK(lock_name);
 SET acquired=0;
END$$
CALL `rl_tenant_zone_000003`.`rl_category_manager_assignments_v1`()$$
DROP PROCEDURE `rl_tenant_zone_000003`.`rl_category_manager_assignments_v1`$$
DELIMITER ;

-- Read-only verification after successful migration.
SELECT DATABASE() AS selected_database;
SELECT COUNT(*) AS categories_without_manager_assignment
FROM customer_categories c
LEFT JOIN customer_category_manager_assignments a ON a.category_id=c.id
WHERE a.category_id IS NULL;
SELECT COUNT(*) AS invalid_customer_category_links
FROM customer_category_memberships x
LEFT JOIN customer_category_manager_assignments a
  ON a.category_id=x.category_id AND a.manager_id=x.manager_id
WHERE a.category_id IS NULL;
SELECT CONSTRAINT_NAME,REFERENCED_TABLE_NAME
FROM information_schema.REFERENTIAL_CONSTRAINTS
WHERE CONSTRAINT_SCHEMA=DATABASE()
  AND TABLE_NAME='customer_category_memberships'
  AND CONSTRAINT_NAME='fk_membership_category_assignment';
