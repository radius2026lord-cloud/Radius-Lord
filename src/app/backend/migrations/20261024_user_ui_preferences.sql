-- Per-account UI preferences. Apply once to the central database.
CREATE TABLE IF NOT EXISTS user_ui_preferences (
  owner_key VARCHAR(191) NOT NULL,
  preferences_json JSON NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (owner_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
