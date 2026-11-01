-- Select the target rl_tenant_ database. Does not change existing account credentials.
DELIMITER $$
DROP PROCEDURE IF EXISTS rl_hotspot_package_login_mode_v1$$
CREATE PROCEDURE rl_hotspot_package_login_mode_v1()
BEGIN
 IF DATABASE() IS NULL OR BINARY LEFT(DATABASE(),10)<>BINARY 'rl_tenant_' THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Select the target rl_tenant_ database';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='hotspot_packages' AND COLUMN_NAME='login_mode') THEN
  ALTER TABLE hotspot_packages ADD COLUMN login_mode ENUM('code','username_password') NULL DEFAULT NULL;
 END IF;
 UPDATE hotspot_packages p JOIN (
  SELECT v.package_id,MIN(a.login_mode) mode_value FROM hotspot_package_versions v
  JOIN hotspot_service_periods sp ON sp.package_version_id=v.id
  JOIN hotspot_accounts a ON a.id=sp.account_id
  GROUP BY v.package_id HAVING COUNT(DISTINCT a.login_mode)=1
 ) known_modes ON known_modes.package_id=p.id
 SET p.login_mode=known_modes.mode_value WHERE p.login_mode IS NULL;
END$$
CALL rl_hotspot_package_login_mode_v1()$$
DROP PROCEDURE rl_hotspot_package_login_mode_v1$$
DELIMITER ;
