-- Radius Lord: platform contact settings, immutable payment history, and subscription licenses
-- Payment orders are historical financial records. Do not delete completed orders.

CREATE TABLE IF NOT EXISTS platform_settings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  setting_group VARCHAR(60) NOT NULL,
  setting_key VARCHAR(100) NOT NULL,
  setting_value TEXT NULL,
  value_type ENUM('string','text','boolean','number','json') NOT NULL DEFAULT 'string',
  is_public TINYINT(1) NOT NULL DEFAULT 0,
  updated_by_master_admin_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_platform_setting (setting_group,setting_key),
  KEY idx_platform_settings_group (setting_group)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO platform_settings (setting_group,setting_key,setting_value,value_type,is_public) VALUES
('contact_payment','contact_name','','string',1),
('contact_payment','whatsapp_number','','string',1),
('contact_payment','whatsapp_enabled','1','boolean',1),
('contact_payment','whatsapp_button_text','التواصل عبر واتساب لإتمام الدفع','string',1),
('contact_payment','whatsapp_message_template','مرحبًا، أرغب بإتمام اشتراكي في Radius Lord. كود الدفع: {{payment_code}}','text',1),
('contact_payment','payment_instructions','','text',1)
ON DUPLICATE KEY UPDATE setting_key=VALUES(setting_key);

CREATE TABLE IF NOT EXISTS payment_orders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  payment_code VARCHAR(40) NOT NULL,
  customer_id BIGINT UNSIGNED NOT NULL,
  subscription_id BIGINT UNSIGNED NULL,
  plan_id BIGINT UNSIGNED NOT NULL,
  deployment_type_id BIGINT UNSIGNED NULL,
  payment_purpose ENUM('initial_subscription','renewal','upgrade','addon_purchase') NOT NULL DEFAULT 'initial_subscription',

  -- Immutable purchase snapshot for historical reporting.
  plan_name_snapshot VARCHAR(150) NOT NULL,
  duration_months_snapshot INT UNSIGNED NOT NULL,
  deployment_name_snapshot VARCHAR(120) NULL,
  base_price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  addons_total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  currency_code VARCHAR(10) NOT NULL,
  addons_snapshot JSON NULL,

  payment_method ENUM('whatsapp_manual') NOT NULL DEFAULT 'whatsapp_manual',
  status ENUM('pending','awaiting_confirmation','paid','completed','cancelled','expired') NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  cancelled_at TIMESTAMP NULL,
  expires_at TIMESTAMP NULL,
  confirmed_by_master_admin_id BIGINT UNSIGNED NULL,
  admin_note TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_payment_orders_code (payment_code),
  KEY idx_payment_orders_customer_date (customer_id,created_at),
  KEY idx_payment_orders_purpose_date (payment_purpose,created_at),
  KEY idx_payment_orders_status_date (status,created_at),
  KEY idx_payment_orders_subscription (subscription_id),
  KEY idx_payment_orders_plan (plan_id),
  CONSTRAINT fk_payment_orders_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
  CONSTRAINT fk_payment_orders_plan FOREIGN KEY (plan_id) REFERENCES payment_plans(id),
  CONSTRAINT fk_payment_orders_deployment FOREIGN KEY (deployment_type_id) REFERENCES deployment_types(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS subscription_licenses (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  subscription_id BIGINT UNSIGNED NOT NULL,
  tenant_id BIGINT UNSIGNED NULL,
  license_key VARCHAR(64) NOT NULL,
  status ENUM('pending','active','suspended','expired','revoked') NOT NULL DEFAULT 'pending',
  activated_at TIMESTAMP NULL,
  starts_at TIMESTAMP NULL,
  expires_at TIMESTAMP NULL,
  suspended_at TIMESTAMP NULL,
  revoked_at TIMESTAMP NULL,
  last_renewed_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_subscription_license_key (license_key),
  UNIQUE KEY uq_subscription_license_subscription (subscription_id),
  KEY idx_subscription_license_status_expiry (status,expires_at),
  KEY idx_subscription_license_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payment_order_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  payment_order_id BIGINT UNSIGNED NOT NULL,
  event_type ENUM('created','sent_to_whatsapp','awaiting_confirmation','confirmed_paid','completed','cancelled','expired','note_added') NOT NULL,
  from_status VARCHAR(40) NULL,
  to_status VARCHAR(40) NULL,
  master_admin_id BIGINT UNSIGNED NULL,
  note TEXT NULL,
  metadata JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_payment_order_events_order_date (payment_order_id,created_at),
  KEY idx_payment_order_events_type_date (event_type,created_at),
  CONSTRAINT fk_payment_order_events_order FOREIGN KEY (payment_order_id) REFERENCES payment_orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- subscription_id / tenant_id foreign keys are intentionally deferred until the exact
-- current subscriptions and tenants column types are verified in the target database.
