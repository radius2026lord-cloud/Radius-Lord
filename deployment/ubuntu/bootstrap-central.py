#!/usr/bin/env python3
"""Approve/check one central-only first release; never executes application SQL."""
import argparse
import hashlib
import json
import os
import pathlib
import re
import shlex
import subprocess
import sys
import tempfile

ROOT = pathlib.Path('/srv/radius-lord')
SHARED = ROOT / 'shared'
APPROVAL = SHARED / 'central-bootstrap-approval.json'
SYSTEM = {'mysql', 'information_schema', 'performance_schema', 'sys'}


def environment():
    result = {}
    for line in (SHARED / 'backend.env').read_text().splitlines():
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        key, value = line.split('=', 1)
        words = shlex.split(value, comments=True)
        if len(words) != 1:
            raise ValueError('Unsupported backend environment value')
        result[key] = words[0]
    if result.get('RADIUS_BACKGROUND_WORKERS_ENABLED') != '0':
        raise ValueError('Set RADIUS_BACKGROUND_WORKERS_ENABLED=0 before bootstrap')
    if result.get('RADIUS_MIGRATE_MANUAL_ENVIRONMENT_ON_START') == '1':
        raise ValueError('Disable startup migrations before bootstrap')
    if result.get('DB_HOST') not in ('localhost', '127.0.0.1') or result.get('DB_PORT', '3306') != '3306':
        raise ValueError('Central-only bootstrap requires local MySQL:3306')
    name = result.get('DB_NAME', '')
    if not re.fullmatch(r'[a-zA-Z][a-zA-Z0-9_]{0,63}', name):
        raise ValueError('Invalid central database name')
    return name


def query(sql):
    return subprocess.check_output([
        'mysql', '--defaults-extra-file=' + str(SHARED / 'mysql-backup.cnf'),
        '--batch', '--raw', '--skip-column-names', '-e', sql
    ], text=True, stderr=subprocess.DEVNULL, timeout=30).splitlines()


def verify():
    name = environment()
    databases = set(query('SHOW DATABASES')) - SYSTEM
    if databases != {name}:
        raise ValueError('Bootstrap requires only the central application database on this host')
    reference_path = pathlib.Path(__file__).parent / 'central-baseline.manifest.json'
    reference = json.loads(reference_path.read_text())
    columns = {}
    for row in query("SELECT TABLE_NAME,COLUMN_NAME FROM information_schema.columns WHERE TABLE_SCHEMA='" + name + "'"):
        table, column = row.split('\t')
        columns.setdefault(table, set()).add(column)
    indexes = {}
    for row in query("SELECT TABLE_NAME,INDEX_NAME,COLUMN_NAME FROM information_schema.statistics WHERE TABLE_SCHEMA='" + name + "' AND NON_UNIQUE=0 ORDER BY TABLE_NAME,INDEX_NAME,SEQ_IN_INDEX"):
        table, index, column = row.split('\t')
        indexes.setdefault((table, index), []).append(column)
    for table, definition in reference['tables'].items():
        if not set(definition['columns']).issubset(columns.get(table, set())):
            raise ValueError('Central columns differ from the approved reference: ' + table)
        for index, expected in definition['uniqueIndexes'].items():
            if indexes.get((table, index)) != expected:
                raise ValueError('Central unique index differs: ' + table + '.' + index)
    imported = json.loads((SHARED / 'central-import-receipt.json').read_text())
    if imported.get('database') != name or imported.get('centralTablesVerified') is not True or imported.get('centralReferenceVersion') != reference['schemaVersion']:
        raise ValueError('Missing matching central import receipt')
    if not re.fullmatch(r'[a-f0-9]{64}', imported.get('sha256') or ''):
        raise ValueError('A checksum-approved central import receipt is required')
    return {
        'database': name,
        'centralReferenceVersion': reference['schemaVersion'],
        'referenceSha256': hashlib.sha256(reference_path.read_bytes()).hexdigest(),
        'importSha256': imported['sha256'],
        'checkedDimensions': reference['checkedDimensions'],
        'tenantDatabasesVerified': False,
        'tenantMigrationsExecuted': False,
        'backgroundWorkersEnabled': False,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['approve', 'check'])
    parser.add_argument('--commit', required=True)
    args = parser.parse_args()
    if not re.fullmatch(r'[a-f0-9]{40}', args.commit):
        raise ValueError('A full release commit SHA is required')
    if (ROOT / 'current').exists() or (ROOT / 'current').is_symlink():
        raise ValueError('Bootstrap is allowed only before the first activation')
    if args.action == 'approve' and os.geteuid() != 0:
        raise ValueError('Root must approve the initial baseline')
    result = {**verify(), 'commit': args.commit, 'mode': 'imported-central-only-v1'}
    if args.action == 'approve':
        if APPROVAL.exists() or APPROVAL.is_symlink():
            raise ValueError('Bootstrap approval already exists; review it before replacement')
        fd, temporary = tempfile.mkstemp(prefix='.bootstrap-', dir=SHARED)
        try:
            with os.fdopen(fd, 'w') as stream:
                json.dump(result, stream, indent=2)
            os.chmod(temporary, 0o644)
            os.replace(temporary, APPROVAL)
        finally:
            if os.path.exists(temporary):
                os.unlink(temporary)
    else:
        stat = APPROVAL.lstat()
        if APPROVAL.is_symlink() or stat.st_uid != 0 or stat.st_mode & 0o022:
            raise ValueError('Bootstrap approval must be root-owned and not writable by others')
        if json.loads(APPROVAL.read_text()) != result:
            raise ValueError('Bootstrap approval differs from the release or live checks')
    print(json.dumps(result))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print('Bootstrap stopped: ' + (str(error) if isinstance(error, ValueError) else type(error).__name__), file=sys.stderr)
        sys.exit(1)
