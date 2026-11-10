# Radius Lord: Ubuntu hosting preparation v4

This replaces the workflow of the uploaded `RadiusLordInstaller-v3.2.sh` for platform hosting; it does not run or modify that uploaded script. v3.2 installs the generic RADIUS SQL schema, rewrites the SQL module, resets systemd overrides and can apply Netplan or purge shared services. Those actions must not be part of deploying an existing multi-tenant platform.

## 1. Review saved infrastructure locally

After pulling the canonical `work/subscriptions-customer-details` branch, open **الخوادم والبنية التحتية ← استضافة المنصة**. The deployment panel reads saved hosting settings, registered database/FreeRADIUS/CHR servers and the existing infrastructure selection. Choose **استيراد المحفوظ**, review current/proposed domain/IP/ports and export `radius-deployment-profile.json`. This file contains no passwords, private keys or encrypted credentials. It describes deployment; it does not modify existing server records, NAT rules, DNS or application settings. The original hosting form remains the explicit save path after a host move. A VPS with no private interface can use the same validated public IPv4 as its server address in domain mode; local-IP-only mode retains its private-address requirement.

Run checks per section or sequentially. DNS and HTTPS/API checks originate from the current backend and use an application nonce. A matching internal response does not prove public reachability, and HTTP does not prove the SSH WebSocket works. CHR's existing health API checks API/resources; the gateway page retains OVPN setup validation. FreeRADIUS uses the existing dedicated test account, not a customer account. MySQL uses the existing server health path. Full SSH/service/isolation checks remain in the existing infrastructure pages; links are provided.

The known platform API rewrites in Next.js remain intact. Apache proxies the site to Next.js and only the exact SSH WebSocket path to Express, preserving the Next.js auth/identity routes.

## 2. Transfer trusted host setup files

On the release computer, pull source and copy only the setup files to a root-private folder on Ubuntu. This bootstrap transfer does not publish the app. For example (replace `SERVER` and paths):

```powershell
git pull --ff-only origin work/subscriptions-customer-details
scp -r .\deployment\ubuntu root@SERVER:/root/radius-host-setup
scp E:\LordRad\deployment\radius-deployment-profile.json root@SERVER:/root/radius-deployment-profile.json
```

Keep real secrets, deployment exports and database dumps outside the Git working tree. Do not upload Windows `node_modules`, `.next` or backend `dist`. The first version tag delivers the whole tracked project; dependencies/build outputs are produced on Ubuntu.

## 3. Explicit Ubuntu phases

Supported initial hosts: Ubuntu 22.04/24.04 LTS, x64 or arm64. Review the plan first. No phase changes Netplan, removes services or replaces a configured FreeRADIUS SQL module.

```bash
cd /root/radius-host-setup
bash radius-installer.sh plan --profile /root/radius-deployment-profile.json
sudo bash radius-installer.sh packages
sudo bash radius-installer.sh node
sudo bash radius-installer.sh receiver
```

`packages` installs missing prerequisites, including Apache, MySQL, FreeRADIUS and build tools; package managers can start/restart services, so use a maintenance window on a populated server. It does not perform a full OS upgrade. `node` verifies the official HTTPS-distributed Node 24 archive against its published SHA256 and refuses to replace an existing different Node version. Only system-wide Node/npm are accepted by the service setup. `phpmyadmin` is an optional phase, restricted to local requests; it is not required for the platform.

Receiver setup creates `/srv/radius-lord/repository.git`, shared directories, deployment queue and frontend/backend systemd units. It refuses to overwrite existing units. For an already installed receiver, review/copy the changed trusted hook and unit configuration explicitly instead of rerunning initial setup.

## 4. Private configuration and central database

Create a **0600** root-owned JSON file outside the repository using `private-secrets.example.json` as a field guide. Supply the existing `GATEWAY_ENCRYPTION_KEY` if copying any encrypted platform data. Never generate a replacement key for imported data. Use a new dedicated local app database user/password and a private JWT secret. The helper rejects root as the app account and preserves existing environment files rather than overwriting them.

```bash
chmod 600 /root/radius-private-secrets.json
sudo bash radius-installer.sh configure --profile /root/radius-deployment-profile.json --secrets /root/radius-private-secrets.json
sudo bash radius-installer.sh database-prepare --profile /root/radius-deployment-profile.json --secrets /root/radius-private-secrets.json
sudo bash radius-installer.sh database-import --profile /root/radius-deployment-profile.json --secrets /root/radius-private-secrets.json --dump /root/approved-central.sql --sha256 APPROVED_64_HEX_SHA256
```

