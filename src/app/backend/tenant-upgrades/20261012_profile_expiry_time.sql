-- Existing tenant databases only. Select the target tenant database before running this whole file.
-- Existing fixed-day profiles retain midnight; new profiles can choose an exact local hour and minute.
-- Back up the tenant database and pause application writes first. DDL commits implicitly; inspect any failure before rerunning.
DELIMITER $$
DROP PROCEDURE IF EXISTS rl_profile_expiry_time_v1$$
CREATE PROCEDURE rl_profile_expiry_time_v1()
BEGIN
 DECLARE acquired INT DEFAULT 0;
 DECLARE table_count INT DEFAULT 0;
 DECLARE column_count INT DEFAULT 0;
 DECLARE lock_name VARCHAR(64);
 DECLARE EXIT HANDLER FOR SQLEXCEPTION
 BEGIN
  IF acquired=1 THEN DO RELEASE_LOCK(lock_name); END IF;
  RESIGNAL;
 END;

 IF DATABASE() IS NULL OR DATABASE()='lord_radius_core' THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Select an existing tenant database; central database refused';
 END IF;
 IF EXISTS(SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN('tenants','master_admins','payment_orders','tenant_databases')) THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Central platform tables found; upgrade refused';
 END IF;
 SELECT COUNT(*) INTO table_count FROM information_schema.TABLES
 WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN('pppoe_packages','package_service_policies');
 IF table_count<>2 THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Required profile tables missing; inspect selected tenant database';
 END IF;
 SELECT COUNT(*) INTO column_count FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='package_service_policies' AND COLUMN_NAME='expiry_day';
 IF column_count<>1 THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='expiry_day is missing; apply the profile foundation upgrade first';
 END IF;

 SET lock_name=CONCAT('rl-profile-expiry:',LEFT(SHA2(DATABASE(),256),40));
 SELECT GET_LOCK(lock_name,0) INTO acquired;
 IF COALESCE(acquired,0)<>1 THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Another profile schema upgrade is running';
 END IF;

 SELECT COUNT(*) INTO column_count FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='package_service_policies' AND COLUMN_NAME='expiry_time';
 IF column_count=0 THEN
  ALTER TABLE package_service_policies ADD COLUMN expiry_time TIME NULL DEFAULT NULL AFTER expiry_day;
 END IF;
 UPDATE package_service_policies SET expiry_time='00:00:00'
 WHERE validity_mode='fixed_day' AND expiry_time IS NULL;

 DO RELEASE_LOCK(lock_name);
 SET acquired=0;
END$$
CALL rl_profile_expiry_time_v1()$$
DROP PROCEDURE rl_profile_expiry_time_v1$$
DELIMITER ;

-- Read-only verification.
SELECT DATABASE() AS tenant_database;
SELECT COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE,COLUMN_DEFAULT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='package_service_policies' AND COLUMN_NAME='expiry_time';
SELECT COUNT(*) AS fixed_day_profiles_missing_expiry_time
FROM package_service_policies
WHERE validity_mode='fixed_day' AND expiry_time IS NULL;
