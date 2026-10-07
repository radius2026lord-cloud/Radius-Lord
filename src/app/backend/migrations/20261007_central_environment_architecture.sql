-- Radius Lord central environment architecture. Target: MySQL 8.0.46 / lord_radius_core.
-- Run the complete file after existing billing, plan-limits and OpenVPN migrations.
-- Supersedes 20261007_subscription_environment_foundation.sql (not required first).
-- Schema only: no environment provisioning, subscription activation or outbound messages.
-- DDL commits implicitly. Take a backup; run with one migration operator, stop on error.
-- Legacy ownership, historical limits and passwords are NEVER guessed or overwritten.
DROP PROCEDURE IF EXISTS rl_core_preflight;
DELIMITER $$
CREATE PROCEDURE rl_core_preflight()
BEGIN
  IF DATABASE() IS NULL OR DATABASE()<>'lord_radius_core' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Select lord_radius_core before running this migration';
  END IF;
  IF EXISTS (SELECT 1 FROM payment_orders p LEFT JOIN subscriptions s ON s.id=p.subscription_id
             WHERE p.subscription_id IS NOT NULL AND s.id IS NULL) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Orphan payment subscription reference';
  END IF;
  IF EXISTS (SELECT 1 FROM subscription_licenses l LEFT JOIN subscriptions s ON s.id=l.subscription_id
             WHERE l.subscription_id IS NOT NULL AND s.id IS NULL) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Orphan license subscription reference';
  END IF;
  IF EXISTS (SELECT 1 FROM subscription_licenses l LEFT JOIN subscriptions s ON s.id=l.subscription_id
             LEFT JOIN tenants t ON t.id=COALESCE(l.tenant_id,s.tenant_id)
             WHERE t.id IS NULL OR (l.tenant_id IS NOT NULL AND s.id IS NOT NULL AND l.tenant_id<>s.tenant_id)) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Missing or conflicting license network';
  END IF;
  IF EXISTS (SELECT 1 FROM subscription_licenses l LEFT JOIN subscriptions s ON s.id=l.subscription_id
             GROUP BY COALESCE(l.tenant_id,s.tenant_id) HAVING COUNT(*)>1) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Multiple licenses for one network; review before migration';
  END IF;
  IF EXISTS (SELECT 1 FROM subscription_licenses l LEFT JOIN subscriptions s ON s.id=l.subscription_id
             JOIN tenants t ON t.id=COALESCE(l.tenant_id,s.tenant_id) WHERE l.license_key<>t.license_number) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='License key differs from network license; do not renumber automatically';
  END IF;
END$$
DELIMITER ;
CALL rl_core_preflight();
DROP PROCEDURE rl_core_preflight;

-- Helpers make additions resumable. Existing definitions still require review on schema drift.
DROP PROCEDURE IF EXISTS rl_core_add;
DROP PROCEDURE IF EXISTS rl_core_restrict;
DELIMITER $$
CREATE PROCEDURE rl_core_add(IN tab VARCHAR(64), IN kind VARCHAR(16), IN obj VARCHAR(64), IN ddl TEXT)
BEGIN
  DECLARE found_count INT DEFAULT 0;
  IF kind='column' THEN
    SELECT COUNT(*) INTO found_count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=tab AND COLUMN_NAME=obj;
  ELSEIF kind='index' THEN
    SELECT COUNT(*) INTO found_count FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=tab AND INDEX_NAME=obj;
  ELSEIF kind='fk' THEN
    SELECT COUNT(*) INTO found_count FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME=tab AND CONSTRAINT_NAME=obj;
  END IF;
  IF found_count=0 THEN
    SET @rl_core_ddl=ddl;
    PREPARE rl_core_stmt FROM @rl_core_ddl;
    EXECUTE rl_core_stmt;
    DEALLOCATE PREPARE rl_core_stmt;
  END IF;
