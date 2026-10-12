-- Temporary profile-wide speed multiplier for the existing tenant.
-- Apply only after taking a backup and pausing tenant writes.
USE `rl_tenant_zone_000003`;
DELIMITER $$
DROP PROCEDURE IF EXISTS `rl_tenant_zone_000003`.`rl_profile_speed_boost_v1`$$
CREATE PROCEDURE `rl_tenant_zone_000003`.`rl_profile_speed_boost_v1`()
BEGIN
 IF BINARY DATABASE()<>BINARY 'rl_tenant_zone_000003' THEN
   SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Wrong tenant database';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='pppoe_packages')
    OR NOT EXISTS(SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='package_service_policies')
    OR NOT EXISTS(SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='pppoe_package_versions')
    OR NOT EXISTS(SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='managers') THEN
   SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Required profile tables are missing';
 END IF;
 CREATE TABLE IF NOT EXISTS pppoe_package_speed_boosts (
   id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
   package_id BIGINT UNSIGNED NOT NULL,
   multiplier TINYINT UNSIGNED NOT NULL,
   original_download_bps BIGINT UNSIGNED NOT NULL,
   original_upload_bps BIGINT UNSIGNED NOT NULL,
   boosted_download_bps BIGINT UNSIGNED NOT NULL,
   boosted_upload_bps BIGINT UNSIGNED NOT NULL,
   started_at DATETIME(6) NOT NULL,
   expires_at DATETIME(6) NOT NULL,
   status ENUM('active','reverted') NOT NULL DEFAULT 'active',
   active_package_id BIGINT UNSIGNED GENERATED ALWAYS AS (CASE WHEN status='active' THEN package_id ELSE NULL END) STORED,
   created_by BIGINT UNSIGNED NOT NULL,
   created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
   reverted_at DATETIME(6) NULL,
   PRIMARY KEY(id),
   UNIQUE KEY uq_active_profile_speed_boost(active_package_id),
   KEY idx_profile_speed_boost_expiry(status,expires_at,id),
   CONSTRAINT fk_profile_speed_boost_package FOREIGN KEY(package_id) REFERENCES pppoe_packages(id) ON DELETE RESTRICT,
   CONSTRAINT fk_profile_speed_boost_creator FOREIGN KEY(created_by) REFERENCES managers(id) ON DELETE RESTRICT,
   CONSTRAINT chk_profile_boost_multiplier CHECK(multiplier BETWEEN 1 AND 5),
   CONSTRAINT chk_profile_boost_speeds CHECK(original_download_bps>0 AND original_upload_bps>0 AND boosted_download_bps>=original_download_bps AND boosted_upload_bps>=original_upload_bps),
   CONSTRAINT chk_profile_boost_expiry CHECK(expires_at>started_at)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
 IF (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='pppoe_package_speed_boosts' AND COLUMN_NAME IN('package_id','multiplier','original_download_bps','original_upload_bps','boosted_download_bps','boosted_upload_bps','started_at','expires_at','status','active_package_id','created_by','reverted_at'))<>12 THEN
   SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Incompatible profile speed boost table';
 END IF;
END$$
CALL `rl_tenant_zone_000003`.`rl_profile_speed_boost_v1`()$$
DROP PROCEDURE `rl_tenant_zone_000003`.`rl_profile_speed_boost_v1`$$
DELIMITER ;
