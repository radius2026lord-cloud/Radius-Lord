# Selecting backup versions for isolated checks

The health tab opens a review dialog for a database source. The versions endpoint limits selection to successful, unremoved backups for that same kind/server/database tuple. It returns 50 versions per page; older pages load on demand. Opening a historical backup preserves its ID as the initial selection, even when it is older than the first page. No fallback silently starts a different file.

The dialog shows filename, batch, backup timestamp, size and timezone. It marks the latest available copy and the copy associated with the most recent successful restoration check. These shortcuts select the file without starting a check. Comparison cards show the chosen, newest and most recently passed copy when distinct.

Each selected file has a paginated verification history (10 entries per page), a current check record and a server-computed duration. Pending checks are polled while the dialog is open; changing versions clears the previous view and rejects stale responses. Download uses the selected backup ID. Checks start only through the explicit action with a stable request UUID during uncertain retries.

The shared circular view counts completed phases: initialization, import, table checks, and cleanup. It shows no byte-import percentage. A failed check does not infer a completed phase count from an error code. Success includes the cleanup confirmation, table count, finish time, and duration when available. Older history cards may lack duration; the selected-file endpoint provides it.

The MySQL restore implementation and production database behavior are unchanged by this UI change. A restoration check remains an isolated exercise, not production replacement.