END$$
CREATE PROCEDURE rl_core_restrict(IN tab VARCHAR(64), IN fk VARCHAR(64), IN ddl TEXT)
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME=tab AND CONSTRAINT_NAME=fk AND DELETE_RULE='CASCADE') THEN
    SET @rl_core_ddl=CONCAT('ALTER TABLE `',tab,'` DROP FOREIGN KEY `',fk,'`');
    PREPARE rl_core_stmt FROM @rl_core_ddl;
    EXECUTE rl_core_stmt;
    DEALLOCATE PREPARE rl_core_stmt;
  END IF;
  CALL rl_core_add(tab,'fk',fk,ddl);
END$$
DELIMITER ;
CALL rl_core_add('tenants','column','customer_id','ALTER TABLE tenants ADD customer_id BIGINT UNSIGNED NULL COMMENT ''Legacy owners require explicit reconciliation''');
CALL rl_core_add('tenants','column','archived_at','ALTER TABLE tenants ADD archived_at DATETIME NULL');
CALL rl_core_add('tenants','index','idx_tenant_owner','ALTER TABLE tenants ADD KEY idx_tenant_owner (customer_id)');
CALL rl_core_add('tenants','fk','fk_tenant_customer','ALTER TABLE tenants ADD CONSTRAINT fk_tenant_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT ON UPDATE CASCADE');
ALTER TABLE subscriptions MODIFY starts_at DATETIME NULL DEFAULT NULL, MODIFY expires_at DATETIME NULL DEFAULT NULL;
CALL rl_core_add('subscriptions','column','plan_limits_snapshot','ALTER TABLE subscriptions ADD plan_limits_snapshot JSON NULL');
CALL rl_core_add('subscriptions','column','duration_months_snapshot','ALTER TABLE subscriptions ADD duration_months_snapshot INT UNSIGNED NULL');
CALL rl_core_add('subscriptions','column','deployment_type_id','ALTER TABLE subscriptions ADD deployment_type_id BIGINT UNSIGNED NULL');
CALL rl_core_add('subscriptions','column','activated_at','ALTER TABLE subscriptions ADD activated_at DATETIME NULL');
CALL rl_core_add('subscriptions','column','archived_at','ALTER TABLE subscriptions ADD archived_at DATETIME NULL');
CALL rl_core_add('subscriptions','index','uq_subscription_id_tenant','ALTER TABLE subscriptions ADD UNIQUE KEY uq_subscription_id_tenant (id,tenant_id)');
CALL rl_core_add('subscriptions','fk','fk_subscription_deployment','ALTER TABLE subscriptions ADD CONSTRAINT fk_subscription_deployment FOREIGN KEY (deployment_type_id) REFERENCES deployment_types(id) ON DELETE RESTRICT ON UPDATE CASCADE');
CALL rl_core_restrict('subscriptions','fk_subscription_tenant','ALTER TABLE subscriptions ADD CONSTRAINT fk_subscription_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT ON UPDATE CASCADE');
CALL rl_core_add('payment_orders','column','tenant_id','ALTER TABLE payment_orders ADD tenant_id BIGINT UNSIGNED NULL');
CALL rl_core_add('payment_orders','index','uq_payment_id_subscription_tenant','ALTER TABLE payment_orders ADD UNIQUE KEY uq_payment_id_subscription_tenant (id,subscription_id,tenant_id)');
CALL rl_core_add('payment_orders','index','idx_payment_tenant_paid','ALTER TABLE payment_orders ADD KEY idx_payment_tenant_paid (tenant_id,paid_at)');
CALL rl_core_add('payment_orders','fk','fk_payment_orders_tenant','ALTER TABLE payment_orders ADD CONSTRAINT fk_payment_orders_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT ON UPDATE CASCADE');
CALL rl_core_add('payment_orders','fk','fk_payment_orders_subscription','ALTER TABLE payment_orders ADD CONSTRAINT fk_payment_orders_subscription FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE RESTRICT ON UPDATE CASCADE');
CALL rl_core_add('payment_orders','fk','fk_payment_subscription_scope','ALTER TABLE payment_orders ADD CONSTRAINT fk_payment_subscription_scope FOREIGN KEY (subscription_id,tenant_id) REFERENCES subscriptions(id,tenant_id) ON DELETE RESTRICT ON UPDATE CASCADE');
-- Infer license network only through its existing, verified subscription.
UPDATE subscription_licenses l JOIN subscriptions s ON s.id=l.subscription_id
SET l.tenant_id=s.tenant_id WHERE l.tenant_id IS NULL;
ALTER TABLE subscription_licenses MODIFY tenant_id BIGINT UNSIGNED NOT NULL,
  MODIFY subscription_id BIGINT UNSIGNED NULL COMMENT 'Current subscription; network license stays fixed';
