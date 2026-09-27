-- Radius Lord: simplify deployment pricing and add optional plan add-ons
-- Run after 20260927_plan_deployment_architecture.sql.

CREATE TABLE IF NOT EXISTS plan_addons (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  plan_id BIGINT UNSIGNED NOT NULL,
  deployment_type_id BIGINT UNSIGNED NOT NULL,
  code VARCHAR(60) NOT NULL,
  name_ar VARCHAR(150) NOT NULL,
  name_en VARCHAR(150) NOT NULL,
  description TEXT NULL,
  price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_plan_addon (plan_id,deployment_type_id,code),
  KEY idx_plan_addon_deployment_type (deployment_type_id),
  CONSTRAINT fk_plan_addon_plan FOREIGN KEY (plan_id) REFERENCES payment_plans(id) ON DELETE CASCADE,
  CONSTRAINT fk_plan_addon_deployment_type FOREIGN KEY (deployment_type_id) REFERENCES deployment_types(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @has_setup_fee := (
 SELECT COUNT(*) FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='plan_deployment_options' AND COLUMN_NAME='setup_fee'
);
SET @sql := IF(@has_setup_fee=1,'ALTER TABLE plan_deployment_options DROP COLUMN setup_fee','SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
