-- Store identity image bytes in each tenant database.
-- Select the target tenant database before running this upgrade.
-- This script avoids INFORMATION_SCHEMA and safely skips duplicate columns.

DELIMITER $$
DROP PROCEDURE IF EXISTS rl_customer_identity_images_blob_v1$$
CREATE PROCEDURE rl_customer_identity_images_blob_v1()
BEGIN
 DECLARE acquired INT DEFAULT 0;
 DECLARE CONTINUE HANDLER FOR 1060 BEGIN END;
 DECLARE EXIT HANDLER FOR SQLEXCEPTION
 BEGIN
  IF acquired=1 THEN DO RELEASE_LOCK(CONCAT('rl-identity-images:',LEFT(SHA2(DATABASE(),256),40))); END IF;
  RESIGNAL;
 END;

 IF DATABASE() IS NULL OR DATABASE()='lord_radius_core' OR BINARY LEFT(DATABASE(),10)<>BINARY 'rl_tenant_' THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Select the target rl_tenant_ database; central or unrelated databases are refused';
 END IF;

 SELECT GET_LOCK(CONCAT('rl-identity-images:',LEFT(SHA2(DATABASE(),256),40)),0) INTO acquired;
 IF COALESCE(acquired,0)<>1 THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Another identity image upgrade is running';
 END IF;

 ALTER TABLE customer_identity_documents ADD COLUMN front_image_data LONGBLOB NULL AFTER back_image_reference;
 ALTER TABLE customer_identity_documents ADD COLUMN back_image_data LONGBLOB NULL AFTER front_image_data;

 DO RELEASE_LOCK(CONCAT('rl-identity-images:',LEFT(SHA2(DATABASE(),256),40)));
 SET acquired=0;
END$$
CALL rl_customer_identity_images_blob_v1()$$
DROP PROCEDURE rl_customer_identity_images_blob_v1$$
DELIMITER ;

-- Verify the image columns exist in the selected tenant database.
SHOW COLUMNS FROM customer_identity_documents LIKE '%_image_data';