CALL rl_core_add('subscription_licenses','index','uq_license_network','ALTER TABLE subscription_licenses ADD UNIQUE KEY uq_license_network (tenant_id)');
CALL rl_core_add('subscription_licenses','fk','fk_subscription_licenses_tenant','ALTER TABLE subscription_licenses ADD CONSTRAINT fk_subscription_licenses_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT ON UPDATE CASCADE');
CALL rl_core_add('subscription_licenses','fk','fk_subscription_licenses_subscription','ALTER TABLE subscription_licenses ADD CONSTRAINT fk_subscription_licenses_subscription FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE RESTRICT ON UPDATE CASCADE');
CALL rl_core_add('subscription_licenses','fk','fk_license_subscription_scope','ALTER TABLE subscription_licenses ADD CONSTRAINT fk_license_subscription_scope FOREIGN KEY (subscription_id,tenant_id) REFERENCES subscriptions(id,tenant_id) ON DELETE RESTRICT ON UPDATE CASCADE');
CALL rl_core_restrict('schema_versions','fk_schema_version_tenant','ALTER TABLE schema_versions ADD CONSTRAINT fk_schema_version_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT ON UPDATE CASCADE');
CALL rl_core_restrict('tenant_databases','fk_tenant_database_tenant','ALTER TABLE tenant_databases ADD CONSTRAINT fk_tenant_database_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT ON UPDATE CASCADE');
CALL rl_core_restrict('payment_order_events','fk_payment_order_events_order','ALTER TABLE payment_order_events ADD CONSTRAINT fk_payment_order_events_order FOREIGN KEY (payment_order_id) REFERENCES payment_orders(id) ON DELETE RESTRICT ON UPDATE CASCADE');

CREATE TABLE IF NOT EXISTS database_servers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  host VARCHAR(255) NOT NULL,
  port SMALLINT UNSIGNED NOT NULL DEFAULT 3306,
  provisioning_username VARCHAR(150) NULL,
  provisioning_password_encrypted TEXT NULL,
  accepts_new_environments TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('active','maintenance','disabled') NOT NULL DEFAULT 'disabled',
  app_connection_budget INT UNSIGNED NOT NULL DEFAULT 0,
  radius_connection_budget INT UNSIGNED NOT NULL DEFAULT 0,
  tls_required TINYINT(1) NOT NULL DEFAULT 1,
  tls_ca_reference VARCHAR(255) NULL,
  archived_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_database_server_endpoint (host,port),
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CALL rl_core_add('tenant_databases','column','database_server_id','ALTER TABLE tenant_databases ADD database_server_id BIGINT UNSIGNED NULL');
CALL rl_core_add('tenant_databases','column','app_password_encrypted','ALTER TABLE tenant_databases ADD app_password_encrypted TEXT NULL');
CALL rl_core_add('tenant_databases','column','radius_username','ALTER TABLE tenant_databases ADD radius_username VARCHAR(150) NULL');
CALL rl_core_add('tenant_databases','column','radius_password_encrypted','ALTER TABLE tenant_databases ADD radius_password_encrypted TEXT NULL');
CALL rl_core_add('tenant_databases','column','credentials_state','ALTER TABLE tenant_databases ADD credentials_state ENUM(''legacy'',''ready'') NOT NULL DEFAULT ''legacy''');
CALL rl_core_add('tenant_databases','column','app_pool_limit','ALTER TABLE tenant_databases ADD app_pool_limit INT UNSIGNED NOT NULL DEFAULT 0');
CALL rl_core_add('tenant_databases','column','radius_pool_limit','ALTER TABLE tenant_databases ADD radius_pool_limit INT UNSIGNED NOT NULL DEFAULT 0');
CALL rl_core_add('tenant_databases','index','uq_tenant_database_id_tenant','ALTER TABLE tenant_databases ADD UNIQUE KEY uq_tenant_database_id_tenant (id,tenant_id)');
CALL rl_core_add('tenant_databases','fk','fk_tenant_database_server','ALTER TABLE tenant_databases ADD CONSTRAINT fk_tenant_database_server FOREIGN KEY (database_server_id) REFERENCES database_servers(id) ON DELETE RESTRICT ON UPDATE CASCADE');
-- Existing db_password is legacy only: SQL cannot securely encrypt it with the application key.
-- No runtime may use a new environment until encrypted credentials are ready.

