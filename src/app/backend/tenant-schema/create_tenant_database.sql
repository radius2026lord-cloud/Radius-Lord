-- Radius Lord complete tenant database template / 2026-11-06 / MySQL 8.0.46.
-- SPDX-License-Identifier: GPL-2.0-or-later
-- Based on the development structure export. FreeRADIUS table definitions
-- derive from v3.2.x MySQL schema; upstream license: vendor/FREERADIUS-LICENSE.
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

CREATE TABLE `activity_log` (
  `id` bigint UNSIGNED NOT NULL,
  `actor_manager_id` bigint UNSIGNED DEFAULT NULL,
  `actor_snapshot` json DEFAULT NULL,
  `actor_kind` enum('manager','system') COLLATE utf8mb4_unicode_ci NOT NULL,
  `action_code` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `target_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `target_id` bigint UNSIGNED DEFAULT NULL,
  `customer_id` bigint UNSIGNED DEFAULT NULL,
  `account_id` bigint UNSIGNED DEFAULT NULL COMMENT 'Stable radius_identities.id across PPPoE and hotspot',
  `before_data` json DEFAULT NULL,
  `after_data` json DEFAULT NULL,
  `result` enum('success','failed') COLLATE utf8mb4_unicode_ci NOT NULL,
  `failure_code` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `failure_reason` text COLLATE utf8mb4_unicode_ci,
  `request_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `operation_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `occurred_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `address_keywords` (
  `id` bigint UNSIGNED NOT NULL,
  `keyword` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_enabled` tinyint(1) NOT NULL DEFAULT '1',
  `created_by_manager_id` bigint UNSIGNED NOT NULL,
  `archived_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `connection_methods` (
  `id` tinyint UNSIGNED NOT NULL,
  `service_type_id` tinyint UNSIGNED NOT NULL,
  `code` varchar(30) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `name` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `currencies` (
  `id` smallint UNSIGNED NOT NULL,
  `code` varchar(10) NOT NULL,
  `name_ar` varchar(80) NOT NULL,
  `symbol` varchar(12) NOT NULL DEFAULT '',
  `decimal_places` tinyint UNSIGNED NOT NULL DEFAULT '2',
  `is_enabled` tinyint UNSIGNED NOT NULL DEFAULT '1'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `customers` (
  `id` bigint UNSIGNED NOT NULL,
  `manager_id` bigint UNSIGNED NOT NULL,
  `status` enum('active','suspended') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `first_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `last_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `address` text COLLATE utf8mb4_unicode_ci,
  `latitude` decimal(10,7) DEFAULT NULL,
  `longitude` decimal(10,7) DEFAULT NULL,
  `payment_code` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_by_manager_id` bigint UNSIGNED NOT NULL,
  `archived_at` datetime DEFAULT NULL,
  `archived_by_manager_id` bigint UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `scope_id` bigint UNSIGNED DEFAULT NULL,
  `assigned_manager_id` bigint UNSIGNED DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `customer_address_suggestions` (
  `id` bigint UNSIGNED NOT NULL,
  `manager_id` bigint UNSIGNED NOT NULL,
  `address` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `address_hash` binary(32) NOT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `last_used_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `customer_categories` (
  `id` bigint UNSIGNED NOT NULL,
  `manager_id` bigint UNSIGNED NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `created_by_manager_id` bigint UNSIGNED NOT NULL,
  `archived_at` datetime DEFAULT NULL,
  `archived_by_manager_id` bigint UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `scope_id` bigint UNSIGNED DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `customer_category_manager_assignments` (
  `category_id` bigint UNSIGNED NOT NULL,
  `manager_id` bigint UNSIGNED NOT NULL,
  `assigned_by_manager_id` bigint UNSIGNED NOT NULL,
  `assigned_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `customer_category_memberships` (
  `customer_id` bigint UNSIGNED NOT NULL,
  `category_id` bigint UNSIGNED NOT NULL,
  `manager_id` bigint UNSIGNED NOT NULL,
  `assigned_by_manager_id` bigint UNSIGNED NOT NULL,
  `assigned_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `scope_id` bigint UNSIGNED DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `customer_identity_documents` (
  `id` bigint UNSIGNED NOT NULL,
  `customer_id` bigint UNSIGNED NOT NULL,
  `first_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `last_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `father_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mother_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `birth_place` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `birth_date` date DEFAULT NULL,
  `national_number` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `identity_number` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address` text COLLATE utf8mb4_unicode_ci,
  `front_image_reference` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `back_image_reference` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `front_image_data` longblob,
  `back_image_data` longblob,
  `capture_method` enum('manual','qr') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'manual',
  `updated_by_manager_id` bigint UNSIGNED NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `data_units` (
  `id` smallint UNSIGNED NOT NULL,
  `code` varchar(10) NOT NULL,
  `name_ar` varchar(50) NOT NULL,
  `bytes_factor` bigint UNSIGNED NOT NULL,
  `is_enabled` tinyint UNSIGNED NOT NULL DEFAULT '1'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `equipment_ip_pools` (
  `id` bigint UNSIGNED NOT NULL,
  `name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `cidr` varchar(18) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `gateway_ipv4` int UNSIGNED NOT NULL,
  `range_start_ipv4` int UNSIGNED NOT NULL,
  `range_end_ipv4` int UNSIGNED NOT NULL,
  `excluded_ipv4` json NOT NULL,
  `is_enabled` tinyint UNSIGNED NOT NULL DEFAULT '1',
  `created_by` bigint UNSIGNED NOT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `hotspot_accounting_segments` (
  `id` bigint UNSIGNED NOT NULL,
  `period_id` bigint UNSIGNED NOT NULL,
  `acctuniqueid` varchar(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `segment_start` datetime(6) NOT NULL,
  `segment_end` datetime(6) NOT NULL,
  `input_start` bigint UNSIGNED NOT NULL,
  `input_end` bigint UNSIGNED NOT NULL,
  `output_start` bigint UNSIGNED NOT NULL,
  `output_end` bigint UNSIGNED NOT NULL,
  `time_start` bigint UNSIGNED NOT NULL,
  `time_end` bigint UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `hotspot_accounts` (
  `id` bigint UNSIGNED NOT NULL,
  `radius_identity_id` bigint UNSIGNED NOT NULL,
  `identity_kind` enum('pppoe','hotspot') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'hotspot',
  `account_kind` enum('batch','standalone') COLLATE utf8mb4_unicode_ci NOT NULL,
  `owner_manager_id` bigint UNSIGNED DEFAULT NULL,
  `created_by` bigint UNSIGNED NOT NULL,
  `login_mode` enum('code','username_password') COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('enabled','disabled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'enabled',
  `bind_first_mac` tinyint UNSIGNED NOT NULL DEFAULT '0',
  `bound_mac` char(17) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `archived_at` datetime(6) DEFAULT NULL,
  `archived_by` bigint UNSIGNED DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `hotspot_batch_cards` (
  `account_id` bigint UNSIGNED NOT NULL,
  `account_kind` enum('batch','standalone') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'batch',
  `batch_id` bigint UNSIGNED NOT NULL,
  `owner_manager_id` bigint UNSIGNED NOT NULL,
  `serial_no` int UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `hotspot_card_batches` (
  `id` bigint UNSIGNED NOT NULL,
  `package_version_id` bigint UNSIGNED NOT NULL,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity` int UNSIGNED NOT NULL,
  `owner_manager_id` bigint UNSIGNED NOT NULL,
  `created_by` bigint UNSIGNED NOT NULL,
  `login_mode` enum('code','username_password') COLLATE utf8mb4_unicode_ci NOT NULL,
  `generation_options` json NOT NULL,
  `unit_price` decimal(12,2) NOT NULL,
  `currency_code` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_gift` tinyint UNSIGNED NOT NULL DEFAULT '0',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `hotspot_card_output_jobs` (
  `id` char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `batch_id` bigint UNSIGNED NOT NULL,
  `actor_manager_id` bigint UNSIGNED NOT NULL,
  `output_kind` enum('print','pdf') COLLATE utf8mb4_unicode_ci NOT NULL,
  `card_count` int UNSIGNED NOT NULL,
  `serials_json` json NOT NULL,
  `confirmed_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `hotspot_card_print_marks` (
  `account_id` bigint UNSIGNED NOT NULL,
  `last_job_id` char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `printed_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `hotspot_packages` (
  `id` bigint UNSIGNED NOT NULL,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `owner_manager_id` bigint UNSIGNED NOT NULL,
  `is_enabled` tinyint UNSIGNED NOT NULL DEFAULT '1',
  `base_price` decimal(12,2) NOT NULL,
  `currency_code` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `archived_at` datetime(6) DEFAULT NULL,
  `archived_by` bigint UNSIGNED DEFAULT NULL,
  `login_mode` enum('code','username_password') COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `hotspot_package_versions` (
  `id` bigint UNSIGNED NOT NULL,
  `package_id` bigint UNSIGNED NOT NULL,
  `version_no` int UNSIGNED NOT NULL,
  `radius_group_name` varchar(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `download_bps` bigint UNSIGNED NOT NULL,
  `upload_bps` bigint UNSIGNED NOT NULL,
  `quota_bytes` bigint UNSIGNED DEFAULT NULL,
  `duration_value` int UNSIGNED NOT NULL,
  `duration_unit_id` smallint UNSIGNED NOT NULL,
  `duration_mode` enum('continuous','connected_time') COLLATE utf8mb4_unicode_ci NOT NULL,
  `simultaneous_sessions` smallint UNSIGNED NOT NULL DEFAULT '1',
  `radius_snapshot` json NOT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `hotspot_period_usage` (
  `period_id` bigint UNSIGNED NOT NULL,
  `upload_bytes` bigint UNSIGNED NOT NULL DEFAULT '0',
  `download_bytes` bigint UNSIGNED NOT NULL DEFAULT '0',
  `used_seconds` bigint UNSIGNED NOT NULL DEFAULT '0' COMMENT 'Duration of UNION of connection intervals, not sum of sessions',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `hotspot_service_periods` (
  `id` bigint UNSIGNED NOT NULL,
  `account_id` bigint UNSIGNED NOT NULL,
  `package_version_id` bigint UNSIGNED NOT NULL,
  `previous_period_id` bigint UNSIGNED DEFAULT NULL,
  `event_type` enum('issue','renew') COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_by` bigint UNSIGNED NOT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `activated_at` datetime(6) DEFAULT NULL,
  `ended_at` datetime(6) DEFAULT NULL,
  `expires_at` datetime(6) DEFAULT NULL,
  `duration_mode` enum('continuous','connected_time') COLLATE utf8mb4_unicode_ci NOT NULL,
  `duration_value` int UNSIGNED NOT NULL,
  `duration_unit_id` smallint UNSIGNED NOT NULL,
  `time_allowance_seconds` bigint UNSIGNED DEFAULT NULL,
  `carried_seconds` bigint UNSIGNED NOT NULL DEFAULT '0',
  `quota_allowance_bytes` bigint UNSIGNED DEFAULT NULL,
  `price_snapshot` decimal(12,2) NOT NULL,
  `currency_code` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_gift` tinyint UNSIGNED NOT NULL DEFAULT '0',
  `unit_snapshot` json NOT NULL COMMENT 'Capture code, fixed_seconds and actual_usage_seconds',
  `lifecycle` enum('pending','active','ended','cancelled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `live_account_id` bigint UNSIGNED GENERATED ALWAYS AS ((case when (`lifecycle` in (_utf8mb4'pending',_utf8mb4'active')) then `account_id` else NULL end)) STORED
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `hotspot_standalone_cards` (
  `account_id` bigint UNSIGNED NOT NULL,
  `account_kind` enum('batch','standalone') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'standalone',
  `customer_id` bigint UNSIGNED NOT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `hotspot_usage_intervals` (
  `period_id` bigint UNSIGNED NOT NULL,
  `interval_start` datetime(6) NOT NULL,
  `interval_end` datetime(6) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `lord_nas` (
  `id` bigint UNSIGNED NOT NULL,
  `radius_nas_id` int NOT NULL,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `vendor` enum('mikrotik','ubiquiti','cisco','other') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'mikrotik',
  `model` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `radius_services` set('ppp','hotspot') COLLATE utf8mb4_unicode_ci NOT NULL,
  `routeros_version` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `coa_host` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `management_host` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `auth_port` smallint UNSIGNED NOT NULL DEFAULT '1812',
  `acct_port` smallint UNSIGNED NOT NULL DEFAULT '1813',
  `coa_port` smallint UNSIGNED NOT NULL,
  `is_enabled` tinyint UNSIGNED NOT NULL DEFAULT '1',
  `activity_status` enum('recent','stale','unknown') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'unknown',
  `last_seen_at` datetime(6) DEFAULT NULL,
  `location` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `created_by` bigint UNSIGNED NOT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `archived_at` datetime(6) DEFAULT NULL,
  `archived_by` bigint UNSIGNED DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `managers` (
  `id` bigint UNSIGNED NOT NULL,
  `full_name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `username` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `manager_type` enum('principal','subordinate') COLLATE utf8mb4_unicode_ci NOT NULL,
  `permission_group_id` bigint UNSIGNED DEFAULT NULL,
  `is_enabled` tinyint(1) NOT NULL DEFAULT '1',
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_by_manager_id` bigint UNSIGNED DEFAULT NULL,
  `archived_at` datetime DEFAULT NULL,
  `archived_by_manager_id` bigint UNSIGNED DEFAULT NULL,
  `principal_guard` tinyint UNSIGNED GENERATED ALWAYS AS ((case when (`manager_type` = _utf8mb4'principal') then 1 else NULL end)) STORED,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `account_role` enum('principal','center_employee','agent','agent_employee') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `scope_id` bigint UNSIGNED DEFAULT NULL,
  `parent_agent_manager_id` bigint UNSIGNED DEFAULT NULL,
  `contact_email` varchar(254) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `purged_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `manager_contact_numbers` (
  `id` bigint UNSIGNED NOT NULL,
  `manager_id` bigint UNSIGNED NOT NULL,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `label` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `display_order` smallint UNSIGNED NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `nas` (
  `id` int NOT NULL,
  `nasname` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `shortname` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `type` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT 'other',
  `ports` int DEFAULT NULL,
  `secret` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'secret',
  `server` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `community` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT 'RADIUS Client'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `nasreload` (
  `nasipaddress` varchar(15) COLLATE utf8mb4_unicode_ci NOT NULL,
  `reloadtime` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `nas_management_credentials` (
  `id` bigint UNSIGNED NOT NULL,
  `lord_nas_id` bigint UNSIGNED NOT NULL,
  `username` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_encrypted` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `encryption_key_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `updated_by` bigint UNSIGNED NOT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `nas_management_services` (
  `id` bigint UNSIGNED NOT NULL,
  `lord_nas_id` bigint UNSIGNED NOT NULL,
  `service_type` enum('api','api_tls','winbox','webconfig','ssh','custom') COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `host` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `port` smallint UNSIGNED NOT NULL,
  `external_host` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `external_port` smallint UNSIGNED DEFAULT NULL,
  `protocol` enum('tcp','udp') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'tcp',
  `scheme` enum('http','https') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_enabled` tinyint UNSIGNED NOT NULL DEFAULT '1',
  `description` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `nas_ovpn_connections` (
  `id` bigint UNSIGNED NOT NULL,
  `nas_id` bigint UNSIGNED NOT NULL COMMENT 'lord_nas.id, the local administrative NAS identifier',
  `central_tunnel_id` bigint UNSIGNED NOT NULL,
  `central_gateway_id` bigint UNSIGNED NOT NULL,
  `server_host` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `server_port` smallint UNSIGNED NOT NULL DEFAULT '1194',
  `transport_protocol` enum('tcp','udp') COLLATE utf8mb4_unicode_ci NOT NULL,
  `tunnel_username` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tunnel_password_encrypted` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `encryption_key_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tunnel_address` varchar(45) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ca_certificate_reference` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `client_certificate_reference` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `client_private_key_encrypted` text COLLATE utf8mb4_unicode_ci,
  `radius_server_address` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `routeros_version` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `configuration_snapshot` json NOT NULL,
  `sync_version` bigint UNSIGNED NOT NULL,
  `synced_at` datetime(6) NOT NULL,
  `updated_by_manager_id` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `network_archive_policy` (
  `id` tinyint UNSIGNED NOT NULL,
  `retention_days` smallint UNSIGNED NOT NULL DEFAULT '90',
  `automatic_cleanup` tinyint UNSIGNED NOT NULL DEFAULT '0',
  `updated_by_manager_id` bigint UNSIGNED DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `network_contact_numbers` (
  `id` bigint UNSIGNED NOT NULL,
  `network_settings_id` tinyint UNSIGNED NOT NULL DEFAULT '1',
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `label` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `display_order` smallint UNSIGNED NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `network_equipment_devices` (
  `id` bigint UNSIGNED NOT NULL,
  `device_role` enum('ap','station') COLLATE utf8mb4_unicode_ci NOT NULL,
  `customer_id` bigint UNSIGNED DEFAULT NULL,
  `pool_id` bigint UNSIGNED NOT NULL,
  `management_ipv4` int UNSIGNED DEFAULT NULL,
  `last_management_ipv4` int UNSIGNED DEFAULT NULL,
  `vendor` enum('ubnt','mimosa','mikrotik','other') COLLATE utf8mb4_unicode_ci NOT NULL,
  `model` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `serial_number` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mac_address` varchar(17) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `parent_ap_id` bigint UNSIGNED DEFAULT NULL,
  `status` enum('active','maintenance','retired') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `address` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `latitude` decimal(10,7) DEFAULT NULL,
  `longitude` decimal(10,7) DEFAULT NULL,
  `notes` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_by` bigint UNSIGNED NOT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `network_hotspot_card_templates` (
  `id` tinyint UNSIGNED NOT NULL,
  `library_json` json NOT NULL,
  `revision` int UNSIGNED NOT NULL DEFAULT '0',
  `updated_by` bigint UNSIGNED DEFAULT NULL,
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `network_ovpn_settings` (
  `id` tinyint UNSIGNED NOT NULL,
  `configuration_snapshot` json NOT NULL,
  `synced_at` datetime(6) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `network_scopes` (
  `id` bigint UNSIGNED NOT NULL,
  `scope_kind` enum('center','agent','legacy_private') COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `owner_manager_id` bigint UNSIGNED DEFAULT NULL,
  `is_enabled` tinyint(1) NOT NULL DEFAULT '1',
  `created_by_manager_id` bigint UNSIGNED DEFAULT NULL,
  `archived_at` datetime DEFAULT NULL,
  `archived_by_manager_id` bigint UNSIGNED DEFAULT NULL,
  `center_guard` tinyint UNSIGNED GENERATED ALWAYS AS ((case when (`scope_kind` = _utf8mb4'center') then 1 else NULL end)) STORED,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `network_service_areas` (
  `id` bigint UNSIGNED NOT NULL,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `address` text COLLATE utf8mb4_unicode_ci,
  `latitude` decimal(10,7) DEFAULT NULL,
  `longitude` decimal(10,7) DEFAULT NULL,
  `scope_id` bigint UNSIGNED DEFAULT NULL COMMENT 'Optional agent scope; one area has at most one agent, an agent may have many areas',
  `status` enum('active','inactive','planned') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'planned',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_by_manager_id` bigint UNSIGNED NOT NULL,
  `archived_at` datetime DEFAULT NULL,
  `archived_by_manager_id` bigint UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `network_settings` (
  `id` tinyint UNSIGNED NOT NULL,
  `network_name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `radius_server_address` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `radius_interim_update_seconds` int UNSIGNED NOT NULL DEFAULT '180',
  `timezone` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'IANA timezone, explicitly selected for this network',
  `primary_contact_phone` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `identity_capture_enabled` tinyint(1) NOT NULL DEFAULT '0',
  `grace_policy` enum('package','global') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'package',
  `global_grace_days` smallint UNSIGNED NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `contact_email` varchar(254) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address` text COLLATE utf8mb4_unicode_ci,
  `latitude` decimal(10,7) DEFAULT NULL,
  `longitude` decimal(10,7) DEFAULT NULL,
  `government_license_number` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `logo_reference` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `internal_notes` text COLLATE utf8mb4_unicode_ci,
  `default_currency_id` smallint UNSIGNED DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `network_subscriber_card_templates` (
  `id` tinyint UNSIGNED NOT NULL DEFAULT '1',
  `template_json` json NOT NULL,
  `is_approved` tinyint(1) NOT NULL DEFAULT '0',
  `approved_by` bigint UNSIGNED DEFAULT NULL,
  `approved_at` datetime(3) DEFAULT NULL,
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `package_radius_defaults` (
  `package_id` bigint UNSIGNED NOT NULL,
  `mikrotik_group` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Existing PPP profile on NAS',
  `framed_pool` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Existing IP pool on NAS'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `package_service_policies` (
  `package_id` bigint UNSIGNED NOT NULL,
  `download_bps` bigint UNSIGNED NOT NULL,
  `upload_bps` bigint UNSIGNED NOT NULL,
  `quota_bytes` bigint UNSIGNED DEFAULT NULL COMMENT 'NULL = unlimited; otherwise positive bytes',
  `simultaneous_sessions` smallint UNSIGNED NOT NULL DEFAULT '1',
  `validity_mode` enum('duration','fixed_day','calendar_monthly') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'duration',
  `duration_value` int UNSIGNED DEFAULT NULL,
  `duration_unit_id` smallint UNSIGNED DEFAULT NULL,
  `expiry_day` tinyint UNSIGNED DEFAULT NULL,
  `expiry_time` time DEFAULT NULL,
  `starts_at` enum('activation','first_connection','creation') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `grace_days` smallint UNSIGNED NOT NULL DEFAULT '0',
  `quota_exhaustion_action` enum('stop','reduce_speed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'stop',
  `reduced_download_bps` bigint UNSIGNED DEFAULT NULL,
  `reduced_upload_bps` bigint UNSIGNED DEFAULT NULL,
  `quota_renewal_policy` enum('reset','carry_over') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'reset',
  `download_unit_id` smallint UNSIGNED DEFAULT NULL,
  `upload_unit_id` smallint UNSIGNED DEFAULT NULL,
  `quota_unit_id` smallint UNSIGNED DEFAULT NULL,
  `reduced_download_unit_id` smallint UNSIGNED DEFAULT NULL,
  `reduced_upload_unit_id` smallint UNSIGNED DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `permissions` (
  `id` bigint UNSIGNED NOT NULL,
  `code` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name_ar` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `module` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `principal_only` tinyint(1) NOT NULL DEFAULT '0',
  `is_enabled` tinyint(1) NOT NULL DEFAULT '1'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `permission_groups` (
  `id` bigint UNSIGNED NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `is_enabled` tinyint(1) NOT NULL DEFAULT '1',
  `archived_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `scope_id` bigint UNSIGNED DEFAULT NULL,
  `scope_name_guard` bigint UNSIGNED GENERATED ALWAYS AS (coalesce(`scope_id`,0)) STORED,
  `purged_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `permission_group_permissions` (
  `permission_group_id` bigint UNSIGNED NOT NULL,
  `permission_id` bigint UNSIGNED NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `platform_subscription` (
  `id` tinyint UNSIGNED NOT NULL,
  `central_tenant_id` bigint UNSIGNED NOT NULL,
  `central_subscription_id` bigint UNSIGNED NOT NULL,
  `license_number` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `license_status` enum('pending','active','suspended','expired','revoked') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `subscription_status` enum('pending','active','expired','cancelled','suspended') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `plan_name_snapshot` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `deployment_code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `max_pppoe_accounts` bigint UNSIGNED NOT NULL,
  `base_max_nas` int UNSIGNED NOT NULL,
  `additional_nas_capacity` int UNSIGNED NOT NULL DEFAULT '0',
  `duration_months_snapshot` int UNSIGNED NOT NULL,
  `activated_at` datetime DEFAULT NULL,
  `starts_at` datetime DEFAULT NULL,
  `expires_at` datetime DEFAULT NULL,
  `sync_version` bigint UNSIGNED NOT NULL,
  `synced_at` datetime NOT NULL,
  `signed_payload` json NOT NULL,
  `payload_signature` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `signing_key_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `pppoe_accounting_segments` (
  `id` bigint UNSIGNED NOT NULL,
  `subscription_id` bigint UNSIGNED NOT NULL,
  `acctuniqueid` varchar(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `segment_start` datetime(6) NOT NULL,
  `segment_end` datetime(6) NOT NULL,
  `input_start` bigint UNSIGNED NOT NULL,
  `input_end` bigint UNSIGNED NOT NULL,
  `output_start` bigint UNSIGNED NOT NULL,
  `output_end` bigint UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `pppoe_accounts` (
  `id` bigint UNSIGNED NOT NULL,
  `customer_id` bigint UNSIGNED NOT NULL,
  `radius_identity_id` bigint UNSIGNED NOT NULL,
  `identity_kind` enum('pppoe','hotspot') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pppoe',
  `line_name` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `admin_status` enum('enabled','disabled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'enabled',
  `address` text COLLATE utf8mb4_unicode_ci,
  `latitude` decimal(10,7) DEFAULT NULL,
  `longitude` decimal(10,7) DEFAULT NULL,
  `service_type_id` tinyint UNSIGNED DEFAULT NULL,
  `connection_method_id` tinyint UNSIGNED DEFAULT NULL,
  `distribution_box_serial` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `distribution_box_description` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `station_vendor` enum('ubnt','mimosa','mikrotik') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `station_ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `station_device_id` bigint UNSIGNED DEFAULT NULL,
  `allowed_nas_id` int DEFAULT NULL,
  `created_by` bigint UNSIGNED NOT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `archived_at` datetime(6) DEFAULT NULL,
  `archived_by` bigint UNSIGNED DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `pppoe_account_radius_overrides` (
  `account_id` bigint UNSIGNED NOT NULL,
  `framed_route` varchar(253) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updated_by_manager_id` bigint UNSIGNED NOT NULL,
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `pppoe_import_batches` (
  `id` bigint UNSIGNED NOT NULL,
  `created_by` bigint UNSIGNED NOT NULL,
  `category_id` bigint UNSIGNED NOT NULL,
  `source_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `total_rows` int UNSIGNED NOT NULL DEFAULT '0',
  `imported_rows` int UNSIGNED NOT NULL DEFAULT '0',
  `duplicate_rows` int UNSIGNED NOT NULL DEFAULT '0',
  `rejected_rows` int UNSIGNED NOT NULL DEFAULT '0',
  `status` enum('processing','completed','completed_with_issues') COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `pppoe_import_review_rows` (
  `id` bigint UNSIGNED NOT NULL,
  `batch_id` bigint UNSIGNED NOT NULL,
  `source_row_number` int UNSIGNED NOT NULL,
  `username` varchar(64) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `reason_code` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `encrypted_payload` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `resolved_at` datetime(6) DEFAULT NULL,
  `resolved_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `pppoe_line_speed_boosts` (
  `id` bigint UNSIGNED NOT NULL,
  `account_id` bigint UNSIGNED NOT NULL,
  `username` varchar(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `multiplier` tinyint UNSIGNED DEFAULT NULL,
  `download_bps` bigint UNSIGNED DEFAULT NULL,
  `upload_bps` bigint UNSIGNED DEFAULT NULL,
  `original_rate_limit` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `boosted_rate_limit` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `original_user_reply` json NOT NULL,
  `started_at` datetime(6) NOT NULL,
  `expires_at` datetime(6) NOT NULL,
  `status` enum('active','reverted','cancelled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `active_account_id` bigint UNSIGNED GENERATED ALWAYS AS ((case when (`status` = _utf8mb4'active') then `account_id` else NULL end)) STORED,
  `created_by` bigint UNSIGNED NOT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `reverted_at` datetime(6) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `pppoe_packages` (
  `id` bigint UNSIGNED NOT NULL,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `owner_manager_id` bigint UNSIGNED NOT NULL,
  `package_type` enum('prepaid','daily','addon','free') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'prepaid',
  `is_enabled` tinyint UNSIGNED NOT NULL DEFAULT '1',
  `base_price` decimal(12,2) NOT NULL DEFAULT '0.00',
  `offer_price` decimal(12,2) DEFAULT NULL,
  `offer_ends_at` datetime(6) DEFAULT NULL COMMENT 'Exclusive UTC boundary; offer valid only before this instant',
  `is_gift` tinyint UNSIGNED NOT NULL DEFAULT '0',
  `currency_code` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `daily_package_id` bigint UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `archived_at` datetime(6) DEFAULT NULL,
  `archived_by` bigint UNSIGNED DEFAULT NULL,
  `currency_id` smallint UNSIGNED DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `pppoe_package_speed_boosts` (
  `id` bigint UNSIGNED NOT NULL,
  `package_id` bigint UNSIGNED NOT NULL,
  `multiplier` tinyint UNSIGNED NOT NULL,
  `original_download_bps` bigint UNSIGNED NOT NULL,
  `original_upload_bps` bigint UNSIGNED NOT NULL,
  `boosted_download_bps` bigint UNSIGNED NOT NULL,
  `boosted_upload_bps` bigint UNSIGNED NOT NULL,
  `started_at` datetime(6) NOT NULL,
  `expires_at` datetime(6) NOT NULL,
  `status` enum('active','reverted') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `active_package_id` bigint UNSIGNED GENERATED ALWAYS AS ((case when (`status` = _utf8mb4'active') then `package_id` else NULL end)) STORED,
  `created_by` bigint UNSIGNED NOT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `reverted_at` datetime(6) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `pppoe_package_versions` (
  `id` bigint UNSIGNED NOT NULL,
  `package_id` bigint UNSIGNED NOT NULL,
  `version_no` int UNSIGNED NOT NULL,
  `radius_group_name` varchar(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `service_snapshot` json NOT NULL,
  `radius_snapshot` json NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `pppoe_radius_jobs` (
  `id` bigint UNSIGNED NOT NULL,
  `radacctid` bigint NOT NULL,
  `reason` enum('expiry','reauth') COLLATE utf8mb4_unicode_ci NOT NULL,
  `revision` bigint UNSIGNED NOT NULL DEFAULT '1',
  `attempts` smallint UNSIGNED NOT NULL DEFAULT '0',
  `next_attempt_at` datetime(6) NOT NULL,
  `acknowledged_at` datetime(6) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `pppoe_radius_job_state` (
  `id` tinyint UNSIGNED NOT NULL,
  `scan_cursor` bigint NOT NULL DEFAULT '0',
  `cleanup_cursor` bigint NOT NULL DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `pppoe_subscriptions` (
  `id` bigint UNSIGNED NOT NULL,
  `account_id` bigint UNSIGNED NOT NULL,
  `package_version_id` bigint UNSIGNED NOT NULL,
  `service_role` enum('base','daily','addon') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'base',
  `parent_subscription_id` bigint UNSIGNED DEFAULT NULL,
  `created_by` bigint UNSIGNED NOT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `activated_at` datetime(6) DEFAULT NULL,
  `expires_at` datetime(6) DEFAULT NULL,
  `ended_at` datetime(6) DEFAULT NULL,
  `event_type` enum('activation','renewal','package_change','daily_fallback','addon') COLLATE utf8mb4_unicode_ci NOT NULL,
  `previous_subscription_id` bigint UNSIGNED DEFAULT NULL,
  `renewal_mode` enum('normal','fixed_due','full_month') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'normal',
  `base_price_snapshot` decimal(12,2) NOT NULL,
  `offer_price_snapshot` decimal(12,2) DEFAULT NULL,
  `offer_ends_at_snapshot` datetime(6) DEFAULT NULL,
  `effective_price_snapshot` decimal(12,2) NOT NULL,
  `currency_code` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_gift_snapshot` tinyint UNSIGNED NOT NULL,
  `grace_source_snapshot` enum('global','package') COLLATE utf8mb4_unicode_ci NOT NULL,
  `grace_days_snapshot` smallint UNSIGNED NOT NULL DEFAULT '0',
  `grace_expires_at` datetime(6) DEFAULT NULL,
  `effective_service_snapshot` json NOT NULL,
  `quota_allowance_bytes` bigint UNSIGNED DEFAULT NULL,
  `carried_quota_bytes` bigint UNSIGNED NOT NULL DEFAULT '0',
  `lifecycle` enum('pending','active','ended','cancelled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `live_role` varchar(10) COLLATE utf8mb4_unicode_ci GENERATED ALWAYS AS ((case when (`lifecycle` in (_utf8mb4'pending',_utf8mb4'active')) then `service_role` else NULL end)) STORED,
  `daily_parent_id` bigint UNSIGNED GENERATED ALWAYS AS ((case when (`service_role` = _utf8mb4'daily') then `parent_subscription_id` else NULL end)) STORED
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `pppoe_subscription_usage` (
  `subscription_id` bigint UNSIGNED NOT NULL,
  `upload_bytes` bigint UNSIGNED NOT NULL DEFAULT '0',
  `download_bytes` bigint UNSIGNED NOT NULL DEFAULT '0',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `radacct` (
  `radacctid` bigint NOT NULL,
  `acctsessionid` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `acctuniqueid` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `username` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `realm` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT '',
  `nasipaddress` varchar(15) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `nasportid` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nasporttype` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `acctstarttime` datetime DEFAULT NULL,
  `acctupdatetime` datetime DEFAULT NULL,
  `acctstoptime` datetime DEFAULT NULL,
  `acctinterval` int DEFAULT NULL,
  `acctsessiontime` int UNSIGNED DEFAULT NULL,
  `acctauthentic` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `connectinfo_start` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `connectinfo_stop` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `acctinputoctets` bigint DEFAULT NULL,
  `acctoutputoctets` bigint DEFAULT NULL,
  `calledstationid` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `callingstationid` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `acctterminatecause` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `servicetype` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `framedprotocol` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `framedipaddress` varchar(15) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `framedipv6address` varchar(45) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `framedipv6prefix` varchar(45) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `framedinterfaceid` varchar(44) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `delegatedipv6prefix` varchar(45) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `class` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `radcheck` (
  `id` int UNSIGNED NOT NULL,
  `username` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `attribute` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `op` char(2) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '==',
  `value` varchar(253) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `radgroupcheck` (
  `id` int UNSIGNED NOT NULL,
  `groupname` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `attribute` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `op` char(2) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '==',
  `value` varchar(253) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `radgroupreply` (
  `id` int UNSIGNED NOT NULL,
  `groupname` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `attribute` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `op` char(2) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '=',
  `value` varchar(253) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `radius_identities` (
  `id` bigint UNSIGNED NOT NULL,
  `service_kind` enum('pppoe','hotspot') COLLATE utf8mb4_unicode_ci NOT NULL,
  `contract_number` varchar(64) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `line_payment_code` varchar(64) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `current_username` varchar(64) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `radius_username_reservations` (
  `username` varchar(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `radius_identity_id` bigint UNSIGNED NOT NULL,
  `reserved_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `last_retired_at` datetime(6) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `radpostauth` (
  `id` int NOT NULL,
  `username` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `pass` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `reply` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `authdate` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `class` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `radreply` (
  `id` int UNSIGNED NOT NULL,
  `username` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `attribute` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `op` char(2) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '=',
  `value` varchar(253) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `radusergroup` (
  `id` int UNSIGNED NOT NULL,
  `username` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `groupname` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `priority` int NOT NULL DEFAULT '1'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `service_types` (
  `id` tinyint UNSIGNED NOT NULL,
  `code` varchar(30) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `name` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_enabled` tinyint UNSIGNED NOT NULL DEFAULT '1'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `speed_units` (
  `id` smallint UNSIGNED NOT NULL,
  `code` varchar(10) NOT NULL,
  `name_ar` varchar(50) NOT NULL,
  `bps_factor` bigint UNSIGNED NOT NULL,
  `is_enabled` tinyint UNSIGNED NOT NULL DEFAULT '1'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `time_units` (
  `id` smallint UNSIGNED NOT NULL,
  `code` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name_ar` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `calculation_kind` enum('fixed','calendar') COLLATE utf8mb4_unicode_ci NOT NULL,
  `seconds_per_unit` int UNSIGNED DEFAULT NULL,
  `actual_usage_seconds` int UNSIGNED NOT NULL,
  `is_enabled` tinyint(1) NOT NULL DEFAULT '1'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `username_change_history` (
  `id` bigint UNSIGNED NOT NULL,
  `radius_identity_id` bigint UNSIGNED NOT NULL,
  `old_username` varchar(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `new_username` varchar(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `changed_by` bigint UNSIGNED NOT NULL,
  `changed_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `user_ui_preferences` (
  `owner_key` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `preferences_json` json NOT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `activity_log`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_activity_customer_time` (`customer_id`,`occurred_at`,`id`),
  ADD KEY `idx_activity_actor_time` (`actor_manager_id`,`occurred_at`,`id`),
  ADD KEY `idx_activity_target_time` (`target_type`,`target_id`,`occurred_at`,`id`),
  ADD KEY `idx_activity_operation` (`operation_id`,`id`),
  ADD KEY `idx_activity_account_time` (`account_id`,`occurred_at`,`id`);

ALTER TABLE `address_keywords`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `keyword` (`keyword`),
  ADD KEY `fk_address_keyword_creator` (`created_by_manager_id`);

ALTER TABLE `connection_methods`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_connection_code` (`code`),
  ADD UNIQUE KEY `uq_method_service` (`id`,`service_type_id`),
  ADD KEY `fk_method_service` (`service_type_id`);

ALTER TABLE `currencies`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `code` (`code`);

ALTER TABLE `customers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_customer_payment_code` (`payment_code`),
  ADD UNIQUE KEY `uq_customer_id_manager` (`id`,`manager_id`),
  ADD KEY `idx_customer_owner_archive` (`manager_id`,`archived_at`,`id`),
  ADD KEY `idx_customer_name` (`last_name`,`first_name`),
  ADD KEY `fk_customer_creator` (`created_by_manager_id`),
  ADD KEY `fk_customer_archiver` (`archived_by_manager_id`);

ALTER TABLE `customer_address_suggestions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_customer_address_suggestion_hash` (`manager_id`,`address_hash`),
  ADD KEY `idx_customer_address_suggestions_prefix` (`manager_id`,`address`(191));

ALTER TABLE `customer_categories`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_category_owner_name` (`manager_id`,`name`),
  ADD UNIQUE KEY `uq_category_id_manager` (`id`,`manager_id`),
  ADD KEY `idx_category_owner_archive` (`manager_id`,`archived_at`,`id`),
  ADD KEY `fk_category_creator` (`created_by_manager_id`),
  ADD KEY `fk_category_archiver` (`archived_by_manager_id`);

ALTER TABLE `customer_category_manager_assignments`
  ADD PRIMARY KEY (`category_id`,`manager_id`),
  ADD KEY `idx_category_assignment_manager` (`manager_id`,`category_id`),
  ADD KEY `fk_category_assignment_actor` (`assigned_by_manager_id`);

ALTER TABLE `customer_category_memberships`
  ADD PRIMARY KEY (`customer_id`,`category_id`),
  ADD KEY `fk_membership_customer_owner` (`customer_id`,`manager_id`),
  ADD KEY `fk_membership_actor` (`assigned_by_manager_id`),
  ADD KEY `idx_membership_category_manager` (`category_id`,`manager_id`);

ALTER TABLE `customer_identity_documents`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_customer_one_identity` (`customer_id`),
  ADD UNIQUE KEY `uq_identity_number` (`identity_number`),
  ADD KEY `fk_identity_editor` (`updated_by_manager_id`);

ALTER TABLE `data_units`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `code` (`code`);

ALTER TABLE `equipment_ip_pools`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_equipment_pool_name` (`name`),
  ADD KEY `idx_equipment_pool_range` (`is_enabled`,`range_start_ipv4`,`range_end_ipv4`),
  ADD KEY `fk_equipment_pool_creator` (`created_by`);

ALTER TABLE `hotspot_accounting_segments`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_hs_segment` (`acctuniqueid`,`segment_start`),
  ADD KEY `idx_hs_segment_period` (`period_id`,`segment_start`,`segment_end`);

ALTER TABLE `hotspot_accounts`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_hs_identity` (`radius_identity_id`),
  ADD UNIQUE KEY `uq_hs_account_kind` (`id`,`account_kind`),
  ADD UNIQUE KEY `uq_hotspot_accounts_owner` (`id`,`owner_manager_id`),
  ADD KEY `fk_hotspot_accounts_creator` (`created_by`),
  ADD KEY `fk_hs_radius_identity` (`radius_identity_id`,`identity_kind`),
  ADD KEY `fk_hs_account_archiver` (`archived_by`),
  ADD KEY `idx_hs_account_owner` (`owner_manager_id`,`status`);

ALTER TABLE `hotspot_batch_cards`
  ADD PRIMARY KEY (`account_id`),
  ADD UNIQUE KEY `uq_hs_batch_serial` (`batch_id`,`serial_no`),
  ADD KEY `fk_hs_batch_card_account` (`account_id`,`account_kind`),
  ADD KEY `fk_hs_batch_card_owner` (`account_id`,`owner_manager_id`),
  ADD KEY `fk_hs_batch_batch_owner` (`batch_id`,`owner_manager_id`);

ALTER TABLE `hotspot_card_batches`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_hotspot_card_batches_owner` (`id`,`owner_manager_id`),
  ADD KEY `fk_hotspot_card_batches_creator` (`created_by`),
  ADD KEY `idx_hs_batch_owner` (`owner_manager_id`,`created_at`),
  ADD KEY `fk_hs_batch_version` (`package_version_id`);

ALTER TABLE `hotspot_card_output_jobs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_hotspot_output_batch_time` (`batch_id`,`output_kind`,`confirmed_at`),
  ADD KEY `fk_hotspot_output_actor` (`actor_manager_id`);

ALTER TABLE `hotspot_card_print_marks`
  ADD PRIMARY KEY (`account_id`),
  ADD KEY `idx_hotspot_print_job` (`last_job_id`);

ALTER TABLE `hotspot_packages`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_hs_package_archiver` (`archived_by`),
  ADD KEY `idx_hs_package_owner` (`owner_manager_id`);

ALTER TABLE `hotspot_package_versions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_hs_version` (`package_id`,`version_no`),
  ADD UNIQUE KEY `uq_hs_radius_group` (`radius_group_name`),
  ADD KEY `fk_hs_version_unit` (`duration_unit_id`);

ALTER TABLE `hotspot_period_usage`
  ADD PRIMARY KEY (`period_id`);

ALTER TABLE `hotspot_service_periods`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_hs_period_account` (`id`,`account_id`),
  ADD UNIQUE KEY `uq_hs_one_live_period` (`live_account_id`),
  ADD UNIQUE KEY `uq_hs_period_successor` (`previous_period_id`),
  ADD KEY `fk_hotspot_service_periods_creator` (`created_by`),
  ADD KEY `idx_hs_period_account_time` (`account_id`,`created_at`),
  ADD KEY `fk_hs_period_version` (`package_version_id`),
  ADD KEY `fk_hs_period_unit` (`duration_unit_id`),
  ADD KEY `fk_hs_period_previous` (`previous_period_id`,`account_id`);

ALTER TABLE `hotspot_standalone_cards`
  ADD PRIMARY KEY (`account_id`),
  ADD KEY `fk_hs_standalone_customer` (`customer_id`),
  ADD KEY `fk_hs_standalone_account` (`account_id`,`account_kind`);

ALTER TABLE `hotspot_usage_intervals`
  ADD PRIMARY KEY (`period_id`,`interval_start`);

ALTER TABLE `lord_nas`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_lord_radius_nas` (`radius_nas_id`),
  ADD KEY `fk_nas_creator` (`created_by`),
  ADD KEY `fk_nas_archiver` (`archived_by`);

ALTER TABLE `managers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_manager_username` (`username`),
  ADD UNIQUE KEY `uq_single_principal` (`principal_guard`),
  ADD KEY `idx_managers_group_status` (`permission_group_id`,`is_enabled`,`archived_at`),
  ADD KEY `fk_manager_creator` (`created_by_manager_id`),
  ADD KEY `fk_manager_archiver` (`archived_by_manager_id`);

ALTER TABLE `manager_contact_numbers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_manager_extra_phone` (`manager_id`,`phone`);

ALTER TABLE `nas`
  ADD PRIMARY KEY (`id`),
  ADD KEY `nasname` (`nasname`);

ALTER TABLE `nasreload`
  ADD PRIMARY KEY (`nasipaddress`);

ALTER TABLE `nas_management_credentials`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_nas_credential` (`lord_nas_id`),
  ADD KEY `fk_credential_actor` (`updated_by`);

ALTER TABLE `nas_management_services`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_management_service_nas` (`lord_nas_id`);

ALTER TABLE `nas_ovpn_connections`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_ovpn_local_nas` (`nas_id`),
  ADD UNIQUE KEY `uq_ovpn_central_tunnel` (`central_tunnel_id`),
  ADD UNIQUE KEY `uq_ovpn_gateway_username` (`central_gateway_id`,`tunnel_username`),
  ADD UNIQUE KEY `uq_ovpn_gateway_address` (`central_gateway_id`,`tunnel_address`),
  ADD KEY `fk_ovpn_actor` (`updated_by_manager_id`);

ALTER TABLE `network_archive_policy`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_archive_policy_actor` (`updated_by_manager_id`);

ALTER TABLE `network_contact_numbers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_network_optional_phone` (`network_settings_id`,`phone`);

ALTER TABLE `network_equipment_devices`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_equipment_management_ipv4` (`management_ipv4`),
  ADD UNIQUE KEY `uq_equipment_serial` (`serial_number`),
  ADD UNIQUE KEY `uq_equipment_mac` (`mac_address`),
  ADD KEY `idx_equipment_customer` (`customer_id`,`device_role`,`status`),
  ADD KEY `idx_equipment_pool` (`pool_id`,`status`),
  ADD KEY `idx_equipment_parent_ap` (`parent_ap_id`),
  ADD KEY `fk_equipment_creator` (`created_by`);

ALTER TABLE `network_hotspot_card_templates`
  ADD PRIMARY KEY (`id`);

ALTER TABLE `network_ovpn_settings`
  ADD PRIMARY KEY (`id`);

ALTER TABLE `network_scopes`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_scope_one_center` (`center_guard`),
  ADD UNIQUE KEY `uq_scope_kind_owner` (`scope_kind`,`owner_manager_id`),
  ADD UNIQUE KEY `uq_scope_id_owner` (`id`,`owner_manager_id`),
  ADD KEY `fk_scope_owner` (`owner_manager_id`),
  ADD KEY `fk_scope_creator` (`created_by_manager_id`),
  ADD KEY `fk_scope_archiver` (`archived_by_manager_id`);

ALTER TABLE `network_service_areas`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_service_area_scope_status` (`scope_id`,`status`,`archived_at`),
  ADD KEY `fk_service_area_creator` (`created_by_manager_id`),
  ADD KEY `fk_service_area_archiver` (`archived_by_manager_id`);

ALTER TABLE `network_settings`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_network_currency_reference` (`default_currency_id`);

ALTER TABLE `network_subscriber_card_templates`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_subscriber_card_template_approval` (`is_approved`,`updated_at`),
  ADD KEY `fk_subscriber_card_template_approver` (`approved_by`);

ALTER TABLE `package_radius_defaults`
  ADD PRIMARY KEY (`package_id`);

ALTER TABLE `package_service_policies`
  ADD PRIMARY KEY (`package_id`),
  ADD KEY `fk_ppp_policy_unit` (`duration_unit_id`),
  ADD KEY `fk_ppp_download_unit` (`download_unit_id`),
  ADD KEY `fk_ppp_upload_unit` (`upload_unit_id`),
  ADD KEY `fk_ppp_quota_unit` (`quota_unit_id`),
  ADD KEY `fk_ppp_reduced_download_unit` (`reduced_download_unit_id`),
  ADD KEY `fk_ppp_reduced_upload_unit` (`reduced_upload_unit_id`);

ALTER TABLE `permissions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `code` (`code`);

ALTER TABLE `permission_groups`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_group_scope_name` (`scope_name_guard`,`name`);

ALTER TABLE `permission_group_permissions`
  ADD PRIMARY KEY (`permission_group_id`,`permission_id`),
  ADD KEY `fk_group_permission_definition` (`permission_id`);

ALTER TABLE `platform_subscription`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_local_platform_license` (`license_number`);

ALTER TABLE `pppoe_accounting_segments`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_ppp_accounting_segment` (`acctuniqueid`,`segment_start`),
  ADD KEY `idx_ppp_segment_subscription` (`subscription_id`,`segment_start`);

ALTER TABLE `pppoe_accounts`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_ppp_identity` (`radius_identity_id`),
  ADD UNIQUE KEY `uq_ppp_station_device` (`station_device_id`),
  ADD KEY `idx_ppp_customer_archive` (`customer_id`,`archived_at`),
  ADD KEY `fk_ppp_radius_identity` (`radius_identity_id`,`identity_kind`),
  ADD KEY `fk_ppp_service` (`service_type_id`),
  ADD KEY `fk_ppp_connection` (`connection_method_id`,`service_type_id`),
  ADD KEY `fk_ppp_nas` (`allowed_nas_id`),
  ADD KEY `fk_ppp_creator` (`created_by`),
  ADD KEY `fk_ppp_archiver` (`archived_by`);

ALTER TABLE `pppoe_account_radius_overrides`
  ADD PRIMARY KEY (`account_id`),
  ADD KEY `fk_ppp_route_actor` (`updated_by_manager_id`);

ALTER TABLE `pppoe_import_batches`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_pppoe_import_batch_time` (`created_at`,`id`),
  ADD KEY `fk_pppoe_import_batch_actor` (`created_by`),
  ADD KEY `fk_pppoe_import_batch_category` (`category_id`);

ALTER TABLE `pppoe_import_review_rows`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_pppoe_import_review_source` (`batch_id`,`source_row_number`),
  ADD KEY `idx_pppoe_import_review_open` (`resolved_at`,`batch_id`,`id`),
  ADD KEY `fk_pppoe_import_review_actor` (`resolved_by`);

ALTER TABLE `pppoe_line_speed_boosts`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_active_line_speed_boost` (`active_account_id`),
  ADD KEY `idx_line_speed_boost_expiry` (`status`,`expires_at`,`id`),
  ADD KEY `idx_line_speed_boost_username` (`username`,`status`),
  ADD KEY `fk_line_speed_boost_creator` (`created_by`),
  ADD KEY `idx_line_boost_account_state` (`account_id`,`status`,`expires_at`,`id`);

ALTER TABLE `pppoe_packages`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_ppp_package_archiver` (`archived_by`),
  ADD KEY `idx_pppoe_packages_type_enabled` (`package_type`,`is_enabled`),
  ADD KEY `idx_pppoe_packages_daily` (`daily_package_id`),
  ADD KEY `idx_pppoe_packages_owner` (`owner_manager_id`),
  ADD KEY `fk_ppp_currency_reference` (`currency_id`);

ALTER TABLE `pppoe_package_speed_boosts`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_active_profile_speed_boost` (`active_package_id`),
  ADD KEY `idx_profile_speed_boost_expiry` (`status`,`expires_at`,`id`),
  ADD KEY `fk_profile_speed_boost_package` (`package_id`),
  ADD KEY `fk_profile_speed_boost_creator` (`created_by`);

ALTER TABLE `pppoe_package_versions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_pppoe_package_version` (`package_id`,`version_no`),
  ADD UNIQUE KEY `uq_pppoe_radius_group` (`radius_group_name`);

ALTER TABLE `pppoe_radius_jobs`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_ppp_radius_job_session` (`radacctid`),
  ADD KEY `idx_ppp_radius_job_due` (`next_attempt_at`,`id`);

ALTER TABLE `pppoe_radius_job_state`
  ADD PRIMARY KEY (`id`);

ALTER TABLE `pppoe_subscriptions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_ppp_subscription_account` (`id`,`account_id`),
  ADD UNIQUE KEY `uq_live_ppp_role` (`account_id`,`live_role`),
  ADD UNIQUE KEY `uq_ppp_daily_once` (`daily_parent_id`),
  ADD KEY `idx_ppp_subscription_account` (`account_id`,`lifecycle`),
  ADD KEY `fk_ppp_subscription_version` (`package_version_id`),
  ADD KEY `fk_ppp_subscription_parent` (`parent_subscription_id`,`account_id`),
  ADD KEY `fk_ppp_subscription_previous` (`previous_subscription_id`,`account_id`),
  ADD KEY `fk_ppp_subscription_creator` (`created_by`),
  ADD KEY `idx_ppp_subscription_account_role_time` (`account_id`,`service_role`,`id`);

ALTER TABLE `pppoe_subscription_usage`
  ADD PRIMARY KEY (`subscription_id`);

ALTER TABLE `radacct`
  ADD PRIMARY KEY (`radacctid`),
  ADD UNIQUE KEY `acctuniqueid` (`acctuniqueid`),
  ADD KEY `username` (`username`),
  ADD KEY `framedipaddress` (`framedipaddress`),
  ADD KEY `framedipv6address` (`framedipv6address`),
  ADD KEY `framedipv6prefix` (`framedipv6prefix`),
  ADD KEY `framedinterfaceid` (`framedinterfaceid`),
  ADD KEY `delegatedipv6prefix` (`delegatedipv6prefix`),
  ADD KEY `acctsessionid` (`acctsessionid`),
  ADD KEY `acctsessiontime` (`acctsessiontime`),
  ADD KEY `acctstarttime` (`acctstarttime`),
  ADD KEY `acctinterval` (`acctinterval`),
  ADD KEY `acctstoptime` (`acctstoptime`),
  ADD KEY `nasipaddress` (`nasipaddress`),
  ADD KEY `class` (`class`),
  ADD KEY `idx_radacct_username_live` (`username`,`acctstoptime`,`acctupdatetime`,`radacctid`);

ALTER TABLE `radcheck`
  ADD PRIMARY KEY (`id`),
  ADD KEY `username` (`username`(32));

ALTER TABLE `radgroupcheck`
  ADD PRIMARY KEY (`id`),
  ADD KEY `groupname` (`groupname`(32));

ALTER TABLE `radgroupreply`
  ADD PRIMARY KEY (`id`),
  ADD KEY `groupname` (`groupname`(32));

ALTER TABLE `radius_identities`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_identity_kind` (`id`,`service_kind`),
  ADD UNIQUE KEY `uq_current_username` (`current_username`),
  ADD UNIQUE KEY `uq_identity_contract_number` (`contract_number`),
  ADD UNIQUE KEY `uq_identity_line_payment_code` (`line_payment_code`),
  ADD KEY `fk_identity_current_name` (`id`,`current_username`);

ALTER TABLE `radius_username_reservations`
  ADD PRIMARY KEY (`username`),
  ADD UNIQUE KEY `uq_username_owner` (`radius_identity_id`,`username`);

ALTER TABLE `radpostauth`
  ADD PRIMARY KEY (`id`),
  ADD KEY `username` (`username`),
  ADD KEY `class` (`class`),
  ADD KEY `idx_radpostauth_username_time` (`username`,`authdate`,`id`);

ALTER TABLE `radreply`
  ADD PRIMARY KEY (`id`),
  ADD KEY `username` (`username`(32));

ALTER TABLE `radusergroup`
  ADD PRIMARY KEY (`id`),
  ADD KEY `username` (`username`(32));

ALTER TABLE `service_types`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_service_code` (`code`);

ALTER TABLE `speed_units`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `code` (`code`);

ALTER TABLE `time_units`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `code` (`code`);

ALTER TABLE `username_change_history`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_name_history_old` (`radius_identity_id`,`old_username`),
  ADD KEY `fk_name_history_new` (`radius_identity_id`,`new_username`),
  ADD KEY `fk_name_history_actor` (`changed_by`);

ALTER TABLE `user_ui_preferences`
  ADD PRIMARY KEY (`owner_key`);

ALTER TABLE `activity_log`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `address_keywords`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `currencies`
  MODIFY `id` smallint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `customers`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `customer_address_suggestions`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `customer_categories`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `customer_identity_documents`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `equipment_ip_pools`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `hotspot_accounting_segments`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `hotspot_accounts`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `hotspot_card_batches`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `hotspot_packages`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `hotspot_package_versions`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `hotspot_service_periods`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `lord_nas`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `managers`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `manager_contact_numbers`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `nas`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

ALTER TABLE `nas_management_credentials`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `nas_management_services`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `nas_ovpn_connections`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `network_contact_numbers`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `network_equipment_devices`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `network_scopes`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `network_service_areas`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `permissions`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `permission_groups`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `pppoe_accounting_segments`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `pppoe_accounts`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `pppoe_import_batches`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `pppoe_import_review_rows`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `pppoe_line_speed_boosts`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `pppoe_packages`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `pppoe_package_speed_boosts`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `pppoe_package_versions`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `pppoe_radius_jobs`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `pppoe_subscriptions`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `radacct`
  MODIFY `radacctid` bigint NOT NULL AUTO_INCREMENT;

ALTER TABLE `radcheck`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `radgroupcheck`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `radgroupreply`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `radius_identities`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `radpostauth`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

ALTER TABLE `radreply`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `radusergroup`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `time_units`
  MODIFY `id` smallint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `username_change_history`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `activity_log`
  ADD CONSTRAINT `fk_activity_actor` FOREIGN KEY (`actor_manager_id`) REFERENCES `managers` (`id`) ON DELETE RESTRICT,
  ADD CONSTRAINT `fk_activity_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE RESTRICT,
  ADD CONSTRAINT `fk_activity_radius_identity` FOREIGN KEY (`account_id`) REFERENCES `radius_identities` (`id`);

ALTER TABLE `address_keywords`
  ADD CONSTRAINT `fk_address_keyword_creator` FOREIGN KEY (`created_by_manager_id`) REFERENCES `managers` (`id`) ON DELETE RESTRICT;

ALTER TABLE `connection_methods`
  ADD CONSTRAINT `fk_method_service` FOREIGN KEY (`service_type_id`) REFERENCES `service_types` (`id`);

ALTER TABLE `customers`
  ADD CONSTRAINT `fk_customer_archiver` FOREIGN KEY (`archived_by_manager_id`) REFERENCES `managers` (`id`) ON DELETE RESTRICT,
  ADD CONSTRAINT `fk_customer_creator` FOREIGN KEY (`created_by_manager_id`) REFERENCES `managers` (`id`) ON DELETE RESTRICT,
  ADD CONSTRAINT `fk_customer_manager` FOREIGN KEY (`manager_id`) REFERENCES `managers` (`id`) ON DELETE RESTRICT;

ALTER TABLE `customer_address_suggestions`
  ADD CONSTRAINT `fk_customer_address_suggestion_manager` FOREIGN KEY (`manager_id`) REFERENCES `managers` (`id`) ON DELETE RESTRICT;

ALTER TABLE `customer_categories`
  ADD CONSTRAINT `fk_category_archiver` FOREIGN KEY (`archived_by_manager_id`) REFERENCES `managers` (`id`) ON DELETE RESTRICT,
  ADD CONSTRAINT `fk_category_creator` FOREIGN KEY (`created_by_manager_id`) REFERENCES `managers` (`id`) ON DELETE RESTRICT,
  ADD CONSTRAINT `fk_category_owner` FOREIGN KEY (`manager_id`) REFERENCES `managers` (`id`) ON DELETE RESTRICT;

ALTER TABLE `customer_category_manager_assignments`
  ADD CONSTRAINT `fk_category_assignment_actor` FOREIGN KEY (`assigned_by_manager_id`) REFERENCES `managers` (`id`) ON DELETE RESTRICT,
  ADD CONSTRAINT `fk_category_assignment_category` FOREIGN KEY (`category_id`) REFERENCES `customer_categories` (`id`) ON DELETE RESTRICT,
  ADD CONSTRAINT `fk_category_assignment_manager` FOREIGN KEY (`manager_id`) REFERENCES `managers` (`id`) ON DELETE RESTRICT;

ALTER TABLE `customer_category_memberships`
  ADD CONSTRAINT `fk_membership_actor` FOREIGN KEY (`assigned_by_manager_id`) REFERENCES `managers` (`id`) ON DELETE RESTRICT,
  ADD CONSTRAINT `fk_membership_category_assignment` FOREIGN KEY (`category_id`,`manager_id`) REFERENCES `customer_category_manager_assignments` (`category_id`, `manager_id`) ON DELETE RESTRICT,
  ADD CONSTRAINT `fk_membership_customer_owner` FOREIGN KEY (`customer_id`,`manager_id`) REFERENCES `customers` (`id`, `manager_id`) ON DELETE RESTRICT;

ALTER TABLE `customer_identity_documents`
  ADD CONSTRAINT `fk_identity_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE RESTRICT,
  ADD CONSTRAINT `fk_identity_editor` FOREIGN KEY (`updated_by_manager_id`) REFERENCES `managers` (`id`) ON DELETE RESTRICT;

ALTER TABLE `equipment_ip_pools`
  ADD CONSTRAINT `fk_equipment_pool_creator` FOREIGN KEY (`created_by`) REFERENCES `managers` (`id`);

ALTER TABLE `hotspot_accounting_segments`
  ADD CONSTRAINT `fk_hs_segment_period` FOREIGN KEY (`period_id`) REFERENCES `hotspot_service_periods` (`id`);

ALTER TABLE `hotspot_accounts`
  ADD CONSTRAINT `fk_hotspot_accounts_creator` FOREIGN KEY (`created_by`) REFERENCES `managers` (`id`),
  ADD CONSTRAINT `fk_hotspot_accounts_owner` FOREIGN KEY (`owner_manager_id`) REFERENCES `managers` (`id`),
  ADD CONSTRAINT `fk_hs_account_archiver` FOREIGN KEY (`archived_by`) REFERENCES `managers` (`id`),
  ADD CONSTRAINT `fk_hs_radius_identity` FOREIGN KEY (`radius_identity_id`,`identity_kind`) REFERENCES `radius_identities` (`id`, `service_kind`);

ALTER TABLE `hotspot_batch_cards`
  ADD CONSTRAINT `fk_hs_batch_batch_owner` FOREIGN KEY (`batch_id`,`owner_manager_id`) REFERENCES `hotspot_card_batches` (`id`, `owner_manager_id`),
  ADD CONSTRAINT `fk_hs_batch_card_account` FOREIGN KEY (`account_id`,`account_kind`) REFERENCES `hotspot_accounts` (`id`, `account_kind`),
  ADD CONSTRAINT `fk_hs_batch_card_batch` FOREIGN KEY (`batch_id`) REFERENCES `hotspot_card_batches` (`id`),
  ADD CONSTRAINT `fk_hs_batch_card_owner` FOREIGN KEY (`account_id`,`owner_manager_id`) REFERENCES `hotspot_accounts` (`id`, `owner_manager_id`);

ALTER TABLE `hotspot_card_batches`
  ADD CONSTRAINT `fk_hotspot_card_batches_creator` FOREIGN KEY (`created_by`) REFERENCES `managers` (`id`),
  ADD CONSTRAINT `fk_hotspot_card_batches_owner` FOREIGN KEY (`owner_manager_id`) REFERENCES `managers` (`id`),
  ADD CONSTRAINT `fk_hs_batch_version` FOREIGN KEY (`package_version_id`) REFERENCES `hotspot_package_versions` (`id`);

ALTER TABLE `hotspot_card_output_jobs`
  ADD CONSTRAINT `fk_hotspot_output_actor` FOREIGN KEY (`actor_manager_id`) REFERENCES `managers` (`id`),
  ADD CONSTRAINT `fk_hotspot_output_batch` FOREIGN KEY (`batch_id`) REFERENCES `hotspot_card_batches` (`id`);

ALTER TABLE `hotspot_card_print_marks`
  ADD CONSTRAINT `fk_hotspot_print_account` FOREIGN KEY (`account_id`) REFERENCES `hotspot_accounts` (`id`),
  ADD CONSTRAINT `fk_hotspot_print_job` FOREIGN KEY (`last_job_id`) REFERENCES `hotspot_card_output_jobs` (`id`);

ALTER TABLE `hotspot_packages`
  ADD CONSTRAINT `fk_hotspot_packages_owner` FOREIGN KEY (`owner_manager_id`) REFERENCES `managers` (`id`),
  ADD CONSTRAINT `fk_hs_package_archiver` FOREIGN KEY (`archived_by`) REFERENCES `managers` (`id`);

ALTER TABLE `hotspot_package_versions`
  ADD CONSTRAINT `fk_hs_version_package` FOREIGN KEY (`package_id`) REFERENCES `hotspot_packages` (`id`),
  ADD CONSTRAINT `fk_hs_version_unit` FOREIGN KEY (`duration_unit_id`) REFERENCES `time_units` (`id`);

ALTER TABLE `hotspot_period_usage`
  ADD CONSTRAINT `fk_hs_usage_period` FOREIGN KEY (`period_id`) REFERENCES `hotspot_service_periods` (`id`);

ALTER TABLE `hotspot_service_periods`
  ADD CONSTRAINT `fk_hotspot_service_periods_creator` FOREIGN KEY (`created_by`) REFERENCES `managers` (`id`),
  ADD CONSTRAINT `fk_hs_period_account` FOREIGN KEY (`account_id`) REFERENCES `hotspot_accounts` (`id`),
  ADD CONSTRAINT `fk_hs_period_previous` FOREIGN KEY (`previous_period_id`,`account_id`) REFERENCES `hotspot_service_periods` (`id`, `account_id`),
  ADD CONSTRAINT `fk_hs_period_unit` FOREIGN KEY (`duration_unit_id`) REFERENCES `time_units` (`id`),
  ADD CONSTRAINT `fk_hs_period_version` FOREIGN KEY (`package_version_id`) REFERENCES `hotspot_package_versions` (`id`);

ALTER TABLE `hotspot_standalone_cards`
  ADD CONSTRAINT `fk_hs_standalone_account` FOREIGN KEY (`account_id`,`account_kind`) REFERENCES `hotspot_accounts` (`id`, `account_kind`),
  ADD CONSTRAINT `fk_hs_standalone_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`);

ALTER TABLE `hotspot_usage_intervals`
  ADD CONSTRAINT `fk_hs_interval_period` FOREIGN KEY (`period_id`) REFERENCES `hotspot_service_periods` (`id`);

ALTER TABLE `lord_nas`
  ADD CONSTRAINT `fk_lord_nas_radius` FOREIGN KEY (`radius_nas_id`) REFERENCES `nas` (`id`),
  ADD CONSTRAINT `fk_nas_archiver` FOREIGN KEY (`archived_by`) REFERENCES `managers` (`id`),
  ADD CONSTRAINT `fk_nas_creator` FOREIGN KEY (`created_by`) REFERENCES `managers` (`id`);

ALTER TABLE `managers`
  ADD CONSTRAINT `fk_manager_archiver` FOREIGN KEY (`archived_by_manager_id`) REFERENCES `managers` (`id`) ON DELETE RESTRICT,
  ADD CONSTRAINT `fk_manager_creator` FOREIGN KEY (`created_by_manager_id`) REFERENCES `managers` (`id`) ON DELETE RESTRICT,
  ADD CONSTRAINT `fk_manager_group` FOREIGN KEY (`permission_group_id`) REFERENCES `permission_groups` (`id`) ON DELETE RESTRICT;

ALTER TABLE `manager_contact_numbers`
  ADD CONSTRAINT `fk_extra_phone_manager` FOREIGN KEY (`manager_id`) REFERENCES `managers` (`id`) ON DELETE RESTRICT;

ALTER TABLE `nas_management_credentials`
  ADD CONSTRAINT `fk_credential_actor` FOREIGN KEY (`updated_by`) REFERENCES `managers` (`id`),
  ADD CONSTRAINT `fk_credential_nas` FOREIGN KEY (`lord_nas_id`) REFERENCES `lord_nas` (`id`);

ALTER TABLE `nas_management_services`
  ADD CONSTRAINT `fk_management_service_nas` FOREIGN KEY (`lord_nas_id`) REFERENCES `lord_nas` (`id`);

ALTER TABLE `nas_ovpn_connections`
  ADD CONSTRAINT `fk_ovpn_actor` FOREIGN KEY (`updated_by_manager_id`) REFERENCES `managers` (`id`),
  ADD CONSTRAINT `fk_ovpn_nas` FOREIGN KEY (`nas_id`) REFERENCES `lord_nas` (`id`);

ALTER TABLE `network_archive_policy`
  ADD CONSTRAINT `fk_archive_policy_actor` FOREIGN KEY (`updated_by_manager_id`) REFERENCES `managers` (`id`) ON DELETE RESTRICT;

ALTER TABLE `network_contact_numbers`
  ADD CONSTRAINT `fk_contact_network_settings` FOREIGN KEY (`network_settings_id`) REFERENCES `network_settings` (`id`) ON DELETE RESTRICT;

ALTER TABLE `network_equipment_devices`
  ADD CONSTRAINT `fk_equipment_creator` FOREIGN KEY (`created_by`) REFERENCES `managers` (`id`),
  ADD CONSTRAINT `fk_equipment_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`),
  ADD CONSTRAINT `fk_equipment_parent_ap` FOREIGN KEY (`parent_ap_id`) REFERENCES `network_equipment_devices` (`id`),
  ADD CONSTRAINT `fk_equipment_pool` FOREIGN KEY (`pool_id`) REFERENCES `equipment_ip_pools` (`id`);

ALTER TABLE `network_scopes`
  ADD CONSTRAINT `fk_scope_archiver` FOREIGN KEY (`archived_by_manager_id`) REFERENCES `managers` (`id`) ON DELETE RESTRICT,
  ADD CONSTRAINT `fk_scope_creator` FOREIGN KEY (`created_by_manager_id`) REFERENCES `managers` (`id`) ON DELETE RESTRICT,
  ADD CONSTRAINT `fk_scope_owner` FOREIGN KEY (`owner_manager_id`) REFERENCES `managers` (`id`) ON DELETE RESTRICT;

ALTER TABLE `network_service_areas`
  ADD CONSTRAINT `fk_service_area_archiver` FOREIGN KEY (`archived_by_manager_id`) REFERENCES `managers` (`id`) ON DELETE RESTRICT,
  ADD CONSTRAINT `fk_service_area_creator` FOREIGN KEY (`created_by_manager_id`) REFERENCES `managers` (`id`) ON DELETE RESTRICT,
  ADD CONSTRAINT `fk_service_area_scope` FOREIGN KEY (`scope_id`) REFERENCES `network_scopes` (`id`) ON DELETE RESTRICT;

ALTER TABLE `network_settings`
  ADD CONSTRAINT `fk_network_currency_reference` FOREIGN KEY (`default_currency_id`) REFERENCES `currencies` (`id`);

ALTER TABLE `network_subscriber_card_templates`
  ADD CONSTRAINT `fk_subscriber_card_template_approver` FOREIGN KEY (`approved_by`) REFERENCES `managers` (`id`);

ALTER TABLE `package_radius_defaults`
  ADD CONSTRAINT `fk_package_radius_package` FOREIGN KEY (`package_id`) REFERENCES `pppoe_packages` (`id`);

ALTER TABLE `package_service_policies`
  ADD CONSTRAINT `fk_package_service_package` FOREIGN KEY (`package_id`) REFERENCES `pppoe_packages` (`id`),
  ADD CONSTRAINT `fk_ppp_download_unit` FOREIGN KEY (`download_unit_id`) REFERENCES `speed_units` (`id`),
  ADD CONSTRAINT `fk_ppp_policy_unit` FOREIGN KEY (`duration_unit_id`) REFERENCES `time_units` (`id`),
  ADD CONSTRAINT `fk_ppp_quota_unit` FOREIGN KEY (`quota_unit_id`) REFERENCES `data_units` (`id`),
  ADD CONSTRAINT `fk_ppp_reduced_download_unit` FOREIGN KEY (`reduced_download_unit_id`) REFERENCES `speed_units` (`id`),
  ADD CONSTRAINT `fk_ppp_reduced_upload_unit` FOREIGN KEY (`reduced_upload_unit_id`) REFERENCES `speed_units` (`id`),
  ADD CONSTRAINT `fk_ppp_upload_unit` FOREIGN KEY (`upload_unit_id`) REFERENCES `speed_units` (`id`);

ALTER TABLE `permission_group_permissions`
  ADD CONSTRAINT `fk_group_permission_definition` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE RESTRICT,
  ADD CONSTRAINT `fk_group_permission_group` FOREIGN KEY (`permission_group_id`) REFERENCES `permission_groups` (`id`) ON DELETE RESTRICT;

ALTER TABLE `pppoe_accounting_segments`
  ADD CONSTRAINT `fk_ppp_segment_subscription` FOREIGN KEY (`subscription_id`) REFERENCES `pppoe_subscriptions` (`id`);

ALTER TABLE `pppoe_accounts`
  ADD CONSTRAINT `fk_ppp_archiver` FOREIGN KEY (`archived_by`) REFERENCES `managers` (`id`),
  ADD CONSTRAINT `fk_ppp_connection` FOREIGN KEY (`connection_method_id`,`service_type_id`) REFERENCES `connection_methods` (`id`, `service_type_id`),
  ADD CONSTRAINT `fk_ppp_creator` FOREIGN KEY (`created_by`) REFERENCES `managers` (`id`),
  ADD CONSTRAINT `fk_ppp_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`),
  ADD CONSTRAINT `fk_ppp_nas` FOREIGN KEY (`allowed_nas_id`) REFERENCES `nas` (`id`),
  ADD CONSTRAINT `fk_ppp_radius_identity` FOREIGN KEY (`radius_identity_id`,`identity_kind`) REFERENCES `radius_identities` (`id`, `service_kind`),
  ADD CONSTRAINT `fk_ppp_service` FOREIGN KEY (`service_type_id`) REFERENCES `service_types` (`id`),
  ADD CONSTRAINT `fk_ppp_station_device` FOREIGN KEY (`station_device_id`) REFERENCES `network_equipment_devices` (`id`);

ALTER TABLE `pppoe_account_radius_overrides`
  ADD CONSTRAINT `fk_ppp_route_account` FOREIGN KEY (`account_id`) REFERENCES `pppoe_accounts` (`id`),
  ADD CONSTRAINT `fk_ppp_route_actor` FOREIGN KEY (`updated_by_manager_id`) REFERENCES `managers` (`id`);

ALTER TABLE `pppoe_import_batches`
  ADD CONSTRAINT `fk_pppoe_import_batch_actor` FOREIGN KEY (`created_by`) REFERENCES `managers` (`id`),
  ADD CONSTRAINT `fk_pppoe_import_batch_category` FOREIGN KEY (`category_id`) REFERENCES `customer_categories` (`id`);

ALTER TABLE `pppoe_import_review_rows`
  ADD CONSTRAINT `fk_pppoe_import_review_actor` FOREIGN KEY (`resolved_by`) REFERENCES `managers` (`id`),
  ADD CONSTRAINT `fk_pppoe_import_review_batch` FOREIGN KEY (`batch_id`) REFERENCES `pppoe_import_batches` (`id`);

ALTER TABLE `pppoe_line_speed_boosts`
  ADD CONSTRAINT `fk_line_speed_boost_account` FOREIGN KEY (`account_id`) REFERENCES `pppoe_accounts` (`id`) ON DELETE RESTRICT,
  ADD CONSTRAINT `fk_line_speed_boost_creator` FOREIGN KEY (`created_by`) REFERENCES `managers` (`id`) ON DELETE RESTRICT;

ALTER TABLE `pppoe_packages`
  ADD CONSTRAINT `fk_ppp_currency_reference` FOREIGN KEY (`currency_id`) REFERENCES `currencies` (`id`),
  ADD CONSTRAINT `fk_ppp_package_archiver` FOREIGN KEY (`archived_by`) REFERENCES `managers` (`id`),
  ADD CONSTRAINT `fk_ppp_package_owner` FOREIGN KEY (`owner_manager_id`) REFERENCES `managers` (`id`),
  ADD CONSTRAINT `fk_pppoe_packages_daily` FOREIGN KEY (`daily_package_id`) REFERENCES `pppoe_packages` (`id`);

ALTER TABLE `pppoe_package_speed_boosts`
  ADD CONSTRAINT `fk_profile_speed_boost_creator` FOREIGN KEY (`created_by`) REFERENCES `managers` (`id`) ON DELETE RESTRICT,
  ADD CONSTRAINT `fk_profile_speed_boost_package` FOREIGN KEY (`package_id`) REFERENCES `pppoe_packages` (`id`) ON DELETE RESTRICT;

ALTER TABLE `pppoe_package_versions`
  ADD CONSTRAINT `fk_pppoe_version_package` FOREIGN KEY (`package_id`) REFERENCES `pppoe_packages` (`id`);

ALTER TABLE `pppoe_subscriptions`
  ADD CONSTRAINT `fk_ppp_subscription_account` FOREIGN KEY (`account_id`) REFERENCES `pppoe_accounts` (`id`),
  ADD CONSTRAINT `fk_ppp_subscription_creator` FOREIGN KEY (`created_by`) REFERENCES `managers` (`id`),
  ADD CONSTRAINT `fk_ppp_subscription_parent` FOREIGN KEY (`parent_subscription_id`,`account_id`) REFERENCES `pppoe_subscriptions` (`id`, `account_id`),
  ADD CONSTRAINT `fk_ppp_subscription_previous` FOREIGN KEY (`previous_subscription_id`,`account_id`) REFERENCES `pppoe_subscriptions` (`id`, `account_id`),
  ADD CONSTRAINT `fk_ppp_subscription_version` FOREIGN KEY (`package_version_id`) REFERENCES `pppoe_package_versions` (`id`);

ALTER TABLE `pppoe_subscription_usage`
  ADD CONSTRAINT `fk_ppp_usage_subscription` FOREIGN KEY (`subscription_id`) REFERENCES `pppoe_subscriptions` (`id`);

ALTER TABLE `radius_identities`
  ADD CONSTRAINT `fk_identity_current_name` FOREIGN KEY (`id`,`current_username`) REFERENCES `radius_username_reservations` (`radius_identity_id`, `username`);

ALTER TABLE `radius_username_reservations`
  ADD CONSTRAINT `fk_reserved_identity` FOREIGN KEY (`radius_identity_id`) REFERENCES `radius_identities` (`id`);

ALTER TABLE `username_change_history`
  ADD CONSTRAINT `fk_name_history_actor` FOREIGN KEY (`changed_by`) REFERENCES `managers` (`id`),
  ADD CONSTRAINT `fk_name_history_identity` FOREIGN KEY (`radius_identity_id`) REFERENCES `radius_identities` (`id`),
  ADD CONSTRAINT `fk_name_history_new` FOREIGN KEY (`radius_identity_id`,`new_username`) REFERENCES `radius_username_reservations` (`radius_identity_id`, `username`),
  ADD CONSTRAINT `fk_name_history_old` FOREIGN KEY (`radius_identity_id`,`old_username`) REFERENCES `radius_username_reservations` (`radius_identity_id`, `username`);

INSERT INTO time_units (code,name_ar,calculation_kind,seconds_per_unit,actual_usage_seconds) VALUES
('minute','دقيقة','fixed',60,60),('hour','ساعة','fixed',3600,3600),
('day','يوم','fixed',86400,86400),('week','أسبوع','fixed',604800,604800),('month','شهر','calendar',NULL,2592000)
ON DUPLICATE KEY UPDATE code=VALUES(code);

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

INSERT INTO service_types(id,code,name) VALUES(1,'ftth','FTTH'),(2,'adsl','ADSL'),(3,'wifi_outdoor','WiFi Outdoor');

INSERT INTO connection_methods(id,service_type_id,code,name) VALUES(1,3,'distribution_box','علبة توزيع'),(2,3,'station','Station');

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

INSERT INTO `currencies` (`id`, `code`, `name_ar`, `symbol`, `decimal_places`, `is_enabled`) VALUES
(1, 'SYP', 'الليرة السورية', 'ل.س', 2, 1),
(2, 'USD', 'الدولار الأمريكي', '$', 2, 1),
(3, 'EUR', 'اليورو', '€', 2, 1),
(4, 'TRY', 'الليرة التركية', '₺', 2, 1),
(5, 'SAR', 'الريال السعودي', 'ر.س', 2, 1),
(6, 'AED', 'الدرهم الإماراتي', 'د.إ', 2, 1);

INSERT INTO `data_units` (`id`, `code`, `name_ar`, `bytes_factor`, `is_enabled`) VALUES
(1, 'MB', 'ميغابايت', 1000000, 1),
(2, 'GB', 'غيغابايت', 1000000000, 1),
(3, 'TB', 'تيرابايت', 1000000000000, 1);

INSERT INTO `speed_units` (`id`, `code`, `name_ar`, `bps_factor`, `is_enabled`) VALUES
(1, 'Kbps', 'كيلوبت/ثانية', 1000, 1),
(2, 'Mbps', 'ميغابت/ثانية', 1000000, 1),
(3, 'Gbps', 'غيغابت/ثانية', 1000000000, 1);

DELIMITER $$
CREATE PROCEDURE `rl_customer_phone_unique_v1` ()  BEGIN
 DECLARE acquired INT DEFAULT 0;
 DECLARE duplicate_count INT DEFAULT 0;
 DECLARE lock_name VARCHAR(64);
 DECLARE CONTINUE HANDLER FOR 1061 BEGIN END;
 DECLARE EXIT HANDLER FOR SQLEXCEPTION
 BEGIN
  IF acquired=1 THEN DO RELEASE_LOCK(lock_name); END IF;
  RESIGNAL;
 END;

 IF DATABASE() IS NULL OR DATABASE()='lord_radius_core' OR BINARY LEFT(DATABASE(),10)<>BINARY 'rl_tenant_' THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Select the target rl_tenant_ database; central or unrelated databases are refused';
 END IF;

 SET lock_name=CONCAT('rl-customer-phone:',LEFT(SHA2(DATABASE(),256),40));
 SELECT GET_LOCK(lock_name,0) INTO acquired;
 IF COALESCE(acquired,0)<>1 THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Another customer phone upgrade is running';
 END IF;

 SELECT COUNT(*) INTO duplicate_count FROM (
  SELECT phone FROM customers
  WHERE phone IS NOT NULL AND CHAR_LENGTH(TRIM(phone))>0
  GROUP BY phone HAVING COUNT(*)>1
 ) duplicates_found;
 IF duplicate_count>0 THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Duplicate customer phone numbers exist; inspect the duplicate report and resolve them before retrying';
 END IF;

 ALTER TABLE customers ADD UNIQUE KEY uq_customer_phone (phone);

 DO RELEASE_LOCK(lock_name);
 SET acquired=0;
END$$

CREATE PROCEDURE `rl_pppoe_import_workflow_v1` ()  BEGIN
 DECLARE acquired INT DEFAULT 0;
 DECLARE lock_name VARCHAR(64);
 DECLARE EXIT HANDLER FOR SQLEXCEPTION
 BEGIN
  IF acquired=1 THEN DO RELEASE_LOCK(lock_name); END IF;
  RESIGNAL;
 END;
 IF DATABASE() IS NULL OR DATABASE()='lord_radius_core' OR BINARY LEFT(DATABASE(),10)<>BINARY 'rl_tenant_' THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Select the target rl_tenant_ database; central or unrelated databases are refused';
 END IF;
 SET lock_name=CONCAT('rl-ppp-import:',LEFT(SHA2(DATABASE(),256),40));
 SELECT GET_LOCK(lock_name,0) INTO acquired;
 IF COALESCE(acquired,0)<>1 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Another PPPoE import upgrade is running'; END IF;
 -- Probe the same tables and columns used by the importer without querying information_schema.
 -- This works with tenant SQL accounts that are intentionally denied metadata access.
 SELECT id,manager_id,first_name,last_name,phone,notes,payment_code,created_by_manager_id FROM customers LIMIT 0;
 SELECT id,name,created_by_manager_id FROM customer_categories LIMIT 0;
 SELECT id FROM managers LIMIT 0;
 SELECT category_id,manager_id FROM customer_category_manager_assignments LIMIT 0;
 SELECT customer_id,category_id,manager_id,assigned_by_manager_id FROM customer_category_memberships LIMIT 0;
 SELECT id,current_username,service_kind FROM radius_identities LIMIT 0;
 SELECT username,radius_identity_id FROM radius_username_reservations LIMIT 0;
 SELECT username,attribute,op,value FROM radcheck LIMIT 0;
 SELECT username,groupname,priority FROM radusergroup LIMIT 0;
 SELECT id,customer_id,radius_identity_id,identity_kind,address,service_type_id,connection_method_id,station_device_id,admin_status,created_by FROM pppoe_accounts LIMIT 0;
 SELECT id,account_id,package_version_id,effective_service_snapshot,lifecycle,expires_at FROM pppoe_subscriptions LIMIT 0;
 SELECT subscription_id,upload_bytes,download_bytes FROM pppoe_subscription_usage LIMIT 0;
 SELECT id,name,package_type,is_enabled,archived_at FROM pppoe_packages LIMIT 0;
 SELECT id,package_id,version_no,radius_group_name,service_snapshot,radius_snapshot FROM pppoe_package_versions LIMIT 0;
 SELECT id,nasname FROM nas LIMIT 0;
 SELECT id,radius_nas_id,radius_services,is_enabled,archived_at FROM lord_nas LIMIT 0;
 SELECT id,timezone FROM network_settings LIMIT 0;
 SELECT id,name,code FROM service_types LIMIT 0;
 SELECT id,service_type_id,name,code FROM connection_methods LIMIT 0;
 SELECT groupname,attribute,op,value FROM radgroupreply LIMIT 0;
 SELECT groupname,attribute,op,value FROM radgroupcheck LIMIT 0;
 SELECT username,attribute,op,value FROM radreply LIMIT 0;
 SELECT actor_manager_id,actor_snapshot,actor_kind,action_code,target_type,target_id,customer_id,account_id,after_data,result FROM activity_log LIMIT 0;
 CREATE TABLE IF NOT EXISTS pppoe_import_batches (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  created_by BIGINT UNSIGNED NOT NULL,
  category_id BIGINT UNSIGNED NOT NULL,
  source_name VARCHAR(255) NULL,
  total_rows INT UNSIGNED NOT NULL DEFAULT 0,
  imported_rows INT UNSIGNED NOT NULL DEFAULT 0,
  duplicate_rows INT UNSIGNED NOT NULL DEFAULT 0,
  rejected_rows INT UNSIGNED NOT NULL DEFAULT 0,
  status ENUM('processing','completed','completed_with_issues') NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY(id), KEY idx_pppoe_import_batch_time(created_at,id),
  CONSTRAINT fk_pppoe_import_batch_actor FOREIGN KEY(created_by) REFERENCES managers(id),
  CONSTRAINT fk_pppoe_import_batch_category FOREIGN KEY(category_id) REFERENCES customer_categories(id)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
 CREATE TABLE IF NOT EXISTS pppoe_import_review_rows (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  batch_id BIGINT UNSIGNED NOT NULL,
  source_row_number INT UNSIGNED NOT NULL,
  username VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  reason_code VARCHAR(64) NOT NULL,
  encrypted_payload TEXT NOT NULL,
  resolved_at DATETIME(6) NULL,
  resolved_by BIGINT UNSIGNED NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY(id), UNIQUE KEY uq_pppoe_import_review_source(batch_id,source_row_number),
  KEY idx_pppoe_import_review_open(resolved_at,batch_id,id),
  CONSTRAINT fk_pppoe_import_review_batch FOREIGN KEY(batch_id) REFERENCES pppoe_import_batches(id),
  CONSTRAINT fk_pppoe_import_review_actor FOREIGN KEY(resolved_by) REFERENCES managers(id)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
 SELECT created_by,category_id,status FROM pppoe_import_batches LIMIT 0;
 SELECT batch_id,source_row_number,reason_code,encrypted_payload FROM pppoe_import_review_rows LIMIT 0;
 -- Existing tenant databases have this canonical check; remove it so imports
 -- can preserve a missing surname as an empty string. Fresh templates omit it.
 ALTER TABLE customers DROP CHECK chk_customer_last_name;
 DO RELEASE_LOCK(lock_name); SET acquired=0;
END$$
DELIMITER ;

-- Direct NAS: separate from OpenVPN tunnels; private credentials stay encrypted in nas_management_credentials.
CREATE TABLE IF NOT EXISTS nas_direct_connections (
 nas_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
 management_address VARCHAR(45) NOT NULL,
 radius_address VARCHAR(45) NOT NULL,
 api_source_address VARCHAR(45) NOT NULL,
 configuration_snapshot JSON NOT NULL,
 synced_at DATETIME(6) NOT NULL,
 CONSTRAINT fk_nas_direct_lord FOREIGN KEY(nas_id) REFERENCES lord_nas(id)
) ENGINE=InnoDB;
