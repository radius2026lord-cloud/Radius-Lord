#!/usr/bin/env bash
set -euo pipefail
# Initial setup on Ubuntu. Run from a trusted checkout as root.
deploy_user="${1:-radiusdeploy}"
deploy_root="${2:-/srv/radius-lord}"
[[ "$EUID" -eq 0 ]] || { echo "Run as root."; exit 1; }
[[ "$deploy_user" =~ ^[a-z_][a-z0-9_-]*$ ]] || exit 1
[[ "$deploy_root" =~ ^/[a-zA-Z0-9_/-]+$ ]] || exit 1
for unit in radius-lord-backend radius-lord-frontend radius-lord-deploy; do
 [[ ! -e "/etc/systemd/system/$unit.service" ]] || { echo "Existing service $unit: review its configuration; receiver setup will not overwrite it."; exit 1; }
done
for existing in /etc/sudoers.d/radius-lord-deploy /etc/systemd/system/radius-lord-deploy.timer "$deploy_root/repository.git"; do
 [[ ! -e "$existing" ]] || { echo 'Existing receiver configuration: review it before setup.'; exit 1; }
done
source_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
command -v apt-get >/dev/null
apt-get update
apt-get install -y git python3 curl sudo
command -v node >/dev/null && command -v npm >/dev/null || { echo "Install the project's supported Node.js and npm first."; exit 1; }
[[ "$(node -p 'process.versions.node.split(".")[0]')" == 24 ]] || { echo "Node.js 24 is required by this host setup."; exit 1; }
for executable in node npm; do
 case "$(command -v "$executable")" in /usr/bin/*|/usr/local/bin/*) ;; *) echo "Use system-wide Node/npm, not a root/home-local installation."; exit 1;; esac
done
id "$deploy_user" >/dev/null 2>&1 || useradd --create-home --shell /bin/bash "$deploy_user"
install -d -m 750 -o "$deploy_user" -g "$deploy_user" "$deploy_root"
for directory in shared shared/hooks shared/uploads shared/backups releases queue status logs; do
  install -d -m 700 -o "$deploy_user" -g "$deploy_user" "$deploy_root/$directory"
done
repo="$deploy_root/repository.git"
if [[ ! -f "$repo/HEAD" ]]; then
  sudo -u "$deploy_user" git init --bare "$repo"
fi
install -m 750 -o "$deploy_user" -g "$deploy_user" "$source_dir/radius-deploy.py" "$repo/hooks/radius-deploy.py"
for hook in pre-receive post-receive; do
  printf '#!/bin/sh\nexec python3 "%s/hooks/radius-deploy.py" %s\n' "$repo" "$hook" > "$repo/hooks/$hook"
  chmod 750 "$repo/hooks/$hook"
  chown "$deploy_user:$deploy_user" "$repo/hooks/$hook"
done
if [[ ! -f "$deploy_root/host-config.json" ]]; then
  python3 - "$deploy_root" <<'PY'
import json,pathlib,sys
root=pathlib.Path(sys.argv[1])
(root/"host-config.json").write_text(json.dumps({
 "root":str(root),"requireBootstrapReceipt":True,"services":["radius-lord-backend.service","radius-lord-frontend.service"],
 "backendHealth":"http://127.0.0.1:4001/release-health",
 "frontendHealth":"http://127.0.0.1:3000/login"
},indent=2))
PY
fi
chown "$deploy_user:$deploy_user" "$deploy_root/host-config.json"
chmod 600 "$deploy_root/host-config.json"
npm_path="$(command -v npm)"
for component in backend frontend; do
  arguments=""
  [[ "$component" != frontend ]] || arguments=" -- --hostname 127.0.0.1"
  working="$deploy_root/current"
  [[ "$component" != backend ]] || working="$working/src/app/backend"
  cat > "/etc/systemd/system/radius-lord-$component.service" <<UNIT
[Unit]
ConditionPathExists=$deploy_root/current
Description=Radius Lord $component
After=network-online.target
Wants=network-online.target
[Service]
User=$deploy_user
Group=$deploy_user
WorkingDirectory=$working
Environment=NODE_ENV=production
Environment=PATH=/usr/local/bin:/usr/bin:/bin
UMask=0077
EnvironmentFile=$deploy_root/shared/backend.env
EnvironmentFile=-$deploy_root/shared/runtime.env
ExecStart=$npm_path run start$arguments
Restart=on-failure
RestartSec=5
[Install]
WantedBy=multi-user.target
UNIT
done
# The frontend reads its own runtime values in addition to the backend's shared deployment metadata.
sed -i "s|EnvironmentFile=$deploy_root/shared/backend.env|EnvironmentFile=$deploy_root/shared/root.env|" /etc/systemd/system/radius-lord-frontend.service
systemctl_path="$(command -v systemctl)"
cat > /etc/sudoers.d/radius-lord-deploy <<SUDOERS
$deploy_user ALL=(root) NOPASSWD: $systemctl_path restart radius-lord-backend.service radius-lord-frontend.service, $systemctl_path stop radius-lord-backend.service radius-lord-frontend.service
SUDOERS
chmod 440 /etc/sudoers.d/radius-lord-deploy
visudo -cf /etc/sudoers.d/radius-lord-deploy
cat > /etc/systemd/system/radius-lord-deploy.service <<UNIT
[Unit]
Description=Radius Lord deployment queue
After=network-online.target
Wants=network-online.target
[Service]
Type=oneshot
UMask=0077
Environment=PATH=/usr/local/bin:/usr/bin:/bin
User=$deploy_user
Group=$deploy_user
ExecStart=/usr/bin/python3 $repo/hooks/radius-deploy.py worker
TimeoutStartSec=3h
UNIT
cat > /etc/systemd/system/radius-lord-deploy.timer <<'UNIT'
[Unit]
Description=Check Radius Lord deployment queue
[Timer]
OnBootSec=10
OnUnitInactiveSec=5
Unit=radius-lord-deploy.service
[Install]
WantedBy=timers.target
UNIT
install -m 750 -o "$deploy_user" -g "$deploy_user" "$source_dir/backup.example.sh" "$deploy_root/shared/hooks/backup.example.sh"
systemctl daemon-reload
systemctl enable radius-lord-backend.service radius-lord-frontend.service
systemctl enable --now radius-lord-deploy.timer
echo "Git receiver ready at $repo"
echo "Configure SSH access for $deploy_user, shared/root.env, shared/backend.env and shared/hooks/backup."
echo "Configure shared/hooks/migrate before a release that changes database structure."
