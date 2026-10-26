-- Network-wide subscriber card template and approval state. Apply once to the central database.
CREATE TABLE IF NOT EXISTS network_subscriber_card_templates (
  environment_id BIGINT UNSIGNED NOT NULL,
  template_json JSON NOT NULL,
  is_approved TINYINT(1) NOT NULL DEFAULT 0,
  approved_by BIGINT UNSIGNED NULL,
  approved_at DATETIME(3) NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (environment_id),
  KEY idx_subscriber_card_template_approval (is_approved, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
