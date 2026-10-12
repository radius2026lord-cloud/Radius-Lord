-- Adds exact local expiry time for fixed-day PPPoE profile policies.
-- Apply to this tenant database once; existing fixed-day profiles keep midnight.
USE `rl_tenant_zone_000003`;
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET @rl_profile_expiry_time_exists = (
 SELECT COUNT(*) FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA=DATABASE()
   AND TABLE_NAME='package_service_policies'
   AND COLUMN_NAME='expiry_time'
);
SET @rl_profile_expiry_time_sql = IF(
 @rl_profile_expiry_time_exists=0,
 'ALTER TABLE package_service_policies ADD COLUMN expiry_time TIME NULL DEFAULT NULL AFTER expiry_day',
 'SELECT 1'
);
PREPARE rl_profile_expiry_time_stmt FROM @rl_profile_expiry_time_sql;
EXECUTE rl_profile_expiry_time_stmt;
DEALLOCATE PREPARE rl_profile_expiry_time_stmt;
UPDATE package_service_policies
SET expiry_time='00:00:00'
WHERE validity_mode='fixed_day' AND expiry_time IS NULL;
