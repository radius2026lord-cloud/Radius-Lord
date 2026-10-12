-- Read-only verification. Run after customer_000003_temporary_profile_boost.sql.
-- Select rl_tenant_zone_000003 in phpMyAdmin before running this file.
SELECT DATABASE() AS selected_database;

SHOW TABLES LIKE 'pppoe_package_speed_boosts';

SELECT COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA='rl_tenant_zone_000003'
  AND TABLE_NAME='pppoe_package_speed_boosts'
ORDER BY ORDINAL_POSITION;

SELECT CONSTRAINT_NAME,TABLE_NAME,REFERENCED_TABLE_NAME
FROM information_schema.REFERENTIAL_CONSTRAINTS
WHERE CONSTRAINT_SCHEMA='rl_tenant_zone_000003'
  AND CONSTRAINT_NAME IN(
    'fk_profile_speed_boost_package',
    'fk_profile_speed_boost_creator'
  )
ORDER BY CONSTRAINT_NAME;

SELECT INDEX_NAME,NON_UNIQUE,COLUMN_NAME
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA='rl_tenant_zone_000003'
  AND TABLE_NAME='pppoe_package_speed_boosts'
  AND INDEX_NAME IN(
    'uq_active_profile_speed_boost',
    'idx_profile_speed_boost_expiry'
  )
ORDER BY INDEX_NAME,SEQ_IN_INDEX;

SELECT COUNT(*) AS invalid_boost_records
FROM rl_tenant_zone_000003.pppoe_package_speed_boosts
WHERE multiplier NOT BETWEEN 1 AND 5
   OR original_download_bps=0
   OR original_upload_bps=0
   OR boosted_download_bps<original_download_bps
   OR boosted_upload_bps<original_upload_bps
   OR expires_at<=started_at
   OR (status='active' AND reverted_at IS NOT NULL)
   OR (status='reverted' AND reverted_at IS NULL);

SELECT COUNT(*) AS active_boost_policy_mismatches
FROM rl_tenant_zone_000003.pppoe_package_speed_boosts b
LEFT JOIN rl_tenant_zone_000003.package_service_policies p
  ON p.package_id=b.package_id
WHERE b.status='active'
  AND (p.package_id IS NULL
       OR p.download_bps<>b.boosted_download_bps
       OR p.upload_bps<>b.boosted_upload_bps);

SELECT COUNT(*) AS expired_boosts_waiting_for_worker
FROM rl_tenant_zone_000003.pppoe_package_speed_boosts
WHERE status='active'
  AND expires_at<=UTC_TIMESTAMP(6);

SELECT b.id,b.package_id,p.name,b.multiplier,b.status,
       b.original_download_bps,b.original_upload_bps,
       b.boosted_download_bps,b.boosted_upload_bps,
       b.started_at,b.expires_at,b.reverted_at
FROM rl_tenant_zone_000003.pppoe_package_speed_boosts b
JOIN rl_tenant_zone_000003.pppoe_packages p ON p.id=b.package_id
ORDER BY b.id DESC
LIMIT 20;
