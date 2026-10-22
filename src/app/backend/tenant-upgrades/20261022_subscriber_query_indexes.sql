-- Query indexes for tenant subscriber, session, and activity reads.
-- Apply once to an existing tenant database after the service tables are present.
-- Select the intended rl_tenant_ database before running this file.

ALTER TABLE radacct
  ADD INDEX idx_radacct_username_live (username,acctstoptime,acctupdatetime,radacctid);

ALTER TABLE radpostauth
  ADD INDEX idx_radpostauth_username_time (username,authdate,id);

ALTER TABLE activity_log
  ADD INDEX idx_activity_account_time (account_id,occurred_at,id);

ALTER TABLE pppoe_line_speed_boosts
  ADD INDEX idx_line_boost_account_state (account_id,status,expires_at,id);

ALTER TABLE pppoe_subscriptions
  ADD INDEX idx_ppp_subscription_account_role_time (account_id,service_role,id);
