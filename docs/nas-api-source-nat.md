# Managed API source NAT on CHR

For OVPN relay access, source NAT is a persistent prerequisite rather than a temporary probe rule. The application reconciles it under the existing gateway lock before publishing the temporary relay DNAT/forward rules or opening TCP connections.

Each rule is scoped by environment and tenant-local NAS ID:

`Lord_Rdius-Cloud | ENV-7 | NAS-1 | API-SNAT`

The match is restricted to TCP, the backend peer IPv4 observed by CHR, the exact NAS tunnel IPv4 `/32`, and its configured API destination port. The translated source is the saved gateway tunnel address. The central tunnel binding and local tenant/subscription/environment snapshot are checked first. No RADIUS ports, routes or tenant database schema are changed by this feature; direct NAS connections do not use it.

## Reconciliation

* The first relay operation creates the rule automatically if absent, or updates the existing owned rule if its endpoint configuration changed.
* A single, exact matching `... | API-SNAT-TEST` or `TEMP_LR_API_SNAT_TEST` rule can be adopted and renamed. A rule targeting another NAS IP is never adopted for this NAS.
* Duplicate canonical markers or rules with conflicting matchers fail explicitly instead of overwriting an unrelated policy.
* The reconciler verifies enabled state, match fields and priority. It can move its own rule above a potentially matching preceding source-NAT rule using RouterOS internal IDs. It leaves preceding, disjoint managed host rules in place, avoiding repeated priority changes as different NAS devices are polled.
* Healthy, unchanged rules are reused without recreation. There is no new polling timer or extra background worker.
* Any remaining exact matching manual test rules are removed only after a successful NAS API operation. A failed operation does not remove them.

DNAT and forwarding remain temporary and are cleaned up after every probe. Legacy temporary SNAT rules are also cleaned on retry. The new persistent SNAT is not included in probe cleanup. No global connection-tracking flush or broad NAT/firewall reset is performed.

## Environment removal and diagnostics

Environment cleanup removes this NAS's persistent rule and owned relay rules before its tunnel address can be released for reuse. Rule ownership and target addresses are checked; a cleanup conflict stops the operation. Shared/global NAT rules and other networks' test rules are retained.

Failure diagnostics include environment, NAS, gateway, observed relay source and the managed rule identity. Counter snapshots include the persistent rule; its counters are cumulative, not a count of only the latest probe. New Arabic error messages distinguish ambiguous rules, conflicting configuration and failed verification.

After updating the backend, run API check on the existing NAS. The matching manual test rule can be adopted in place. Re-importing the device script or recreating the tenant environment is not required for this CHR-side correction.

Validation is limited to static TypeScript checking of the changed files. No live CHR/MySQL operation, automated test or browser check was run for this change.
