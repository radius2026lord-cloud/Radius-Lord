-- Adds WiFi Outdoor box/station details to existing subscriber lines.
-- Select the target rl_tenant_ database before running this upgrade.
DELIMITER $$
DROP PROCEDURE IF EXISTS rl_pppoe_outdoor_details_v1$$
CREATE PROCEDURE rl_pppoe_outdoor_details_v1()
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

 IF DATABASE() IS NULL OR DATABASE()='lord_radius_core' OR BINARY LEFT(DATABASE(),10)<>BINARY 'rl_tenant_' THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Select the target rl_tenant_ database; central or unrelated databases are refused';
 END IF;
 SELECT COUNT(*) INTO table_count FROM information_schema.TABLES
 WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='pppoe_accounts';
 IF table_count<>1 THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='pppoe_accounts is missing; inspect the selected tenant schema';
 END IF;

 SET lock_name=CONCAT('rl-ppp-outdoor:',LEFT(SHA2(DATABASE(),256),40));
 SELECT GET_LOCK(lock_name,0) INTO acquired;
 IF COALESCE(acquired,0)<>1 THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Another PPPoE installation upgrade is running';
 END IF;

 SELECT COUNT(*) INTO column_count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='pppoe_accounts' AND COLUMN_NAME='distribution_box_serial';
 IF column_count=0 THEN ALTER TABLE pppoe_accounts ADD COLUMN distribution_box_serial VARCHAR(100) NULL AFTER connection_method_id; END IF;
 SELECT COUNT(*) INTO column_count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='pppoe_accounts' AND COLUMN_NAME='distribution_box_description';
 IF column_count=0 THEN ALTER TABLE pppoe_accounts ADD COLUMN distribution_box_description VARCHAR(500) NULL AFTER distribution_box_serial; END IF;
 SELECT COUNT(*) INTO column_count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='pppoe_accounts' AND COLUMN_NAME='station_vendor';
 IF column_count=0 THEN ALTER TABLE pppoe_accounts ADD COLUMN station_vendor ENUM('ubnt','mimosa','mikrotik') NULL AFTER distribution_box_description; END IF;
 SELECT COUNT(*) INTO column_count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='pppoe_accounts' AND COLUMN_NAME='station_ip_address';
 IF column_count=0 THEN ALTER TABLE pppoe_accounts ADD COLUMN station_ip_address VARCHAR(45) NULL AFTER station_vendor; END IF;

 DO RELEASE_LOCK(lock_name);
 SET acquired=0;
END$$
CALL rl_pppoe_outdoor_details_v1()$$
DROP PROCEDURE rl_pppoe_outdoor_details_v1$$
DELIMITER ;

-- Verify the fields exist in the selected tenant database.
SELECT COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='pppoe_accounts'
 AND COLUMN_NAME IN('distribution_box_serial','distribution_box_description','station_vendor','station_ip_address')
ORDER BY ORDINAL_POSITION;
