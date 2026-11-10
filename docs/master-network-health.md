# Central network health overview

The central administration sidebar exposes **صحة الشبكات** at `/Dashboard/network-health`, under networks/subscriptions. This is a quick operational overview; the existing network details page remains the detailed view. The page uses the shared collection toolbar/view toggle, dropdowns, filter cards, semantic info cards, circular progress, buttons and FloatingNotice. It supports responsive row/grid presentations, search, channel/mode/CHR filters, status cards and pagination.

## Evidence

- OVPN: shared stored CHR inventory, matching exact environment/tunnel/NAS identity. A confirmed absence of every assigned tunnel means full tunnel disconnection. A CHR query failure means unavailable verification, not a confirmed outage. Shared CHR failures/stale reports produce one grouped notice.
- API: saved per-NAS API checks. The overview reads neither subscribers nor sessions. Disabled/archived NAS are excluded, and only enabled API services are counted. A missing reading is pending, an untrusted scope is unknown, and old results are stale. Device failures are named on the card.
- Database: the shared tenant connection pool uses the exact central environment/database mapping, verifies `SELECT DATABASE()` and performs a timeout-bounded `SELECT 1`. It does not depend on subscription validity. Credentials never enter the health response or logs. Network timezone is read for timestamps.
- Database health and API metadata health are separate: a successful database connection is not marked failed merely because the metadata schema/ownership could not be read. The latter makes API evidence unknown.

## Budget and manual checks

The health worker holds a global MySQL named lock, checks one ready environment per cycle and waits ten seconds after completion. Scheduled health checks target a minimum five-minute spacing, with no fleet-wide five-minute SLA. They are also refreshed after an API monitoring attempt completes. Query timeouts are three seconds; connection acquisition reuses the existing bounded tenant pool and its existing limits.

Opening the page reads saved central settings and CHR snapshots only; visible pages refresh the display every fifteen seconds. Client-side freshness uses the backend time plus monotonic elapsed time, rather than the workstation clock. OVPN evidence ages after three minutes; API after six; database snapshots after seven. Each card shows the network timezone and respects the project 12/24-hour preference.

`طلب فحص` queues an environment, with a central atomic thirty-second cooldown. The database health worker prioritizes it. The existing API monitor consumes the same request under its existing global lock and budget (at most three sequential devices/cycle, at most one per selected environment); forced requests retain a thirty-second per-device minimum spacing. Subscription/license/tenant checks remain in that existing path. Ineligible networks still receive database checks, but API is not enabled by bypassing policy. CHR remains on its existing periodic shared cycle. `تحديث العرض` never triggers device polling.

Private `platform_settings` groups `master_network_health` and `master_network_health_requests` hold scoped snapshots and coalesced requests. Existing `nas_api_monitor` schedules add completion and request-acknowledgement timestamps. No schema migration or customer data modification is required. This implementation does not yet add an incident-history/audit-log screen.

## Validation boundary

Static TypeScript validation covers the new health service/component/page, changed API worker, billing route and dashboard shell against current shared source dependencies. No tests, browser checks, SQL execution, live database connections or device operations were performed in this task. Runtime acceptance needs cloud and direct networks, API-only failure, CHR-wide failure, database connection failure, stale observations and simultaneous queue requests in the user's test environment.
