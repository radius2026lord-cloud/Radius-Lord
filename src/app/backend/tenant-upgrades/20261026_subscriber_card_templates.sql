-- Subscriber ID card template for one tenant. Select the target rl_tenant_ database before running.
DELIMITER $$
DROP PROCEDURE IF EXISTS rl_subscriber_card_template_v1$$
CREATE PROCEDURE rl_subscriber_card_template_v1()
BEGIN
 IF DATABASE() IS NULL OR BINARY LEFT(DATABASE(),10)<>BINARY 'rl_tenant_' THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Select the target rl_tenant_ database; this upgrade must not run on the central database';
 END IF;
 CREATE TABLE IF NOT EXISTS network_subscriber_card_templates (
  id TINYINT UNSIGNED NOT NULL DEFAULT 1,
  template_json JSON NOT NULL,
  is_approved TINYINT(1) NOT NULL DEFAULT 0,
  approved_by BIGINT UNSIGNED NULL,
  approved_at DATETIME(3) NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_subscriber_card_template_approval (is_approved, updated_at),
  CONSTRAINT fk_subscriber_card_template_approver FOREIGN KEY (approved_by) REFERENCES managers(id),
  CONSTRAINT chk_subscriber_card_template_single_row CHECK (id=1)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
END$$
CALL rl_subscriber_card_template_v1()$$
DROP PROCEDURE rl_subscriber_card_template_v1$$
DELIMITER ;

SELECT TABLE_NAME FROM information_schema.TABLES
WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='network_subscriber_card_templates';
