-- Run on the backend database before restarting the updated backend.
-- Existing orders stay NULL: current plan values cannot prove historical limits.
-- Safe to rerun; no historical payment or plan data is changed.
SET @radius_lord_limits_ddl = (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE payment_orders ADD COLUMN plan_limits_snapshot JSON NULL AFTER addons_snapshot',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'payment_orders'
    AND COLUMN_NAME = 'plan_limits_snapshot'
);
PREPARE radius_lord_limits_stmt FROM @radius_lord_limits_ddl;
EXECUTE radius_lord_limits_stmt;
DEALLOCATE PREPARE radius_lord_limits_stmt;
