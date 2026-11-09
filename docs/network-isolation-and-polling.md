# Network/NAS ownership and polling

Resources use `Lord_Rdius-Cloud | ENV-<environmentId> | NAS-<nasId>` with an explicit suffix for API relay/SNAT and client certificates. Reserved capacity uses ENV/SLOT until assigned. Shared CA certificates and internal FreeRADIUS virtual-server names retain their existing identity.

The common create, provision, script, API and RADIUS-client paths validate tenant/environment/subscription ownership. Cloud API access uses the assigned CHR relay, validates the expected PPP secret and active tunnel address, and reconciles that NAS's persistent source NAT. Local direct endpoints reserve IP:port centrally; a second owner is refused rather than silently contacting another customer's NAS.

Direct endpoint reservations deliberately remain ownership tombstones after address changes and tunnel cleanup. They must not be automatically reassigned while old tenant databases or requests might remain reachable. Reclaiming them requires a separate verified decommission operation; this change does not implement automatic reclamation.

## Polling budget

* Existing CHR polling remains shared per gateway, targeting a minimum 60-second spacing. Both dashboards consume the same saved observations. OVPN observations age after three minutes.
* The API monitor holds a shared database named lock, processes no more than three NAS sequentially per cycle, and waits ten seconds after the batch. It selects at most one device per environment in the batch and rotates devices. Eligible devices have a minimum five-minute spacing; larger fleets or slow connections can take longer. API/resource observations age after six minutes.
* Automatic browser refresh reads saved snapshots. Manual refresh checks the gateway and up to three devices, advancing its cursor on the next click; gateway failure stops the manual batch. Opening additional browser tabs no longer creates automatic API polling loops.
* Existing aggregate PPPoE/Hotspot polling is retained. No synthetic subscriber authentication requests are introduced. Connected OVPN NAS counts use the shared CHR observation rather than a short resource-report timestamp.

## Compatibility and cleanup

Existing tunnel usernames, passwords and certificate CNs are preserved. CHR comments are adopted during the common provisioning/API path after ownership checks. Download and apply the regenerated NAS script to update device-side tags. Legacy RADIUS/route adoption is constrained by the expected endpoint and tunnel, and legacy telemetry migration checks the exact tenant telemetry URL. Scripts do not remove another full ENV/NAS tag.

Backend tunnel cleanup validates each recorded tunnel and removes its exact secret, sessions, certificate and relay/SNAT rules. Tunnel address reservations remain until database decommission finishes. The standalone `remove-lord-radius-nas.rsc` is intentionally a whole-device cleanup script; it is not used for scoped environment cleanup and must not be run on CHR.

## Verification boundaries

Static TypeScript diagnostics are checked for the modified services, route and NAS component. No browser, database migration, RouterOS script execution or live two-network isolation test was performed. The device-side checks in `nas-diagnostics-review.md` remain required before claiming end-to-end isolation has been proven.
