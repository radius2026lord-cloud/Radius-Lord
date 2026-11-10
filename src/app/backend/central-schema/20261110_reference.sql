-- Radius Lord central structure reference: 2026-11-10
-- No application data, passwords, users or runtime settings are included.
-- Reference only: not a migration and not a complete fresh-install seed.
SET NAMES utf8mb4;

CREATE TABLE `audit_actions` (
  `id` bigint UNSIGNED NOT NULL,
  `code` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name_ar` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name_en` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `is_active` tinyint(1) NOT NULL DEFAULT '1'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `audit_entity_types` (
  `id` bigint UNSIGNED NOT NULL,
  `code` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name_ar` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name_en` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `is_active` tinyint(1) NOT NULL DEFAULT '1'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `central_audit_logs` (
  `id` bigint UNSIGNED NOT NULL,
  `admin_id` bigint UNSIGNED DEFAULT NULL,
  `tenant_id` bigint UNSIGNED DEFAULT NULL,
  `action_id` bigint UNSIGNED NOT NULL,
  `entity_type_id` bigint UNSIGNED NOT NULL,
  `entity_id` bigint UNSIGNED DEFAULT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `metadata` json DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `currencies` (
  `id` bigint UNSIGNED NOT NULL,
  `code` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name_ar` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name_en` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `symbol` varchar(12) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `sort_order` int UNSIGNED NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `customers` (
  `id` bigint UNSIGNED NOT NULL,
  `full_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `username` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `country` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('active','suspended','disabled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `last_login_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `database_backup_jobs` (
  `id` char(36) NOT NULL,
  `batch_key` varchar(128) NOT NULL,
  `request_key` varchar(220) NOT NULL,
  `server_id` bigint UNSIGNED NOT NULL,
  `database_name` varchar(64) NOT NULL,
  `name` varchar(200) NOT NULL,
  `tenant_id` bigint UNSIGNED DEFAULT NULL,
  `kind` varchar(16) NOT NULL,
  `trigger_type` varchar(16) NOT NULL,
  `actor_id` bigint UNSIGNED DEFAULT NULL,
  `status` varchar(24) NOT NULL DEFAULT 'queued',
  `metadata` json DEFAULT NULL,
  `destinations` json NOT NULL,
  `deliveries` json NOT NULL,
  `delivery_owner` char(36) DEFAULT NULL,
  `delivery_state` varchar(24) NOT NULL DEFAULT 'pending',
  `attempts` int NOT NULL DEFAULT '0',
  `last_error` varchar(160) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `finished_at` datetime(6) DEFAULT NULL,
  `next_attempt_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `removed_at` datetime(6) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `database_backup_verifications` (
  `id` char(36) NOT NULL,
  `request_id` char(36) NOT NULL,
  `backup_id` char(36) NOT NULL,
  `server_id` bigint UNSIGNED NOT NULL,
  `actor_id` bigint UNSIGNED NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'queued',
  `result` json DEFAULT NULL,
  `attempts` int NOT NULL DEFAULT '0',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `started_at` datetime(6) DEFAULT NULL,
  `finished_at` datetime(6) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `database_servers` (
  `id` bigint UNSIGNED NOT NULL,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `host` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `port` smallint UNSIGNED NOT NULL DEFAULT '3306',
  `provisioning_username` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `provisioning_password_encrypted` text COLLATE utf8mb4_unicode_ci,
  `accepts_new_environments` tinyint(1) NOT NULL DEFAULT '0',
  `status` enum('active','maintenance','disabled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'disabled',
  `app_connection_budget` int UNSIGNED NOT NULL DEFAULT '0',
  `radius_connection_budget` int UNSIGNED NOT NULL DEFAULT '0',
  `tls_required` tinyint(1) NOT NULL DEFAULT '1',
  `tls_ca_reference` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `archived_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `deployment_types` (
  `id` bigint UNSIGNED NOT NULL,
  `code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name_ar` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name_en` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `sort_order` int UNSIGNED NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `environment_component_versions` (
  `environment_id` bigint UNSIGNED NOT NULL,
  `component` enum('database','application','radius','template') COLLATE utf8mb4_unicode_ci NOT NULL,
  `release_id` bigint UNSIGNED NOT NULL,
  `verified_at` datetime NOT NULL,
  `installed_at` datetime NOT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `environment_notifications` (
  `id` bigint UNSIGNED NOT NULL,
  `tenant_id` bigint UNSIGNED NOT NULL,
  `environment_id` bigint UNSIGNED NOT NULL,
  `subscription_id` bigint UNSIGNED NOT NULL,
  `provisioning_job_id` bigint UNSIGNED NOT NULL,
  `recipient_phone` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `recipient_source` enum('verified_inbound','verified_customer') COLLATE utf8mb4_unicode_ci NOT NULL,
  `channel` enum('whatsapp') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'whatsapp',
  `idempotency_key` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('pending','sending','sent','failed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `initial_username` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `initial_password_encrypted` text COLLATE utf8mb4_unicode_ci COMMENT 'Delete after successful delivery or credential rotation',
  `credentials_expires_at` datetime DEFAULT NULL,
  `attempt_count` int UNSIGNED NOT NULL DEFAULT '0',
  `next_attempt_at` datetime DEFAULT NULL,
  `lock_token` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `locked_until` datetime DEFAULT NULL,
  `provider_message_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sent_at` datetime DEFAULT NULL,
  `error_code` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `error_message` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `environment_provisioning_jobs` (
  `id` bigint UNSIGNED NOT NULL,
  `tenant_id` bigint UNSIGNED NOT NULL,
  `environment_id` bigint UNSIGNED NOT NULL,
  `subscription_id` bigint UNSIGNED NOT NULL,
  `payment_order_id` bigint UNSIGNED NOT NULL,
  `requested_by_master_admin_id` bigint UNSIGNED NOT NULL,
  `idempotency_key` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('queued','running','success','failed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'queued',
  `current_step` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `attempt_count` int UNSIGNED NOT NULL DEFAULT '0',
  `available_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `lock_token` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `locked_until` datetime DEFAULT NULL,
  `started_at` datetime DEFAULT NULL,
  `finished_at` datetime DEFAULT NULL,
  `error_code` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `error_message` text COLLATE utf8mb4_unicode_ci,
  `active_environment_id` bigint UNSIGNED GENERATED ALWAYS AS ((case when (`status` in (_utf8mb4'queued',_utf8mb4'running')) then `environment_id` else NULL end)) STORED,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `environment_provisioning_steps` (
  `id` bigint UNSIGNED NOT NULL,
  `job_id` bigint UNSIGNED NOT NULL,
  `step_code` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('pending','running','success','failed','skipped') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `attempt_count` int UNSIGNED NOT NULL DEFAULT '0',
  `resource_reference` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `started_at` datetime DEFAULT NULL,
  `finished_at` datetime DEFAULT NULL,
  `error_code` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `error_message` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `environment_releases` (
  `id` bigint UNSIGNED NOT NULL,
  `component` enum('database','application','radius','template') COLLATE utf8mb4_unicode_ci NOT NULL,
  `version` varchar(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `artifact_sha256` char(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `artifact_reference` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `minimum_compatible_version` varchar(64) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `rollout_policy` enum('manual','online_compatible') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'manual',
  `status` enum('draft','approved','withdrawn') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft',
  `approved_by_master_admin_id` bigint UNSIGNED DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE `environment_upgrade_jobs` (
  `id` bigint UNSIGNED NOT NULL,
  `environment_id` bigint UNSIGNED NOT NULL,
  `component` enum('database','application','radius','template') COLLATE utf8mb4_unicode_ci NOT NULL,
  `from_release_id` bigint UNSIGNED NOT NULL,
  `to_release_id` bigint UNSIGNED NOT NULL,
  `idempotency_key` varchar(190) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `requested_by_master_admin_id` bigint UNSIGNED NOT NULL,
  `status` enum('blocked','queued','running','success','failed','cancelled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'blocked',
  `backup_reference` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `compatibility_verified_at` datetime DEFAULT NULL,
  `health_verified_at` datetime DEFAULT NULL,
  `lock_token` varchar(64) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `locked_until` datetime DEFAULT NULL,
  `started_at` datetime DEFAULT NULL,
  `finished_at` datetime DEFAULT NULL,
  `error_code` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `error_message` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `active_environment_id` bigint UNSIGNED GENERATED ALWAYS AS ((case when (`status` in (_utf8mb4'queued',_utf8mb4'running')) then `environment_id` else NULL end)) STORED,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE `lord_nas` (
  `id` bigint UNSIGNED NOT NULL,
  `tenant_id` bigint UNSIGNED NOT NULL,
  `radius_nas_id` bigint UNSIGNED DEFAULT NULL,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `host` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `vendor` enum('mikrotik','ubiquiti','cisco','other') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'mikrotik',
  `model` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `auth_port` smallint UNSIGNED NOT NULL DEFAULT '1812',
  `acct_port` smallint UNSIGNED NOT NULL DEFAULT '1813',
  `coa_port` smallint UNSIGNED NOT NULL DEFAULT '3799',
  `location` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('active','suspended','disabled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `connection_status` enum('online','offline','unknown') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'unknown',
  `last_seen_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `lord_nas_api_credentials` (
  `id` bigint UNSIGNED NOT NULL,
  `nas_id` bigint UNSIGNED NOT NULL,
  `enabled` tinyint(1) NOT NULL DEFAULT '1',
  `api_host` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `api_port` smallint UNSIGNED NOT NULL DEFAULT '8728',
  `use_ssl` tinyint(1) NOT NULL DEFAULT '0',
  `username` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `password_encrypted` text COLLATE utf8mb4_unicode_ci,
  `status` enum('connected','disconnected','error','unknown') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'unknown',
  `last_connected_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `lord_nas_endpoints` (
  `id` bigint UNSIGNED NOT NULL,
  `nas_id` bigint UNSIGNED NOT NULL,
  `service_type` enum('api','api_ssl','winbox','webfig','ssh','coa','custom') COLLATE utf8mb4_unicode_ci NOT NULL,
  `host` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `port` smallint UNSIGNED DEFAULT NULL,
  `external_host` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `external_port` smallint UNSIGNED DEFAULT NULL,
  `protocol` enum('tcp','udp','http','https') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'tcp',
  `enabled` tinyint(1) NOT NULL DEFAULT '1',
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `lord_nas_status_logs` (
  `id` bigint UNSIGNED NOT NULL,
  `nas_id` bigint UNSIGNED NOT NULL,
  `status` enum('online','offline','timeout','error') COLLATE utf8mb4_unicode_ci NOT NULL,
  `response_time_ms` int UNSIGNED DEFAULT NULL,
  `message` text COLLATE utf8mb4_unicode_ci,
  `checked_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `master_admins` (
  `id` bigint UNSIGNED NOT NULL,
  `full_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `username` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(190) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('active','suspended','disabled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `last_login_at` datetime DEFAULT NULL,
  `last_login_ip` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `nas_registry` (
  `id` bigint UNSIGNED NOT NULL,
  `tenant_id` bigint UNSIGNED NOT NULL,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nas_ip` varchar(45) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nas_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'MikroTik',
  `radius_secret` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `auth_port` smallint UNSIGNED NOT NULL DEFAULT '1812',
  `acct_port` smallint UNSIGNED NOT NULL DEFAULT '1813',
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('active','inactive','disabled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `last_seen_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `nas_tunnels` (
  `id` bigint UNSIGNED NOT NULL,
  `environment_id` bigint UNSIGNED NOT NULL,
  `ovpn_gateway_id` bigint UNSIGNED NOT NULL,
  `tenant_nas_id` bigint UNSIGNED DEFAULT NULL COMMENT 'Logical reference to NAS in tenant database; NULL during reservation',
  `reservation_slot` smallint UNSIGNED DEFAULT NULL,
  `tunnel_username` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tunnel_password_encrypted` text COLLATE utf8mb4_unicode_ci,
  `tunnel_address` varchar(45) COLLATE utf8mb4_unicode_ci NOT NULL,
  `certificate_reference` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('reserved','provisioning','awaiting_link','connected','disconnected','failed','disabled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'reserved',
  `last_seen_at` datetime DEFAULT NULL,
  `archived_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `network_followup_alert_settings` (
  `environment_id` bigint UNSIGNED NOT NULL,
  `expiry_days` tinyint UNSIGNED NOT NULL DEFAULT '7',
  `quota_percent` tinyint UNSIGNED NOT NULL DEFAULT '80',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `ovpn_gateways` (
  `id` bigint UNSIGNED NOT NULL,
  `settings_json` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `api_password_encrypted` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_by_master_admin_id` bigint UNSIGNED DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `payment_orders` (
  `id` bigint UNSIGNED NOT NULL,
  `payment_code` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `customer_id` bigint UNSIGNED NOT NULL,
  `subscription_id` bigint UNSIGNED DEFAULT NULL,
  `plan_id` bigint UNSIGNED DEFAULT NULL,
  `deployment_type_id` bigint UNSIGNED DEFAULT NULL,
  `payment_purpose` enum('initial_subscription','renewal','upgrade','addon_purchase') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'initial_subscription',
  `plan_name_snapshot` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `duration_months_snapshot` int UNSIGNED NOT NULL,
  `deployment_name_snapshot` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `base_price` decimal(12,2) NOT NULL DEFAULT '0.00',
  `addons_total` decimal(12,2) NOT NULL DEFAULT '0.00',
  `total_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `currency_code` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `addons_snapshot` json DEFAULT NULL,
  `plan_limits_snapshot` json DEFAULT NULL,
  `payment_method` enum('whatsapp_manual') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'whatsapp_manual',
  `status` enum('pending','awaiting_confirmation','paid','completed','cancelled','expired','manual_authorized') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `requested_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `paid_at` timestamp NULL DEFAULT NULL,
  `completed_at` timestamp NULL DEFAULT NULL,
  `cancelled_at` timestamp NULL DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `confirmed_by_master_admin_id` bigint UNSIGNED DEFAULT NULL,
  `admin_note` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `tenant_id` bigint UNSIGNED DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `payment_order_events` (
  `id` bigint UNSIGNED NOT NULL,
  `payment_order_id` bigint UNSIGNED NOT NULL,
  `event_type` enum('created','sent_to_whatsapp','awaiting_confirmation','confirmed_paid','completed','cancelled','expired','note_added') COLLATE utf8mb4_unicode_ci NOT NULL,
  `from_status` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `to_status` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `master_admin_id` bigint UNSIGNED DEFAULT NULL,
  `note` text COLLATE utf8mb4_unicode_ci,
  `metadata` json DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `payment_plans` (
  `id` bigint UNSIGNED NOT NULL,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `duration_months` int UNSIGNED NOT NULL,
  `max_tenants` int UNSIGNED NOT NULL DEFAULT '1',
  `max_subscribers` int UNSIGNED NOT NULL DEFAULT '0',
  `max_nas` int UNSIGNED NOT NULL DEFAULT '0',
  `price` decimal(10,2) NOT NULL DEFAULT '0.00',
  `currency` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'USD',
  `currency_id` bigint UNSIGNED DEFAULT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `is_featured` tinyint(1) NOT NULL DEFAULT '0',
  `status` enum('active','inactive','disabled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `plan_addons` (
  `id` bigint UNSIGNED NOT NULL,
  `plan_id` bigint UNSIGNED NOT NULL,
  `deployment_type_id` bigint UNSIGNED NOT NULL,
  `code` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name_ar` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name_en` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `price` decimal(12,2) NOT NULL DEFAULT '0.00',
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `sort_order` int UNSIGNED NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `plan_deployment_options` (
  `id` bigint UNSIGNED NOT NULL,
  `plan_id` bigint UNSIGNED NOT NULL,
  `deployment_type_id` bigint UNSIGNED NOT NULL,
  `price` decimal(12,2) NOT NULL DEFAULT '0.00',
  `is_default` tinyint(1) NOT NULL DEFAULT '0',
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `platform_settings` (
  `id` bigint UNSIGNED NOT NULL,
  `setting_group` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `setting_key` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `setting_value` text COLLATE utf8mb4_unicode_ci,
  `value_type` enum('string','text','boolean','number','json') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'string',
  `is_public` tinyint(1) NOT NULL DEFAULT '0',
  `updated_by_master_admin_id` bigint UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `schema_versions` (
  `id` bigint UNSIGNED NOT NULL,
  `tenant_id` bigint UNSIGNED NOT NULL,
  `version` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('pending','running','success','failed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `applied_at` datetime DEFAULT NULL,
  `error_message` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `server_ssh_connections` (
  `database_server_id` bigint UNSIGNED NOT NULL,
  `host` varchar(253) COLLATE utf8mb4_unicode_ci NOT NULL,
  `port` int UNSIGNED NOT NULL,
  `username` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `auth_method` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL,
  `secret_encrypted` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `passphrase_encrypted` text COLLATE utf8mb4_unicode_ci,
  `host_fingerprint` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `subscriptions` (
  `id` bigint UNSIGNED NOT NULL,
  `tenant_id` bigint UNSIGNED NOT NULL,
  `plan_id` bigint UNSIGNED DEFAULT NULL,
  `starts_at` datetime DEFAULT NULL,
  `expires_at` datetime DEFAULT NULL,
  `status` enum('pending','active','expired','cancelled','suspended') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `auto_renew` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `plan_limits_snapshot` json DEFAULT NULL,
  `duration_months_snapshot` int UNSIGNED DEFAULT NULL,
  `deployment_type_id` bigint UNSIGNED DEFAULT NULL,
  `activated_at` datetime DEFAULT NULL,
  `archived_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `subscription_addons` (
  `id` bigint UNSIGNED NOT NULL,
  `tenant_id` bigint UNSIGNED NOT NULL,
  `subscription_id` bigint UNSIGNED NOT NULL,
  `plan_addon_id` bigint UNSIGNED NOT NULL,
  `payment_order_id` bigint UNSIGNED DEFAULT NULL,
  `addon_code_snapshot` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `addon_name_snapshot` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity` int UNSIGNED NOT NULL,
  `nas_capacity_increment` int UNSIGNED NOT NULL DEFAULT '0',
  `unit_price_snapshot` decimal(12,2) DEFAULT NULL,
  `currency_code_snapshot` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('pending','active','expired','cancelled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `activated_at` datetime DEFAULT NULL,
  `expires_at` datetime DEFAULT NULL COMMENT 'NULL does not imply a perpetual entitlement',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE `subscription_licenses` (
  `id` bigint UNSIGNED NOT NULL,
  `subscription_id` bigint UNSIGNED DEFAULT NULL COMMENT 'Current subscription; network license stays fixed',
  `tenant_id` bigint UNSIGNED NOT NULL,
  `license_key` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('pending','active','suspended','expired','revoked') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `activated_at` timestamp NULL DEFAULT NULL,
  `starts_at` timestamp NULL DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `suspended_at` timestamp NULL DEFAULT NULL,
  `revoked_at` timestamp NULL DEFAULT NULL,
  `last_renewed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `tenants` (
  `id` bigint UNSIGNED NOT NULL,
  `license_number` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `logo` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('active','suspended','expired','disabled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `customer_id` bigint UNSIGNED DEFAULT NULL COMMENT 'Legacy owners require explicit reconciliation',
  `archived_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `tenant_databases` (
  `id` bigint UNSIGNED NOT NULL,
  `tenant_id` bigint UNSIGNED NOT NULL,
  `db_host` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `db_port` smallint UNSIGNED NOT NULL DEFAULT '3306',
  `db_name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `db_username` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `db_password` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('active','inactive','maintenance','error') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `schema_version` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `database_server_id` bigint UNSIGNED DEFAULT NULL,
  `app_password_encrypted` text COLLATE utf8mb4_unicode_ci,
  `radius_username` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `radius_password_encrypted` text COLLATE utf8mb4_unicode_ci,
  `credentials_state` enum('legacy','ready') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'legacy',
  `app_pool_limit` int UNSIGNED NOT NULL DEFAULT '0',
  `radius_pool_limit` int UNSIGNED NOT NULL DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `tenant_environments` (
  `id` bigint UNSIGNED NOT NULL,
  `tenant_id` bigint UNSIGNED NOT NULL,
  `tenant_database_id` bigint UNSIGNED DEFAULT NULL,
  `deployment_type_id` bigint UNSIGNED NOT NULL,
  `system_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('pending','provisioning','ready','failed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `ready_at` datetime DEFAULT NULL,
  `archived_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `tenant_environment_status` (
  `id` bigint UNSIGNED NOT NULL,
  `environment_id` bigint UNSIGNED NOT NULL,
  `last_seen_at` datetime DEFAULT NULL,
  `reported_at` datetime DEFAULT NULL,
  `radius_status` enum('healthy','degraded','unavailable','unknown') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'unknown',
  `database_status` enum('healthy','degraded','unavailable','unknown') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'unknown',
  `pppoe_accounts_count` bigint UNSIGNED DEFAULT NULL,
  `online_users_count` bigint UNSIGNED DEFAULT NULL,
  `active_sessions_count` bigint UNSIGNED DEFAULT NULL,
  `nas_count` int UNSIGNED DEFAULT NULL,
  `online_nas_count` int UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `tenant_managers` (
  `id` bigint UNSIGNED NOT NULL,
  `tenant_id` bigint UNSIGNED NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(190) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('active','suspended','disabled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `last_login_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `user_ui_preferences` (
  `owner_key` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `preferences_json` json NOT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `audit_actions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_audit_action_code` (`code`),
  ADD KEY `idx_audit_action_active` (`is_active`);

ALTER TABLE `audit_entity_types`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_audit_entity_code` (`code`),
  ADD KEY `idx_audit_entity_active` (`is_active`);

ALTER TABLE `central_audit_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_audit_admin` (`admin_id`),
  ADD KEY `idx_audit_tenant` (`tenant_id`),
  ADD KEY `idx_audit_action` (`action_id`),
  ADD KEY `idx_audit_entity_type` (`entity_type_id`),
  ADD KEY `idx_audit_entity` (`entity_type_id`,`entity_id`),
  ADD KEY `idx_audit_created_at` (`created_at`),
  ADD KEY `idx_audit_tenant_created` (`tenant_id`,`created_at`);

ALTER TABLE `currencies`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_currencies_code` (`code`);

ALTER TABLE `customers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_customer_email` (`email`),
  ADD UNIQUE KEY `uq_customer_phone` (`phone`),
  ADD UNIQUE KEY `uq_customer_username` (`username`),
  ADD KEY `idx_customer_status` (`status`);

ALTER TABLE `database_backup_jobs`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `request_key` (`request_key`),
  ADD KEY `backup_queue` (`status`,`next_attempt_at`),
  ADD KEY `backup_retention` (`server_id`,`database_name`,`status`,`finished_at`),
  ADD KEY `backup_batch_targets` (`batch_key`,`kind`,`server_id`,`database_name`,`created_at`);

ALTER TABLE `database_backup_verifications`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `request_id` (`request_id`),
  ADD KEY `verification_queue` (`status`,`created_at`),
  ADD KEY `verification_source` (`backup_id`,`created_at`);

ALTER TABLE `database_servers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_database_server_endpoint` (`host`,`port`);

ALTER TABLE `deployment_types`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_deployment_types_code` (`code`);

ALTER TABLE `environment_component_versions`
  ADD PRIMARY KEY (`environment_id`,`component`),
  ADD KEY `fk_component_release` (`release_id`,`component`);

ALTER TABLE `environment_notifications`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_notification_idempotency` (`idempotency_key`),
  ADD KEY `idx_notification_queue` (`status`,`next_attempt_at`),
  ADD KEY `fk_notification_network` (`tenant_id`),
  ADD KEY `fk_notification_environment_scope` (`environment_id`,`tenant_id`),
  ADD KEY `fk_notification_subscription_scope` (`subscription_id`,`tenant_id`),
  ADD KEY `fk_notification_job_scope` (`provisioning_job_id`,`tenant_id`,`environment_id`,`subscription_id`);

ALTER TABLE `environment_provisioning_jobs`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_provision_idempotency` (`idempotency_key`),
  ADD UNIQUE KEY `uq_provision_id_network_environment` (`id`,`tenant_id`,`environment_id`,`subscription_id`),
  ADD UNIQUE KEY `uq_provision_active_environment` (`active_environment_id`),
  ADD KEY `idx_provision_queue` (`status`,`available_at`),
  ADD KEY `fk_provision_network` (`tenant_id`),
  ADD KEY `fk_provision_environment_scope` (`environment_id`,`tenant_id`),
  ADD KEY `fk_provision_subscription_scope` (`subscription_id`,`tenant_id`),
  ADD KEY `fk_provision_payment_scope` (`payment_order_id`,`subscription_id`,`tenant_id`),
  ADD KEY `fk_provision_admin` (`requested_by_master_admin_id`);

ALTER TABLE `environment_provisioning_steps`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_provision_step` (`job_id`,`step_code`);

ALTER TABLE `environment_releases`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_release_component_version` (`component`,`version`),
  ADD UNIQUE KEY `uq_release_id_component` (`id`,`component`);

ALTER TABLE `environment_upgrade_jobs`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_upgrade_request` (`idempotency_key`),
  ADD UNIQUE KEY `uq_upgrade_active_environment` (`active_environment_id`),
  ADD KEY `idx_upgrade_queue` (`status`,`created_at`),
  ADD KEY `fk_upgrade_environment` (`environment_id`),
  ADD KEY `fk_upgrade_from` (`from_release_id`,`component`),
  ADD KEY `fk_upgrade_to` (`to_release_id`,`component`);

ALTER TABLE `lord_nas`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_lord_nas_tenant_host` (`tenant_id`,`host`),
  ADD KEY `idx_lord_nas_tenant` (`tenant_id`),
  ADD KEY `idx_lord_nas_radius_id` (`radius_nas_id`),
  ADD KEY `idx_lord_nas_status` (`status`),
  ADD KEY `idx_lord_nas_connection` (`connection_status`),
  ADD KEY `idx_lord_nas_vendor` (`vendor`);

ALTER TABLE `lord_nas_api_credentials`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_nas_api_credentials` (`nas_id`),
  ADD KEY `idx_nas_api_status` (`status`);

ALTER TABLE `lord_nas_endpoints`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_nas_endpoint_nas` (`nas_id`),
  ADD KEY `idx_nas_endpoint_service` (`service_type`),
  ADD KEY `idx_nas_endpoint_enabled` (`enabled`);

ALTER TABLE `lord_nas_status_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_nas_status_logs_nas` (`nas_id`),
  ADD KEY `idx_nas_status_logs_checked` (`checked_at`),
  ADD KEY `idx_nas_status_logs_nas_checked` (`nas_id`,`checked_at`),
  ADD KEY `idx_nas_status_logs_status` (`status`);

ALTER TABLE `master_admins`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_master_admin_username` (`username`),
  ADD UNIQUE KEY `uq_master_admin_email` (`email`),
  ADD KEY `idx_master_admin_status` (`status`);

ALTER TABLE `nas_registry`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_tenant_nas_ip` (`tenant_id`,`nas_ip`),
  ADD KEY `idx_nas_tenant` (`tenant_id`),
  ADD KEY `idx_nas_status` (`status`),
  ADD KEY `idx_nas_ip` (`nas_ip`);

ALTER TABLE `nas_tunnels`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_tunnel_gateway_username` (`ovpn_gateway_id`,`tunnel_username`),
  ADD UNIQUE KEY `uq_tunnel_gateway_address` (`ovpn_gateway_id`,`tunnel_address`),
  ADD UNIQUE KEY `uq_tunnel_environment_nas` (`environment_id`,`tenant_nas_id`),
  ADD UNIQUE KEY `uq_tunnel_environment_slot` (`environment_id`,`reservation_slot`),
  ADD KEY `idx_tunnel_environment_status` (`environment_id`,`status`);

ALTER TABLE `network_followup_alert_settings`
  ADD PRIMARY KEY (`environment_id`);

ALTER TABLE `ovpn_gateways`
  ADD PRIMARY KEY (`id`);

ALTER TABLE `payment_orders`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_payment_orders_code` (`payment_code`),
  ADD UNIQUE KEY `uq_payment_id_subscription_tenant` (`id`,`subscription_id`,`tenant_id`),
  ADD KEY `idx_payment_orders_customer_date` (`customer_id`,`created_at`),
  ADD KEY `idx_payment_orders_purpose_date` (`payment_purpose`,`created_at`),
  ADD KEY `idx_payment_orders_status_date` (`status`,`created_at`),
  ADD KEY `idx_payment_orders_subscription` (`subscription_id`),
  ADD KEY `idx_payment_orders_plan` (`plan_id`),
  ADD KEY `fk_payment_orders_deployment` (`deployment_type_id`),
  ADD KEY `idx_payment_tenant_paid` (`tenant_id`,`paid_at`),
  ADD KEY `fk_payment_subscription_scope` (`subscription_id`,`tenant_id`);

ALTER TABLE `payment_order_events`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_payment_order_events_order_date` (`payment_order_id`,`created_at`),
  ADD KEY `idx_payment_order_events_type_date` (`event_type`,`created_at`);

ALTER TABLE `payment_plans`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_payment_plan_status` (`status`),
  ADD KEY `idx_payment_plan_featured` (`is_featured`);

ALTER TABLE `plan_addons`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_plan_addon` (`plan_id`,`deployment_type_id`,`code`),
  ADD KEY `idx_plan_addon_deployment_type` (`deployment_type_id`);

ALTER TABLE `plan_deployment_options`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_plan_deployment` (`plan_id`,`deployment_type_id`),
  ADD KEY `idx_plan_deployment_type` (`deployment_type_id`);

ALTER TABLE `platform_settings`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_platform_setting` (`setting_group`,`setting_key`),
  ADD KEY `idx_platform_settings_group` (`setting_group`);

ALTER TABLE `schema_versions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_schema_tenant` (`tenant_id`),
  ADD KEY `idx_schema_version` (`version`),
  ADD KEY `idx_schema_status` (`status`);

ALTER TABLE `server_ssh_connections`
  ADD PRIMARY KEY (`database_server_id`);

ALTER TABLE `subscriptions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_subscription_id_tenant` (`id`,`tenant_id`),
  ADD KEY `idx_subscription_tenant` (`tenant_id`),
  ADD KEY `idx_subscription_plan` (`plan_id`),
  ADD KEY `idx_subscription_status` (`status`),
  ADD KEY `idx_subscription_expiry` (`expires_at`),
  ADD KEY `idx_subscription_tenant_status` (`tenant_id`,`status`),
  ADD KEY `fk_subscription_deployment` (`deployment_type_id`);

ALTER TABLE `subscription_addons`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_subscription_addon_status` (`subscription_id`,`status`),
  ADD KEY `fk_addon_network` (`tenant_id`),
  ADD KEY `fk_addon_subscription_scope` (`subscription_id`,`tenant_id`),
  ADD KEY `fk_addon_payment_scope` (`payment_order_id`,`subscription_id`,`tenant_id`),
  ADD KEY `fk_addon_definition` (`plan_addon_id`);

ALTER TABLE `subscription_licenses`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_subscription_license_key` (`license_key`),
  ADD UNIQUE KEY `uq_license_network` (`tenant_id`),
  ADD UNIQUE KEY `uq_subscription_license_subscription` (`subscription_id`),
  ADD KEY `idx_subscription_license_status_expiry` (`status`,`expires_at`),
  ADD KEY `idx_subscription_license_tenant` (`tenant_id`),
  ADD KEY `fk_license_subscription_scope` (`subscription_id`,`tenant_id`);

ALTER TABLE `tenants`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_tenant_license` (`license_number`),
  ADD UNIQUE KEY `uq_tenant_slug` (`slug`),
  ADD KEY `idx_tenant_status` (`status`),
  ADD KEY `idx_tenant_name` (`name`),
  ADD KEY `idx_tenant_owner` (`customer_id`);

ALTER TABLE `tenant_databases`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_tenant_database_tenant` (`tenant_id`),
  ADD UNIQUE KEY `uq_tenant_database_name_host` (`db_host`,`db_name`),
  ADD UNIQUE KEY `uq_tenant_database_id_tenant` (`id`,`tenant_id`),
  ADD KEY `idx_tenant_database_status` (`status`),
  ADD KEY `fk_tenant_database_server` (`database_server_id`);

ALTER TABLE `tenant_environments`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_environment_network` (`tenant_id`),
  ADD UNIQUE KEY `uq_environment_id_tenant` (`id`,`tenant_id`),
  ADD UNIQUE KEY `uq_environment_database` (`tenant_database_id`),
  ADD KEY `fk_environment_database_scope` (`tenant_database_id`,`tenant_id`),
  ADD KEY `fk_environment_deployment` (`deployment_type_id`);

ALTER TABLE `tenant_environment_status`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_environment_status` (`environment_id`),
  ADD KEY `idx_environment_last_seen` (`last_seen_at`);

ALTER TABLE `tenant_managers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_tenant_manager_tenant` (`tenant_id`),
  ADD UNIQUE KEY `uq_tenant_manager_email` (`email`);

ALTER TABLE `user_ui_preferences`
  ADD PRIMARY KEY (`owner_key`);

ALTER TABLE `audit_actions`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `audit_entity_types`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `central_audit_logs`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `currencies`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `customers`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `database_servers`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `deployment_types`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `environment_notifications`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `environment_provisioning_jobs`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `environment_provisioning_steps`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `environment_releases`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `environment_upgrade_jobs`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `lord_nas`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `lord_nas_api_credentials`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `lord_nas_endpoints`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `lord_nas_status_logs`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `master_admins`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `nas_registry`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `nas_tunnels`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `ovpn_gateways`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `payment_orders`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `payment_order_events`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `payment_plans`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `plan_addons`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `plan_deployment_options`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `platform_settings`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `schema_versions`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `subscriptions`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `subscription_addons`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `subscription_licenses`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `tenants`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `tenant_databases`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `tenant_environments`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `tenant_environment_status`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `tenant_managers`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `central_audit_logs`
  ADD CONSTRAINT `fk_audit_action` FOREIGN KEY (`action_id`) REFERENCES `audit_actions` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_audit_admin` FOREIGN KEY (`admin_id`) REFERENCES `master_admins` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_audit_entity_type` FOREIGN KEY (`entity_type_id`) REFERENCES `audit_entity_types` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_audit_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `environment_component_versions`
  ADD CONSTRAINT `fk_component_environment` FOREIGN KEY (`environment_id`) REFERENCES `tenant_environments` (`id`) ON DELETE RESTRICT,
  ADD CONSTRAINT `fk_component_release` FOREIGN KEY (`release_id`,`component`) REFERENCES `environment_releases` (`id`, `component`) ON DELETE RESTRICT;

ALTER TABLE `environment_notifications`
  ADD CONSTRAINT `fk_notification_environment_scope` FOREIGN KEY (`environment_id`,`tenant_id`) REFERENCES `tenant_environments` (`id`, `tenant_id`) ON DELETE RESTRICT,
  ADD CONSTRAINT `fk_notification_job_scope` FOREIGN KEY (`provisioning_job_id`,`tenant_id`,`environment_id`,`subscription_id`) REFERENCES `environment_provisioning_jobs` (`id`, `tenant_id`, `environment_id`, `subscription_id`) ON DELETE RESTRICT,
  ADD CONSTRAINT `fk_notification_network` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT,
  ADD CONSTRAINT `fk_notification_subscription_scope` FOREIGN KEY (`subscription_id`,`tenant_id`) REFERENCES `subscriptions` (`id`, `tenant_id`) ON DELETE RESTRICT;

ALTER TABLE `environment_provisioning_jobs`
  ADD CONSTRAINT `fk_provision_admin` FOREIGN KEY (`requested_by_master_admin_id`) REFERENCES `master_admins` (`id`) ON DELETE RESTRICT,
  ADD CONSTRAINT `fk_provision_environment_scope` FOREIGN KEY (`environment_id`,`tenant_id`) REFERENCES `tenant_environments` (`id`, `tenant_id`) ON DELETE RESTRICT,
  ADD CONSTRAINT `fk_provision_network` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT,
  ADD CONSTRAINT `fk_provision_payment_scope` FOREIGN KEY (`payment_order_id`,`subscription_id`,`tenant_id`) REFERENCES `payment_orders` (`id`, `subscription_id`, `tenant_id`) ON DELETE RESTRICT,
  ADD CONSTRAINT `fk_provision_subscription_scope` FOREIGN KEY (`subscription_id`,`tenant_id`) REFERENCES `subscriptions` (`id`, `tenant_id`) ON DELETE RESTRICT;

ALTER TABLE `environment_provisioning_steps`
  ADD CONSTRAINT `fk_step_job` FOREIGN KEY (`job_id`) REFERENCES `environment_provisioning_jobs` (`id`) ON DELETE RESTRICT;

ALTER TABLE `environment_upgrade_jobs`
  ADD CONSTRAINT `fk_upgrade_environment` FOREIGN KEY (`environment_id`) REFERENCES `tenant_environments` (`id`) ON DELETE RESTRICT,
  ADD CONSTRAINT `fk_upgrade_from` FOREIGN KEY (`from_release_id`,`component`) REFERENCES `environment_releases` (`id`, `component`) ON DELETE RESTRICT,
  ADD CONSTRAINT `fk_upgrade_to` FOREIGN KEY (`to_release_id`,`component`) REFERENCES `environment_releases` (`id`, `component`) ON DELETE RESTRICT;

ALTER TABLE `lord_nas`
  ADD CONSTRAINT `fk_lord_nas_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `lord_nas_api_credentials`
  ADD CONSTRAINT `fk_nas_api_credentials_nas` FOREIGN KEY (`nas_id`) REFERENCES `lord_nas` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `lord_nas_endpoints`
  ADD CONSTRAINT `fk_nas_endpoint_nas` FOREIGN KEY (`nas_id`) REFERENCES `lord_nas` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `lord_nas_status_logs`
  ADD CONSTRAINT `fk_nas_status_logs_nas` FOREIGN KEY (`nas_id`) REFERENCES `lord_nas` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `nas_registry`
  ADD CONSTRAINT `fk_nas_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `nas_tunnels`
  ADD CONSTRAINT `fk_tunnel_environment` FOREIGN KEY (`environment_id`) REFERENCES `tenant_environments` (`id`) ON DELETE RESTRICT,
  ADD CONSTRAINT `fk_tunnel_gateway` FOREIGN KEY (`ovpn_gateway_id`) REFERENCES `ovpn_gateways` (`id`) ON DELETE RESTRICT;

ALTER TABLE `payment_orders`
  ADD CONSTRAINT `fk_payment_orders_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`),
  ADD CONSTRAINT `fk_payment_orders_deployment` FOREIGN KEY (`deployment_type_id`) REFERENCES `deployment_types` (`id`),
  ADD CONSTRAINT `fk_payment_orders_plan` FOREIGN KEY (`plan_id`) REFERENCES `payment_plans` (`id`),
  ADD CONSTRAINT `fk_payment_orders_subscription` FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_payment_orders_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_payment_subscription_scope` FOREIGN KEY (`subscription_id`,`tenant_id`) REFERENCES `subscriptions` (`id`, `tenant_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `payment_order_events`
  ADD CONSTRAINT `fk_payment_order_events_order` FOREIGN KEY (`payment_order_id`) REFERENCES `payment_orders` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `plan_addons`
  ADD CONSTRAINT `fk_plan_addon_deployment_type` FOREIGN KEY (`deployment_type_id`) REFERENCES `deployment_types` (`id`),
  ADD CONSTRAINT `fk_plan_addon_plan` FOREIGN KEY (`plan_id`) REFERENCES `payment_plans` (`id`) ON DELETE CASCADE;

ALTER TABLE `plan_deployment_options`
  ADD CONSTRAINT `fk_plan_deployment_plan` FOREIGN KEY (`plan_id`) REFERENCES `payment_plans` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_plan_deployment_type` FOREIGN KEY (`deployment_type_id`) REFERENCES `deployment_types` (`id`);

ALTER TABLE `schema_versions`
  ADD CONSTRAINT `fk_schema_version_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `subscriptions`
  ADD CONSTRAINT `fk_subscription_deployment` FOREIGN KEY (`deployment_type_id`) REFERENCES `deployment_types` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_subscription_plan` FOREIGN KEY (`plan_id`) REFERENCES `payment_plans` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_subscription_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `subscription_addons`
  ADD CONSTRAINT `fk_addon_definition` FOREIGN KEY (`plan_addon_id`) REFERENCES `plan_addons` (`id`) ON DELETE RESTRICT,
  ADD CONSTRAINT `fk_addon_network` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT,
  ADD CONSTRAINT `fk_addon_payment_scope` FOREIGN KEY (`payment_order_id`,`subscription_id`,`tenant_id`) REFERENCES `payment_orders` (`id`, `subscription_id`, `tenant_id`) ON DELETE RESTRICT,
  ADD CONSTRAINT `fk_addon_subscription_scope` FOREIGN KEY (`subscription_id`,`tenant_id`) REFERENCES `subscriptions` (`id`, `tenant_id`) ON DELETE RESTRICT;

ALTER TABLE `subscription_licenses`
  ADD CONSTRAINT `fk_license_subscription_scope` FOREIGN KEY (`subscription_id`,`tenant_id`) REFERENCES `subscriptions` (`id`, `tenant_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_subscription_licenses_subscription` FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_subscription_licenses_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `tenants`
  ADD CONSTRAINT `fk_tenant_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `tenant_databases`
  ADD CONSTRAINT `fk_tenant_database_server` FOREIGN KEY (`database_server_id`) REFERENCES `database_servers` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_tenant_database_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `tenant_environments`
  ADD CONSTRAINT `fk_environment_database_scope` FOREIGN KEY (`tenant_database_id`,`tenant_id`) REFERENCES `tenant_databases` (`id`, `tenant_id`) ON DELETE RESTRICT,
  ADD CONSTRAINT `fk_environment_deployment` FOREIGN KEY (`deployment_type_id`) REFERENCES `deployment_types` (`id`) ON DELETE RESTRICT,
  ADD CONSTRAINT `fk_environment_network` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT;

ALTER TABLE `tenant_environment_status`
  ADD CONSTRAINT `fk_status_environment` FOREIGN KEY (`environment_id`) REFERENCES `tenant_environments` (`id`) ON DELETE RESTRICT;

ALTER TABLE `tenant_managers`
  ADD CONSTRAINT `fk_tenant_manager_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
