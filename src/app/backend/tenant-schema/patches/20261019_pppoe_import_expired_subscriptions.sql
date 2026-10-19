-- Apply once to each existing tenant database before retrying PPPoE imports with expired dates.
-- Historical imports have no known activation timestamp; retain the given expiry without inventing one.
ALTER TABLE pppoe_subscriptions
  DROP CHECK chk_ppp_subscription_times;

ALTER TABLE pppoe_subscriptions
  ADD CONSTRAINT chk_ppp_subscription_times CHECK (
    (activated_at IS NULL AND expires_at IS NULL)
    OR (activated_at IS NOT NULL AND expires_at IS NOT NULL AND expires_at > activated_at)
    OR (lifecycle = 'ended' AND activated_at IS NULL AND expires_at IS NOT NULL)
    OR (lifecycle = 'active' AND activated_at IS NULL AND expires_at IS NOT NULL
        AND grace_expires_at IS NOT NULL AND grace_expires_at > expires_at)
  );
