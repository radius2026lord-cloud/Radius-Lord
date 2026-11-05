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
  read access and renewal access are now explicitly allowed for identity/preferences/subscription only; other operations retain the default active-license checks.

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
4. Review and extend restricted subscription access where additional read-only pages are required.
   Keep accounting and subscriber authentication running; do not stop FreeRADIUS.
5. Improve monitoring backoff, fair scheduling and stale-data display. No per-card polling.
6. Display purchased usage limits in central cards and rows using authoritative plan snapshots.
7. Validate concurrency, import rollback, expired/read-only access and renewal in the user's
   test environment. Runtime/browser/database tests were not run for this increment.

## Subscription page and expiry access increment
- Subscription dates returned to the browser come from the verified signed payload.
- New local license writes use explicit UTC SQL strings, a signed dateEncoding=utc marker,
  and update plan name/limits/duration/subscription ID/signature together. Sync version
  increases when the signed entitlement changes. Original activation is preserved.
- Legacy rows are not rewritten or re-signed on read. They retain their existing driver
  compatibility check. Historical seven-hour discrepancies need a controlled reconciliation
  against the central record; this change does not guess or shift their expiry.
- All subscription UI dates explicitly use network_settings.timezone and the shared 12/24
  preference. Countdown progression is anchored to server time, not the device clock.
- Full capacity counts occur on opening or refreshing the subscription page only.
  Settings are coalesced/cached centrally for 60 seconds; no per-gauge polling is added.
- One derived reminder appears in the network bell/banner based on central reminder days,
  and disappears when the verified expiry moves outside the threshold.
- A principal can register one renewal request per subscription/expiry in central settings.
  Requests are visible on central network cards and a tenant activity event is attempted.
  WhatsApp opens a prepared message; it never records payment or confirms renewal.
- Expired (not revoked/suspended) entitlements may authenticate and access subscription
  information/renewal/preferences. Operational route guards remain strict. The UI redirects
  expired portals to subscription. No FreeRADIUS process/client/session is stopped.
- No migration, historical expiry update, payment confirmation, or automatic renewal is run.
- Remaining: real payment/renewal approval propagation, full subscription event history,
  NAS counting audit, batch reservations and runtime/database/browser verification.

