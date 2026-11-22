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

## Desktop layout

- Compact header, four equal service cards, and separate deployment/backup/maintenance
  tabs. Connection/key setup opens in a separate settings window.
- Cards display actual last-checked service state, checking or unknown; click for
  details and last check time. Restart is separate and requires confirmation.
  A failed SSH check clears cached card states to unknown.
- The lower log has a draggable divider, expand/restore button, selectable text,
  timestamped messages and semantic error/warning/success colors. The selected tab receives its required height without a workspace scrollbar.
- Light/dark appearance is saved locally. Action buttons wrap across rows; busy
  controls explain that a running task must finish. Phase labels show actual
  checks, build, push and observed server deployment stages.
- Layout changes were syntax-checked, not visually exercised on Windows.


### Compact controls

The control canvas and its scrollbar were removed. Tab height is adjusted to the
selected page; the log gets remaining space. Connection settings and database
selection open in separate windows. Backup actions sit next to the backup table,
so actions remain visible rather than below a scrolling form. Scrollbars remain
only for long data history and the operation log. Flat buttons, lighter framing
and the LBC font (when installed, otherwise Segoe UI) follow the project palette.

## Modern desktop interface (Qt WebEngine)

`Radius-Lord-Deploy.cmd` now opens the local HTML/CSS interface in a PySide6
Qt WebEngine window. First launch creates an isolated Python environment under
`%LOCALAPPDATA%\RadiusLord\desktop-python` and installs `PySide6>=6.8,<7` from
PyPI. Python 3.10+ and internet access for the first dependency download are
required. No Node build is needed for this interface. Later launches reuse it.

The interface lives in `deployment/windows/web/`. It uses local inline SVG icons,
RTL layout, soft cards, semantic service states, light/dark colors and a large
selectable operation log. It uses LBC if installed, otherwise Windows fonts.
No remote fonts, CDN, HTTP server or public port is used. Qt WebChannel exposes
only the named desktop operations. Requests to remote URLs and navigation outside
the local interface are blocked. Log and database contents are inserted as text,
not executable HTML. Password/passphrase entry uses Qt password dialogs and does
not pass through JavaScript or saved preferences.

The Qt shell shares the existing SSH/Git/backup Python methods; it does not replace
the receiver or change production files merely by opening the UI. Key setup and
SSH sessions still open a real terminal. Publish, restore, delete, schedule,
restart and central-reset confirmations remain enforced in Python.

Use **فحص الخدمات** for actual status, or the backup refresh button after installing
the backup helper. No health state is invented for display. The desktop still
requires Git, Node/npm and Windows OpenSSH for the corresponding operations.
The underlying operation module imports Python's standard Tkinter library but does
not create a Tk window in modern mode. The old interface can be opened using
`Radius-Lord-Legacy.cmd` during this transition.

Validation: Python AST and JavaScript syntax checks passed. The Qt interface has
not been launched on Windows in the development environment, and no production
backup, restore, reset or release was executed for this UI conversion.


### Guided connection setup

The modern connection dialog now has five ordered stages: paths, existing/new
key, Windows Agent service + matching loaded fingerprint, public-key installation,
and real SSH/service verification. **فحص الإعدادات** reads local state without
changing the server. Existing keys are detected and never replaced. Agent checks
match the selected public-key fingerprint rather than accepting any loaded key.
Completed/inapplicable actions are disabled. Previously installed keys can go
straight to the final connection check; a successful check confirms installation.
No setup state is fabricated from saved preferences.

**تشغيل الخدمة** requests Windows UAC only when clicked, to set ssh-agent Automatic
and start it; service state is rechecked afterward. **تحميل المفتاح** is a separate
interactive passphrase step. Fingerprints and service state are not passwords.
The final check can fail due to the network even when local setup is complete;
inspect the log before changing credentials or generating another key.

Native Qt/browser title tooltips are suppressed. Arabic CSS hints replace them,
so stray native "Close" labels are not shown over the interface.


### Connection diagnosis and pre-publish readiness

