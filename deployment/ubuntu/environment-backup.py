#!/usr/bin/env python3
"""Root-only, same-host encrypted environment maintenance. JSON request on stdin.
No credentials in argv/stdout. GnuPG provides authenticated symmetric encryption.
"""
import contextlib
import datetime as dt
import fcntl
import hashlib
import json
import os
import pathlib
import pwd
import re
import shutil
import signal
import subprocess
import sys
import tarfile
import tempfile
import uuid
import urllib.request

ROOT = pathlib.Path('/srv/radius-lord')
VAULT = pathlib.Path('/var/backups/radius-lord-environment')
KEY = pathlib.Path('/etc/radius-lord-backup.key')
POLICY = pathlib.Path('/etc/radius-lord-backup-policy.json')
RECOVERY = ROOT / 'maintenance-recovery.json'
SELF = pathlib.Path('/usr/local/lib/radius-lord/environment-backup.py')
UNITS = ['radius-lord-deploy.timer', 'radius-lord-frontend.service',
         'radius-lord-backend.service', 'freeradius.service']
ID = re.compile(r'b-[0-9]{8}T[0-9]{6}Z-[a-f0-9]{12}')
DB = re.compile(r'(lord_radius_core|rl_tenant_[A-Za-z0-9_]+|rl_infrastructure_[A-Za-z0-9_]+)')
CONFIGS = ['etc/freeradius/3.0', 'etc/apache2', 'etc/mysql', 'etc/letsencrypt']
SHARED = ['root.env', 'backend.env', 'runtime.env', 'uploads']


def run(args, **kwargs):
    result = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, **kwargs)
    if result.returncode:
        # stderr from database tools may contain credentials or SQL; keep private.
        raise RuntimeError('Command failed: ' + pathlib.Path(args[0]).name + ' (exit ' + str(result.returncode) + ')')
    return result.stdout


def atomic(path, data):
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    fd, name = tempfile.mkstemp(dir=path.parent)
    try:
        with os.fdopen(fd, 'w') as stream:
            json.dump(data, stream, ensure_ascii=False, indent=2)
        os.chmod(name, 0o600)
        os.replace(name, path)
    finally:
        pathlib.Path(name).unlink(missing_ok=True)


def digest(path):
    value = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            value.update(chunk)
    return value.hexdigest()


def identifier(value):
    if not isinstance(value, str) or not ID.fullmatch(value):
        raise ValueError('Invalid backup identifier')
    return value


def sql(query):
    return run(['mysql', '--batch', '--skip-column-names', '-e', query]).decode().strip()


def databases():
    return [name for name in sql('SHOW DATABASES').splitlines() if DB.fullmatch(name)]


def release():
    path = ROOT / 'current/release.json'
    return json.loads(path.read_text()) if path.is_file() else {}


def key_bytes(request):
    supplied = request.get('passphrase')
    if supplied:
        if not isinstance(supplied, str) or '\n' in supplied or '\r' in supplied:
            raise ValueError('Invalid passphrase')
        return (supplied + '\n').encode()
    if not KEY.is_file() or KEY.is_symlink() or KEY.stat().st_mode & 0o077:
        raise RuntimeError('Configure the backup encryption passphrase first')
    return KEY.read_bytes().rstrip(b'\r\n') + b'\n'


def crypt(source, target, request, decrypt=False):
    args = ['gpg', '--batch', '--yes', '--pinentry-mode', 'loopback', '--passphrase-fd', '0',
            '--output', str(target)]
    args += ['--decrypt', str(source)] if decrypt else ['--symmetric', '--cipher-algo', 'AES256', str(source)]
    run(args, input=key_bytes(request), timeout=7200)
    os.chmod(target, 0o600)


@contextlib.contextmanager
def locked():
    # Share the publisher's lock; maintenance never races a release activation.
    path = ROOT / 'deployment.lock'
    existed = path.exists()
    with path.open('a') as stream:
        if not existed:
            owner = pwd.getpwnam('radiusdeploy')
            os.fchown(stream.fileno(), owner.pw_uid, owner.pw_gid)
        fcntl.flock(stream, fcntl.LOCK_EX | fcntl.LOCK_NB)
        yield


