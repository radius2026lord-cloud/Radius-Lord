-- Add subscriber-level status and per-service-line identifiers to the existing tenant.
-- Apply only to rl_tenant_zone_000003 after a full backup and with application writes paused.
-- MySQL DDL commits implicitly; stop at the first error and inspect before retrying.
USE `rl_tenant_zone_000003`;
DELIMITER $$
DROP PROCEDURE IF EXISTS `rl_tenant_zone_000003`.`rl_subscriber_identity_v1`$$
CREATE PROCEDURE `rl_tenant_zone_000003`.`rl_subscriber_identity_v1`()
BEGIN
 DECLARE lock_name VARCHAR(64);
 DECLARE acquired INT DEFAULT 0;
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
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Central database detected; subscriber upgrade refused';
 END IF;
 SELECT COUNT(*) INTO table_count FROM information_schema.TABLES
 WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN('customers','radius_identities','pppoe_accounts','hotspot_standalone_cards');
 IF table_count<>4 THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Required subscriber and service tables are missing';
 END IF;
 SET lock_name=CONCAT('rl-subscriber:',LEFT(SHA2(DATABASE(),256),40));
 SELECT GET_LOCK(lock_name,0) INTO acquired;
 IF COALESCE(acquired,0)<>1 THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Another subscriber upgrade is running';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='customers' AND COLUMN_NAME='status') THEN
  ALTER TABLE customers ADD COLUMN status ENUM('active','suspended') NOT NULL DEFAULT 'active' AFTER manager_id;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='radius_identities' AND COLUMN_NAME='contract_number') THEN
  ALTER TABLE radius_identities ADD COLUMN contract_number VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL AFTER service_kind;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='radius_identities' AND COLUMN_NAME='line_payment_code') THEN
  ALTER TABLE radius_identities ADD COLUMN line_payment_code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL AFTER contract_number;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='radius_identities' AND INDEX_NAME='uq_identity_contract_number') THEN
  ALTER TABLE radius_identities ADD UNIQUE KEY uq_identity_contract_number(contract_number);
 END IF;
 IF NOT EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='radius_identities' AND INDEX_NAME='uq_identity_line_payment_code') THEN
  ALTER TABLE radius_identities ADD UNIQUE KEY uq_identity_line_payment_code(line_payment_code);
 END IF;
 DO RELEASE_LOCK(lock_name);
 SET acquired=0;
END$$
CALL `rl_tenant_zone_000003`.`rl_subscriber_identity_v1`()$$
DROP PROCEDURE `rl_tenant_zone_000003`.`rl_subscriber_identity_v1`$$
DELIMITER ;

-- Read-only verification.
SELECT DATABASE() AS selected_database;
SELECT COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE,COLUMN_DEFAULT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA='rl_tenant_zone_000003'
 AND ((TABLE_NAME='customers' AND COLUMN_NAME='status')
   OR (TABLE_NAME='radius_identities' AND COLUMN_NAME IN('contract_number','line_payment_code')))
ORDER BY TABLE_NAME,ORDINAL_POSITION;
SELECT INDEX_NAME,COLUMN_NAME,NON_UNIQUE
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA='rl_tenant_zone_000003'
 AND TABLE_NAME='radius_identities'
 AND INDEX_NAME IN('uq_identity_contract_number','uq_identity_line_payment_code')
GROUP BY INDEX_NAME,COLUMN_NAME,NON_UNIQUE
ORDER BY INDEX_NAME;
