# Automatic network incident history

Central **صحة الشبكات** now has **الحالة الحالية** and **سجل الأعطال** views. The incident view uses the shared row/grid controls, uniform cards, semantic icons, filter groups, searchable dropdowns, item-count selector, server pagination, status cards and FloatingNotice. Filters cover open/resolved state, service, network and rolling 24-hour/7-day/30-day incident-start periods. Network dates use the saved network timezone and project 12/24-hour preference. A shared CHR incident uses explicit UTC because its networks may have different timezones.

## Confirmation and recovery

The current health view continues to show the first failure immediately. A history episode opens only after two distinct failed observations from the same scoped resource. Cached page refreshes do not count as additional failures. Confirmation resets after a fifteen-minute gap between pending failure observations, preventing an old isolated failure from being paired with a new one after a long monitoring gap.

Each episode records first observed failure, confirmation time, last known success before that failure, latest definitive check and recovery time. Duration starts at the first observed failure; polling cannot establish the physical instant of disconnection. An open episode is updated rather than duplicated. The next successful observation closes it. A later failure starts a separate confirmation sequence and episode.

Pending, stale, unavailable and disabled observations never establish recovery or confirm device disconnection. They do not close an already confirmed episode. If a persisted last-success timestamp proves that a successful observation occurred between two sampled failures, it closes the older episode (if any) and breaks pending failure confirmation. This handles a busy/restarted worker missing an intermediate successful sample.

## Scope and shared causes

Resources are keyed by kind and environment/NAS identity; a database event is per environment and a CHR event per gateway. Scope hashes are storage keys, not a replacement for the existing tenant/tunnel checks performed by health and API services. Only ready environments are consumed. History preserves its network/device identity snapshots across later renames or decommissioning; a paused environment is not falsely marked recovered.

OVPN episodes require a fresh CHR observation confirming that the exact device tunnel is absent. API episodes require a fresh saved API failure. Gateway unavailability/staleness/pending verification suppresses dependent API incidents; the absence of a tunnel is represented by OVPN rather than a duplicate API-connectivity episode. API ownership/address conflicts remain explicit verification reasons rather than being described as a physical tunnel outage.

A gateway verification failure opens one shared **تعذّر فحص CHR** episode after two actual failed gateway attempts, linked to its associated ready networks. It does not create a disconnected-OVPN episode per network. Only a fresh successful gateway query closes it. A failure to query CHR does not prove that existing customer tunnels stopped forwarding traffic.

## Persistence and budget

The worker consumes saved central health/CHR snapshots, generates no RouterOS calls or tenant-database queries, and never requests authentication traffic. It holds a global MySQL named lock, processes at most fifty distinct resource observations per cycle and waits fifteen seconds after the cycle. Round-robin selection prevents an unbounded batch; larger fleets can have delayed incident confirmation. The existing source polling budgets remain unchanged.

Private `platform_settings` groups `master_network_incident_state` and `master_network_incidents` store cursors and episodes. A cursor uses an exact resource identity and last consumed observation time. Episode writes and cursor updates share a transaction under the worker lock, preventing repeated cached observations or a backend restart from opening duplicate episodes. No database schema migration is needed. History starts after this feature is enabled; old incidents are not fabricated from current failed snapshots. Records are not automatically purged by this change.

The history GET route is master-admin-only, uses validated parameterized filters, central cached reads and bounded pages (12/24/48/96). It performs no monitoring writes. Status counts respect service/network/search/period filters and remain independent of the selected open/resolved status.

## Validation boundary

Static TypeScript checking covers the incident worker/service, changed billing route and both components. Server syntax is checked separately. No tests, browser sessions, SQL statements against a live database, or device operations were executed. Runtime acceptance still needs: two distinct failures vs one repeatedly displayed failure, recovery, a recurring incident, a shared CHR failure, unknown/stale observations, a backend restart during an open incident, multiple networks sharing NAS ID 1, and intermediate persisted success while the worker catches up.