@contextlib.contextmanager
def paused(restart_on_error=True):
    if subprocess.run(['systemctl', 'is-active', '--quiet', 'radius-lord-deploy.service']).returncode == 0:
        raise RuntimeError('Deployment worker is active; wait for completion')
    active = [unit for unit in UNITS if subprocess.run(['systemctl', 'is-active', '--quiet', unit]).returncode == 0]
    failed = False
    try:
        for unit in active:
            run(['systemctl', 'stop', unit], timeout=120)
        yield active
    except BaseException:
        failed = True
        raise
    finally:
        errors = []
        for unit in reversed(active) if restart_on_error or not failed else []:
            try:
                run(['systemctl', 'start', unit], timeout=120)
            except Exception:
                errors.append(unit)
        if errors:
            raise RuntimeError('Services require manual recovery: ' + ', '.join(errors))


def copy(source, target):
    if source.is_dir():
        shutil.copytree(source, target, symlinks=False,
                        ignore=shutil.ignore_patterns('node_modules', '.git', '.cache', 'cache', '*.log', '__pycache__'))
    elif source.exists():
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)


def create(request, already_paused=False):
    kind = request.get('kind', 'full')
    if kind not in ('full', 'project', 'databases'):
        raise ValueError('Invalid backup kind')
    key_bytes(request)
    names = databases()
    selected = request.get('databases', names)
    if not isinstance(selected, list) or not set(selected) <= set(names) or len(selected) != len(set(selected)):
        raise ValueError('Choose existing, supported databases')
    if kind == 'project':
        selected = []
    if kind != 'project' and not selected:
        raise ValueError('Choose at least one database')
    if not (ROOT / 'current').is_symlink():
        raise RuntimeError('Active release is missing')
    current = (ROOT / 'current').resolve()
    if current.parent != ROOT / 'releases':
        raise RuntimeError('Unexpected active release path')
    if shutil.disk_usage(VAULT).free < 2 * 1024**3:
        raise RuntimeError('At least 2 GiB free disk space is required')
    backup_id = 'b-' + dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '-' + uuid.uuid4().hex[:12]
    row = {'id': backup_id, 'kind': kind, 'createdAt': dt.datetime.now(dt.timezone.utc).isoformat(),
           'release': release(), 'databases': selected, 'hostId': pathlib.Path('/etc/machine-id').read_text().strip(),
           'format': 1, 'scheduled': bool(request.get('scheduled')), 'verified': False,
           'scope': 'same-host Ubuntu; remote CHR and remote database servers excluded'}
    archive = VAULT / (backup_id + '.tar.gpg')
    try:
        pause = contextlib.nullcontext() if already_paused else paused()
        with tempfile.TemporaryDirectory(prefix='.build-', dir=VAULT) as temp, pause:
            stage = pathlib.Path(temp) / 'payload'
            stage.mkdir(mode=0o700)
            for name in selected:
                with (stage / (name + '.sql')).open('wb') as output:
                    result = subprocess.run(['mysqldump', '--single-transaction', '--no-tablespaces',
                        '--routines', '--events', '--triggers', '--hex-blob', '--add-drop-database', '--databases', name],
                        stdout=output, stderr=subprocess.PIPE)
                    if result.returncode:
                        raise RuntimeError('Database export failed: ' + name)
            if kind in ('full', 'project'):
                copy(current, stage / 'project')
                for name in SHARED:
                    copy(ROOT / 'shared' / name, stage / 'shared' / name)
                copy(ROOT / 'host-config.json', stage / 'host-config.json')
                copy(ROOT / 'shared/hooks', stage / 'recovery/hooks')
                copy(ROOT / 'shared/mysql-backup.cnf', stage / 'recovery/mysql-backup.cnf')
                # Capture application DB users and grants separately from system/root accounts.
                accounts = sql("SELECT CONCAT(QUOTE(User),'@',QUOTE(Host)) FROM mysql.user WHERE User NOT IN ('root','mysql.sys','mysql.session','mysql.infoschema')")
                statements = []
                for account in accounts.splitlines():
                    fields = sql('SHOW CREATE USER ' + account).split('\t', 1)
                    if len(fields) == 2:
                        statements.append(fields[1] + ';')
                    statements += [line + ';' for line in sql('SHOW GRANTS FOR ' + account).splitlines()]
                (stage / 'accounts.sql').write_text('\n'.join(statements))
                bundle = stage / 'repository.bundle'
                # Keep all plaintext root-only; Git writes into a separate private directory.
                with tempfile.TemporaryDirectory(prefix='radius-git-') as git_temp:
                    owner = pwd.getpwnam('radiusdeploy')
                    os.chown(git_temp, owner.pw_uid, owner.pw_gid)
                    git_bundle = pathlib.Path(git_temp) / 'repository.bundle'
                    run(['sudo', '-n', '-u', 'radiusdeploy', 'git', '--git-dir=' + str(ROOT / 'repository.git'),
                         'bundle', 'create', str(git_bundle), '--all'], timeout=600)
                    shutil.copy2(git_bundle, bundle)
                os.chmod(bundle, 0o600)
            if kind == 'full':
                for path in CONFIGS:
                    copy(pathlib.Path('/') / path, stage / 'config' / path)
                units = stage / 'config/etc/systemd/system'
                units.mkdir(parents=True, exist_ok=True)
                for file in pathlib.Path('/etc/systemd/system').glob('radius-lord-*'):
                    if file.is_file():
                        copy(file, units / file.name)
            row['files'] = {str(p.relative_to(stage)): {'sha256': digest(p), 'bytes': p.stat().st_size}
                            for p in stage.rglob('*') if p.is_file()}
            (stage / 'manifest.json').write_text(json.dumps(row, ensure_ascii=False))
            plain = pathlib.Path(temp) / 'backup.tar'
            with tarfile.open(plain, 'w') as tar:
                tar.add(stage, arcname='payload', recursive=True)
            crypt(plain, archive, request)
            # Authenticate/decrypt and validate every member before marking verified.
            with unpack(archive, request) as (_, checked):
                if checked['id'] != backup_id:
                    raise RuntimeError('Backup verification failed')
        row.pop('files')
        row.update(verified=True, sha256=digest(archive), bytes=archive.stat().st_size,
                   verification='GnuPG integrity + file SHA256; restore not rehearsed')
        atomic(VAULT / (backup_id + '.json'), row)
        return row
    except Exception:
        archive.unlink(missing_ok=True)
        raise


