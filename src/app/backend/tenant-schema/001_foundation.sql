-- Radius Lord tenant database: foundation v1. Target MySQL 8.0.46.
-- NEW, ISOLATED network database only; NEVER apply to lord_radius_core.
-- No CREATE DATABASE, credentials, live data, RADIUS provisioning or activation.
-- DDL commits implicitly. Run the whole file in one session and stop on errors.
-- IF NOT EXISTS supports resuming additions, not upgrading incompatible old tables.
DROP PROCEDURE IF EXISTS rl_tenant_foundation_guard;
DELIMITER $$
CREATE PROCEDURE rl_tenant_foundation_guard()
BEGIN
 IF DATABASE() IS NULL OR DATABASE()='lord_radius_core' THEN
   SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Select a new isolated tenant database, not lord_radius_core';
 END IF;
 IF EXISTS (SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('payment_orders','master_admins','tenant_databases','tenants')) THEN
   SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Central platform tables detected; tenant foundation refused';
 END IF;
 IF EXISTS (SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME NOT IN
   ('time_units','network_settings','network_contact_numbers','platform_subscription','permission_groups','permissions','permission_group_permissions','managers','customers','customer_identity_documents','address_keywords','customer_categories','customer_category_memberships','activity_log')) THEN
   SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Existing unrelated tables found; use a new tenant database';
 END IF;
END$$
DELIMITER ;
CALL rl_tenant_foundation_guard();
DROP PROCEDURE rl_tenant_foundation_guard;

