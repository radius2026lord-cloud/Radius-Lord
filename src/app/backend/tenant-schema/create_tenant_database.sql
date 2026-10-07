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


-- SECTION 1: Network, subscription, managers and customers.
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
  account_id BIGINT UNSIGNED NULL COMMENT 'Stable radius_identities.id across PPPoE and hotspot',
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
-- Foundation section finished; service tables follow.

-- SECTION 2: Official FreeRADIUS SQL schema (verbatim).
###########################################################################
# $Id$                 #
#                                                                         #
#  schema.sql                       rlm_sql - FreeRADIUS SQL Module       #
#                                                                         #
#     Database schema for MySQL rlm_sql module                            #
#                                                                         #
#     To load:                                                            #
#         mysql -uroot -prootpass radius < schema.sql                     #
#                                                                         #
#                                   Mike Machado <mike@innercite.com>     #
###########################################################################
#
# Table structure for table 'radacct'
#

CREATE TABLE IF NOT EXISTS radacct (
  radacctid bigint(21) NOT NULL auto_increment,
  acctsessionid varchar(64) NOT NULL default '',
  acctuniqueid varchar(32) NOT NULL default '',
  username varchar(64) NOT NULL default '',
  realm varchar(64) default '',
  nasipaddress varchar(15) NOT NULL default '',
  nasportid varchar(32) default NULL,
  nasporttype varchar(32) default NULL,
  acctstarttime datetime NULL default NULL,
  acctupdatetime datetime NULL default NULL,
  acctstoptime datetime NULL default NULL,
  acctinterval int(12) default NULL,
  acctsessiontime int(12) unsigned default NULL,
  acctauthentic varchar(32) default NULL,
  connectinfo_start varchar(128) default NULL,
  connectinfo_stop varchar(128) default NULL,
  acctinputoctets bigint(20) default NULL,
  acctoutputoctets bigint(20) default NULL,
  calledstationid varchar(50) NOT NULL default '',
  callingstationid varchar(50) NOT NULL default '',
  acctterminatecause varchar(32) NOT NULL default '',
  servicetype varchar(32) default NULL,
  framedprotocol varchar(32) default NULL,
  framedipaddress varchar(15) NOT NULL default '',
  framedipv6address varchar(45) NOT NULL default '',
  framedipv6prefix varchar(45) NOT NULL default '',
  framedinterfaceid varchar(44) NOT NULL default '',
  delegatedipv6prefix varchar(45) NOT NULL default '',
  class varchar(64) default NULL,
  PRIMARY KEY (radacctid),
  UNIQUE KEY acctuniqueid (acctuniqueid),
  KEY username (username),
  KEY framedipaddress (framedipaddress),
  KEY framedipv6address (framedipv6address),
  KEY framedipv6prefix (framedipv6prefix),
  KEY framedinterfaceid (framedinterfaceid),
  KEY delegatedipv6prefix (delegatedipv6prefix),
  KEY acctsessionid (acctsessionid),
  KEY acctsessiontime (acctsessiontime),
  KEY acctstarttime (acctstarttime),
  KEY acctinterval (acctinterval),
  KEY acctstoptime (acctstoptime),
  KEY nasipaddress (nasipaddress),
  KEY class (class)
) ENGINE = INNODB;

#
# Table structure for table 'radcheck'
#

CREATE TABLE IF NOT EXISTS radcheck (
  id int(11) unsigned NOT NULL auto_increment,
  username varchar(64) NOT NULL default '',
  attribute varchar(64)  NOT NULL default '',
  op char(2) NOT NULL DEFAULT '==',
  value varchar(253) NOT NULL default '',
  PRIMARY KEY  (id),
  KEY username (username(32))
);

#
# Table structure for table 'radgroupcheck'
#

CREATE TABLE IF NOT EXISTS radgroupcheck (
  id int(11) unsigned NOT NULL auto_increment,
  groupname varchar(64) NOT NULL default '',
  attribute varchar(64)  NOT NULL default '',
  op char(2) NOT NULL DEFAULT '==',
  value varchar(253)  NOT NULL default '',
  PRIMARY KEY  (id),
  KEY groupname (groupname(32))
);

#
# Table structure for table 'radgroupreply'
#

CREATE TABLE IF NOT EXISTS radgroupreply (
  id int(11) unsigned NOT NULL auto_increment,
  groupname varchar(64) NOT NULL default '',
  attribute varchar(64)  NOT NULL default '',
  op char(2) NOT NULL DEFAULT '=',
  value varchar(253)  NOT NULL default '',
  PRIMARY KEY  (id),
  KEY groupname (groupname(32))
);

#
# Table structure for table 'radreply'
#

CREATE TABLE IF NOT EXISTS radreply (
  id int(11) unsigned NOT NULL auto_increment,
  username varchar(64) NOT NULL default '',
  attribute varchar(64) NOT NULL default '',
  op char(2) NOT NULL DEFAULT '=',
  value varchar(253) NOT NULL default '',
  PRIMARY KEY  (id),
  KEY username (username(32))
);


#
# Table structure for table 'radusergroup'
#

CREATE TABLE IF NOT EXISTS radusergroup (
  id int(11) unsigned NOT NULL auto_increment,
  username varchar(64) NOT NULL default '',
  groupname varchar(64) NOT NULL default '',
  priority int(11) NOT NULL default '1',
  PRIMARY KEY  (id),
  KEY username (username(32))
);

#
# Table structure for table 'radpostauth'
#
# Note: MySQL versions since 5.6.4 support fractional precision timestamps
#        which we use here. Replace the authdate definition with the following
#        if your software is too old:
#
#   authdate timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
#
CREATE TABLE IF NOT EXISTS radpostauth (
  id int(11) NOT NULL auto_increment,
  username varchar(64) NOT NULL default '',
  pass varchar(64) NOT NULL default '',
  reply varchar(32) NOT NULL default '',
  authdate timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  class varchar(64) default NULL,
  PRIMARY KEY  (id),
  KEY username (username),
  KEY class (class)
) ENGINE = INNODB;