@contextlib.contextmanager
def unpack(archive, request):
    with tempfile.TemporaryDirectory(prefix='.verify-', dir=VAULT) as temp:
        plain = pathlib.Path(temp) / 'archive.tar'
        crypt(archive, plain, request, decrypt=True)
        with tarfile.open(plain) as tar:
            members = tar.getmembers()
            seen = set()
            total = 0
            for item in members:
                path = pathlib.PurePosixPath(item.name)
                if path.is_absolute() or '..' in path.parts or not path.parts or path.parts[0] != 'payload':
                    raise ValueError('Unsafe archive path')
                if item.name in seen or not (item.isfile() or item.isdir()):
                    raise ValueError('Links, special files and duplicate members are forbidden')
                seen.add(item.name)
                total += item.size
            if total > shutil.disk_usage(VAULT).free - 512 * 1024**2:
                raise RuntimeError('Insufficient disk space for verification')
            tar.extractall(temp, members=members, filter='data')
        stage = pathlib.Path(temp) / 'payload'
        manifest = json.loads((stage / 'manifest.json').read_text())
        if manifest.get('format') != 1 or manifest.get('kind') not in ('full', 'project', 'databases'):
            raise ValueError('Unsupported backup format')
        files = manifest.get('files', {})
        actual = {str(p.relative_to(stage)) for p in stage.rglob('*') if p.is_file()} - {'manifest.json'}
        if actual != set(files):
            raise ValueError('Manifest inventory differs')
        for name, item in files.items():
            if digest(stage / name) != item['sha256'] or (stage / name).stat().st_size != item['bytes']:
                raise ValueError('File integrity check failed')
        names = manifest.get('databases')
        if not isinstance(names, list) or len(names) != len(set(names)) or not all(DB.fullmatch(n) for n in names):
            raise ValueError('Invalid database scope')
        if {p.stem for p in stage.glob('*.sql') if p.name != 'accounts.sql'} != set(names):
            raise ValueError('Database inventory differs')
        if manifest['kind'] in ('full', 'project'):
            required = ['project/package.json', 'project/package-lock.json', 'project/release.json',
                        'project/.next/BUILD_ID', 'project/src/app/backend/package-lock.json',
                        'project/src/app/backend/dist/server.js', 'shared/root.env', 'shared/backend.env']
            if any(not (stage / name).is_file() for name in required):
                raise ValueError('Project runtime files are incomplete')
            if json.loads((stage / 'project/release.json').read_text()).get('commit') != manifest['release'].get('commit'):
                raise ValueError('Project release identity differs from manifest')
        yield stage, manifest


