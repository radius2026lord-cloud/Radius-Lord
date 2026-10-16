-- Add persistent identity fields for the existing subscriber tables.
-- Select the target tenant database before running this file.
-- This migration is restricted to tenant database names beginning with rl_tenant_.
-- It does not read INFORMATION_SCHEMA so restricted tenant accounts can run it.
-- Take a database backup first; MySQL DDL commits implicitly.

DELIMITER $$
DROP PROCEDURE IF EXISTS rl_customer_identity_capture_v1$$
CREATE PROCEDURE rl_customer_identity_capture_v1()
BEGIN
 DECLARE acquired INT DEFAULT 0;
 DECLARE lock_name VARCHAR(64);
 DECLARE CONTINUE HANDLER FOR 1060 BEGIN END;
 DECLARE EXIT HANDLER FOR SQLEXCEPTION
 BEGIN
  IF acquired=1 THEN DO RELEASE_LOCK(lock_name); END IF;
  RESIGNAL;
 END;

 IF DATABASE() IS NULL OR DATABASE()='lord_radius_core' OR BINARY LEFT(DATABASE(),10)<>BINARY 'rl_tenant_' THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Select the target rl_tenant_ database; central or unrelated databases are refused';
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
  front_image_data LONGBLOB NULL,
  back_image_data LONGBLOB NULL,
  capture_method ENUM('manual','qr') NOT NULL DEFAULT 'manual',
  updated_by_manager_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_customer_one_identity (customer_id),
  UNIQUE KEY uq_national_number (national_number),
  CONSTRAINT chk_identity_number CHECK (identity_number IS NULL OR CHAR_LENGTH(TRIM(identity_number))>0),
  CONSTRAINT fk_identity_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
  CONSTRAINT fk_identity_editor FOREIGN KEY (updated_by_manager_id) REFERENCES managers(id) ON DELETE RESTRICT
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

 ALTER TABLE customer_identity_documents ADD COLUMN birth_place VARCHAR(150) NULL AFTER mother_name;
 ALTER TABLE customer_identity_documents ADD COLUMN capture_method ENUM('manual','qr') NOT NULL DEFAULT 'manual';
 ALTER TABLE customer_identity_documents MODIFY COLUMN capture_method ENUM('manual','qr') NOT NULL DEFAULT 'manual';

 DO RELEASE_LOCK(lock_name);
 SET acquired=0;
END$$
CALL rl_customer_identity_capture_v1()$$
DROP PROCEDURE rl_customer_identity_capture_v1$$
DELIMITER ;

-- Read-only verification.
SELECT DATABASE() AS selected_database;
SHOW COLUMNS FROM customer_identity_documents;
