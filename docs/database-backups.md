# Database backups

Central administration → System → Backups provides manual runs, an editable schedule, cloud setup, and per-database history. Scheduling and retention are disabled initially.

## Server prerequisites

Save and verify the database server SSH connection using the existing pinned-host workflow. The SSH account needs passwordless sudo for the managed Python execution. Python 3, MySQL client and MySQL 8 mysqldump must be installed. Select the server hosting the central database; tenant mappings use their registered database servers. Existing provisioning-secret encryption must be configured.

Backups run sequentially and retain schema, data, routines, events and triggers. Each compressed artifact is checked for gzip integrity and SHA-256 before becoming downloadable. Transactional consistency requires transactional tables; avoid schema changes during a dump. File verification does not replace a restoration exercise. Artifacts are private under /var/lib/radius-lord/database-backups. Temporary credentials are removed after the attempt.

## Schedule and retention

Choose an interval in hours or days. Day schedules also use the selected local time and IANA timezone. Enable explicitly after checking server access. Retention is optional, defaults to 30 days with at least three newer successful copies retained per database, and removes server artifacts only after delivery completes. History and cloud copies remain.

## Cloud setup tab

Telegram: save a bot token and destination chat ID, grant the bot permission to send documents, then run the upload test. Hosted Telegram uploads are limited to 50 MB; larger artifacts remain downloadable and can use Drive.

Google Drive: configure an OAuth web client, enable Drive API, register the exact callback URL displayed in the tab, save its client ID and secret, then connect the account. The application requests drive.file access and creates a Radius Lord Backups folder. OAuth consent configuration must allow the intended account and durable offline access.

Secrets are encrypted and never returned to the browser. Each destination has a real small-file upload test; the probe file remains in the selected destination. Tests require live credentials and network access.

A verified backup remains successful if a cloud destination fails. History reports each destination separately. Drive uploads resume with a fixed file ID. Ambiguous Telegram results require checking the chat before an explicit retry to avoid duplicates. Local download is an explicit browser action, not an automatic save to a user device.

No restoration or automatic deletion of cloud copies is implemented. Production server and cloud integration must be verified after deployment.