def get_archive(value):
    identifier(value)
    file = VAULT / (value + '.tar.gpg')
    if not file.is_file() or file.is_symlink():
        raise ValueError('Backup not found')
    return file


def review(request):
    archive = get_archive(request['id'])
    with unpack(archive, request) as (_, manifest):
        host = pathlib.Path('/etc/machine-id').read_text().strip()
        return {'id': request['id'], 'kind': manifest['kind'], 'release': manifest['release'],
                'databases': manifest['databases'], 'files': len(manifest['files']),
                'sameHost': manifest.get('hostId') == host, 'sha256': digest(archive),
                'warning': 'Restore replaces selected databases and project/shared files. Existing MySQL accounts and host network settings stay unchanged. Service configs are staged for review, not activated.'}


def restore(request):
    plan = review(request)
    if not plan['sameHost'] or plan['sha256'] != request.get('sha256'):
        raise ValueError('Review this same-host backup before restore')
    # Uploaded encrypted files can still contain hostile SQL/code: explicit trust required.
    if request.get('trusted') is not True:
        raise ValueError('Only restore a backup from a trusted source')
    before = None
    record = {'status': 'preparing', 'source': request['id']}
    receipt = VAULT / ('restore-' + uuid.uuid4().hex + '.json')
    atomic(receipt, record)
    try:
        with unpack(get_archive(request['id']), request) as (stage, manifest):
            target = None
            if manifest['kind'] in ('full', 'project'):
                target = ROOT / 'releases' / ('restored-' + uuid.uuid4().hex)
                shutil.copytree(stage / 'project', target)
                account = pwd.getpwnam('radiusdeploy')
                for p in [target, *target.rglob('*')]:
                    os.chown(p, account.pw_uid, account.pw_gid)
                for folder in [target, target / 'src/app/backend']:
                    run(['sudo', '-n', '-u', 'radiusdeploy', 'npm', 'ci', '--include=dev'], cwd=folder, timeout=1800)
                for relative, shared in [('.env', 'root.env'), ('src/app/backend/.env', 'backend.env'),
                                         ('src/app/backend/uploads', 'uploads')]:
                    p = target / relative
                    if p.is_dir():
                        shutil.rmtree(p)
                    else:
                        p.unlink(missing_ok=True)
                    p.symlink_to(ROOT / 'shared' / shared, target_is_directory=shared == 'uploads')
            with paused(restart_on_error=False) as active:
                record['previouslyActiveUnits'] = active
                # Capture the immediate pre-restore state while all writers stay paused.
                before = create({'kind': 'full'}, already_paused=True)
                record['beforeBackup'] = before['id']
                record['status'] = 'restoring'
                atomic(receipt, record)
                for name in manifest['databases']:
                    with (stage / (name + '.sql')).open('rb') as data:
                        run(['mysql', '--binary-mode=1'], stdin=data, timeout=3600)
                if target:
                    for name in SHARED:
                        source = stage / 'shared' / name
                        if source.exists():
                            destination = ROOT / 'shared' / name
                            if destination.is_dir():
                                shutil.rmtree(destination)
                            else:
                                destination.unlink(missing_ok=True)
                            copy(source, destination)
                            for p in [destination, *destination.rglob('*')] if destination.is_dir() else [destination]:
                                os.chown(p, account.pw_uid, account.pw_gid)
                    link = ROOT / ('restore-link-' + uuid.uuid4().hex)
                    link.symlink_to(target)
                    os.replace(link, ROOT / 'current')
                if (stage / 'config').exists():
                    shutil.copytree(stage / 'config', VAULT / ('config-review-' + request['id']), dirs_exist_ok=True)
                if (stage / 'accounts.sql').exists():
                    # Accounts are encrypted in the backup, staged root-only for manual recovery.
                    copy(stage / 'accounts.sql', VAULT / ('accounts-review-' + request['id'] + '.sql'))
                    os.chmod(VAULT / ('accounts-review-' + request['id'] + '.sql'), 0o600)
            expected = manifest['release'] if target else release()
            if 'radius-lord-backend.service' in active:
                healthy = False
                import time
                for _ in range(20):
                    try:
                        with urllib.request.urlopen('http://127.0.0.1:4001/release-health', timeout=3) as response:
                            health = json.load(response)
                            healthy = health.get('ok') and health.get('commit') == expected.get('commit')
                            if healthy:
                                break
                    except Exception:
                        pass
                    time.sleep(1)
                if not healthy:
                    raise RuntimeError('Backend health verification failed')
            if not set(manifest['databases']) <= set(databases()):
                raise RuntimeError('Restored database inventory differs')
        record['status'] = 'succeeded'
        record['backendHealthChecked'] = 'radius-lord-backend.service' in active
        atomic(receipt, record)
        RECOVERY.unlink(missing_ok=True)
        return record
    except Exception:
        record['status'] = 'recovery_required' if before else 'preparation_failed'
        if before:
            atomic(RECOVERY, record)
        if before:
            for unit in UNITS:
                subprocess.run(['systemctl', 'stop', unit], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        atomic(receipt, record)
        raise RuntimeError('Restore incomplete. Before-backup: ' + (before['id'] if before else 'not yet created; no restore writes started') + '. Inspect services and restore receipt before another operation.')


def schedule(request):
    hour = request.get('hour', 2)
    daily, weekly = request.get('daily', 7), request.get('weekly', 4)
    if type(hour) is not int or not 0 <= hour <= 23 or type(daily) is not int or not 1 <= daily <= 90 or type(weekly) is not int or not 1 <= weekly <= 52:
        raise ValueError('Invalid schedule or retention')
    enabled = request.get('enabled') is True
    if enabled:
        key_bytes({})
    policy = {'enabled': enabled, 'hourUTC': hour, 'daily': daily, 'weekly': weekly}
    atomic(POLICY, policy)
    pathlib.Path('/etc/systemd/system/radius-lord-environment-backup.service').write_text(
        '[Unit]\nDescription=Radius Lord encrypted environment backup\n[Service]\nType=oneshot\nUMask=0077\n'
        'ExecStart=/usr/bin/python3 ' + str(SELF) + ' scheduled\nTimeoutStartSec=3h\n')
    pathlib.Path('/etc/systemd/system/radius-lord-environment-backup.timer').write_text(
        '[Unit]\nDescription=Radius Lord daily backup (UTC)\n[Timer]\nOnCalendar=*-*-* %02d:00:00 UTC\nPersistent=true\n[Install]\nWantedBy=timers.target\n' % hour)
    run(['systemctl', 'daemon-reload'])
    run(['systemctl', 'enable' if enabled else 'disable', '--now', 'radius-lord-environment-backup.timer'])
    return policy


def listing():
    return sorted([json.loads(p.read_text()) for p in VAULT.glob('b-*.json')], key=lambda r: r['createdAt'], reverse=True)


def prune():
    policy = json.loads(POLICY.read_text())
    rows = [r for r in listing() if r.get('scheduled') and r.get('verified')]
    keep = {r['id'] for r in rows[:policy['daily']]}
    weeks = set()
    for row in rows:
        week = dt.datetime.fromisoformat(row['createdAt']).strftime('%G-%V')
        if week not in weeks and len(weeks) < policy['weekly']:
            weeks.add(week)
            keep.add(row['id'])
    # Retention applies only after a fresh successful scheduled snapshot.
    for row in rows:
        if row['id'] not in keep:
            get_archive(row['id']).unlink()
            (VAULT / (row['id'] + '.json')).unlink()


def reset(request, apply=False):
    server, radius = request.get('keepServer'), request.get('keepRadius')
    if type(server) is not int or type(radius) is not int or min(server, radius) < 1:
        raise ValueError('Invalid retained infrastructure IDs')
    command = ['python3', str(SELF.with_name('reset-central-operational.py')),
               '--keep-server', str(server), '--keep-radius', str(radius)]
    plan = json.loads(run(command, timeout=180))
    signature = hashlib.sha256(json.dumps(plan, sort_keys=True).encode()).hexdigest()
    plan['planSha256'] = signature
    if not apply:
        return plan
    if request.get('planSha256') != signature:
        raise ValueError('Reset plan changed; review it again')
    with paused(restart_on_error=False):
        before = create({'kind': 'full'}, already_paused=True)
        atomic(RECOVERY, {'status': 'reset_in_progress', 'beforeBackup': before['id']})
        # Recheck after pausing to avoid deleting a changed inventory.
        current = json.loads(run(command, timeout=180))
        if hashlib.sha256(json.dumps(current, sort_keys=True).encode()).hexdigest() != signature:
            raise ValueError('Reset plan changed after pause; inspect services and review again')
        output = run([*command, '--apply'], timeout=1200).decode()
    RECOVERY.unlink(missing_ok=True)
    return {'status': 'succeeded', 'beforeBackup': before['id'], 'result': output}


def process_token(pid):
    try:
        # Linux process start ticks prevent a reused PID from appearing as this job.
        return pathlib.Path('/proc/' + str(pid) + '/stat').read_text().rsplit(')', 1)[1].split()[19]
    except (OSError, IndexError):
        return None


def operation_path(value):
    if not isinstance(value, str) or not re.fullmatch(r'[a-f0-9]{32}', value):
        raise ValueError('Invalid operation identifier')
    return VAULT / 'operations' / (value + '.json')


def main():
    if os.geteuid() != 0:
        raise RuntimeError('Run as root')
    signal.signal(signal.SIGHUP, signal.SIG_IGN)
    os.umask(0o077)
    VAULT.mkdir(parents=True, exist_ok=True, mode=0o700)
    if VAULT.is_symlink():
        raise RuntimeError('Invalid backup directory')
    action = sys.argv[1]
    if action in ('receive', 'send'):
        backup_id = identifier(sys.argv[2])
        if action == 'send':
            with get_archive(backup_id).open('rb') as data:
                shutil.copyfileobj(data, sys.stdout.buffer)
        else:
            path = VAULT / (backup_id + '.tar.gpg')
            with locked():
                if path.exists():
                    raise RuntimeError('Backup already exists')
                part = path.with_suffix('.part')
                try:
                    with part.open('xb') as data:
                        while chunk := sys.stdin.buffer.read(1024 * 1024):
                            if shutil.disk_usage(VAULT).free < len(chunk) + 512 * 1024**2:
                                raise RuntimeError('Disk space exhausted')
                            data.write(chunk)
                    os.replace(part, path)
                    atomic(VAULT / (backup_id + '.json'), {'id': backup_id, 'kind': 'uploaded', 'verified': False,
                        'createdAt': dt.datetime.now(dt.timezone.utc).isoformat(), 'bytes': path.stat().st_size, 'sha256': digest(path)})
                finally:
                    part.unlink(missing_ok=True)
        return
    request = {} if action == 'scheduled' else json.load(sys.stdin)
    if action == 'operation-status':
        path = operation_path(request.get('operationId'))
        result = json.loads(path.read_text()) if path.exists() else {'status': 'not_recorded', 'note': 'No matching receipt; do not infer success or repeat the write automatically.'}
        if result.get('status') == 'running' and (not result.get('processToken') or process_token(result.get('pid')) != result.get('processToken')):
            result['status'] = 'interrupted'
            result['note'] = 'The recorded process is no longer running; inspect the environment before retrying.'
        print(json.dumps(result, ensure_ascii=False))
        return
    with locked():
        receipt_path = None
        operation = None
        if action in ('create', 'restore', 'delete', 'schedule', 'reset-apply') and request.get('operationId'):
            receipt_path = operation_path(request['operationId'])
            if receipt_path.exists():
                raise ValueError('Operation identifier already recorded; read its status instead of replaying it')
            operation = {'id': request['operationId'], 'action': action, 'status': 'running',
                         'pid': os.getpid(), 'processToken': process_token(os.getpid()),
                         'startedAt': dt.datetime.now(dt.timezone.utc).isoformat()}
            atomic(receipt_path, operation)
        try:
            if RECOVERY.exists() and action in ('scheduled', 'reset-apply'):
                raise RuntimeError('Maintenance recovery is required; inspect the restore receipt')
            if action == 'list':
                result = {'backups': listing(), 'databases': databases(), 'keyConfigured': KEY.is_file(),
                          'policy': json.loads(POLICY.read_text()) if POLICY.exists() else {'enabled': False},
                          'maintenanceRecovery': json.loads(RECOVERY.read_text()) if RECOVERY.exists() else None,
                          'restoreReceipts': [json.loads(p.read_text()) for p in VAULT.glob('restore-*.json')]}
            elif action == 'key':
                secret = request.get('passphrase', '')
                if len(secret) < 16 or '\n' in secret or '\r' in secret:
                    raise ValueError('Use a passphrase of at least 16 characters')
                fd = os.open(KEY, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
                with os.fdopen(fd, 'w') as data:
                    data.write(secret + '\n')
                result = {'configured': True}
            elif action in ('create', 'scheduled'):
                if action == 'scheduled' and not json.loads(POLICY.read_text()).get('enabled'):
                    return
                result = create({'kind': 'full', 'scheduled': True} if action == 'scheduled' else request)
                if action == 'scheduled':
                    prune()
            elif action in ('review', 'verify'):
                result = review(request)
                meta = VAULT / (identifier(request['id']) + '.json')
                row = json.loads(meta.read_text())
                row.update(verified=True, kind=result['kind'], release=result['release'], databases=result['databases'])
                atomic(meta, row)
            elif action in ('reset-plan', 'reset-apply'):
                result = reset(request, apply=action == 'reset-apply')
            elif action == 'restore':
                result = restore(request)
            elif action == 'delete':
                if RECOVERY.exists() and json.loads(RECOVERY.read_text()).get('beforeBackup') == request.get('id'):
                    raise ValueError('Cannot delete the active recovery backup')
                get_archive(request['id']).unlink()
                (VAULT / (request['id'] + '.json')).unlink(missing_ok=True)
                result = {'deleted': request['id']}
            elif action == 'schedule':
                result = schedule(request)
            else:
                raise ValueError('Unknown operation')
        except BaseException:
            if receipt_path:
                operation.update(status='failed', endedAt=dt.datetime.now(dt.timezone.utc).isoformat(),
                                 note='The operation raised an error. Review its recovery receipt and environment; no rollback is implied.')
                atomic(receipt_path, operation)
            raise
        else:
            if receipt_path:
                operation.update(status='succeeded', endedAt=dt.datetime.now(dt.timezone.utc).isoformat(), result=result)
                atomic(receipt_path, operation)
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(json.dumps({'error': str(error)}, ensure_ascii=False), file=sys.stderr)
        sys.exit(1)