CREATE TABLE IF NOT EXISTS time_units (
  id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  name_ar VARCHAR(50) NOT NULL,
  calculation_kind ENUM('fixed','calendar') NOT NULL,
  seconds_per_unit INT UNSIGNED NULL,
  actual_usage_seconds INT UNSIGNED NOT NULL,
  is_enabled TINYINT(1) NOT NULL DEFAULT 1,
  CONSTRAINT chk_actual_usage_conversion CHECK (actual_usage_seconds>0),
  CONSTRAINT chk_time_conversion CHECK ((calculation_kind='fixed' AND seconds_per_unit IS NOT NULL AND seconds_per_unit>0) OR (calculation_kind='calendar' AND seconds_per_unit IS NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO time_units (code,name_ar,calculation_kind,seconds_per_unit,actual_usage_seconds) VALUES
('minute','دقيقة','fixed',60,60),('hour','ساعة','fixed',3600,3600),
('day','يوم','fixed',86400,86400),('week','أسبوع','fixed',604800,604800),('month','شهر','calendar',NULL,2592000)
ON DUPLICATE KEY UPDATE code=VALUES(code);
-- Calendar month is NOT a fixed 30-day interval.

CREATE TABLE IF NOT EXISTS network_settings (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  network_name VARCHAR(150) NOT NULL,
  description TEXT NULL,
  radius_server_address VARCHAR(255) NULL,
  radius_interim_update_seconds INT UNSIGNED NOT NULL DEFAULT 180,
  timezone VARCHAR(64) NOT NULL COMMENT 'IANA timezone, explicitly selected for this network',
  primary_contact_phone VARCHAR(20) NOT NULL,
  identity_capture_enabled TINYINT(1) NOT NULL DEFAULT 0,
  grace_policy ENUM('package','global') NOT NULL DEFAULT 'package',
  global_grace_days SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_network_singleton CHECK (id=1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS network_contact_numbers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  network_settings_id TINYINT UNSIGNED NOT NULL DEFAULT 1,
  phone VARCHAR(20) NOT NULL,
  label VARCHAR(80) NULL,
  display_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_network_optional_phone (network_settings_id,phone),
  CONSTRAINT fk_contact_network_settings FOREIGN KEY (network_settings_id) REFERENCES network_settings(id) ON DELETE RESTRICT

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS platform_subscription (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  central_tenant_id BIGINT UNSIGNED NOT NULL,
  central_subscription_id BIGINT UNSIGNED NOT NULL,
  license_number VARCHAR(64) NOT NULL,
  license_status ENUM('pending','active','suspended','expired','revoked') NOT NULL DEFAULT 'pending',
  subscription_status ENUM('pending','active','expired','cancelled','suspended') NOT NULL DEFAULT 'pending',
  plan_name_snapshot VARCHAR(150) NOT NULL,
  deployment_code VARCHAR(50) NOT NULL,
  max_pppoe_accounts BIGINT UNSIGNED NOT NULL,
  base_max_nas INT UNSIGNED NOT NULL,
  additional_nas_capacity INT UNSIGNED NOT NULL DEFAULT 0,
  duration_months_snapshot INT UNSIGNED NOT NULL,
  activated_at DATETIME NULL,
  starts_at DATETIME NULL,
  expires_at DATETIME NULL,
  sync_version BIGINT UNSIGNED NOT NULL,
  synced_at DATETIME NOT NULL,
  signed_payload JSON NOT NULL,
  payload_signature TEXT NOT NULL,
  signing_key_id VARCHAR(100) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_local_platform_license (license_number),
  CONSTRAINT chk_platform_singleton CHECK (id=1),
  CONSTRAINT chk_platform_duration CHECK (duration_months_snapshot>0),
  CONSTRAINT chk_platform_sync_version CHECK (sync_version>0),
  CONSTRAINT chk_platform_period CHECK ((starts_at IS NULL AND expires_at IS NULL) OR (starts_at IS NOT NULL AND expires_at IS NOT NULL AND expires_at>starts_at))
-- Central IDs are logical references; no cross-database FOREIGN KEY.
-- 0 base limits mean unlimited. Additional capacity cannot turn unlimited into finite.

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS permission_groups (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT NULL,
  is_enabled TINYINT(1) NOT NULL DEFAULT 1,
  archived_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_permission_group_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS permissions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  name_ar VARCHAR(150) NOT NULL,
  module VARCHAR(50) NOT NULL,
  principal_only TINYINT(1) NOT NULL DEFAULT 0,
  is_enabled TINYINT(1) NOT NULL DEFAULT 1

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS permission_group_permissions (
  permission_group_id BIGINT UNSIGNED NOT NULL,
  permission_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (permission_group_id,permission_id),
  CONSTRAINT fk_group_permission_group FOREIGN KEY (permission_group_id) REFERENCES permission_groups(id) ON DELETE RESTRICT,
  CONSTRAINT fk_group_permission_definition FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE RESTRICT

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS managers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(150) NOT NULL,
  username VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  manager_type ENUM('principal','subordinate') NOT NULL,
  permission_group_id BIGINT UNSIGNED NULL,
  is_enabled TINYINT(1) NOT NULL DEFAULT 1,
  phone VARCHAR(20) NULL,
  notes TEXT NULL,
  created_by_manager_id BIGINT UNSIGNED NULL,
  archived_at DATETIME NULL,
  archived_by_manager_id BIGINT UNSIGNED NULL,
  principal_guard TINYINT UNSIGNED GENERATED ALWAYS AS (CASE WHEN manager_type='principal' THEN 1 ELSE NULL END) STORED,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_manager_username (username),
  UNIQUE KEY uq_single_principal (principal_guard),
  KEY idx_managers_group_status (permission_group_id,is_enabled,archived_at),
  CONSTRAINT chk_manager_group CHECK ((manager_type='principal' AND permission_group_id IS NULL) OR (manager_type='subordinate' AND permission_group_id IS NOT NULL)),
  CONSTRAINT fk_manager_group FOREIGN KEY (permission_group_id) REFERENCES permission_groups(id) ON DELETE RESTRICT,
  CONSTRAINT fk_manager_creator FOREIGN KEY (created_by_manager_id) REFERENCES managers(id) ON DELETE RESTRICT,
  CONSTRAINT fk_manager_archiver FOREIGN KEY (archived_by_manager_id) REFERENCES managers(id) ON DELETE RESTRICT

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS customers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  manager_id BIGINT UNSIGNED NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(40) NULL,
  notes TEXT NULL,
  address TEXT NULL,
  latitude DECIMAL(10,7) NULL,
  longitude DECIMAL(10,7) NULL,
  payment_code VARCHAR(64) NOT NULL,
  created_by_manager_id BIGINT UNSIGNED NOT NULL,
  archived_at DATETIME NULL,
  archived_by_manager_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_customer_payment_code (payment_code),
  UNIQUE KEY uq_customer_id_manager (id,manager_id),
  KEY idx_customer_owner_archive (manager_id,archived_at,id),
  KEY idx_customer_name (last_name,first_name),
  CONSTRAINT chk_customer_first_name CHECK (CHAR_LENGTH(TRIM(first_name))>0),
  CONSTRAINT chk_customer_last_name CHECK (CHAR_LENGTH(TRIM(last_name))>0),
  CONSTRAINT chk_customer_payment_code CHECK (CHAR_LENGTH(TRIM(payment_code))>0),
  CONSTRAINT chk_customer_coordinates CHECK ((latitude IS NULL AND longitude IS NULL) OR (latitude IS NOT NULL AND longitude IS NOT NULL AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)),
  CONSTRAINT fk_customer_manager FOREIGN KEY (manager_id) REFERENCES managers(id) ON DELETE RESTRICT,
  CONSTRAINT fk_customer_creator FOREIGN KEY (created_by_manager_id) REFERENCES managers(id) ON DELETE RESTRICT,
  CONSTRAINT fk_customer_archiver FOREIGN KEY (archived_by_manager_id) REFERENCES managers(id) ON DELETE RESTRICT

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS customer_identity_documents (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  customer_id BIGINT UNSIGNED NOT NULL,
  first_name VARCHAR(100) NULL,
  last_name VARCHAR(100) NULL,
  father_name VARCHAR(100) NULL,
  mother_name VARCHAR(100) NULL,
  birth_date DATE NULL,
  national_number VARCHAR(50) NULL,
  identity_number VARCHAR(50) NULL,
  address TEXT NULL,
  front_image_reference VARCHAR(500) NULL,
  back_image_reference VARCHAR(500) NULL,
  capture_method ENUM('manual','qr') NOT NULL DEFAULT 'manual',
  updated_by_manager_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_customer_one_identity (customer_id),
  UNIQUE KEY uq_identity_number (identity_number),
  CONSTRAINT chk_identity_number CHECK (identity_number IS NULL OR CHAR_LENGTH(TRIM(identity_number))>0),
  CONSTRAINT fk_identity_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
  CONSTRAINT fk_identity_editor FOREIGN KEY (updated_by_manager_id) REFERENCES managers(id) ON DELETE RESTRICT

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS address_keywords (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  keyword VARCHAR(150) NOT NULL UNIQUE,
  is_enabled TINYINT(1) NOT NULL DEFAULT 1,
  created_by_manager_id BIGINT UNSIGNED NOT NULL,
  archived_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_address_keyword_creator FOREIGN KEY (created_by_manager_id) REFERENCES managers(id) ON DELETE RESTRICT
-- Suggestions only; customers.address stays text with no mandatory area_id.

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS customer_categories (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  manager_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT NULL,
  created_by_manager_id BIGINT UNSIGNED NOT NULL,
  archived_at DATETIME NULL,
  archived_by_manager_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_category_owner_name (manager_id,name),
  UNIQUE KEY uq_category_id_manager (id,manager_id),
  KEY idx_category_owner_archive (manager_id,archived_at,id),
  CONSTRAINT fk_category_owner FOREIGN KEY (manager_id) REFERENCES managers(id) ON DELETE RESTRICT,
  CONSTRAINT fk_category_creator FOREIGN KEY (created_by_manager_id) REFERENCES managers(id) ON DELETE RESTRICT,
  CONSTRAINT fk_category_archiver FOREIGN KEY (archived_by_manager_id) REFERENCES managers(id) ON DELETE RESTRICT

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS customer_category_memberships (
  customer_id BIGINT UNSIGNED NOT NULL,
  category_id BIGINT UNSIGNED NOT NULL,
  manager_id BIGINT UNSIGNED NOT NULL,
  assigned_by_manager_id BIGINT UNSIGNED NOT NULL,
  assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (customer_id,category_id),
  CONSTRAINT fk_membership_customer_owner FOREIGN KEY (customer_id,manager_id) REFERENCES customers(id,manager_id) ON DELETE RESTRICT,
  CONSTRAINT fk_membership_category_owner FOREIGN KEY (category_id,manager_id) REFERENCES customer_categories(id,manager_id) ON DELETE RESTRICT,
  CONSTRAINT fk_membership_actor FOREIGN KEY (assigned_by_manager_id) REFERENCES managers(id) ON DELETE RESTRICT

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS activity_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  actor_manager_id BIGINT UNSIGNED NULL,
  actor_snapshot JSON NULL,
  actor_kind ENUM('manager','system') NOT NULL,
  action_code VARCHAR(100) NOT NULL,
  target_type VARCHAR(100) NOT NULL,
  target_id BIGINT UNSIGNED NULL,
  customer_id BIGINT UNSIGNED NULL,
  account_id BIGINT UNSIGNED NULL COMMENT 'Logical reference; account registry defined in next stage',
  before_data JSON NULL,
  after_data JSON NULL,
  result ENUM('success','failed') NOT NULL,
  failure_code VARCHAR(100) NULL,
  failure_reason TEXT NULL,
  request_id VARCHAR(100) NULL,
  operation_id VARCHAR(100) NULL,
  occurred_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  KEY idx_activity_customer_time (customer_id,occurred_at,id),
  KEY idx_activity_actor_time (actor_manager_id,occurred_at,id),
  KEY idx_activity_target_time (target_type,target_id,occurred_at,id),
  KEY idx_activity_operation (operation_id,id),
  CONSTRAINT fk_activity_actor FOREIGN KEY (actor_manager_id) REFERENCES managers(id) ON DELETE RESTRICT,
  CONSTRAINT fk_activity_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT
-- Append-only by application/DB grants, not enforced merely by table definition.
-- Never include passwords, tunnel secrets, identity images or sensitive identity data.

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO permissions (code,name_ar,module,principal_only) VALUES
('customers.view','عرض العملاء','customers',0),
('customers.create','إضافة عميل','customers',0),
('customers.update','تعديل العميل','customers',0),
('customers.archive','أرشفة العميل','customers',0),
('customers.export','تصدير العملاء','customers',0),
('customers.transfer','نقل تبعية العميل','customers',1),
('identity.view','عرض بيانات الهوية','identity',0),
('identity.update','تعديل بيانات الهوية','identity',0),
('identity.images.view','عرض صور الهوية','identity',0),
('identity.images.download','تنزيل صور الهوية','identity',0),
('categories.view','عرض التصنيفات','categories',0),
('categories.create','إضافة تصنيف','categories',0),
('categories.update','تعديل التصنيف','categories',0),
('categories.archive','أرشفة التصنيف','categories',0),
('activity.view','عرض سجل النشاط','activity',0),
('managers.manage','إدارة المدراء','managers',1),
('permission_groups.manage','إدارة مجموعات الصلاحيات','permissions',1)
ON DUPLICATE KEY UPDATE code=VALUES(code);

-- No default manager/password, sample customer, activated license or speculative group grants.
SELECT 'tenant_foundation_schema_created_not_provisioned' AS result;
