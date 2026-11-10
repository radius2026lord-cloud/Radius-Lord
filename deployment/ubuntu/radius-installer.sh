#!/usr/bin/env bash
set -Eeuo pipefail
# Radius Lord v4 host phases. Replaces v3.2's destructive repair/network workflow.
# This installer never applies Netplan, rewrites FreeRADIUS SQL, or purges services.
base="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
action="${1:-help}"; shift || true
if [[ "$action" == help ]]; then
 cat <<'HELP'
Radius Lord Host Installer v4
  plan --profile deployment-profile.json
  packages                       Install prerequisites only (no Netplan/RADIUS edits)
  node                           Install official Node 24 if Node is absent
  phpmyadmin                     Optional; local access only (SSH tunnel)
  receiver                       Prepare SSH Git receiver and systemd services
  configure --profile FILE --secrets PRIVATE_JSON
  database-prepare --profile FILE --secrets PRIVATE_JSON
  database-import --profile FILE --secrets PRIVATE_JSON --dump CENTRAL.sql --sha256 HEX
  apache --profile FILE          Initial HTTP proxy; never replaces existing vhost
  https --profile FILE --email EMAIL
  verify --profile FILE
Phases are explicit. Configure backup/migration hooks and SSH access before release.
Do not use v3.2 repair/cleanup on an existing multi-tenant production server.
HELP
 exit 0
fi
if [[ "$action" == plan ]]; then exec python3 "$base/host-setup.py" plan "$@"; fi
[[ "$EUID" -eq 0 ]] || { echo 'Run setup phases with sudo.'; exit 1; }
# shellcheck disable=SC1091
source /etc/os-release
[[ "${ID:-}" == ubuntu && ( "${VERSION_ID:-}" == 22.04 || "${VERSION_ID:-}" == 24.04 ) ]] || { echo 'Supported: Ubuntu 22.04/24.04 LTS.'; exit 1; }
case "$action" in
 packages)
  export DEBIAN_FRONTEND=noninteractive
  apt-get update
  apt-get install -y ca-certificates curl xz-utils git python3 sudo openssl gzip tar build-essential apache2 certbot python3-certbot-apache mysql-server freeradius freeradius-mysql freeradius-utils
  a2enmod proxy proxy_http proxy_wstunnel headers ssl
  apache2ctl configtest
  echo 'Packages prepared. Existing RADIUS/Netplan/database configuration was not rewritten.'
  ;;
 phpmyadmin)
  [[ ! -e /etc/apache2/conf-available/phpmyadmin.conf ]] || { echo 'Existing phpMyAdmin configuration: review it separately.'; exit 1; }
  install -d -m 755 /etc/apache2/conf-available
  cat > /etc/apache2/conf-available/radius-lord-phpmyadmin-guard.conf <<'GUARD'
<Location /phpmyadmin>
    Require local
</Location>
GUARD
  a2enconf radius-lord-phpmyadmin-guard; apache2ctl configtest; systemctl reload apache2
  export DEBIAN_FRONTEND=noninteractive
  echo 'phpmyadmin phpmyadmin/dbconfig-install boolean false' | debconf-set-selections
  apt-get install -y phpmyadmin libapache2-mod-php php-mysql php-mbstring php-xml php-curl php-zip
  apache2ctl configtest; systemctl reload apache2
  echo 'phpMyAdmin is optional and restricted to local requests. Use an SSH tunnel.'
  ;;
 node)
  if command -v node >/dev/null; then
   [[ "$(node -p 'process.versions.node.split(".")[0]')" == 24 ]] || { echo 'An existing Node version differs. Review compatibility before replacing it.'; exit 1; }
   command -v npm >/dev/null; echo 'Node 24/npm already available.'; exit 0
  fi
  architecture="$(dpkg --print-architecture)"
  case "$architecture" in amd64) node_arch=x64;; arm64) node_arch=arm64;; *) echo 'Unsupported Node architecture.'; exit 1;; esac
  temporary="$(mktemp -d)"; trap 'rm -rf -- "$temporary"' EXIT
  curl --fail --silent --show-error --proto '=https' --tlsv1.2 https://nodejs.org/dist/latest-v24.x/SHASUMS256.txt -o "$temporary/sums"
  archive="$(awk -v arch="$node_arch" '$2 ~ ("^node-v24\\.[0-9]+\\.[0-9]+-linux-" arch "[.]tar[.]xz$") {print $2}' "$temporary/sums")"
  [[ "$archive" =~ ^node-v24\.[0-9]+\.[0-9]+-linux-(x64|arm64)\.tar\.xz$ ]] || exit 1
  version="${archive%%-linux-*}"; version="${version#node-}"
  curl --fail --silent --show-error --proto '=https' --tlsv1.2 "https://nodejs.org/dist/$version/$archive" -o "$temporary/$archive"
  awk -v name="$archive" '$2==name' "$temporary/sums" > "$temporary/selected.sha256"
  (cd "$temporary" && sha256sum --check selected.sha256)
  for binary in node npm npx; do
   [[ ! -e "/usr/local/bin/$binary" && ! -L "/usr/local/bin/$binary" ]] || { echo 'Existing binary link; review it.'; exit 1; }
  done
  install -d -m 755 /opt/radius-lord/node
  [[ ! -e "/opt/radius-lord/node/${archive%.tar.xz}" ]] || { echo 'Node destination exists; review it.'; exit 1; }
  tar --extract --xz --no-same-owner -f "$temporary/$archive" -C /opt/radius-lord/node
  for binary in node npm npx; do
   [[ ! -e "/usr/local/bin/$binary" && ! -L "/usr/local/bin/$binary" ]] || { echo 'Existing binary link; review it.'; exit 1; }
   ln -s "/opt/radius-lord/node/${archive%.tar.xz}/bin/$binary" "/usr/local/bin/$binary"
  done
  node --version; npm --version
  ;;
 receiver) bash "$base/install-git-host.sh" radiusdeploy /srv/radius-lord ;;
 configure|database-prepare|database-import|apache|verify) exec python3 "$base/host-setup.py" "$action" "$@" ;;
 https)
  [[ $# == 4 && "$1" == --profile && "$3" == --email ]] || { echo 'https --profile FILE --email EMAIL'; exit 1; }
  domain="$(python3 - "$base" "$2" <<'PY'
import sys
sys.path.insert(0,sys.argv[1]);from importlib.machinery import SourceFileLoader
m=SourceFileLoader('host_setup',sys.argv[1]+'/host-setup.py').load_module()
h=m.profile(sys.argv[2])['hosting']
if h['local_https_port']!=443 or h['public_https_port']!=443:raise ValueError('Automated ACME uses standard ports; custom NAT/HTTPS ports need manual review.')
print(h['domain'])
PY
)"
  [[ "$4" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]] || exit 1
  certbot --apache --non-interactive --agree-tos --redirect --email "$4" -d "$domain"
  # Apache terminates TLS; keep the forwarded scheme accurate on the HTTPS vhost.
  ssl_file=/etc/apache2/sites-available/radius-lord-le-ssl.conf
  [[ -f "$ssl_file" ]] || { echo 'Review the HTTPS vhost and X-Forwarded-Proto before proceeding.'; exit 1; }
  sed -i 's/RequestHeader set X-Forwarded-Proto "http"/RequestHeader set X-Forwarded-Proto "https"/' "$ssl_file"
  apache2ctl configtest; systemctl reload apache2
  ;;
 *) echo 'Unknown phase. Use help.'; exit 1 ;;
esac
