# Backup batches and filters

Every manual request or scheduled occurrence keeps its existing batch_key. Lists now paginate batches (20 per page), and opening a batch loads its latest database attempts (50 targets per page). Historical rows remain intact. No SQL dump files are merged.

Batch status is calculated from the latest attempt for each database target (kind, server, database name). Active attempts take priority, then queued attempts; terminal batches are successful, failed, or mixed. The circle measures completed attempts (success + failure) out of target count, not byte-transfer progress. Cloud delivery remains a separate result and cannot turn a failed dump into a success.

Retrying failed targets appends new job rows to the same original batch. Previous attempts remain visible (the latest 20 attempts per target are displayed). Batch retries use a per-batch lock and caller request UUID for idempotency. Existing unrelated historical batches are not guessed or merged. The existing sequential backup worker executes the resulting queue.

Filters cover batch status, original batch creation date, recurring hours of day, database kind, server, network, manual/scheduled origin, destination, delivery result, and text. Target conditions must match the same database row; opening the batch still shows all targets, with matches highlighted first. Summary counts apply all filters except the selected status.

Dates and hours use the saved backup policy timezone. Today, yesterday, last seven days, current month and custom ranges are available. Supplying only hours selects today. Hour ranges crossing midnight end on the next day; the ending minute is included. Hour-of-day filtering supports at most 366 dates per request. It uses backend IANA timezone conversion and UTC boundaries without requiring MySQL named timezone tables. A nonexistent local time at a DST change is rejected instead of silently shifted.

Only a central metadata index is added, when absent: backup_batch_targets(batch_key,kind,server_id,database_name,created_at). No tenant schema or tenant data changes are made.
