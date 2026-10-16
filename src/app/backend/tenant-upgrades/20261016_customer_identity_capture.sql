-- Add persistent identity fields for the existing subscriber tables.
-- Select the target tenant database before running this file.
-- Do not run against the central platform database.
-- Take a database backup first; MySQL DDL commits implicitly.

DELIMITER $$
DROP PROCEDURE IF EXISTS rl_customer_identity_capture_v1$$
CREATE PROCEDURE rl_customer_identity_capture_v1()
BEGIN
 DECLARE acquired INT DEFAULT 0;
 DECLARE lock_name VARCHAR(64);
 DECLARE table_count INT DEFAULT 0;
 DECLARE column_count INT DEFAULT 0;
 DECLARE capture_type TEXT;
 DECLARE EXIT HANDLER FOR SQLEXCEPTION
 BEGIN
  IF acquired=1 THEN DO RELEASE_LOCK(lock_name); END IF;
  RESIGNAL;
 END;

 IF DATABASE() IS NULL OR DATABASE()='lord_radius_core' THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Select an isolated tenant database; central database refused';
 END IF;
 IF EXISTS(SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN('tenants','master_admins','payment_orders','tenant_databases')) THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Central platform tables found; identity upgrade refused';
 END IF;
 SELECT COUNT(*) INTO table_count FROM information_schema.TABLES
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN('customers','managers');
 IF table_count<>2 THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Required tenant customers/managers tables are missing';
 END IF;

 SET lock_name=CONCAT('rl-identity:',LEFT(SHA2(DATABASE(),256),40));
 SELECT GET_LOCK(lock_name,0) INTO acquired;
 IF COALESCE(acquired,0)<>1 THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Another identity upgrade is running';
 END IF;

 CREATE TABLE IF NOT EXISTS customer_identity_documents (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  customer_id BIGINT UNSIGNED NOT NULL,
  first_name VARCHAR(100) NULL,
  last_name VARCHAR(100) NULL,
  father_name VARCHAR(100) NULL,
  mother_name VARCHAR(100) NULL,
  birth_place VARCHAR(150) NULL,
  birth_date DATE NULL,
  national_number VARCHAR(50) NULL,
  identity_number VARCHAR(50) NULL,
  address TEXT NULL,
  front_image_reference VARCHAR(500) NULL,
  back_image_reference VARCHAR(500) NULL,
  capture_method ENUM('manual','qr') NOT NULL DEFAULT 'manual',
  updated_by_manager_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_customer_one_identity (customer_id),
  UNIQUE KEY uq_identity_number (identity_number),
  CONSTRAINT chk_identity_number CHECK (identity_number IS NULL OR CHAR_LENGTH(TRIM(identity_number))>0),
  CONSTRAINT fk_identity_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
  CONSTRAINT fk_identity_editor FOREIGN KEY (updated_by_manager_id) REFERENCES managers(id) ON DELETE RESTRICT
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

 SELECT COUNT(*) INTO column_count FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='customer_identity_documents' AND COLUMN_NAME='birth_place';
 IF column_count=0 THEN
  ALTER TABLE customer_identity_documents ADD COLUMN birth_place VARCHAR(150) NULL AFTER mother_name;
 END IF;

 SELECT COALESCE(MAX(COLUMN_TYPE),'') INTO capture_type FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='customer_identity_documents' AND COLUMN_NAME='capture_method';
 IF capture_type='' THEN
  ALTER TABLE customer_identity_documents ADD COLUMN capture_method ENUM('manual','qr') NOT NULL DEFAULT 'manual';
 ELSEIF LOCATE('qr',capture_type)=0 THEN
  ALTER TABLE customer_identity_documents MODIFY COLUMN capture_method ENUM('manual','qr') NOT NULL DEFAULT 'manual';
 END IF;

 DO RELEASE_LOCK(lock_name);
 SET acquired=0;
END$$
CALL rl_customer_identity_capture_v1()$$
DROP PROCEDURE rl_customer_identity_capture_v1$$
DELIMITER ;

-- Read-only verification.
SELECT DATABASE() AS selected_database;
SELECT COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE,COLUMN_DEFAULT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='customer_identity_documents'
 AND COLUMN_NAME IN('father_name','mother_name','birth_place','birth_date','national_number','capture_method')
ORDER BY ORDINAL_POSITION;
