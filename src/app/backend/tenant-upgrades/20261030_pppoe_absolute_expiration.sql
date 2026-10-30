-- Select the EXISTING tenant database before running. No subscription dates
-- are changed. Run before starting the updated backend; then sync NAS RADIUS.
DROP PROCEDURE IF EXISTS rl_pppoe_expiration_20261030_guard;
DELIMITER $$
CREATE PROCEDURE rl_pppoe_expiration_20261030_guard()
BEGIN
 IF DATABASE() IS NULL OR DATABASE() NOT REGEXP '^rl_tenant_(zone_[0-9]+|[0-9]+_[a-f0-9]{16})$' THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Select an existing Radius Lord tenant database';
 END IF;
 IF (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()
  AND TABLE_NAME IN ('radius_identities','pppoe_accounts','pppoe_subscriptions','radcheck','radreply','radacct'))<>6 THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Required tenant tables are missing';
 END IF;
END$$
DELIMITER ;
CALL rl_pppoe_expiration_20261030_guard();
DROP PROCEDURE rl_pppoe_expiration_20261030_guard;

CREATE TABLE IF NOT EXISTS pppoe_radius_jobs (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
 radacctid BIGINT NOT NULL,
 reason ENUM('expiry','reauth') NOT NULL,
 revision BIGINT UNSIGNED NOT NULL DEFAULT 1,
 attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
 next_attempt_at DATETIME(6) NOT NULL,
 acknowledged_at DATETIME(6) NULL,
 PRIMARY KEY(id),
 UNIQUE KEY uq_ppp_radius_job_session(radacctid),
 KEY idx_ppp_radius_job_due(next_attempt_at,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pppoe_radius_job_state (
 id TINYINT UNSIGNED NOT NULL,
 scan_cursor BIGINT NOT NULL DEFAULT 0,
 cleanup_cursor BIGINT NOT NULL DEFAULT 0,
 PRIMARY KEY(id),
 CONSTRAINT chk_ppp_radius_job_state_singleton CHECK(id=1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT IGNORE INTO pppoe_radius_job_state(id,scan_cursor) VALUES(1,0);

START TRANSACTION;
-- Only mirror the latest active base subscription. Existing grace policy is
-- retained; TIMESTAMPDIFF treats stored DATETIME as UTC without session TZ.
DELETE rc FROM radcheck rc JOIN radius_identities r ON r.current_username=rc.username
 WHERE r.service_kind='pppoe' AND rc.attribute='Expiration';
INSERT INTO radcheck(username,attribute,op,value)
 SELECT r.current_username,'Expiration',':=',CAST(TIMESTAMPDIFF(SECOND,'1970-01-01 00:00:00',COALESCE(s.grace_expires_at,s.expires_at)) AS CHAR)
 FROM radius_identities r JOIN pppoe_accounts a ON a.radius_identity_id=r.id
 JOIN pppoe_subscriptions s ON s.id=(SELECT latest.id FROM pppoe_subscriptions latest
  WHERE latest.account_id=a.id AND latest.service_role='base' ORDER BY latest.id DESC LIMIT 1)
 WHERE r.service_kind='pppoe' AND r.current_username IS NOT NULL
  AND s.lifecycle='active' AND COALESCE(s.grace_expires_at,s.expires_at) IS NOT NULL;
DELETE rr FROM radreply rr JOIN radius_identities r ON r.current_username=rr.username
 WHERE r.service_kind='pppoe' AND rr.attribute='Session-Timeout';
COMMIT;