#
# Table structure for table 'nas'
#
CREATE TABLE IF NOT EXISTS nas (
  id int(10) NOT NULL auto_increment,
  nasname varchar(128) NOT NULL,
  shortname varchar(32),
  type varchar(30) DEFAULT 'other',
  ports int(5),
  secret varchar(60) DEFAULT 'secret' NOT NULL,
  server varchar(64),
  community varchar(50),
  description varchar(200) DEFAULT 'RADIUS Client',
  PRIMARY KEY (id),
  KEY nasname (nasname)
) ENGINE = INNODB;

#
# Table structure for table 'nasreload'
#
CREATE TABLE IF NOT EXISTS nasreload (
  nasipaddress varchar(15) NOT NULL,
  reloadtime datetime NOT NULL,
  PRIMARY KEY (nasipaddress)
) ENGINE = INNODB;

-- SECTION 3: PPPoE, hotspot, NAS and OpenVPN.
-- Tenant service tables consolidated from approved 2026-10-02/04 references.
-- Apply only through create_tenant_database.sql on an EMPTY isolated database.
-- References to managers use the latest permission-group design.

CREATE TABLE radius_identities (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
 service_kind ENUM('pppoe','hotspot') NOT NULL,
 current_username VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 PRIMARY KEY(id),
 UNIQUE KEY uq_identity_kind(id,service_kind),
 UNIQUE KEY uq_current_username(current_username),
 CONSTRAINT chk_current_username CHECK(current_username IS NULL OR (CHAR_LENGTH(current_username)>0 AND BINARY current_username=BINARY LOWER(current_username)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE radius_username_reservations (
 username VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 radius_identity_id BIGINT UNSIGNED NOT NULL,
 reserved_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 last_retired_at DATETIME(6) NULL,
 PRIMARY KEY(username),
 UNIQUE KEY uq_username_owner(radius_identity_id,username),
 CONSTRAINT fk_reserved_identity FOREIGN KEY(radius_identity_id) REFERENCES radius_identities(id),
 CONSTRAINT chk_reserved_name CHECK(CHAR_LENGTH(username)>0 AND BINARY username=BINARY LOWER(username))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE radius_identities ADD CONSTRAINT fk_identity_current_name FOREIGN KEY(id,current_username) REFERENCES radius_username_reservations(radius_identity_id,username);

CREATE TABLE username_change_history (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
 radius_identity_id BIGINT UNSIGNED NOT NULL,
 old_username VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 new_username VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 changed_by BIGINT UNSIGNED NOT NULL,
 changed_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 PRIMARY KEY(id),
 CONSTRAINT fk_name_history_identity FOREIGN KEY(radius_identity_id) REFERENCES radius_identities(id),
 CONSTRAINT fk_name_history_old FOREIGN KEY(radius_identity_id,old_username) REFERENCES radius_username_reservations(radius_identity_id,username),
 CONSTRAINT fk_name_history_new FOREIGN KEY(radius_identity_id,new_username) REFERENCES radius_username_reservations(radius_identity_id,username),
 CONSTRAINT fk_name_history_actor FOREIGN KEY(changed_by) REFERENCES managers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE service_types (
 id TINYINT UNSIGNED NOT NULL,
 code VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 name VARCHAR(80) NOT NULL,
 is_enabled TINYINT UNSIGNED NOT NULL DEFAULT 1,
 PRIMARY KEY(id),
 UNIQUE KEY uq_service_code(code),
 CONSTRAINT chk_service_enabled CHECK(is_enabled IN(0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE connection_methods (
 id TINYINT UNSIGNED NOT NULL,
 service_type_id TINYINT UNSIGNED NOT NULL,
 code VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 name VARCHAR(80) NOT NULL,
 PRIMARY KEY(id),
 UNIQUE KEY uq_connection_code(code),
 UNIQUE KEY uq_method_service(id,service_type_id),
 CONSTRAINT fk_method_service FOREIGN KEY(service_type_id) REFERENCES service_types(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO service_types(id,code,name) VALUES(1,'ftth','FTTH'),(2,'adsl','ADSL'),(3,'wifi_outdoor','WiFi Outdoor');
INSERT INTO connection_methods(id,service_type_id,code,name) VALUES(1,3,'distribution_box','علبة توزيع'),(2,3,'station','Station');

CREATE TABLE lord_nas (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
 radius_nas_id INT NOT NULL,
 name VARCHAR(150) NOT NULL,
 vendor ENUM('mikrotik','ubiquiti','cisco','other') NOT NULL DEFAULT 'mikrotik',
 model VARCHAR(100) NULL,
 radius_services SET('ppp','hotspot') NOT NULL,
 routeros_version VARCHAR(40) NULL,
 coa_host VARCHAR(255) NOT NULL,
 management_host VARCHAR(255) NOT NULL,
 auth_port SMALLINT UNSIGNED NOT NULL DEFAULT 1812,
 acct_port SMALLINT UNSIGNED NOT NULL DEFAULT 1813,
 coa_port SMALLINT UNSIGNED NOT NULL,
 is_enabled TINYINT UNSIGNED NOT NULL DEFAULT 1,
 activity_status ENUM('recent','stale','unknown') NOT NULL DEFAULT 'unknown',
 last_seen_at DATETIME(6) NULL,
 location VARCHAR(150) NULL,
 description TEXT NULL,
 created_by BIGINT UNSIGNED NOT NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
 archived_at DATETIME(6) NULL,
 archived_by BIGINT UNSIGNED NULL,
 PRIMARY KEY(id),
 UNIQUE KEY uq_lord_radius_nas(radius_nas_id),
 CONSTRAINT fk_lord_nas_radius FOREIGN KEY(radius_nas_id) REFERENCES nas(id),
 CONSTRAINT fk_nas_creator FOREIGN KEY(created_by) REFERENCES managers(id),
 CONSTRAINT fk_nas_archiver FOREIGN KEY(archived_by) REFERENCES managers(id),
 CONSTRAINT chk_nas_settings CHECK(auth_port>0 AND acct_port>0 AND coa_port>0 AND is_enabled IN(0,1) AND CHAR_LENGTH(radius_services)>0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE nas_management_credentials (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
 lord_nas_id BIGINT UNSIGNED NOT NULL,
 username VARCHAR(100) NOT NULL,
 password_encrypted TEXT NOT NULL,
 encryption_key_id VARCHAR(100) NOT NULL,
 updated_by BIGINT UNSIGNED NOT NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
 PRIMARY KEY(id),
 UNIQUE KEY uq_nas_credential(lord_nas_id),
 CONSTRAINT fk_credential_nas FOREIGN KEY(lord_nas_id) REFERENCES lord_nas(id),
 CONSTRAINT fk_credential_actor FOREIGN KEY(updated_by) REFERENCES managers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE nas_management_services (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
 lord_nas_id BIGINT UNSIGNED NOT NULL,
 service_type ENUM('api','api_tls','winbox','webconfig','ssh','custom') NOT NULL,
 name VARCHAR(100) NOT NULL,
 host VARCHAR(255) NULL,
 port SMALLINT UNSIGNED NOT NULL,
 external_host VARCHAR(255) NULL,
 external_port SMALLINT UNSIGNED NULL,
 protocol ENUM('tcp','udp') NOT NULL DEFAULT 'tcp',
 scheme ENUM('http','https') NULL,
 is_enabled TINYINT UNSIGNED NOT NULL DEFAULT 1,
 description TEXT NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
 PRIMARY KEY(id),
 CONSTRAINT fk_management_service_nas FOREIGN KEY(lord_nas_id) REFERENCES lord_nas(id),
 CONSTRAINT chk_endpoint CHECK(port>0 AND (external_port IS NULL OR external_port>0) AND is_enabled IN(0,1) AND ((external_host IS NULL AND external_port IS NULL) OR (external_host IS NOT NULL AND external_port IS NOT NULL)) AND (scheme IS NULL OR protocol='tcp'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE pppoe_accounts (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
 customer_id BIGINT UNSIGNED NOT NULL,
 radius_identity_id BIGINT UNSIGNED NOT NULL,
 identity_kind ENUM('pppoe','hotspot') NOT NULL DEFAULT 'pppoe',
 line_name VARCHAR(150) NULL,
 admin_status ENUM('enabled','disabled') NOT NULL DEFAULT 'enabled',
 address TEXT NULL,
 latitude DECIMAL(10,7) NULL,
 longitude DECIMAL(10,7) NULL,
 service_type_id TINYINT UNSIGNED NULL,
 connection_method_id TINYINT UNSIGNED NULL,
 allowed_nas_id INT NULL,
 created_by BIGINT UNSIGNED NOT NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
 archived_at DATETIME(6) NULL,
 archived_by BIGINT UNSIGNED NULL,
 PRIMARY KEY(id),
 UNIQUE KEY uq_ppp_identity(radius_identity_id),
 KEY idx_ppp_customer_archive(customer_id,archived_at),
 CONSTRAINT fk_ppp_customer FOREIGN KEY(customer_id) REFERENCES customers(id),
 CONSTRAINT fk_ppp_radius_identity FOREIGN KEY(radius_identity_id,identity_kind) REFERENCES radius_identities(id,service_kind),
 CONSTRAINT fk_ppp_service FOREIGN KEY(service_type_id) REFERENCES service_types(id),
 CONSTRAINT fk_ppp_connection FOREIGN KEY(connection_method_id,service_type_id) REFERENCES connection_methods(id,service_type_id),
 CONSTRAINT fk_ppp_nas FOREIGN KEY(allowed_nas_id) REFERENCES nas(id),
 CONSTRAINT fk_ppp_creator FOREIGN KEY(created_by) REFERENCES managers(id),
 CONSTRAINT fk_ppp_archiver FOREIGN KEY(archived_by) REFERENCES managers(id),
 CONSTRAINT chk_ppp_kind CHECK(identity_kind='pppoe'),
 CONSTRAINT chk_ppp_location CHECK((latitude IS NULL AND longitude IS NULL) OR (latitude IS NOT NULL AND longitude IS NOT NULL AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)),
 CONSTRAINT chk_ppp_connection CHECK((service_type_id IS NULL AND connection_method_id IS NULL) OR (service_type_id IS NOT NULL AND service_type_id<>3 AND connection_method_id IS NULL) OR (service_type_id IS NOT NULL AND service_type_id=3 AND connection_method_id IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE pppoe_packages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  description TEXT NULL,
  owner_manager_id BIGINT UNSIGNED NOT NULL,
  package_type ENUM('prepaid','daily','addon') NOT NULL DEFAULT 'prepaid',
  is_enabled TINYINT UNSIGNED NOT NULL DEFAULT 1,
  base_price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  offer_price DECIMAL(12,2) NULL,
  offer_ends_at DATETIME(6) NULL COMMENT 'Exclusive UTC boundary; offer valid only before this instant',
  is_gift TINYINT UNSIGNED NOT NULL DEFAULT 0,
  currency_code VARCHAR(10) NOT NULL,
  daily_package_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  archived_at DATETIME(6) NULL,
  archived_by BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_ppp_package_owner FOREIGN KEY(owner_manager_id) REFERENCES managers(id),
  CONSTRAINT fk_ppp_package_archiver FOREIGN KEY(archived_by) REFERENCES managers(id),
  KEY idx_pppoe_packages_type_enabled (package_type,is_enabled),
  KEY idx_pppoe_packages_daily (daily_package_id),
  KEY idx_pppoe_packages_owner (owner_manager_id),
  CONSTRAINT fk_pppoe_packages_daily FOREIGN KEY (daily_package_id)
    REFERENCES pppoe_packages(id),
  CONSTRAINT chk_pppoe_package_price CHECK (base_price >= 0),
  CONSTRAINT chk_pppoe_package_gift CHECK (is_gift IN (0,1)),
  CONSTRAINT chk_pppoe_package_offer CHECK (
    (offer_price IS NULL AND offer_ends_at IS NULL) OR
    (offer_price IS NOT NULL AND offer_ends_at IS NOT NULL
      AND offer_price >= 0 AND offer_price <= base_price)
  ),
  CONSTRAINT chk_pppoe_package_enabled CHECK (is_enabled IN (0,1)),
  CONSTRAINT chk_pppoe_daily_link_owner CHECK (daily_package_id IS NULL OR package_type = 'prepaid')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE package_service_policies (
  package_id BIGINT UNSIGNED NOT NULL,
  download_bps BIGINT UNSIGNED NOT NULL,
  upload_bps BIGINT UNSIGNED NOT NULL,
  quota_bytes BIGINT UNSIGNED NULL COMMENT 'NULL = unlimited; otherwise positive bytes',
  simultaneous_sessions SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  validity_mode ENUM('duration','fixed_day','calendar_monthly') NOT NULL DEFAULT 'duration',
  duration_value INT UNSIGNED NULL,
  duration_unit_id SMALLINT UNSIGNED NULL,
  expiry_day TINYINT UNSIGNED NULL,
  starts_at ENUM('activation','first_connection') NULL,
  grace_days SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  quota_exhaustion_action ENUM('stop','reduce_speed') NOT NULL DEFAULT 'stop',
  reduced_download_bps BIGINT UNSIGNED NULL,
  reduced_upload_bps BIGINT UNSIGNED NULL,
  quota_renewal_policy ENUM('reset','carry_over') NOT NULL DEFAULT 'reset',
  PRIMARY KEY (package_id),
  CONSTRAINT fk_ppp_policy_unit FOREIGN KEY(duration_unit_id) REFERENCES time_units(id),
  CONSTRAINT fk_package_service_package FOREIGN KEY (package_id)
    REFERENCES pppoe_packages(id),
  CONSTRAINT chk_pppoe_speeds CHECK (download_bps > 0 AND upload_bps > 0),
  CONSTRAINT chk_pppoe_quota CHECK (quota_bytes IS NULL OR quota_bytes > 0),
  CONSTRAINT chk_pppoe_sessions CHECK (simultaneous_sessions >= 1),
  CONSTRAINT chk_pppoe_validity CHECK (
    (validity_mode = 'calendar_monthly' AND duration_value IS NULL
      AND duration_unit_id IS NULL AND expiry_day IS NULL AND starts_at IS NULL)
    OR
    (validity_mode = 'duration' AND duration_value IS NOT NULL AND duration_value > 0
      AND duration_unit_id IS NOT NULL AND expiry_day IS NULL AND starts_at IS NOT NULL)
    OR
    (validity_mode = 'fixed_day' AND duration_value IS NOT NULL AND duration_value > 0
      AND duration_unit_id IS NOT NULL AND expiry_day IS NOT NULL
      AND expiry_day BETWEEN 1 AND 31 AND starts_at IS NOT NULL)
  ),
  CONSTRAINT chk_pppoe_exhaustion CHECK (
    (quota_exhaustion_action = 'stop' AND reduced_download_bps IS NULL AND reduced_upload_bps IS NULL)
    OR
    (quota_exhaustion_action = 'reduce_speed' AND quota_bytes IS NOT NULL
      AND reduced_download_bps IS NOT NULL AND reduced_upload_bps IS NOT NULL
      AND reduced_download_bps > 0 AND reduced_upload_bps > 0
      AND reduced_download_bps <= download_bps AND reduced_upload_bps <= upload_bps)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE package_radius_defaults (
  package_id BIGINT UNSIGNED NOT NULL,
  mikrotik_group VARCHAR(150) NULL COMMENT 'Existing PPP profile on NAS',
  framed_pool VARCHAR(150) NULL COMMENT 'Existing IP pool on NAS',
  PRIMARY KEY (package_id),
  CONSTRAINT fk_package_radius_package FOREIGN KEY (package_id)
    REFERENCES pppoe_packages(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE pppoe_package_versions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  package_id BIGINT UNSIGNED NOT NULL,
  version_no INT UNSIGNED NOT NULL,
  radius_group_name VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  service_snapshot JSON NOT NULL,
  radius_snapshot JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pppoe_package_version (package_id,version_no),
  UNIQUE KEY uq_pppoe_radius_group (radius_group_name),
  CONSTRAINT fk_pppoe_version_package FOREIGN KEY (package_id)
    REFERENCES pppoe_packages(id),
  CONSTRAINT chk_pppoe_version_number CHECK (version_no >= 1),
  CONSTRAINT chk_pppoe_service_snapshot CHECK (JSON_TYPE(service_snapshot) = 'OBJECT'),
  CONSTRAINT chk_pppoe_radius_snapshot CHECK (JSON_TYPE(radius_snapshot) = 'OBJECT')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE pppoe_subscriptions (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
 account_id BIGINT UNSIGNED NOT NULL,
 package_version_id BIGINT UNSIGNED NOT NULL,
 service_role ENUM('base','daily','addon') NOT NULL DEFAULT 'base',
 parent_subscription_id BIGINT UNSIGNED NULL,
 created_by BIGINT UNSIGNED NOT NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 activated_at DATETIME(6) NULL,
 expires_at DATETIME(6) NULL,
 ended_at DATETIME(6) NULL,
 event_type ENUM('activation','renewal','package_change','daily_fallback','addon') NOT NULL,
 previous_subscription_id BIGINT UNSIGNED NULL,
 renewal_mode ENUM('normal','fixed_due','full_month') NOT NULL DEFAULT 'normal',
 base_price_snapshot DECIMAL(12,2) NOT NULL,
 offer_price_snapshot DECIMAL(12,2) NULL,
 offer_ends_at_snapshot DATETIME(6) NULL,
 effective_price_snapshot DECIMAL(12,2) NOT NULL,
 currency_code VARCHAR(10) NOT NULL,
 is_gift_snapshot TINYINT UNSIGNED NOT NULL,
 grace_source_snapshot ENUM('global','package') NOT NULL,
 grace_days_snapshot SMALLINT UNSIGNED NOT NULL DEFAULT 0,
 grace_expires_at DATETIME(6) NULL,
 effective_service_snapshot JSON NOT NULL,
 quota_allowance_bytes BIGINT UNSIGNED NULL,
 carried_quota_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
 lifecycle ENUM('pending','active','ended','cancelled') NOT NULL DEFAULT 'pending',
 live_role VARCHAR(10) GENERATED ALWAYS AS (CASE WHEN lifecycle IN ('pending','active') THEN service_role ELSE NULL END) STORED,
 daily_parent_id BIGINT UNSIGNED GENERATED ALWAYS AS (CASE WHEN service_role='daily' THEN parent_subscription_id ELSE NULL END) STORED,
 PRIMARY KEY(id),
 UNIQUE KEY uq_live_ppp_role(account_id,live_role),
 UNIQUE KEY uq_ppp_daily_once(daily_parent_id),
 UNIQUE KEY uq_ppp_subscription_account(id,account_id),
 KEY idx_ppp_subscription_account(account_id,lifecycle),
 CONSTRAINT fk_ppp_subscription_account FOREIGN KEY(account_id) REFERENCES pppoe_accounts(id),
 CONSTRAINT fk_ppp_subscription_version FOREIGN KEY(package_version_id) REFERENCES pppoe_package_versions(id),
 CONSTRAINT fk_ppp_subscription_parent FOREIGN KEY(parent_subscription_id,account_id) REFERENCES pppoe_subscriptions(id,account_id),
 CONSTRAINT fk_ppp_subscription_previous FOREIGN KEY(previous_subscription_id,account_id) REFERENCES pppoe_subscriptions(id,account_id),
 CONSTRAINT chk_ppp_subscription_money CHECK(base_price_snapshot>=0 AND effective_price_snapshot>=0 AND is_gift_snapshot IN(0,1) AND (is_gift_snapshot=0 OR effective_price_snapshot=0) AND ((offer_price_snapshot IS NULL AND offer_ends_at_snapshot IS NULL) OR (offer_price_snapshot IS NOT NULL AND offer_price_snapshot>=0 AND offer_price_snapshot<=base_price_snapshot AND offer_ends_at_snapshot IS NOT NULL))),
 CONSTRAINT chk_ppp_subscription_snapshot CHECK(JSON_TYPE(effective_service_snapshot)='OBJECT'),
 CONSTRAINT chk_ppp_subscription_quota CHECK(quota_allowance_bytes IS NULL OR quota_allowance_bytes>0),
 CONSTRAINT chk_ppp_subscription_times CHECK((activated_at IS NULL AND expires_at IS NULL) OR (activated_at IS NOT NULL AND expires_at IS NOT NULL AND expires_at>activated_at)),
 CONSTRAINT chk_ppp_subscription_parent CHECK((service_role='base' AND parent_subscription_id IS NULL) OR (service_role<>'base' AND parent_subscription_id IS NOT NULL)),
 CONSTRAINT fk_ppp_subscription_creator FOREIGN KEY(created_by) REFERENCES managers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE hotspot_packages (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
 name VARCHAR(150) NOT NULL,
 description TEXT NULL,
 owner_manager_id BIGINT UNSIGNED NOT NULL,
 is_enabled TINYINT UNSIGNED NOT NULL DEFAULT 1,
 base_price DECIMAL(12,2) NOT NULL,
 currency_code VARCHAR(10) NOT NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
 archived_at DATETIME(6) NULL,
 archived_by BIGINT UNSIGNED NULL,
 PRIMARY KEY(id),
 CONSTRAINT fk_hs_package_archiver FOREIGN KEY(archived_by) REFERENCES managers(id),
 CONSTRAINT fk_hotspot_packages_owner FOREIGN KEY(owner_manager_id) REFERENCES managers(id),
 KEY idx_hs_package_owner(owner_manager_id),
 CONSTRAINT chk_hs_package CHECK (is_enabled IN (0,1) AND base_price>=0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE hotspot_package_versions (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
 package_id BIGINT UNSIGNED NOT NULL,
 version_no INT UNSIGNED NOT NULL,
 radius_group_name VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 download_bps BIGINT UNSIGNED NOT NULL,
 upload_bps BIGINT UNSIGNED NOT NULL,
 quota_bytes BIGINT UNSIGNED NULL,
 duration_value INT UNSIGNED NOT NULL,
 duration_unit_id SMALLINT UNSIGNED NOT NULL,
 duration_mode ENUM('continuous','connected_time') NOT NULL,
 simultaneous_sessions SMALLINT UNSIGNED NOT NULL DEFAULT 1,
 radius_snapshot JSON NOT NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 PRIMARY KEY(id),
 UNIQUE KEY uq_hs_version(package_id,version_no),
 UNIQUE KEY uq_hs_radius_group(radius_group_name),
 CONSTRAINT fk_hs_version_package FOREIGN KEY (package_id) REFERENCES hotspot_packages(id),
 CONSTRAINT fk_hs_version_unit FOREIGN KEY (duration_unit_id) REFERENCES time_units(id),
 CONSTRAINT chk_hs_version CHECK(version_no>0 AND download_bps>0 AND upload_bps>0 AND (quota_bytes IS NULL OR quota_bytes>0) AND duration_value>0 AND simultaneous_sessions>0 AND JSON_TYPE(radius_snapshot)='OBJECT')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE hotspot_card_batches (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
 package_version_id BIGINT UNSIGNED NOT NULL,
 name VARCHAR(150) NOT NULL,
 quantity INT UNSIGNED NOT NULL,
 owner_manager_id BIGINT UNSIGNED NOT NULL,
 created_by BIGINT UNSIGNED NOT NULL,
 login_mode ENUM('code','username_password') NOT NULL,
 generation_options JSON NOT NULL,
 unit_price DECIMAL(12,2) NOT NULL,
 currency_code VARCHAR(10) NOT NULL,
 is_gift TINYINT UNSIGNED NOT NULL DEFAULT 0,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 PRIMARY KEY(id),
 UNIQUE KEY uq_hotspot_card_batches_owner(id,owner_manager_id),
 CONSTRAINT fk_hotspot_card_batches_creator FOREIGN KEY(created_by) REFERENCES managers(id),
 CONSTRAINT fk_hotspot_card_batches_owner FOREIGN KEY(owner_manager_id) REFERENCES managers(id),
 KEY idx_hs_batch_owner(owner_manager_id,created_at),
 CONSTRAINT fk_hs_batch_version FOREIGN KEY (package_version_id) REFERENCES hotspot_package_versions(id),
 CONSTRAINT chk_hs_batch CHECK(quantity>0 AND unit_price>=0 AND is_gift IN(0,1) AND (is_gift=0 OR unit_price=0) AND JSON_TYPE(generation_options)='OBJECT')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE hotspot_accounts (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
 radius_identity_id BIGINT UNSIGNED NOT NULL,
 identity_kind ENUM('pppoe','hotspot') NOT NULL DEFAULT 'hotspot',
 account_kind ENUM('batch','standalone') NOT NULL,
 owner_manager_id BIGINT UNSIGNED NULL,
 created_by BIGINT UNSIGNED NOT NULL,
 login_mode ENUM('code','username_password') NOT NULL,
 status ENUM('enabled','disabled') NOT NULL DEFAULT 'enabled',
 bind_first_mac TINYINT UNSIGNED NOT NULL DEFAULT 0,
 bound_mac CHAR(17) CHARACTER SET ascii COLLATE ascii_bin NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 archived_at DATETIME(6) NULL,
 archived_by BIGINT UNSIGNED NULL,
 PRIMARY KEY(id),
 UNIQUE KEY uq_hotspot_accounts_owner(id,owner_manager_id),
 CONSTRAINT fk_hotspot_accounts_creator FOREIGN KEY(created_by) REFERENCES managers(id),
 CONSTRAINT fk_hotspot_accounts_owner FOREIGN KEY(owner_manager_id) REFERENCES managers(id),
 CONSTRAINT fk_hs_radius_identity FOREIGN KEY(radius_identity_id,identity_kind) REFERENCES radius_identities(id,service_kind),
 CONSTRAINT fk_hs_account_archiver FOREIGN KEY(archived_by) REFERENCES managers(id),
 UNIQUE KEY uq_hs_identity(radius_identity_id),
 UNIQUE KEY uq_hs_account_kind(id,account_kind),
 KEY idx_hs_account_owner(owner_manager_id,status),
 CONSTRAINT chk_hs_account CHECK(identity_kind='hotspot' AND bind_first_mac IN(0,1) AND ((account_kind='standalone' AND owner_manager_id IS NULL) OR (account_kind='batch' AND owner_manager_id IS NOT NULL)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE hotspot_standalone_cards (
 account_id BIGINT UNSIGNED NOT NULL,
 account_kind ENUM('batch','standalone') NOT NULL DEFAULT 'standalone',
 customer_id BIGINT UNSIGNED NOT NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 PRIMARY KEY(account_id),
 CONSTRAINT fk_hs_standalone_customer FOREIGN KEY(customer_id) REFERENCES customers(id),
 CONSTRAINT fk_hs_standalone_account FOREIGN KEY (account_id,account_kind) REFERENCES hotspot_accounts(id,account_kind),
 CONSTRAINT chk_hs_standalone CHECK(account_kind='standalone')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE hotspot_batch_cards (
 account_id BIGINT UNSIGNED NOT NULL,
 account_kind ENUM('batch','standalone') NOT NULL DEFAULT 'batch',
 batch_id BIGINT UNSIGNED NOT NULL,
 owner_manager_id BIGINT UNSIGNED NOT NULL,
 serial_no INT UNSIGNED NOT NULL,
 PRIMARY KEY(account_id),
 UNIQUE KEY uq_hs_batch_serial(batch_id,serial_no),
 CONSTRAINT fk_hs_batch_card_account FOREIGN KEY (account_id,account_kind) REFERENCES hotspot_accounts(id,account_kind),
 CONSTRAINT fk_hs_batch_card_owner FOREIGN KEY(account_id,owner_manager_id) REFERENCES hotspot_accounts(id,owner_manager_id),
 CONSTRAINT fk_hs_batch_batch_owner FOREIGN KEY(batch_id,owner_manager_id) REFERENCES hotspot_card_batches(id,owner_manager_id),
 CONSTRAINT fk_hs_batch_card_batch FOREIGN KEY (batch_id) REFERENCES hotspot_card_batches(id),
 CONSTRAINT chk_hs_batch_card CHECK(account_kind='batch' AND serial_no>0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE hotspot_service_periods (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
 account_id BIGINT UNSIGNED NOT NULL,
 package_version_id BIGINT UNSIGNED NOT NULL,
 previous_period_id BIGINT UNSIGNED NULL,
 event_type ENUM('issue','renew') NOT NULL,
 created_by BIGINT UNSIGNED NOT NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 activated_at DATETIME(6) NULL,
 ended_at DATETIME(6) NULL,
 expires_at DATETIME(6) NULL,
 duration_mode ENUM('continuous','connected_time') NOT NULL,
 duration_value INT UNSIGNED NOT NULL,
 duration_unit_id SMALLINT UNSIGNED NOT NULL,
 time_allowance_seconds BIGINT UNSIGNED NULL,
 carried_seconds BIGINT UNSIGNED NOT NULL DEFAULT 0,
 quota_allowance_bytes BIGINT UNSIGNED NULL,
 price_snapshot DECIMAL(12,2) NOT NULL,
 currency_code VARCHAR(10) NOT NULL,
 is_gift TINYINT UNSIGNED NOT NULL DEFAULT 0,
 unit_snapshot JSON NOT NULL COMMENT 'Capture code, fixed_seconds and actual_usage_seconds',
 lifecycle ENUM('pending','active','ended','cancelled') NOT NULL DEFAULT 'pending',
 live_account_id BIGINT UNSIGNED GENERATED ALWAYS AS (CASE WHEN lifecycle IN ('pending','active') THEN account_id ELSE NULL END) STORED,
 PRIMARY KEY(id),
 UNIQUE KEY uq_hs_one_live_period(live_account_id),
 CONSTRAINT fk_hotspot_service_periods_creator FOREIGN KEY(created_by) REFERENCES managers(id),
 UNIQUE KEY uq_hs_period_account(id,account_id),
 UNIQUE KEY uq_hs_period_successor(previous_period_id),
 KEY idx_hs_period_account_time(account_id,created_at),
 CONSTRAINT fk_hs_period_account FOREIGN KEY (account_id) REFERENCES hotspot_accounts(id),
 CONSTRAINT fk_hs_period_version FOREIGN KEY (package_version_id) REFERENCES hotspot_package_versions(id),
 CONSTRAINT fk_hs_period_unit FOREIGN KEY (duration_unit_id) REFERENCES time_units(id),
 CONSTRAINT fk_hs_period_previous FOREIGN KEY (previous_period_id,account_id) REFERENCES hotspot_service_periods(id,account_id),
 CONSTRAINT chk_hs_period_event CHECK((event_type='issue' AND previous_period_id IS NULL) OR (event_type='renew' AND previous_period_id IS NOT NULL)),
 CONSTRAINT chk_hs_period_money CHECK(price_snapshot>=0 AND is_gift IN(0,1) AND (is_gift=0 OR price_snapshot=0)),
 CONSTRAINT chk_hs_period_duration CHECK(duration_value>0 AND JSON_TYPE(unit_snapshot)='OBJECT' AND ((duration_mode='continuous' AND time_allowance_seconds IS NULL) OR (duration_mode='connected_time' AND time_allowance_seconds IS NOT NULL AND time_allowance_seconds>0 AND expires_at IS NULL))),
 CONSTRAINT chk_hs_period_times CHECK((activated_at IS NULL AND expires_at IS NULL AND (ended_at IS NULL OR ended_at>=created_at)) OR (activated_at IS NOT NULL AND (ended_at IS NULL OR ended_at>=activated_at) AND (expires_at IS NULL OR expires_at>activated_at))),
 CONSTRAINT chk_hs_period_quota CHECK(quota_allowance_bytes IS NULL OR quota_allowance_bytes>0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE hotspot_period_usage (
 period_id BIGINT UNSIGNED NOT NULL,
 upload_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
 download_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
 used_seconds BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Duration of UNION of connection intervals, not sum of sessions',
 updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 PRIMARY KEY(period_id),
 CONSTRAINT fk_hs_usage_period FOREIGN KEY (period_id) REFERENCES hotspot_service_periods(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE hotspot_accounting_segments (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
 period_id BIGINT UNSIGNED NOT NULL,
 acctuniqueid VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 segment_start DATETIME(6) NOT NULL,
 segment_end DATETIME(6) NOT NULL,
 input_start BIGINT UNSIGNED NOT NULL,
 input_end BIGINT UNSIGNED NOT NULL,
 output_start BIGINT UNSIGNED NOT NULL,
 output_end BIGINT UNSIGNED NOT NULL,
 time_start BIGINT UNSIGNED NOT NULL,
 time_end BIGINT UNSIGNED NOT NULL,
 PRIMARY KEY(id),
 UNIQUE KEY uq_hs_segment(acctuniqueid,segment_start),
 KEY idx_hs_segment_period(period_id,segment_start,segment_end),
 CONSTRAINT fk_hs_segment_period FOREIGN KEY (period_id) REFERENCES hotspot_service_periods(id),
 CONSTRAINT chk_hs_segment CHECK(segment_end>segment_start AND input_end>=input_start AND output_end>=output_start AND time_end>=time_start)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE hotspot_usage_intervals (
 period_id BIGINT UNSIGNED NOT NULL,
 interval_start DATETIME(6) NOT NULL,
 interval_end DATETIME(6) NOT NULL,
 PRIMARY KEY(period_id,interval_start),
 CONSTRAINT fk_hs_interval_period FOREIGN KEY (period_id) REFERENCES hotspot_service_periods(id),
 CONSTRAINT chk_hs_interval CHECK(interval_end>interval_start)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE pppoe_account_radius_overrides (
 account_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
 framed_route VARCHAR(253) NULL,
 updated_by_manager_id BIGINT UNSIGNED NOT NULL,
 updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
 CONSTRAINT fk_ppp_route_account FOREIGN KEY(account_id) REFERENCES pppoe_accounts(id),
 CONSTRAINT fk_ppp_route_actor FOREIGN KEY(updated_by_manager_id) REFERENCES managers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE pppoe_subscription_usage (
 subscription_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
 upload_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
 download_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
 updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 CONSTRAINT fk_ppp_usage_subscription FOREIGN KEY(subscription_id) REFERENCES pppoe_subscriptions(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE pppoe_accounting_segments (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 subscription_id BIGINT UNSIGNED NOT NULL,
 acctuniqueid VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 segment_start DATETIME(6) NOT NULL,
 segment_end DATETIME(6) NOT NULL,
 input_start BIGINT UNSIGNED NOT NULL,
 input_end BIGINT UNSIGNED NOT NULL,
 output_start BIGINT UNSIGNED NOT NULL,
 output_end BIGINT UNSIGNED NOT NULL,
 UNIQUE KEY uq_ppp_accounting_segment(acctuniqueid,segment_start),
 KEY idx_ppp_segment_subscription(subscription_id,segment_start),
 CONSTRAINT fk_ppp_segment_subscription FOREIGN KEY(subscription_id) REFERENCES pppoe_subscriptions(id),
 CONSTRAINT chk_ppp_segment CHECK(segment_end>segment_start AND input_end>=input_start AND output_end>=output_start)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE nas_ovpn_connections (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 nas_id BIGINT UNSIGNED NOT NULL COMMENT 'lord_nas.id, the local administrative NAS identifier',
 central_tunnel_id BIGINT UNSIGNED NOT NULL,
 central_gateway_id BIGINT UNSIGNED NOT NULL,
 server_host VARCHAR(255) NOT NULL,
 server_port SMALLINT UNSIGNED NOT NULL DEFAULT 1194,
 transport_protocol ENUM('tcp','udp') NOT NULL,
 tunnel_username VARCHAR(150) NOT NULL,
 tunnel_password_encrypted TEXT NOT NULL,
 encryption_key_id VARCHAR(100) NOT NULL,
 tunnel_address VARCHAR(45) NOT NULL,
 ca_certificate_reference VARCHAR(500) NULL,
 client_certificate_reference VARCHAR(500) NULL,
 client_private_key_encrypted TEXT NULL,
 radius_server_address VARCHAR(255) NOT NULL,
 routeros_version VARCHAR(40) NULL,
 configuration_snapshot JSON NOT NULL,
 sync_version BIGINT UNSIGNED NOT NULL,
 synced_at DATETIME(6) NOT NULL,
 updated_by_manager_id BIGINT UNSIGNED NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
 UNIQUE KEY uq_ovpn_local_nas(nas_id),
 UNIQUE KEY uq_ovpn_central_tunnel(central_tunnel_id),
 UNIQUE KEY uq_ovpn_gateway_username(central_gateway_id,tunnel_username),
 UNIQUE KEY uq_ovpn_gateway_address(central_gateway_id,tunnel_address),
 CONSTRAINT fk_ovpn_nas FOREIGN KEY(nas_id) REFERENCES lord_nas(id),
 CONSTRAINT fk_ovpn_actor FOREIGN KEY(updated_by_manager_id) REFERENCES managers(id),
 CONSTRAINT chk_ovpn_configuration CHECK(server_port>0 AND sync_version>0 AND JSON_TYPE(configuration_snapshot)='OBJECT')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- activity_log.account_id records the stable radius identity across PPPoE/hotspot.
ALTER TABLE activity_log ADD CONSTRAINT fk_activity_radius_identity FOREIGN KEY(account_id) REFERENCES radius_identities(id);

INSERT INTO permissions(code,name_ar,module,principal_only) VALUES
('customers.restore','استعادة العميل','customers',0),
('categories.restore','استعادة التصنيف','categories',0),
('lines.view','عرض الخطوط','lines',0),
('lines.create','إضافة خط','lines',0),
('lines.update','تعديل خط','lines',0),
('lines.enable','تفعيل خط','lines',0),
('lines.disable','تعطيل خط','lines',0),
('lines.archive','أرشفة خط','lines',0),
('lines.restore','استعادة خط','lines',0),
('credentials.change_username','تغيير اسم الدخول','credentials',0),
('credentials.change_password','تغيير كلمة المرور','credentials',0),
('sessions.view','عرض الجلسات','sessions',0),
('sessions.disconnect','قطع جلسة','sessions',0),
('usage.view','عرض الاستهلاك','usage',0),
('pppoe.packages.manage','إدارة باقات PPPoE','pppoe',0),
('pppoe.subscriptions.manage','إدارة اشتراكات PPPoE','pppoe',0),
('hotspot.packages.manage','إدارة باقات الهوتسبوت','hotspot',0),
('hotspot.cards.issue','إصدار كروت الهوتسبوت','hotspot',0),
('hotspot.cards.renew','تجديد الكرت المستقل','hotspot',0),
('nas.view','عرض NAS','nas',0),
('nas.manage','إدارة NAS','nas',1),
('nas.script.generate','توليد سكربت NAS','nas',1),
('network.settings.manage','إدارة إعدادات الشبكة','network',1)
ON DUPLICATE KEY UPDATE code=VALUES(code);

SELECT 'tenant_database_schema_created_not_activated' AS result;
