-- Read-only verification. Run after profile reference migration.
SELECT DATABASE() AS selected_database;
SELECT id,code,bps_factor FROM rl_tenant_zone_000003.speed_units ORDER BY id;
SELECT id,code,bytes_factor FROM rl_tenant_zone_000003.data_units ORDER BY id;
SELECT id,code,name_ar,calculation_kind,seconds_per_unit,actual_usage_seconds FROM rl_tenant_zone_000003.time_units ORDER BY id;
SELECT id,code,decimal_places,is_enabled FROM rl_tenant_zone_000003.currencies ORDER BY id;
SELECT COUNT(*) AS invalid_currency_links
FROM rl_tenant_zone_000003.pppoe_packages p LEFT JOIN rl_tenant_zone_000003.currencies c ON c.id=p.currency_id
WHERE c.id IS NULL OR CONVERT(c.code USING utf8mb4) COLLATE utf8mb4_unicode_ci<>CONVERT(p.currency_code USING utf8mb4) COLLATE utf8mb4_unicode_ci;
SELECT COUNT(*) AS invalid_speed_unit_links
FROM rl_tenant_zone_000003.package_service_policies p
LEFT JOIN rl_tenant_zone_000003.speed_units d ON d.id=p.download_unit_id
LEFT JOIN rl_tenant_zone_000003.speed_units u ON u.id=p.upload_unit_id
WHERE d.id IS NULL OR u.id IS NULL;
SELECT COUNT(*) AS invalid_free_profiles FROM rl_tenant_zone_000003.pppoe_packages
WHERE package_type='free' AND (base_price<>0 OR offer_price IS NOT NULL OR offer_ends_at IS NOT NULL OR is_gift<>0 OR daily_package_id IS NOT NULL);
SELECT COUNT(*) AS invalid_daily_links
FROM rl_tenant_zone_000003.pppoe_packages p LEFT JOIN rl_tenant_zone_000003.pppoe_packages d ON d.id=p.daily_package_id
WHERE p.daily_package_id IS NOT NULL AND (p.package_type<>'prepaid' OR d.id IS NULL OR d.package_type<>'daily' OR d.owner_manager_id<>p.owner_manager_id);
SELECT CONSTRAINT_NAME,TABLE_NAME,REFERENCED_TABLE_NAME
FROM information_schema.REFERENTIAL_CONSTRAINTS
WHERE CONSTRAINT_SCHEMA='rl_tenant_zone_000003' AND CONSTRAINT_NAME IN('fk_ppp_currency_reference','fk_network_currency_reference','fk_ppp_download_unit','fk_ppp_upload_unit','fk_ppp_quota_unit','fk_ppp_reduced_download_unit','fk_ppp_reduced_upload_unit') ORDER BY CONSTRAINT_NAME;
