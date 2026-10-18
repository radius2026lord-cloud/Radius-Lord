-- Equipment inventory and automatically allocated IPv4 addresses for one tenant.
-- Select the target rl_tenant_ database before running this upgrade.
DELIMITER $$
DROP PROCEDURE IF EXISTS rl_network_equipment_inventory_v1$$
CREATE PROCEDURE rl_network_equipment_inventory_v1()
BEGIN
 DECLARE acquired INT DEFAULT 0;
 DECLARE table_count INT DEFAULT 0;
 DECLARE column_count INT DEFAULT 0;
 DECLARE object_count INT DEFAULT 0;
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
 WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN('customers','managers','pppoe_accounts');
 IF table_count<>3 THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Required tenant tables are missing; inspect the selected tenant schema';
 END IF;
 SET lock_name=CONCAT('rl-equipment:',LEFT(SHA2(DATABASE(),256),40));
 SELECT GET_LOCK(lock_name,0) INTO acquired;
 IF COALESCE(acquired,0)<>1 THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Another equipment inventory upgrade is running';
 END IF;

 -- Keep this upgrade self-sufficient for tenants that have not yet applied the outdoor-line fields.
 SELECT COUNT(*) INTO column_count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='pppoe_accounts' AND COLUMN_NAME='distribution_box_serial';
 IF column_count=0 THEN ALTER TABLE pppoe_accounts ADD COLUMN distribution_box_serial VARCHAR(100) NULL AFTER connection_method_id; END IF;
 SELECT COUNT(*) INTO column_count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='pppoe_accounts' AND COLUMN_NAME='distribution_box_description';
 IF column_count=0 THEN ALTER TABLE pppoe_accounts ADD COLUMN distribution_box_description VARCHAR(500) NULL AFTER distribution_box_serial; END IF;
 SELECT COUNT(*) INTO column_count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='pppoe_accounts' AND COLUMN_NAME='station_vendor';
 IF column_count=0 THEN ALTER TABLE pppoe_accounts ADD COLUMN station_vendor ENUM('ubnt','mimosa','mikrotik') NULL AFTER distribution_box_description; END IF;
 SELECT COUNT(*) INTO column_count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='pppoe_accounts' AND COLUMN_NAME='station_ip_address';
 IF column_count=0 THEN ALTER TABLE pppoe_accounts ADD COLUMN station_ip_address VARCHAR(45) NULL AFTER station_vendor; END IF;

 CREATE TABLE IF NOT EXISTS equipment_ip_pools (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  cidr VARCHAR(18) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  gateway_ipv4 INT UNSIGNED NOT NULL,
  range_start_ipv4 INT UNSIGNED NOT NULL,
  range_end_ipv4 INT UNSIGNED NOT NULL,
  excluded_ipv4 JSON NOT NULL,
  is_enabled TINYINT UNSIGNED NOT NULL DEFAULT 1,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY(id),
  UNIQUE KEY uq_equipment_pool_name(name),
  KEY idx_equipment_pool_range(is_enabled,range_start_ipv4,range_end_ipv4),
  CONSTRAINT fk_equipment_pool_creator FOREIGN KEY(created_by) REFERENCES managers(id),
  CONSTRAINT chk_equipment_pool_range CHECK(range_start_ipv4<=range_end_ipv4 AND is_enabled IN(0,1))
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

 CREATE TABLE IF NOT EXISTS network_equipment_devices (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  device_role ENUM('ap','station') NOT NULL,
  customer_id BIGINT UNSIGNED NULL,
  pool_id BIGINT UNSIGNED NOT NULL,
  management_ipv4 INT UNSIGNED NULL,
  last_management_ipv4 INT UNSIGNED NULL,
  vendor ENUM('ubnt','mimosa','mikrotik','other') NOT NULL,
  model VARCHAR(100) NULL,
  name VARCHAR(150) NOT NULL,
  serial_number VARCHAR(120) NULL,
  mac_address VARCHAR(17) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  parent_ap_id BIGINT UNSIGNED NULL,
  status ENUM('active','maintenance','retired') NOT NULL DEFAULT 'active',
  address VARCHAR(1000) NULL,
  latitude DECIMAL(10,7) NULL,
  longitude DECIMAL(10,7) NULL,
  notes VARCHAR(1000) NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY(id),
  UNIQUE KEY uq_equipment_management_ipv4(management_ipv4),
  UNIQUE KEY uq_equipment_serial(serial_number),
  UNIQUE KEY uq_equipment_mac(mac_address),
  KEY idx_equipment_customer(customer_id,device_role,status),
  KEY idx_equipment_pool(pool_id,status),
  KEY idx_equipment_parent_ap(parent_ap_id),
  CONSTRAINT fk_equipment_customer FOREIGN KEY(customer_id) REFERENCES customers(id),
  CONSTRAINT fk_equipment_pool FOREIGN KEY(pool_id) REFERENCES equipment_ip_pools(id),
  CONSTRAINT fk_equipment_parent_ap FOREIGN KEY(parent_ap_id) REFERENCES network_equipment_devices(id),
  CONSTRAINT fk_equipment_creator FOREIGN KEY(created_by) REFERENCES managers(id),
  CONSTRAINT chk_equipment_owner CHECK((device_role='ap' AND customer_id IS NULL) OR (device_role='station' AND customer_id IS NOT NULL)),
  CONSTRAINT chk_equipment_location CHECK((latitude IS NULL AND longitude IS NULL) OR (latitude IS NOT NULL AND longitude IS NOT NULL AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180))
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

 SELECT COUNT(*) INTO column_count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='pppoe_accounts' AND COLUMN_NAME='station_device_id';
 IF column_count=0 THEN ALTER TABLE pppoe_accounts ADD COLUMN station_device_id BIGINT UNSIGNED NULL AFTER station_ip_address; END IF;
 SELECT COUNT(*) INTO object_count FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='pppoe_accounts' AND INDEX_NAME='uq_ppp_station_device';
 IF object_count=0 THEN ALTER TABLE pppoe_accounts ADD UNIQUE KEY uq_ppp_station_device(station_device_id); END IF;
 SELECT COUNT(*) INTO object_count FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='pppoe_accounts' AND CONSTRAINT_NAME='fk_ppp_station_device';
 IF object_count=0 THEN ALTER TABLE pppoe_accounts ADD CONSTRAINT fk_ppp_station_device FOREIGN KEY(station_device_id) REFERENCES network_equipment_devices(id); END IF;

 DO RELEASE_LOCK(lock_name);
 SET acquired=0;
END$$
CALL rl_network_equipment_inventory_v1()$$
DROP PROCEDURE rl_network_equipment_inventory_v1$$
DELIMITER ;

-- Verify the new tables and the PPPoE-to-Station reference.
SELECT TABLE_NAME FROM information_schema.TABLES
WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN('equipment_ip_pools','network_equipment_devices')
ORDER BY TABLE_NAME;
SELECT COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='pppoe_accounts' AND COLUMN_NAME='station_device_id';
