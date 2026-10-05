-- Apply to db-core before using the NAS / OpenVPN settings tab.
CREATE TABLE IF NOT EXISTS ovpn_gateways (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 settings_json LONGTEXT NOT NULL,
 api_password_encrypted TEXT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_by_master_admin_id BIGINT UNSIGNED NULL,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT INTO audit_entity_types (code,name_ar,name_en,description,is_active)
VALUES ('PLATFORM_SETTINGS','إعدادات المنصة','Platform Settings','إعدادات منصة Radius Lord',1)
ON DUPLICATE KEY UPDATE is_active=1;