CREATE TABLE IF NOT EXISTS tenant_environments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  tenant_database_id BIGINT UNSIGNED NULL,
  deployment_type_id BIGINT UNSIGNED NOT NULL,
  system_url VARCHAR(500) NULL,
  status ENUM('pending','provisioning','ready','failed') NOT NULL DEFAULT 'pending',
  ready_at DATETIME NULL,
  archived_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_environment_network (tenant_id),
  UNIQUE KEY uq_environment_id_tenant (id,tenant_id),
  UNIQUE KEY uq_environment_database (tenant_database_id),
  CONSTRAINT fk_environment_network FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT,
  CONSTRAINT fk_environment_database_scope FOREIGN KEY (tenant_database_id,tenant_id) REFERENCES tenant_databases(id,tenant_id) ON DELETE RESTRICT,
  CONSTRAINT fk_environment_deployment FOREIGN KEY (deployment_type_id) REFERENCES deployment_types(id) ON DELETE RESTRICT,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS subscription_addons (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  subscription_id BIGINT UNSIGNED NOT NULL,
  plan_addon_id BIGINT UNSIGNED NOT NULL,
  payment_order_id BIGINT UNSIGNED NULL,
  addon_code_snapshot VARCHAR(60) NOT NULL,
  addon_name_snapshot VARCHAR(150) NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  nas_capacity_increment INT UNSIGNED NOT NULL DEFAULT 0,
  unit_price_snapshot DECIMAL(12,2) NULL,
  currency_code_snapshot VARCHAR(10) NULL,
  status ENUM('pending','active','expired','cancelled') NOT NULL DEFAULT 'pending',
  activated_at DATETIME NULL,
  expires_at DATETIME NULL COMMENT 'NULL does not imply a perpetual entitlement',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_subscription_addon_status (subscription_id,status),
  CONSTRAINT fk_addon_network FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT,
  CONSTRAINT fk_addon_subscription_scope FOREIGN KEY (subscription_id,tenant_id) REFERENCES subscriptions(id,tenant_id) ON DELETE RESTRICT,
  CONSTRAINT fk_addon_payment_scope FOREIGN KEY (payment_order_id,subscription_id,tenant_id) REFERENCES payment_orders(id,subscription_id,tenant_id) ON DELETE RESTRICT,
  CONSTRAINT fk_addon_definition FOREIGN KEY (plan_addon_id) REFERENCES plan_addons(id) ON DELETE RESTRICT,
  CONSTRAINT chk_addon_quantity CHECK (quantity>0),
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS nas_tunnels (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  environment_id BIGINT UNSIGNED NOT NULL,
  ovpn_gateway_id BIGINT UNSIGNED NOT NULL,
  tenant_nas_id BIGINT UNSIGNED NULL COMMENT 'Logical reference to NAS in tenant database; NULL during reservation',
  tunnel_username VARCHAR(150) NOT NULL,
  tunnel_password_encrypted TEXT NULL,
  tunnel_address VARCHAR(45) NOT NULL,
  certificate_reference VARCHAR(255) NULL,
  status ENUM('reserved','provisioning','awaiting_link','connected','disconnected','failed','disabled') NOT NULL DEFAULT 'reserved',
  last_seen_at DATETIME NULL,
  archived_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_tunnel_gateway_username (ovpn_gateway_id,tunnel_username),
  UNIQUE KEY uq_tunnel_gateway_address (ovpn_gateway_id,tunnel_address),
  UNIQUE KEY uq_tunnel_environment_nas (environment_id,tenant_nas_id),
  KEY idx_tunnel_environment_status (environment_id,status),
  CONSTRAINT fk_tunnel_environment FOREIGN KEY (environment_id) REFERENCES tenant_environments(id) ON DELETE RESTRICT,
  CONSTRAINT fk_tunnel_gateway FOREIGN KEY (ovpn_gateway_id) REFERENCES ovpn_gateways(id) ON DELETE RESTRICT,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tenant_environment_status (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  environment_id BIGINT UNSIGNED NOT NULL,
  last_seen_at DATETIME NULL,
  reported_at DATETIME NULL,
  radius_status ENUM('healthy','degraded','unavailable','unknown') NOT NULL DEFAULT 'unknown',
  database_status ENUM('healthy','degraded','unavailable','unknown') NOT NULL DEFAULT 'unknown',
  pppoe_accounts_count BIGINT UNSIGNED NULL,
  online_users_count BIGINT UNSIGNED NULL,
  active_sessions_count BIGINT UNSIGNED NULL,
  nas_count INT UNSIGNED NULL,
  online_nas_count INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_environment_status (environment_id),
  KEY idx_environment_last_seen (last_seen_at),
  CONSTRAINT fk_status_environment FOREIGN KEY (environment_id) REFERENCES tenant_environments(id) ON DELETE RESTRICT,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS environment_provisioning_jobs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  environment_id BIGINT UNSIGNED NOT NULL,
  subscription_id BIGINT UNSIGNED NOT NULL,
  payment_order_id BIGINT UNSIGNED NOT NULL,
  requested_by_master_admin_id BIGINT UNSIGNED NOT NULL,
  idempotency_key VARCHAR(100) NOT NULL,
  status ENUM('queued','running','success','failed') NOT NULL DEFAULT 'queued',
  current_step VARCHAR(80) NULL,
  attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
  available_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  lock_token VARCHAR(100) NULL,
  locked_until DATETIME NULL,
  started_at DATETIME NULL,
  finished_at DATETIME NULL,
  error_code VARCHAR(100) NULL,
  error_message TEXT NULL,
  active_environment_id BIGINT UNSIGNED GENERATED ALWAYS AS (CASE WHEN status IN ('queued','running') THEN environment_id ELSE NULL END) STORED,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_provision_idempotency (idempotency_key),
  UNIQUE KEY uq_provision_active_environment (active_environment_id),
  UNIQUE KEY uq_provision_id_network_environment (id,tenant_id,environment_id,subscription_id),
  KEY idx_provision_queue (status,available_at),
  CONSTRAINT fk_provision_network FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT,
  CONSTRAINT fk_provision_environment_scope FOREIGN KEY (environment_id,tenant_id) REFERENCES tenant_environments(id,tenant_id) ON DELETE RESTRICT,
  CONSTRAINT fk_provision_subscription_scope FOREIGN KEY (subscription_id,tenant_id) REFERENCES subscriptions(id,tenant_id) ON DELETE RESTRICT,
  CONSTRAINT fk_provision_payment_scope FOREIGN KEY (payment_order_id,subscription_id,tenant_id) REFERENCES payment_orders(id,subscription_id,tenant_id) ON DELETE RESTRICT,
  CONSTRAINT fk_provision_admin FOREIGN KEY (requested_by_master_admin_id) REFERENCES master_admins(id) ON DELETE RESTRICT,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS environment_provisioning_steps (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  job_id BIGINT UNSIGNED NOT NULL,
  step_code VARCHAR(80) NOT NULL,
  status ENUM('pending','running','success','failed','skipped') NOT NULL DEFAULT 'pending',
  attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
  resource_reference VARCHAR(255) NULL,
  started_at DATETIME NULL,
  finished_at DATETIME NULL,
  error_code VARCHAR(100) NULL,
  error_message TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_provision_step (job_id,step_code),
  CONSTRAINT fk_step_job FOREIGN KEY (job_id) REFERENCES environment_provisioning_jobs(id) ON DELETE RESTRICT,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS environment_notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  environment_id BIGINT UNSIGNED NOT NULL,
  subscription_id BIGINT UNSIGNED NOT NULL,
  provisioning_job_id BIGINT UNSIGNED NOT NULL,
  recipient_phone VARCHAR(20) NOT NULL,
  recipient_source ENUM('verified_inbound','verified_customer') NOT NULL,
  channel ENUM('whatsapp') NOT NULL DEFAULT 'whatsapp',
  idempotency_key VARCHAR(100) NOT NULL,
  status ENUM('pending','sending','sent','failed') NOT NULL DEFAULT 'pending',
  initial_username VARCHAR(150) NULL,
  initial_password_encrypted TEXT NULL COMMENT 'Delete after successful delivery or credential rotation',
  credentials_expires_at DATETIME NULL,
  attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
  next_attempt_at DATETIME NULL,
  lock_token VARCHAR(100) NULL,
  locked_until DATETIME NULL,
  provider_message_id VARCHAR(255) NULL,
  sent_at DATETIME NULL,
  error_code VARCHAR(100) NULL,
  error_message TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_notification_idempotency (idempotency_key),
  KEY idx_notification_queue (status,next_attempt_at),
  CONSTRAINT fk_notification_network FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT,
  CONSTRAINT fk_notification_environment_scope FOREIGN KEY (environment_id,tenant_id) REFERENCES tenant_environments(id,tenant_id) ON DELETE RESTRICT,
  CONSTRAINT fk_notification_subscription_scope FOREIGN KEY (subscription_id,tenant_id) REFERENCES subscriptions(id,tenant_id) ON DELETE RESTRICT,
  CONSTRAINT fk_notification_job_scope FOREIGN KEY (provisioning_job_id,tenant_id,environment_id,subscription_id) REFERENCES environment_provisioning_jobs(id,tenant_id,environment_id,subscription_id) ON DELETE RESTRICT,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO audit_entity_types (code,name_ar,name_en,description,is_active) VALUES
('TENANT_ENVIRONMENT','بيئة الشبكة','Tenant Environment','تجهيز وتشغيل بيئة الشبكة',1),
('PROVISIONING_JOB','مهمة التجهيز','Provisioning Job','مراحل ومحاولات تجهيز البيئة',1),
('NAS_TUNNEL','نفق NAS','NAS Tunnel','تخصيص وربط نفق الجهاز',1),
('SUBSCRIPTION_ADDON','إضافة الاشتراك','Subscription Addon','الإضافات والسعة المعتمدة',1),
('ENVIRONMENT_NOTIFICATION','إشعار البيئة','Environment Notification','نتيجة إرسال معلومات البيئة',1),
('DATABASE_SERVER','خادم قاعدة البيانات','Database Server','إدارة خوادم قواعد الشبكات',1)
ON DUPLICATE KEY UPDATE code=VALUES(code);
DROP PROCEDURE rl_core_add;
DROP PROCEDURE rl_core_restrict;
-- Completion means DDL applied; it does NOT mean any customer environment is ready.
SELECT 'central_environment_schema_applied' AS result;
