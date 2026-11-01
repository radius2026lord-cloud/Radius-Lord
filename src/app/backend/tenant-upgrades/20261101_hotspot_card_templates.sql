-- Run only on the selected rl_tenant_ database, never the central database.
DELIMITER $$
DROP PROCEDURE IF EXISTS rl_hotspot_card_templates_v1$$
CREATE PROCEDURE rl_hotspot_card_templates_v1()
BEGIN
 IF DATABASE() IS NULL OR BINARY LEFT(DATABASE(),10)<>BINARY 'rl_tenant_' THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Select the target rl_tenant_ database';
 END IF;
 CREATE TABLE IF NOT EXISTS network_hotspot_card_templates (
  id TINYINT UNSIGNED NOT NULL,
  library_json JSON NOT NULL,
  revision INT UNSIGNED NOT NULL DEFAULT 0,
  updated_by BIGINT UNSIGNED NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY(id),
  CONSTRAINT chk_hotspot_template_library_singleton CHECK(id=1)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
END$$
CALL rl_hotspot_card_templates_v1()$$
DROP PROCEDURE rl_hotspot_card_templates_v1$$
DELIMITER ;
