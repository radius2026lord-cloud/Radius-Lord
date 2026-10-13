-- Create a manager-scoped address suggestion catalog and backfill saved customer addresses.
-- Apply to rl_tenant_zone_000003 after a full backup.
USE `rl_tenant_zone_000003`;
DELIMITER $$
DROP PROCEDURE IF EXISTS `rl_tenant_zone_000003`.`rl_customer_address_suggestions_v1`$$
CREATE PROCEDURE `rl_tenant_zone_000003`.`rl_customer_address_suggestions_v1`()
BEGIN
 DECLARE acquired INT DEFAULT 0;
 DECLARE lock_name VARCHAR(64);
 DECLARE table_count INT DEFAULT 0;
 DECLARE EXIT HANDLER FOR SQLEXCEPTION
 BEGIN
  IF acquired=1 THEN DO RELEASE_LOCK(lock_name); END IF;
  RESIGNAL;
 END;
 IF BINARY DATABASE()<>BINARY 'rl_tenant_zone_000003' THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Wrong tenant database';
 END IF;
 IF EXISTS(SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN('tenants','master_admins','payment_orders','tenant_databases')) THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Central database detected; address suggestion upgrade refused';
 END IF;
 SELECT COUNT(*) INTO table_count FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN('customers','managers');
 IF table_count<>2 THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Required customer tables are missing';
 END IF;
 SET lock_name=CONCAT('rl-address:',LEFT(SHA2(DATABASE(),256),40));
 SELECT GET_LOCK(lock_name,0) INTO acquired;
 IF COALESCE(acquired,0)<>1 THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Another address suggestion upgrade is running';
 END IF;
 CREATE TABLE IF NOT EXISTS customer_address_suggestions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  manager_id BIGINT UNSIGNED NOT NULL,
  address TEXT NOT NULL,
  address_hash BINARY(32) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  last_used_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY(id),
  UNIQUE KEY uq_customer_address_suggestion_hash(manager_id,address_hash),
  KEY idx_customer_address_suggestions_prefix(manager_id,address(191)),
  CONSTRAINT fk_customer_address_suggestion_manager FOREIGN KEY(manager_id) REFERENCES managers(id) ON DELETE RESTRICT
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
 INSERT IGNORE INTO customer_address_suggestions(manager_id,address,address_hash)
 SELECT c.manager_id,TRIM(c.address),UNHEX(SHA2(LOWER(TRIM(c.address)),256))
 FROM customers c
 WHERE c.address IS NOT NULL AND TRIM(c.address)<>'';
 DO RELEASE_LOCK(lock_name);
 SET acquired=0;
END$$
CALL `rl_tenant_zone_000003`.`rl_customer_address_suggestions_v1`()$$
DROP PROCEDURE `rl_tenant_zone_000003`.`rl_customer_address_suggestions_v1`$$
DELIMITER ;

-- Read-only verification
SELECT DATABASE() AS selected_database;
SELECT TABLE_NAME,COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA='rl_tenant_zone_000003'
 AND TABLE_NAME='customer_address_suggestions'
ORDER BY ORDINAL_POSITION;
SELECT COUNT(*) AS saved_address_suggestions
FROM `rl_tenant_zone_000003`.customer_address_suggestions;
