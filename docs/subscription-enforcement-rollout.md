# Subscription enforcement rollout

## Accounting contract
- The subscriber limit is the number of non-archived PPPoE accounts, not customer files.
- Several PPPoE lines under one customer consume several slots.
- Disabled and expired PPPoE accounts still consume a slot until archived.
- Hotspot accounts, cards and sessions are excluded from the subscriber limit.
- NAS has a separate purchased limit. Preserve the existing zero-means-unlimited convention.
- Never delete existing accounts when a plan is reduced.

## Reviewed foundation
- payment_orders.plan_limits_snapshot and subscriptions.plan_limits_snapshot retain purchased limits.
- Tenant platform_subscription already holds signed max_pppoe_accounts, base_max_nas,
  additional_nas_capacity and subscription dates; validateLocalLicense checks the signature.
- createNetworkNas already serializes creation with the platform_subscription row lock.
- networkScope and validateLocalLicense currently deny access after expiry. Restricted
  read access and renewal access require a separate explicit rollout; they are NOT implemented here.

## Implemented in this increment
- PPPoE creation validates the signed local license and counts only non-archived PPPoE accounts.
- The capacity check and account creation share a transaction, serialized on platform_subscription.
- A current locking count avoids stale REPEATABLE READ snapshots after waiting for the lock.
- Import preview returns used/limit/available; the UI warns and blocks an oversized request.
- Import commit preflights the ready rows before creating the batch, then rechecks each row.
- Concurrent creation cannot exceed capacity. The preflight is NOT a full-batch reservation:
  competing requests may consume slots while the import runs; failed rows remain in review.
- Master metrics now requests ready-network scope instead of provisioning-only scope.
- A failed metrics advisory-lock release no longer prevents scheduling the next tick.
- No schema changes and no automatic account/NAS deletions.

## Remaining ordered work
1. Audit every NAS creation/restore route against the same signed entitlement and archive policy.
2. Add bounded batch capacity reservations if all ready rows must be guaranteed together,
   with rollback/release and crash recovery, without long-lived batch transactions.
3. Review renewal/plan-change propagation into the signed tenant entitlement.
4. Introduce explicit read/renew versus operational permissions for expired subscriptions.
   Keep accounting and subscriber authentication running; do not stop FreeRADIUS.
5. Improve monitoring backoff, fair scheduling and stale-data display. No per-card polling.
6. Display purchased usage limits in central cards and rows using authoritative plan snapshots.
7. Validate concurrency, import rollback, expired/read-only access and renewal in the user's
   test environment. Runtime/browser/database tests were not run for this increment.
