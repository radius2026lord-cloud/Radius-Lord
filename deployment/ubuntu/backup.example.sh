#!/usr/bin/env bash
set -euo pipefail
# Copy to shared/hooks/backup after configuring mysql-backup.cnf for this host.
shared="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
backup_id="$(date -u +%Y%m%dT%H%M%SZ)-$(basename "$(dirname "$RADIUS_RELEASE_MANIFEST")")"
backup="$shared/backups/$backup_id.sql.gz"
[[ -f "$shared/mysql-backup.cnf" ]] || { echo "MySQL backup credentials are not configured."; exit 1; }
umask 077
mysqldump --defaults-extra-file="$shared/mysql-backup.cnf" --all-databases --single-transaction --routines --events --triggers | gzip > "$backup"
gzip -t "$backup"
python3 - "$backup" "$backup_id" "$RADIUS_RELEASE_RESULT" <<'PY'
import hashlib,json,pathlib,sys
path=pathlib.Path(sys.argv[1])
digest=hashlib.sha256()
with path.open("rb") as stream:
 for chunk in iter(lambda:stream.read(1024*1024),b""):
  digest.update(chunk)
pathlib.Path(sys.argv[3]).write_text(json.dumps({
 "backupId":sys.argv[2],"verified":True,"method":"gzip-integrity-and-sha256",
 "sha256":digest.hexdigest(),"bytes":path.stat().st_size
}))
PY
