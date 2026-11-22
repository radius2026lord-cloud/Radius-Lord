# Radius Lord local deployment console

Windows / Python 3 with Tk, Git, Node/npm, Windows OpenSSH Client. Launch
`Radius-Lord-Deploy.cmd`. All changes belong to the canonical branch
`work/subscriptions-customer-details` in `radius2026lord-cloud/Radius-Lord`.

## Connection and logs

- Destination: `root@78.155.66.122:3001`. Key and project paths and last version
  are saved in `%LOCALAPPDATA%\RadiusLord\deploy-console.json`. No SSH password,
  private key or passphrase is stored by the Windows console.
- Create a protected Ed25519 key, install its public key once using root's SSH
  password, enable Windows **OpenSSH Authentication Agent** and load the key.
  Existing keys are never replaced and host verification is never disabled.
- Interactive tasks now open a real console with input/output attached. Press
  Enter after reading the result. **فتح طرفية SSH** opens an independent OpenSSH
  terminal with a PTY; this is an external terminal, not a Tk terminal emulator.
- **فحص الاتصال** displays the last SSH check, active release, backend/frontend,
  MySQL and FreeRADIUS service states. These are service states, not end-to-end
  RADIUS authentication or accounting verification.
- Select log text and press Ctrl+C; Ctrl+A selects all. The context menu and
  toolbar support copy selected/all, clear and UTF-8 export. Clearing only clears
  the local display. Disable following to read earlier output without scrolling.
- The latest-release log button reads the active release's status and log tail.

## Releasing

Set the remote once:

```powershell
git remote set-url production ssh://root@78.155.66.122:3001/srv/radius-lord/repository.git
```

SSH uses root, but Git upload/receive and release helper operations run through
`sudo -n -u radiusdeploy`; services retain their existing identity and ownership.
Pull with a clean worktree, build backend and frontend, enter a newer semantic
version and description, then publish. The console checks the branch, origin,
production destination and built commit, pushes an immutable annotated release
tag, and monitors deployment. It does not replace tags, reset local changes,
forge migration receipts or bypass bootstrap/backup/recovery checks. An uncertain
push is never automatically retried; inspect status before another action.

## Environment backup setup

1. Pull these changes and reopen the console. A new website release is not needed
   just to update this desktop tool.
2. Open **نسخ البيئة واستعادتها**, click **تجهيز إدارة النسخ**. This installs the
   reviewed helpers at `/usr/local/lib/radius-lord/` over SSH, and installs GnuPG
   if missing. Requires root and a clean canonical project checkout.
3. Click **ضبط تشفير النسخ**. Choose a separate passphrase of at least 16
   characters and keep it outside the server. This is not your SSH passphrase.
   It is sent through encrypted SSH stdin and saved root-only at
   `/etc/radius-lord-backup.key` for scheduled backups. It is not included in
   archives. Losing both the key and passphrase makes recovery impossible.
   Existing encryption keys are never silently replaced.
4. Refresh the list. Select databases if desired; no selection means all supported
   databases physically present on this Ubuntu host. Remote registered databases
   are not silently claimed to be backed up.

| Kind | Contents |
| --- | --- |
| `full` | Selected local central/tenant/infrastructure databases, active backend and frontend source + compiled output, shared env/uploads, Git bundle, application MySQL account/grant recovery SQL, deployment hooks, Apache/MySQL/FreeRADIUS/HTTPS and Radius Lord unit configuration |
| `project` | Active backend/frontend source + compiled output, shared env/uploads, Git bundle and account/hook recovery material; no database contents |
| `databases` | Selected local database contents, routines, events and triggers; no project files |

Supported databases: `lord_radius_core`, `rl_tenant_*`, `rl_infrastructure_*`.
The active project is resolved through `/srv/radius-lord/current`; shared data
comes from `/srv/radius-lord/shared`. Only the active release is copied, not all
historical releases. Git history is included as an encrypted bundle.
`node_modules`, `.git` directories, caches and log files are excluded from the
project copy. Lockfiles are retained; restore reinstalls dependencies, so registry
access may be needed. This is an application backup, not an Ubuntu disk image.
No Netplan/firewall/SSH configuration or remote CHR/router backup is included.

Backups are encrypted/authenticated with GnuPG AES-256 and stored root-only in
`/var/backups/radius-lord-environment`. File hashes are checked after decrypting
and before marking verified. This proves archive integrity, not a restore rehearsal.
SHA256 is checked after upload/download; uploads initially remain unverified.
Only this tool's `.tar.gpg` format is accepted, not arbitrary SQL/ZIP files.

**Downtime:** manual and scheduled snapshots temporarily stop the deployment
timer, frontend, backend and FreeRADIUS if they were active. Only previously
active services are restarted. No MySQL service restart is required. Other
external writers to the same databases must be quiesced separately.

Transfers show bytes and percentage; creation/verification/restoration show busy
status. If SSH drops, the host operation may continue: refresh the backup list
and inspect services/restore receipts, rather than blindly repeating a write.
Long operations ignore SIGHUP; this is not protection against a host reboot.

## Restore and recovery

Select a backup, use **فحص ومراجعة**, review its kind, release, DB scope, file count,
host identity and SHA256, then restore only a trusted backup. The review remains
bound to that file's digest. Different-server recovery is deliberately manual.
On the same host the tool reinstalls project dependencies in a separate release,
pauses services, creates a complete pre-restore backup, imports the selected DBs,
replaces the included shared files and switches `current`. Other databases are
not deleted. Backend health and commit are checked after startup.

Service configuration and MySQL account SQL are staged **for manual review** in
the backup vault, not automatically activated/replayed. Current MySQL accounts,
host configuration and SSH access stay in place. If historical credentials have
changed, review these recovery files before declaring recovery complete. The Git
bundle is recovery material; live Git refs are not reset during restore.

Restores are not atomic across databases/files. On an apply failure services stay
stopped and `restore-*.json` records the pre-restore backup and recovery state.
Do not keep publishing or restoring blindly; inspect the receipt, recover the
known backup and explicitly restart the previously active units. No automatic
rollback can promise recovery after a partially applied database import.

## Scheduling and retention

The scheduling dialog uses explicit UTC hour and daily/weekly counts. Its timer
is `radius-lord-environment-backup.timer`, service of the same name. Scheduling
is off until enabled. Retention keeps the newest N scheduled copies plus one
per week for W weeks; it prunes only after a fresh successful scheduled backup.
Manual and uploaded copies are not automatically pruned. Disabling scheduling
does not delete backups. Backups are on the same server until downloaded; keep
a separate offline copy and passphrase.

## Central operational cleanup

The maintenance tab reviews and applies `reset-central-operational.py`, preserving
chosen MySQL/SSH and FreeRADIUS records, hosting, admins and reference catalogs.
Defaults match this host: server 2, FreeRADIUS 24557. Validate the plan, then type
RESET to apply. A full encrypted snapshot precedes the transactional central-only
reset. The reviewed plan must still match after services pause. Physical tenant
DBs, MySQL accounts, FreeRADIUS files, uploaded files and remote CHR resources are
not removed. This is not a factory reset of Ubuntu.

## Validation boundary

Python syntax was checked in development. No Windows UI, live-server backup,
scheduled job or destructive restore/reset was executed in development. Exercise
backup + download + review first, and rehearse restoration on a disposable copy
before relying on it for production disaster recovery.
