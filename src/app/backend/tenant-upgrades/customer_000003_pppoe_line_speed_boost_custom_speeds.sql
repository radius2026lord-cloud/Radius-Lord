-- Upgrade the temporary per-line boost table from multiplier input to explicit speeds.
-- Run once in the tenant database after customer_000003_pppoe_line_speed_boost.sql.
USE `rl_tenant_zone_000003`;

ALTER TABLE pppoe_line_speed_boosts
 MODIFY multiplier TINYINT UNSIGNED NULL,
 ADD COLUMN download_bps BIGINT UNSIGNED NULL AFTER multiplier,
 ADD COLUMN upload_bps BIGINT UNSIGNED NULL AFTER download_bps;

SHOW COLUMNS FROM pppoe_line_speed_boosts
 WHERE Field IN ('multiplier','download_bps','upload_bps');
