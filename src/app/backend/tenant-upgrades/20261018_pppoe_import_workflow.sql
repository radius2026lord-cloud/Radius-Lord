-- PPPoE import review tables for an existing tenant database.
-- In phpMyAdmin, select the intended rl_tenant_ database before importing this file.
-- Plain DDL only; no procedural wrapper or metadata permissions are needed.
-- FOREIGN_KEY_CHECKS is left at its normal MySQL default (enabled).

CREATE TABLE IF NOT EXISTS pppoe_import_batches (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  created_by BIGINT UNSIGNED NOT NULL,
  category_id BIGINT UNSIGNED NOT NULL,
  source_name VARCHAR(255) NULL,
  total_rows INT UNSIGNED NOT NULL DEFAULT 0,
  imported_rows INT UNSIGNED NOT NULL DEFAULT 0,
  duplicate_rows INT UNSIGNED NOT NULL DEFAULT 0,
  rejected_rows INT UNSIGNED NOT NULL DEFAULT 0,
  status ENUM('processing','completed','completed_with_issues') NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  KEY idx_pppoe_import_batch_time(created_at,id),
  CONSTRAINT fk_pppoe_import_batch_actor
    FOREIGN KEY (created_by) REFERENCES managers(id),
  CONSTRAINT fk_pppoe_import_batch_category
    FOREIGN KEY (category_id) REFERENCES customer_categories(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pppoe_import_review_rows (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  batch_id BIGINT UNSIGNED NOT NULL,
  source_row_number INT UNSIGNED NOT NULL,
  username VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  reason_code VARCHAR(64) NOT NULL,
  encrypted_payload TEXT NOT NULL,
  resolved_at DATETIME(6) NULL,
  resolved_by BIGINT UNSIGNED NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_pppoe_import_review_source(batch_id,source_row_number),
  KEY idx_pppoe_import_review_open(resolved_at,batch_id,id),
  CONSTRAINT fk_pppoe_import_review_batch
    FOREIGN KEY (batch_id) REFERENCES pppoe_import_batches(id),
  CONSTRAINT fk_pppoe_import_review_actor
    FOREIGN KEY (resolved_by) REFERENCES managers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
