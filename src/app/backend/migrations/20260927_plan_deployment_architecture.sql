-- Radius Lord: deployment types + single-currency plan architecture
-- Safe transitional migration: keeps legacy payment_plans.price/currency until the new flow is verified.

CREATE TABLE IF NOT EXISTS currencies (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(10) NOT NULL,
  name_ar VARCHAR(100) NOT NULL,
  name_en VARCHAR(100) NOT NULL,
  symbol VARCHAR(12) NOT NULL,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_currencies_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO currencies (code,name_ar,name_en,symbol,status,sort_order) VALUES
('USD','دولار أمريكي','US Dollar','$','active',10),
('EUR','يورو','Euro','€','active',20),
('GBP','جنيه إسترليني','British Pound','£','active',30),
('SAR','ريال سعودي','Saudi Riyal','ر.س','active',40),
('AED','درهم إماراتي','UAE Dirham','د.إ','active',50),
('TRY','ليرة تركية','Turkish Lira','₺','active',60),
('SYP','ليرة سورية','Syrian Pound','ل.س','active',70),
('JOD','دينار أردني','Jordanian Dinar','د.أ','active',80),
('KWD','دينار كويتي','Kuwaiti Dinar','د.ك','active',90),
('QAR','ريال قطري','Qatari Riyal','ر.ق','active',100),
('IQD','دينار عراقي','Iraqi Dinar','د.ع','active',110),
('EGP','جنيه مصري','Egyptian Pound','ج.م','active',120)
ON DUPLICATE KEY UPDATE name_ar=VALUES(name_ar),name_en=VALUES(name_en),symbol=VALUES(symbol);

CREATE TABLE IF NOT EXISTS deployment_types (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(50) NOT NULL,
  name_ar VARCHAR(120) NOT NULL,
  name_en VARCHAR(120) NOT NULL,
  description TEXT NULL,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_deployment_types_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO deployment_types (code,name_ar,name_en,description,status,sort_order) VALUES
('shared_cloud','استضافة سحابية مشتركة','Shared Cloud','استضافة على منصة Radius Lord العامة مع عزل بيانات كل شبكة.','active',10),
('private_cloud','استضافة سحابية خاصة','Private Cloud','بيئة خاصة بالعميل مع Domain أو Subdomain خاص.','active',20),
('on_premise','تنصيب محلي','On-Premise','تنصيب Radius Lord على خادم أو VM داخل بيئة العميل.','active',30)
ON DUPLICATE KEY UPDATE name_ar=VALUES(name_ar),name_en=VALUES(name_en),description=VALUES(description);

SET @has_currency_id := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payment_plans' AND COLUMN_NAME='currency_id');
SET @sql := IF(@has_currency_id=0,'ALTER TABLE payment_plans ADD COLUMN currency_id BIGINT UNSIGNED NULL AFTER currency','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE payment_plans p
JOIN currencies c ON c.code=UPPER(p.currency)
SET p.currency_id=c.id
WHERE p.currency_id IS NULL;

CREATE TABLE IF NOT EXISTS plan_deployment_options (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  plan_id BIGINT UNSIGNED NOT NULL,
  deployment_type_id BIGINT UNSIGNED NOT NULL,
  price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  setup_fee DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_plan_deployment (plan_id,deployment_type_id),
  KEY idx_plan_deployment_type (deployment_type_id),
  CONSTRAINT fk_plan_deployment_plan FOREIGN KEY (plan_id) REFERENCES payment_plans(id) ON DELETE CASCADE,
  CONSTRAINT fk_plan_deployment_type FOREIGN KEY (deployment_type_id) REFERENCES deployment_types(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO plan_deployment_options (plan_id,deployment_type_id,price,setup_fee,is_default,status)
SELECT p.id,dt.id,p.price,0.00,1,'active'
FROM payment_plans p
JOIN deployment_types dt ON dt.code='shared_cloud'
LEFT JOIN plan_deployment_options o ON o.plan_id=p.id AND o.deployment_type_id=dt.id
WHERE o.id IS NULL;

-- Legacy price/currency columns intentionally remain during this migration.
