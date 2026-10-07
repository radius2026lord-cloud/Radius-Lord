-- Apply to lord_radius_core after the billing and plan-limits migrations.
-- Foundation only: this does NOT provision databases, activate subscriptions or send messages.
-- Run the complete script in one session. MySQL DDL is not transactional.
-- Existing dates, licenses and payment snapshots are preserved.
DROP PROCEDURE IF EXISTS radius_lord_subscription_foundation;
DELIMITER $$
CREATE PROCEDURE radius_lord_subscription_foundation()
BEGIN
  -- Check all legacy references BEFORE changing any table.
  IF EXISTS (SELECT 1 FROM payment_orders p LEFT JOIN subscriptions s ON s.id=p.subscription_id
             WHERE p.subscription_id IS NOT NULL AND s.id IS NULL) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Orphan payment_orders.subscription_id; reconcile before migration';
  END IF;
  IF EXISTS (SELECT 1 FROM subscription_licenses l LEFT JOIN subscriptions s ON s.id=l.subscription_id
             WHERE s.id IS NULL) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Orphan subscription_licenses.subscription_id; reconcile before migration';
  END IF;
  IF EXISTS (SELECT 1 FROM subscription_licenses l LEFT JOIN tenants t ON t.id=l.tenant_id
             WHERE l.tenant_id IS NOT NULL AND t.id IS NULL) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Orphan subscription_licenses.tenant_id; reconcile before migration';
  END IF;
  IF EXISTS (SELECT 1 FROM subscription_licenses l JOIN subscriptions s ON s.id=l.subscription_id
             WHERE l.tenant_id IS NOT NULL AND l.tenant_id<>s.tenant_id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='License tenant differs from subscription tenant; reconcile before migration';
  END IF;

  -- NULL dates represent an unactivated subscription; no invented activation date.
  ALTER TABLE subscriptions
    MODIFY starts_at DATETIME NULL DEFAULT NULL,
    MODIFY expires_at DATETIME NULL DEFAULT NULL;

  -- The supplied live schema used CASCADE here; retain subscription history instead.
  IF EXISTS (SELECT 1 FROM information_schema.REFERENTIAL_CONSTRAINTS
             WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='subscriptions'
             AND CONSTRAINT_NAME='fk_subscription_tenant' AND DELETE_RULE='CASCADE') THEN
    ALTER TABLE subscriptions DROP FOREIGN KEY fk_subscription_tenant;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.REFERENTIAL_CONSTRAINTS
                 WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='subscriptions'
                 AND CONSTRAINT_NAME='fk_subscription_tenant') THEN
    ALTER TABLE subscriptions ADD CONSTRAINT fk_subscription_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.REFERENTIAL_CONSTRAINTS
                 WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='payment_orders'
                 AND CONSTRAINT_NAME='fk_payment_orders_subscription') THEN
    ALTER TABLE payment_orders ADD CONSTRAINT fk_payment_orders_subscription
      FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.REFERENTIAL_CONSTRAINTS
                 WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='subscription_licenses'
                 AND CONSTRAINT_NAME='fk_subscription_licenses_subscription') THEN
    ALTER TABLE subscription_licenses ADD CONSTRAINT fk_subscription_licenses_subscription
      FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.REFERENTIAL_CONSTRAINTS
                 WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='subscription_licenses'
                 AND CONSTRAINT_NAME='fk_subscription_licenses_tenant') THEN
    ALTER TABLE subscription_licenses ADD CONSTRAINT fk_subscription_licenses_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END$$
DELIMITER ;
CALL radius_lord_subscription_foundation();
DROP PROCEDURE IF EXISTS radius_lord_subscription_foundation;
