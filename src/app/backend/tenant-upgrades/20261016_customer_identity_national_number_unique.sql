-- Enforce one identity record per national number in the selected tenant database.
-- Existing duplicate numbers are reported and must be resolved before this upgrade can finish.
-- This script avoids INFORMATION_SCHEMA permissions and does not delete subscriber data.

-- Run first so phpMyAdmin shows the existing duplicate values and customer IDs before the upgrade stops.
SELECT national_number,COUNT(*) AS record_count,GROUP_CONCAT(customer_id ORDER BY customer_id) AS customer_ids
FROM customer_identity_documents
WHERE national_number IS NOT NULL AND CHAR_LENGTH(TRIM(national_number))>0
GROUP BY national_number HAVING COUNT(*)>1;

DELIMITER $$
DROP PROCEDURE IF EXISTS rl_customer_identity_national_number_v1$$
CREATE PROCEDURE rl_customer_identity_national_number_v1()
BEGIN
 DECLARE acquired INT DEFAULT 0;
 DECLARE duplicate_count INT DEFAULT 0;
 DECLARE lock_name VARCHAR(64);
 DECLARE CONTINUE HANDLER FOR 1061 BEGIN END;
 DECLARE CONTINUE HANDLER FOR 1091 BEGIN END;
 DECLARE EXIT HANDLER FOR SQLEXCEPTION
 BEGIN
  IF acquired=1 THEN DO RELEASE_LOCK(lock_name); END IF;
  RESIGNAL;
 END;

 IF DATABASE() IS NULL OR DATABASE()='lord_radius_core' OR BINARY LEFT(DATABASE(),10)<>BINARY 'rl_tenant_' THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Select the target rl_tenant_ database; central or unrelated databases are refused';
 END IF;

 SET lock_name=CONCAT('rl-national-id:',LEFT(SHA2(DATABASE(),256),40));
 SELECT GET_LOCK(lock_name,0) INTO acquired;
 IF COALESCE(acquired,0)<>1 THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Another national number upgrade is running';
 END IF;

 SELECT COUNT(*) INTO duplicate_count FROM (
  SELECT national_number FROM customer_identity_documents
  WHERE national_number IS NOT NULL AND CHAR_LENGTH(TRIM(national_number))>0
  GROUP BY national_number HAVING COUNT(*)>1
 ) duplicates_found;
 IF duplicate_count>0 THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Duplicate national numbers exist; inspect the duplicate report and resolve them before retrying';
 END IF;

 ALTER TABLE customer_identity_documents DROP INDEX uq_identity_number;
 ALTER TABLE customer_identity_documents ADD UNIQUE KEY uq_national_number (national_number);

 DO RELEASE_LOCK(lock_name);
 SET acquired=0;
END$$
CALL rl_customer_identity_national_number_v1()$$
DROP PROCEDURE rl_customer_identity_national_number_v1$$
DELIMITER ;

-- Verify that the database-level unique index is installed.
SHOW INDEX FROM customer_identity_documents WHERE Key_name='uq_national_number';
