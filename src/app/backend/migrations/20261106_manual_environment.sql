-- Run on the central database. The tenant worker creates each client database.
-- Preserve plan foreign keys and existing rows while allowing custom plans.
DROP PROCEDURE IF EXISTS rl_manual_environment_migrate;
DELIMITER $$
CREATE PROCEDURE rl_manual_environment_migrate()
BEGIN
 DECLARE previous_fk_checks INT DEFAULT 1;
 DECLARE EXIT HANDLER FOR SQLEXCEPTION
 BEGIN
  SET SESSION foreign_key_checks=previous_fk_checks;
  RESIGNAL;
 END;

 SET previous_fk_checks=@@SESSION.foreign_key_checks;
 -- Scope this change to the migration connection. No data writes are performed.
 SET SESSION foreign_key_checks=0;
 ALTER TABLE payment_orders
  MODIFY COLUMN plan_id BIGINT UNSIGNED NULL,
  MODIFY COLUMN status ENUM('pending','awaiting_confirmation','paid','completed','cancelled','expired','manual_authorized') NOT NULL DEFAULT 'pending';
 ALTER TABLE subscriptions
  MODIFY COLUMN plan_id BIGINT UNSIGNED NULL;
 SET SESSION foreign_key_checks=previous_fk_checks;
END$$
DELIMITER ;
CALL rl_manual_environment_migrate();
DROP PROCEDURE rl_manual_environment_migrate;
