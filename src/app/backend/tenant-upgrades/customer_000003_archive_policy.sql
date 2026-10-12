-- Apply to the existing customer only, after manager roles v2. Back up first.
USE `rl_tenant_zone_000003`;
DELIMITER $$
DROP PROCEDURE IF EXISTS `rl_tenant_zone_000003`.`rl_archive_v1`$$
CREATE PROCEDURE `rl_tenant_zone_000003`.`rl_archive_v1`()
BEGIN
 IF DATABASE()<>'rl_tenant_zone_000003' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Wrong database'; END IF;
 IF NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='managers' AND COLUMN_NAME='purged_at') THEN ALTER TABLE managers ADD COLUMN purged_at DATETIME NULL; END IF;
 IF NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='permission_groups' AND COLUMN_NAME='purged_at') THEN ALTER TABLE permission_groups ADD COLUMN purged_at DATETIME NULL; END IF;
 CREATE TABLE IF NOT EXISTS network_archive_policy(
 id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
 retention_days SMALLINT UNSIGNED NOT NULL DEFAULT 90,
 automatic_cleanup TINYINT UNSIGNED NOT NULL DEFAULT 0,
 updated_by_manager_id BIGINT UNSIGNED NULL,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 CONSTRAINT chk_archive_policy_id CHECK(id=1),
 CONSTRAINT chk_archive_retention CHECK(retention_days BETWEEN 1 AND 3650),
 CONSTRAINT chk_archive_cleanup CHECK(automatic_cleanup IN(0,1)),
 CONSTRAINT fk_archive_policy_actor FOREIGN KEY(updated_by_manager_id) REFERENCES managers(id) ON DELETE RESTRICT
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
 INSERT INTO network_archive_policy(id) VALUES(1) ON DUPLICATE KEY UPDATE id=id;
END$$
CALL `rl_tenant_zone_000003`.`rl_archive_v1`()$$
DROP PROCEDURE `rl_tenant_zone_000003`.`rl_archive_v1`$$
DELIMITER ;
