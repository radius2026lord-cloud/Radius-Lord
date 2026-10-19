-- Per-line temporary PPPoE speed boost, applied to active sessions through RADIUS CoA.
-- Run with rl_tenant_zone_000003 selected in phpMyAdmin.
USE `rl_tenant_zone_000003`;

CREATE TABLE IF NOT EXISTS pppoe_line_speed_boosts (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
 account_id BIGINT UNSIGNED NOT NULL,
 username VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 multiplier TINYINT UNSIGNED NOT NULL,
 original_rate_limit VARCHAR(255) NOT NULL,
 boosted_rate_limit VARCHAR(255) NOT NULL,
 original_user_reply JSON NOT NULL,
 started_at DATETIME(6) NOT NULL,
 expires_at DATETIME(6) NOT NULL,
 status ENUM('active','reverted','cancelled') NOT NULL DEFAULT 'active',
 active_account_id BIGINT UNSIGNED GENERATED ALWAYS AS (CASE WHEN status='active' THEN account_id ELSE NULL END) STORED,
 created_by BIGINT UNSIGNED NOT NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 reverted_at DATETIME(6) NULL,
 PRIMARY KEY(id),
 UNIQUE KEY uq_active_line_speed_boost(active_account_id),
 KEY idx_line_speed_boost_expiry(status,expires_at,id),
 KEY idx_line_speed_boost_username(username,status),
 CONSTRAINT fk_line_speed_boost_account FOREIGN KEY(account_id) REFERENCES pppoe_accounts(id) ON DELETE RESTRICT,
 CONSTRAINT fk_line_speed_boost_creator FOREIGN KEY(created_by) REFERENCES managers(id) ON DELETE RESTRICT,
 CONSTRAINT chk_line_speed_boost_multiplier CHECK(multiplier BETWEEN 2 AND 5),
 CONSTRAINT chk_line_speed_boost_expiry CHECK(expires_at>started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SHOW CREATE TABLE pppoe_line_speed_boosts;