The preparation phase only creates a missing local database and scoped account; it never rotates an existing account password. Import requires an empty database, a reviewed single-database SQL dump and the separately approved SHA256. Import executes under the scoped app account, so statements affecting other databases/users/global grants are not authorized. Dumps with `CREATE DATABASE`, `USE another_database`, DEFINER requirements, or server-wide statements need review/normalization before import. A failed import may leave a partially populated new database; automatic retry will refuse it rather than overwrite data. Seven central table names are checked and a private import receipt is saved. This is not a migration or schema-compatibility certification.

**Required input:** this repository contains central incremental migrations, not an approved complete central baseline dump. The installer does not invent a central schema from the generic FreeRADIUS schema and does not replay every migration on an imported database. Supply the approved central dump before the first release. Existing tenant databases, their DB accounts/grants, uploaded files and remote SSH known-host fingerprints also need migration or continued connectivity; a central dump alone does not move them.

If MySQL already contains the correct central database/account, skip `database-prepare` and import. The new-host receiver still requires a reviewed import/verification receipt. Do not fabricate it: verify the central tables and actual account connection, then record that baseline as part of host acceptance.

## 5. Domain and HTTPS

```bash
sudo bash radius-installer.sh apache --profile /root/radius-deployment-profile.json
sudo bash radius-installer.sh https --profile /root/radius-deployment-profile.json --email YOUR_EMAIL
```

Initial Apache setup refuses existing vhosts/domain ownership rather than replacing them. DNS must already target the hosting IP and ACME HTTP/HTTPS ports must be reachable. The automatic HTTPS path supports standard public/internal 443 and HTTP challenge port 80. Custom ports/NAT are exportable for review but require an explicit Listen/vhost/ACME setup; automated configuration stops rather than pretending those work. A temporary HTTP vhost precedes certificate issuance; do not enter application credentials before HTTPS is active.

Frontend and backend bind to loopback (3000/4001) in this deployment. Apache serves the public domain and forwards the exact `/api/admin/ssh/terminal` WebSocket path to 4001. Application origin must equal the public HTTPS URL. Forwarded protocol is corrected on the Certbot HTTPS vhost. Existing customer URLs/CHR advertised IPs do not automatically change; after moving, compare the imported settings with the reviewed target and explicitly save the intended values from the original settings pages.

## 6. Release prerequisites and upload

Provision SSH access for `radiusdeploy`, verify the server host key locally, and configure the `hosting` remote as described in `system-releases.md`. Install executable reviewed `shared/hooks/backup` and `shared/hooks/migrate`; the backup example needs a dedicated MySQL backup config/permissions. A first release contains SQL files and therefore also requires the migration adapter. `migrate.example.sh` is deliberately a blocking example, not a successful no-op. The adapter must validate the imported baseline, apply only approved outstanding steps, verify targeted tenant structures and report the actual central/per-tenant results. Do not bypass it to make the readiness indicator green.

```bash
sudo bash radius-installer.sh verify --profile /root/radius-deployment-profile.json
```

From the local site's **تحديثات النظام**, inspect the host, prepare/review a numbered release and send it. Git on the server receives the annotated immutable tag; the existing worker extracts the full project, runs both `npm ci --include=dev` and production builds, backs up, invokes approved migrations, switches `current`, restarts services and checks release identity. The host does not need GitHub access, but does need access to its approved Ubuntu/npm/Node dependency sources.

`shared/root.env`, `shared/backend.env`, uploads, backups, staged packages and logs survive releases. Move existing uploads to `shared/uploads` before activation. No secret belongs in Git. If database changes are incompatible, automatic code rollback is not a database restore; `recovery_required` intentionally stops subsequent releases.

## Validation performed in this change

Only static Bash/Python syntax and TypeScript diagnostics are checked. No installer phase, package installation, build, DNS probe, certificate request, SQL import, SSH command, browser or production deployment was executed. Host acceptance still requires access to the real VPS, reviewed secret/central/tenant migration inputs, and an external check of HTTPS, login, WebSocket, provisioning, backup/restore and two-network isolation.

## Approved central reference added 2026-11-10

The supplied central dump now has a data-free reference and required table/column/unique-index manifest; see `central-database-reference.md`. `database-import` verifies that inventory after import. `database-verify` verifies an already restored central database using read-only SQL and writes the matching receipt. It does not certify migrations or tenant databases. This replaces the initial seven-table-only verification described above. The raw uploaded dump remains private and is never bundled into releases.

The hosting bootstrap target is the central database plus site/backend; new tenant databases remain generated automatically by the established tenant provisioning flow. No old tenant database is regenerated or removed during setup.
