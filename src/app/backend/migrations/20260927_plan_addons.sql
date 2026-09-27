USE lord_radius_core;

-- Radius Lord - Plan add-ons (phase 1)
-- Keeps setup_fee temporarily for backward compatibility, but the application no longer uses it.

CREATE TABLE IF NOT EXISTS plan_addons (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    plan_id BIGINT UNSIGNED NOT NULL,
    deployment_type_id BIGINT UNSIGNED NOT NULL,
    code VARCHAR(60) NOT NULL,
    name_ar VARCHAR(150) NOT NULL,
    name_en VARCHAR(150) NULL,
    description VARCHAR(500) NULL,
    price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    status ENUM('active','inactive') NOT NULL DEFAULT 'active',
    sort_order INT UNSIGNED NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_plan_addon_code (plan_id,deployment_type_id,code),
    KEY idx_plan_addons_deployment_type (deployment_type_id),
    CONSTRAINT fk_plan_addons_plan FOREIGN KEY (plan_id) REFERENCES payment_plans(id) ON DELETE CASCADE,
    CONSTRAINT fk_plan_addons_deployment_type FOREIGN KEY (deployment_type_id) REFERENCES deployment_types(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
