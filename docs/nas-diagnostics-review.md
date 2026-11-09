# NAS diagnostic observations and isolation review

The NAS list and details share four independent signals: OVPN presence, API access, observed RADIUS responses, and resource-reading freshness. The header badge describes configuration readiness, not operational connectivity. Ping remains a separate network-reachability measurement.

* OVPN observations are recorded only after an actual CHR query. A failed CHR query is unavailable/unknown, not a confirmed disconnection.
* A successful API operation records its own last-success time. Failed operations retain this history and refresh the stored diagnostic view.
* RADIUS response evidence requires positive, numeric counter deltas for the exact environment RADIUS host and auth/accounting ports. An initial cumulative counter baseline, a missing counter, configuration readiness or a successful ping does not prove a current response. Accepted and rejected RADIUS replies both demonstrate a response; neither proves every subscriber login succeeds. Bad replies and timeout deltas take priority when multiple service entries are observed together.
* Older observations become stale: OVPN after 3 minutes, API after 6 minutes, and resources/RADIUS response evidence after 6 minutes. Unknown observations without a timestamp remain unknown. No synthetic authentication traffic is generated. The bounded API worker targets eligible devices after a minimum five-minute spacing; it does not guarantee five-minute coverage of an arbitrarily large fleet. Automatic browser refresh reads cached snapshots.
* Display dates use network timezone and the existing 12/24-hour preference. Client-side ageing is anchored to the backend snapshot timestamp plus monotonic elapsed time, rather than the user's computer wall clock.

## Isolation guards

Each diagnostic snapshot includes tenant, environment, subscription and NAS identifiers, plus the CHR gateway when applicable. Tenant NAS configuration snapshots must match the network's saved scope before their data is returned. The NAS workspace is keyed by endpoint, preventing an old network's same-numbered NAS from retaining UI state in another network. Open details follow refreshed stored records rather than an older copied item.

## Device-side acceptance checks — not executed

These checks need the actual two customer NAS devices and CHR. No tunnel was disconnected and no live device test was performed by this source change.

1. Refresh network A and B separately. Verify each diagnostic identity, tunnel address, CHR and resource readings belong to that network, including when both tenant databases use NAS ID 1.
2. Move between the two network pages while a refresh is pending. No reading, success notice or open details from the old endpoint should populate the other workspace.
3. On a test device only, temporarily disconnect network A's tunnel. Refresh both networks. A should report the observed tunnel disconnection while B stays unaffected. Reconnect A afterward.
4. Stop/restrict API on a test NAS without disconnecting OVPN. The tunnel and API signals should differ. Restore API afterward.
5. Generate an ordinary subscriber authentication on each network and read counters again. Only that environment's matching RADIUS endpoint should provide its response evidence. No requests should be generated merely to paint a green status.
6. Stop refreshing and leave the page open. Old observations should age to stale; changing the user's computer timezone must not change expiry or observation instants.

Static TypeScript checking is used for the modified files. Browser and live integration checks remain for the user's test environment.