SSH command failures now retain their captured output for classification. The
modern interface distinguishes TCP timeout/refusal, missing route, DNS failure,
untrusted/changed host identity, key-file/Agent problems, authentication rejection,
and interrupted negotiation. Unrecognized SSH exit 255 remains explicitly
unclassified. The raw failure stays in the local operation log; the diagnostic
banner shows a targeted next action. It never deletes known_hosts or replaces a
key automatically. Interactive terminal failures still require reading that
terminal because they are not captured by the background SSH runner.

**فحص الجاهزية** reads the canonical local repo/branch/worktree, exact built commit,
production destination, release version/description, remote receiver checks,
free disk space, deployment lock/recovery state and backup-hook configuration.
It compares local SQL changes to the current server commit and requires the
existing migration adapter when relevant. It displays current/target revisions
and the latest available backup verification record. This historical record does
not certify restore readiness; the release worker must still create and verify
its mandatory new backup. The check itself does not create a backup or restart
services. Readiness is re-run immediately before pushing a release tag. If no
successful review has been shown, clicking publish performs the readiness check
first so the user can review the card before confirming the actual release.

Validation remains static Python/JavaScript syntax checks; no Windows/live SSH,
backup or deployment operation was run as part of this update.

### Durable operation history and read-only follow-up

The **العمليات** tab stores new desktop operation metadata and redacted log text
under `%LOCALAPPDATA%\RadiusLord\history\operations.sqlite3`. It records the action,
start time, local-attempt duration, outcome, release/backup identifier and log.
Passwords, passphrases and action argument dictionaries are not stored. Recognized
secret assignments, DSNs and private-key blocks are redacted from captured logs;
this is pattern-based redaction, not a guarantee about arbitrary tool output.
Previous operations from before this update cannot be reconstructed automatically.

An interrupted session is marked unknown. The next startup offers/displays these
records and attempts one read-only follow-up; **فحص العمليات غير المحسومة** can
repeat the status read later. It never replays Git push, restore, backup or delete.
Release follow-up reads the exact version status file directly: it deliberately
does not call the receiver's status function, which may enqueue a missing release.
Missing evidence stays unknown; it is not treated as success or permission to retry.

Refresh the server helper once using **تجهيز إدارة النسخ** after updating this
version. New backup/create/restore/delete/schedule/reset writes carry an operation
ID. The helper writes root-only receipts with running/succeeded/failed status,
process identity and result under the backup vault's `operations/` directory.
Status reads do not acquire the deployment lock and can observe an ongoing job.
PID start ticks distinguish the recorded process from a reused PID; interrupted
processes remain unresolved. Existing operation IDs cannot replay a write.
A failed receipt does not imply an atomic rollback, particularly for restore.
Older helpers/operations without a receipt remain unknown and require review.
Uploads without a completed local hash check remain unknown even if a file exists.
The visible duration is the desktop attempt duration, not a claimed remote runtime.

### Automatic connection check and bounded inspection

The modern shell checks SSH and service state once at startup, before enabling
project/server operations. Connection setup, retry inspection, local history and
log controls remain available. A successful inspection unlocks operations; a
connection failure or changed connection paths locks them again. The Python bridge
also enforces this gate. Pending remote operations are inspected only after the
startup connection succeeds, and can still be checked manually later.

Service inspection uses one SSH session with a 30-second client result deadline,
a 15-second receiver inspection and bounded service-state reads. Local Agent/key
checks have their own short deadlines. The operation footer displays elapsed time
and the current phase. Read-only checks now terminate their local waiting process
on timeout and return controls, instead of waiting indefinitely after the deadline.
These bounded reads do not restart services or retry writes. Builds, publishing,
backups and restore retain their existing handling of uncertain writes.


### Inspection output deadline correction

Read-only SSH and local Agent checks now use file-backed stdout/stderr with a
single bounded wait. They do not join a pipe-reader thread after the child exits;
that previous join could outlive the process deadline. Local stdin is DEVNULL
(or a temporary JSON input file for read-only RPC), so checks never inherit a
console input wait. Inspection phase messages are written to the visible log.
Backup list/operation-status reads also have bounded waits. Startup first finishes
the connection check and then follows pending operations as a separately named
job; a failed follow-up stops the batch rather than repeating network waits.
Production writes and interactive SSH sessions keep their existing semantics.
This was syntax-checked; the Windows symptom has not been reproduced locally.
