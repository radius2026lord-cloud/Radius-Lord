-- Existing customer only. Backup and pause backend writes before applying whole file.
USE `rl_tenant_zone_000003`;
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
DELIMITER $$
DROP PROCEDURE IF EXISTS `rl_tenant_zone_000003`.`rl_profile_refs_v1`$$
DROP PROCEDURE IF EXISTS `rl_tenant_zone_000003`.`rl_profile_refs_v2`$$
CREATE PROCEDURE `rl_tenant_zone_000003`.`rl_profile_refs_v2`()
BEGIN
 IF BINARY DATABASE()<>BINARY 'rl_tenant_zone_000003' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Wrong tenant database'; END IF;
 CREATE TABLE IF NOT EXISTS speed_units(id SMALLINT UNSIGNED NOT NULL PRIMARY KEY,code VARCHAR(10) NOT NULL UNIQUE,name_ar VARCHAR(50) NOT NULL,bps_factor BIGINT UNSIGNED NOT NULL,is_enabled TINYINT UNSIGNED NOT NULL DEFAULT 1,CHECK(bps_factor>0),CHECK(is_enabled IN(0,1))) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
 CREATE TABLE IF NOT EXISTS data_units(id SMALLINT UNSIGNED NOT NULL PRIMARY KEY,code VARCHAR(10) NOT NULL UNIQUE,name_ar VARCHAR(50) NOT NULL,bytes_factor BIGINT UNSIGNED NOT NULL,is_enabled TINYINT UNSIGNED NOT NULL DEFAULT 1,CHECK(bytes_factor>0),CHECK(is_enabled IN(0,1))) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
 CREATE TABLE IF NOT EXISTS currencies(id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,code VARCHAR(10) NOT NULL UNIQUE,name_ar VARCHAR(80) NOT NULL,symbol VARCHAR(12) NOT NULL DEFAULT '',decimal_places TINYINT UNSIGNED NOT NULL DEFAULT 2,is_enabled TINYINT UNSIGNED NOT NULL DEFAULT 1,CHECK(decimal_places BETWEEN 0 AND 2),CHECK(is_enabled IN(0,1))) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
 INSERT IGNORE INTO speed_units VALUES(1,'Kbps','كيلوبت/ثانية',1000,1),(2,'Mbps','ميغابت/ثانية',1000000,1),(3,'Gbps','غيغابت/ثانية',1000000000,1);
 INSERT IGNORE INTO data_units VALUES(1,'MB','ميغابايت',1000000,1),(2,'GB','غيغابايت',1000000000,1),(3,'TB','تيرابايت',1000000000000,1);
 IF (SELECT COUNT(*) FROM speed_units WHERE (id=1 AND BINARY code=BINARY 'Kbps' AND bps_factor=1000) OR (id=2 AND BINARY code=BINARY 'Mbps' AND bps_factor=1000000) OR (id=3 AND BINARY code=BINARY 'Gbps' AND bps_factor=1000000000))<>3 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Incompatible speed factors'; END IF;
 IF (SELECT COUNT(*) FROM data_units WHERE (id=1 AND BINARY code=BINARY 'MB' AND bytes_factor=1000000) OR (id=2 AND BINARY code=BINARY 'GB' AND bytes_factor=1000000000) OR (id=3 AND BINARY code=BINARY 'TB' AND bytes_factor=1000000000000))<>3 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Incompatible data factors'; END IF;
 INSERT IGNORE INTO currencies(code,name_ar,symbol) VALUES('SYP','الليرة السورية','ل.س'),('USD','الدولار الأمريكي','$'),('EUR','اليورو','€'),('TRY','الليرة التركية','₺'),('SAR','الريال السعودي','ر.س'),('AED','الدرهم الإماراتي','د.إ');
 INSERT IGNORE INTO currencies(code,name_ar) SELECT DISTINCT currency_code,currency_code FROM pppoe_packages;
 IF NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE BINARY TABLE_SCHEMA=BINARY DATABASE() AND BINARY TABLE_NAME=BINARY 'pppoe_packages' AND BINARY COLUMN_NAME=BINARY 'currency_id') THEN
  ALTER TABLE pppoe_packages ADD COLUMN currency_id SMALLINT UNSIGNED NULL,ADD CONSTRAINT fk_ppp_currency_reference FOREIGN KEY(currency_id) REFERENCES currencies(id);
 END IF;
 -- Explicit comparison also handles reference tables created by an earlier partial run.
 UPDATE pppoe_packages p JOIN currencies c ON BINARY CONVERT(c.code USING utf8mb4)=BINARY CONVERT(p.currency_code USING utf8mb4) SET p.currency_id=c.id WHERE p.currency_id IS NULL;
 ALTER TABLE pppoe_packages MODIFY package_type ENUM('prepaid','daily','addon','free') NOT NULL DEFAULT 'prepaid';
 IF NOT EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE BINARY CONSTRAINT_SCHEMA=BINARY DATABASE() AND BINARY TABLE_NAME=BINARY 'pppoe_packages' AND BINARY CONSTRAINT_NAME=BINARY 'chk_ppp_free_profile') THEN ALTER TABLE pppoe_packages ADD CONSTRAINT chk_ppp_free_profile CHECK(BINARY package_type<>BINARY 'free' OR (base_price=0 AND offer_price IS NULL AND offer_ends_at IS NULL AND is_gift=0 AND daily_package_id IS NULL)); END IF;
 IF NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE BINARY TABLE_SCHEMA=BINARY DATABASE() AND BINARY TABLE_NAME=BINARY 'network_settings' AND BINARY COLUMN_NAME=BINARY 'default_currency_id') THEN
  ALTER TABLE network_settings ADD COLUMN default_currency_id SMALLINT UNSIGNED NULL,ADD CONSTRAINT fk_network_currency_reference FOREIGN KEY(default_currency_id) REFERENCES currencies(id);
 END IF;
 UPDATE network_settings SET default_currency_id=(SELECT id FROM currencies WHERE BINARY code=BINARY 'SYP') WHERE default_currency_id IS NULL;
 IF NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE BINARY TABLE_SCHEMA=BINARY DATABASE() AND BINARY TABLE_NAME=BINARY 'package_service_policies' AND BINARY COLUMN_NAME=BINARY 'download_unit_id') THEN
  ALTER TABLE package_service_policies ADD COLUMN download_unit_id SMALLINT UNSIGNED NULL,ADD COLUMN upload_unit_id SMALLINT UNSIGNED NULL,ADD COLUMN quota_unit_id SMALLINT UNSIGNED NULL,ADD COLUMN reduced_download_unit_id SMALLINT UNSIGNED NULL,ADD COLUMN reduced_upload_unit_id SMALLINT UNSIGNED NULL,
  ADD CONSTRAINT fk_ppp_download_unit FOREIGN KEY(download_unit_id) REFERENCES speed_units(id),ADD CONSTRAINT fk_ppp_upload_unit FOREIGN KEY(upload_unit_id) REFERENCES speed_units(id),ADD CONSTRAINT fk_ppp_quota_unit FOREIGN KEY(quota_unit_id) REFERENCES data_units(id),ADD CONSTRAINT fk_ppp_reduced_download_unit FOREIGN KEY(reduced_download_unit_id) REFERENCES speed_units(id),ADD CONSTRAINT fk_ppp_reduced_upload_unit FOREIGN KEY(reduced_upload_unit_id) REFERENCES speed_units(id);
 END IF;
 UPDATE package_service_policies SET download_unit_id=COALESCE(download_unit_id,2),upload_unit_id=COALESCE(upload_unit_id,2),quota_unit_id=IF(quota_bytes IS NULL,NULL,COALESCE(quota_unit_id,2)),reduced_download_unit_id=IF(reduced_download_bps IS NULL,NULL,COALESCE(reduced_download_unit_id,2)),reduced_upload_unit_id=IF(reduced_upload_bps IS NULL,NULL,COALESCE(reduced_upload_unit_id,2));
 ALTER TABLE package_service_policies MODIFY starts_at ENUM('activation','first_connection','creation') NULL;
 -- Existing time_units and historic JSON remain unchanged. DDL commits implicitly.
END$$
CALL `rl_tenant_zone_000003`.`rl_profile_refs_v2`()$$
DROP PROCEDURE `rl_tenant_zone_000003`.`rl_profile_refs_v2`$$
DELIMITER ;
