# Manual environment NAS connections

The hosting driver and NAS transport are separate. Both approved plans and custom subscriptions use the same provisioning path and limits. The existing shared hosting driver continues to use the saved platform hosting URL, including local-IP hosting.

## Modes

* `ovpn`: the default for old environments and paid provisioning. Create the initial NAS, CHR PPP secret, client certificate and reserved address automatically. A retry reuses the same central tunnel; it checks existing resources and can restore missing owned resources. Conflicting, expired or revoked resources fail explicitly rather than being overwritten. Regenerating a missing certificate requires reapplying the device script.
* `direct`: chosen in manual creation. Require a management IPv4 address, API port and dedicated API credentials. Require the backend source IPv4 as observed by the NAS. A separate optional RADIUS source address supports routed/NAT deployments; it defaults to the management address. No CHR tunnel, certificate, address reservation or VPN route is created.

An address being saved does not prove connectivity. The backend must have a route to the management address; the RADIUS server must be reachable from the NAS and see the configured RADIUS source address. NAT mappings/routing remain infrastructure configuration. Direct API failure never falls back to CHR.

## Persistence and provisioning

The central private `environment_nas_link` setting is scoped to tenant, subscription and environment. Its initial API password is encrypted. It is saved with the manual order in the same transaction. Tenant API credentials use the existing encrypted credential store; passwords are never included in the NAS listing or review screen.

`nas_direct_connections` stores direct addresses and diagnostic snapshots independently of `nas_ovpn_connections`. The table is part of the canonical tenant SQL template, and bootstrap ensures it exists using the database provisioning connection. No manual central migration is needed for transport selection.

Preflight and retry follow the persisted mode. Direct mode keeps database capacity, permissions, hosting, FreeRADIUS authentication/accounting and isolation checks, but skips the CHR requirement. Its health report is separate from the OVPN report. The existing infrastructure worker refreshes that report only when it expires and direct environments exist.

Environment activation proves the application/database/RADIUS installation, not that a NAS has imported its script. The NAS remains awaiting its first successful connection check. Direct API diagnostics, PPPoE traffic and API session removal use the saved management endpoint. Resource snapshots and RADIUS client registration select the appropriate connection table.

## Device script and changes

The direct script restricts the API service and dedicated user to the specified backend `/32`. It refuses to overwrite a user with a different ownership comment. It creates no VPN, routes, NAT rules or global allow rules. Existing firewall restrictions still apply. When the RADIUS source equals the management IP it explicitly selects that local source; translated RADIUS sources are not assigned as local addresses.

Direct NAS settings can be edited later. Leaving its API password blank retains the encrypted password. Saving invalidates previous API observations and refreshes RADIUS registration. Reapply the script after changing addresses, credentials or ports, then run API check. If RADIUS reload fails after settings were saved, repeat saving to resynchronize; no successful check is inferred.

Direct API results describe management reachability; they do not imply an OVPN connection or prove successful subscriber authentication. Existing CHR tunnel monitoring continues to describe OVPN only.

No live MySQL, SSH or RouterOS operations are performed by this source change itself. Tenant templates pinned by an already-running provisioning job retain the existing schema-drift guard.
