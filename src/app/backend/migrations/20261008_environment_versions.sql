-- Apply to lord_radius_core AFTER 20261007_central_environment_architecture.sql.
-- This migration records releases and verified installations; it performs no tenant upgrades.
CREATE TABLE IF NOT EXISTS environment_releases (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  component ENUM('database','application','radius','template') NOT NULL,
  version VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  artifact_sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  artifact_reference VARCHAR(500) NOT NULL,
  minimum_compatible_version VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  rollout_policy ENUM('manual','online_compatible') NOT NULL DEFAULT 'manual',
  status ENUM('draft','approved','withdrawn') NOT NULL DEFAULT 'draft',
  approved_by_master_admin_id BIGINT UNSIGNED NULL,
  approved_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_release_component_version (component,version),
  UNIQUE KEY uq_release_id_component (id,component),
  CONSTRAINT chk_release_digest CHECK (artifact_sha256 REGEXP '^[0-9a-f]{64}$'),
  CONSTRAINT chk_release_approval CHECK (status <> 'approved' OR (approved_at IS NOT NULL AND approved_by_master_admin_id IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS environment_component_versions (
  environment_id BIGINT UNSIGNED NOT NULL,
  component ENUM('database','application','radius','template') NOT NULL,
  release_id BIGINT UNSIGNED NOT NULL,
  verified_at DATETIME NOT NULL,
  installed_at DATETIME NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (environment_id,component),
  CONSTRAINT fk_component_environment FOREIGN KEY (environment_id) REFERENCES tenant_environments(id) ON DELETE RESTRICT,
  CONSTRAINT fk_component_release FOREIGN KEY (release_id,component) REFERENCES environment_releases(id,component) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS environment_upgrade_jobs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  environment_id BIGINT UNSIGNED NOT NULL,
  component ENUM('database','application','radius','template') NOT NULL,
  from_release_id BIGINT UNSIGNED NOT NULL,
  to_release_id BIGINT UNSIGNED NOT NULL,
  idempotency_key VARCHAR(190) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  requested_by_master_admin_id BIGINT UNSIGNED NOT NULL,
  status ENUM('blocked','queued','running','success','failed','cancelled') NOT NULL DEFAULT 'blocked',
  backup_reference VARCHAR(500) NULL,
  compatibility_verified_at DATETIME NULL,
  health_verified_at DATETIME NULL,
  lock_token VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  locked_until DATETIME NULL,
  started_at DATETIME NULL,
  finished_at DATETIME NULL,
  error_code VARCHAR(100) NULL,
  error_message VARCHAR(1000) NULL,
  active_environment_id BIGINT UNSIGNED GENERATED ALWAYS AS
    (CASE WHEN status IN ('queued','running') THEN environment_id ELSE NULL END) STORED,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_upgrade_request (idempotency_key),
  UNIQUE KEY uq_upgrade_active_environment (active_environment_id),
  KEY idx_upgrade_queue (status,created_at),
  CONSTRAINT fk_upgrade_environment FOREIGN KEY (environment_id) REFERENCES tenant_environments(id) ON DELETE RESTRICT,
  CONSTRAINT fk_upgrade_from FOREIGN KEY (from_release_id,component) REFERENCES environment_releases(id,component) ON DELETE RESTRICT,
  CONSTRAINT fk_upgrade_to FOREIGN KEY (to_release_id,component) REFERENCES environment_releases(id,component) ON DELETE RESTRICT,
  CONSTRAINT chk_upgrade_different_release CHECK (from_release_id <> to_release_id),
  CONSTRAINT chk_upgrade_preflight CHECK (status NOT IN ('queued','running','success') OR compatibility_verified_at IS NOT NULL),
  CONSTRAINT chk_upgrade_database_backup CHECK (component <> 'database' OR status NOT IN ('queued','running','success') OR backup_reference IS NOT NULL),
  CONSTRAINT chk_upgrade_success CHECK (status <> 'success' OR (health_verified_at IS NOT NULL AND finished_at IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO audit_entity_types (code,name_ar,name_en,description,is_active)
VALUES ('ENVIRONMENT_RELEASE','إصدار البيئة','Environment Release','إصدارات مكونات البيئة واعتمادها',1),
       ('ENVIRONMENT_UPGRADE','ترقية البيئة','Environment Upgrade','طلبات ترقية البيئة ونتائجها',1)
ON DUPLICATE KEY UPDATE is_active=1;
