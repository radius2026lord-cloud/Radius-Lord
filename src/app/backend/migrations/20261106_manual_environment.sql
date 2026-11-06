-- Apply to the central database before deploying manual provisioning.
-- A custom subscription retains its own limits snapshot without a catalog plan.
ALTER TABLE payment_orders
 MODIFY COLUMN plan_id BIGINT UNSIGNED NULL,
 MODIFY COLUMN status ENUM('pending','awaiting_confirmation','paid','completed','cancelled','expired','manual_authorized') NOT NULL DEFAULT 'pending';

ALTER TABLE subscriptions
 MODIFY COLUMN plan_id BIGINT UNSIGNED NULL;
