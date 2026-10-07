-- Radius Lord complete tenant database template / 2026-10-07 / MySQL 8.0.46.
-- SPDX-License-Identifier: GPL-2.0-or-later
-- Includes FreeRADIUS v3.2.x MySQL schema verbatim (upstream blob 84846b20c93e92ba785a9f9e49375246309b48b9).
-- Upstream notices remain in the embedded section; license: vendor/FREERADIUS-LICENSE.
-- Empty isolated database only. No fixed database name, credentials or active sample license.
-- Import this ONE FILE, not the component files as well. DDL is not transactional.
SET NAMES utf8mb4;
SET SESSION default_storage_engine=InnoDB;
SET SESSION time_zone='+00:00';
DROP PROCEDURE IF EXISTS rl_complete_tenant_guard;
DELIMITER $$
CREATE PROCEDURE rl_complete_tenant_guard()
BEGIN
 IF DATABASE() IS NULL OR DATABASE()='lord_radius_core' THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Select an empty isolated tenant database';
 END IF;
 IF EXISTS(SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()) THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Database is not empty; this file is not a migration';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=DATABASE() AND DEFAULT_CHARACTER_SET_NAME='utf8mb4' AND DEFAULT_COLLATION_NAME='utf8mb4_unicode_ci') THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Use utf8mb4 / utf8mb4_unicode_ci for the new tenant database';
 END IF;
 IF @@SESSION.foreign_key_checks<>1 THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Enable foreign_key_checks before importing';
 END IF;
END$$
DELIMITER ;
CALL rl_complete_tenant_guard();
DROP PROCEDURE rl_complete_tenant_guard;

