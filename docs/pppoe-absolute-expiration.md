# PPPoE absolute expiration

The subscription remains the source of its stored expiry date. This change
does not move that date on login, reconnect, or worker ticks. Existing grace
days remain part of the effective cutoff (`grace_expires_at`, otherwise
`expires_at`). Date editing and renewal retain their existing rules.

`radcheck.Expiration := <UTC Unix seconds>` mirrors that effective deadline.
The tenant's managed FreeRADIUS 3 module `rl_env_N_expiration` runs after SQL
in `authorize`. It rejects expired credentials and computes the remaining
`Session-Timeout` for each accepted authentication, without an extra query.
The NAS counts down locally, including when the application is unavailable.
The obsolete per-user static timeout is removed from `radreply`; shorter
group timeouts, if configured, still take precedence in the expiration module.

## Existing environment rollout

1. Back up the tenant database and select that existing database in MySQL.
2. Stop the backend worker briefly and apply
   `src/app/backend/tenant-upgrades/20261030_pppoe_absolute_expiration.sql`.
   It adds two small outbox tables and mirrors existing dates into radcheck.
   It changes no subscription dates and creates no new database. Re-running
   the data backfill must likewise be done with subscription writes stopped.
3. Start the updated backend and synchronize NAS RADIUS configuration using
   the existing NAS configuration/script workflow. This installs the managed
   expiration module. The existing deployment performs `freeradius -C`, backs
   up the configuration, and restores it if validation/restart fails.
4. Reconnect one test account and inspect its returned Session-Timeout, then
   its cutoff and refusal to reconnect after expiry. Reconnect after part of
   the validity has elapsed: the returned timeout must be smaller.
5. Existing open sessions retain their old NAS timer until they reauthenticate.
   This deployment deliberately does not disconnect all subscribers. Arrange
   a controlled reconnect before relying on precise cutoff for those sessions.
   The background fallback still handles rejected accounts, but its batching
   interval is not a precise cutoff guarantee for an unarmed legacy session.

The supplied full creation template is for EMPTY databases only. Do not run
it against the existing tenant. No live deployment or router checks were run
as part of preparing this source change.

## Editing an expiry while connected

The date change, Expiration mirror, and session-specific outbox entry commit
in one transaction. A RADIUS Disconnect-Request then makes the existing
session reauthenticate and receive the current deadline. This intentionally
causes a brief reconnect after a date edit; it avoids assuming that every NAS
interprets a CoA Session-Timeout in the same way. An unsuccessful request
remains in the database across backend restarts and the UI reports it pending.
An ACK is recorded as request acceptance, not proof of Accounting-Stop.

## Background limits

The existing worker runs every 30 seconds. SQL advisory locks prevent two
worker instances from processing the same environment simultaneously. An
independent lock serializes outbox transmission, including requests made by
the expiry-edit endpoint. SQL transactions are not held during network I/O.

Each pass scans up to 100 open accounting sessions by an advancing persisted
ID cursor and sends up to 100 due Disconnect-Requests through one SSH batch,
with at most 10 radclient subprocesses in parallel. Backoff grows from 30
seconds to a cap of 30 minutes. Accepted requests are revisited after 15
minutes only if Accounting-Stop has still not arrived. Cleanup is bounded to
100 entries per pass. Automatic work never calls the RouterOS API. Manual
session removal continues to use its existing live API discovery/verification.

Primary cutoff is the NAS timer, not the worker's expiration status update
(which retains its existing limit of 50 subscriptions per pass). Hundreds of
simultaneous expirations still create accounting and router load; this change
avoids hundreds of application API connections at that instant, not all load.
Clock synchronization and working RADIUS authentication/Disconnect routes
remain deployment requirements. First-connection activation retains its
existing accounting-driven activation path and is not a new hard real-time
activation implementation.
