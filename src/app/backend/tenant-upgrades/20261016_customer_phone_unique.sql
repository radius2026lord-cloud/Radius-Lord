-- Enforce one phone number per subscriber in the selected tenant database.
-- Existing duplicates are reported and must be resolved before this upgrade can finish.
-- This script avoids INFORMATION_SCHEMA permissions and does not delete subscriber data.

SELECT phone,COUNT(*) AS record_count,GROUP_CONCAT(id ORDER BY id) AS customer_ids
FROM customers
WHERE phone IS NOT NULL AND CHAR_LENGTH(TRIM(phone))>0
GROUP BY phone HAVING COUNT(*)>1;

DELIMITER $$
DROP PROCEDURE IF EXISTS rl_customer_phone_unique_v1$$
CREATE PROCEDURE rl_customer_phone_unique_v1()
BEGIN
 DECLARE acquired INT DEFAULT 0;
 DECLARE duplicate_count INT DEFAULT 0;
 DECLARE lock_name VARCHAR(64);
 DECLARE CONTINUE HANDLER FOR 1061 BEGIN END;
 DECLARE EXIT HANDLER FOR SQLEXCEPTION
 BEGIN
  IF acquired=1 THEN DO RELEASE_LOCK(lock_name); END IF;
  RESIGNAL;
 END;

 IF DATABASE() IS NULL OR DATABASE()='lord_radius_core' OR BINARY LEFT(DATABASE(),10)<>BINARY 'rl_tenant_' THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Select the target rl_tenant_ database; central or unrelated databases are refused';
 END IF;

 SET lock_name=CONCAT('rl-customer-phone:',LEFT(SHA2(DATABASE(),256),40));
 SELECT GET_LOCK(lock_name,0) INTO acquired;
 IF COALESCE(acquired,0)<>1 THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Another customer phone upgrade is running';
 END IF;

 SELECT COUNT(*) INTO duplicate_count FROM (
  SELECT phone FROM customers
  WHERE phone IS NOT NULL AND CHAR_LENGTH(TRIM(phone))>0
  GROUP BY phone HAVING COUNT(*)>1
 ) duplicates_found;
 IF duplicate_count>0 THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Duplicate customer phone numbers exist; inspect the duplicate report and resolve them before retrying';
 END IF;

 ALTER TABLE customers ADD UNIQUE KEY uq_customer_phone (phone);

 DO RELEASE_LOCK(lock_name);
 SET acquired=0;
END$$
CALL rl_customer_phone_unique_v1()$$
DROP PROCEDURE rl_customer_phone_unique_v1$$
DELIMITER ;

SHOW INDEX FROM customers WHERE Key_name='uq_customer_phone';
