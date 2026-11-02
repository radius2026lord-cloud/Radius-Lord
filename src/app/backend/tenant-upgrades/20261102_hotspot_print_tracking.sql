-- Run on the existing tenant database. Keeps accounts, service periods and usage intact.
CREATE TABLE IF NOT EXISTS hotspot_card_output_jobs (
 id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 batch_id BIGINT UNSIGNED NOT NULL,
 actor_manager_id BIGINT UNSIGNED NOT NULL,
 output_kind ENUM('print','pdf') NOT NULL,
 card_count INT UNSIGNED NOT NULL,
 serials_json JSON NOT NULL,
 confirmed_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 PRIMARY KEY(id),
 KEY idx_hotspot_output_batch_time(batch_id,output_kind,confirmed_at),
 CONSTRAINT fk_hotspot_output_batch FOREIGN KEY(batch_id) REFERENCES hotspot_card_batches(id),
 CONSTRAINT fk_hotspot_output_actor FOREIGN KEY(actor_manager_id) REFERENCES managers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS hotspot_card_print_marks (
 account_id BIGINT UNSIGNED NOT NULL,
 last_job_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 printed_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 PRIMARY KEY(account_id),
 KEY idx_hotspot_print_job(last_job_id),
 CONSTRAINT fk_hotspot_print_account FOREIGN KEY(account_id) REFERENCES hotspot_accounts(id),
 CONSTRAINT fk_hotspot_print_job FOREIGN KEY(last_job_id) REFERENCES hotspot_card_output_jobs(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
