# Radius Lord local deployment console

Windows desktop console for the canonical repository and existing SSH Git
receiver. Requires Python 3 with Tcl/Tk, Git, Node/npm and Windows OpenSSH Client.
No Python packages need to be installed. Launch `Radius-Lord-Deploy.cmd` by
double-clicking it. Do not put private keys inside the repository.

## First-time SSH setup

1. Use **إنشاء مفتاح محمي**. A console opens; enter a passphrase twice.
   The default key is `%USERPROFILE%\.ssh\id_ed25519_radius_lord`.
   Existing keys are never overwritten.
2. Use **تثبيت المفتاح على الخادم**. A console opens to authenticate as
   `root` once using its current SSH password. Verify the host fingerprint
   using your trusted server console if this host has not been trusted before.
   Only the public key is appended to authorized_keys. SSH host verification is
   never disabled. The SSH session uses root. Receiver commands run as radiusdeploy to preserve repository and release ownership.
3. Enable Windows **OpenSSH Authentication Agent** once using Services (run as
   administrator), set its startup type to Automatic and start it.
4. Use **تحميل المفتاح في SSH Agent** and enter the key passphrase in the console.
   Subsequent SSH/push operations use BatchMode and never request a password in
   the background. If the agent no longer has the key, load it again.
5. Use **فحص الاتصال** to display receiver readiness and the running version.

Configure the production remote once in the project folder:

```powershell
git remote set-url production ssh://root@78.155.66.122:3001/srv/radius-lord/repository.git
```

The console runs Git upload/receive commands and the deployment helper through
`sudo -n -u radiusdeploy` on the server. Application services keep their existing
service account; no repository ownership changes or safe.directory bypass is needed.

## Releasing

- Choose the project root. Only `work/subscriptions-customer-details` in the
  canonical `radius2026lord-cloud/Radius-Lord` repository is accepted.
- Pull using the GitHub button. A clean worktree is required; the tool never
  resets or stashes local modifications. GitHub authentication uses your existing
  Git credential manager.
- Build using the build button. This runs `npm ci --include=dev` and `npm run build`
  for backend and frontend. Stop local dev servers before building. Build success
  is retained only for that project/commit during the current console session.
- Enter a new semantic release version and a change description. Verify the
  production destination shown in the header. The production Git remote must
  match the existing approved SSH destination.
- Publish. The console confirms the action, checks receiver readiness, writes an
  annotated immutable tag with the existing release JSON contract and pushes only
  that tag. Existing remote tags are not replaced. An identical local tag can be
  reused only if it has not reached the receiver.
- Read-only status polling runs every 10 seconds until completion. A lost SSH
  connection does not cancel a server deployment. After repeated connection
  failures, use the status button; never assume that a failed push or status read
  proves the server did not receive the tag.
- The console does not bypass central/tenant migration checks, initial bootstrap
  approval, backup checks or server recovery blocks. Maintenance/reset commands
  are intentionally not exposed in this first version.

The application stores no SSH password, passphrase or private-key contents. Key
paths and connection settings are held in memory; default project and key paths
are derived on startup. Log output is shown locally. This UI has not been run on
Windows in the development environment; verify it on your Windows machine before
using it for a new production release.
