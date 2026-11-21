#!/usr/bin/env python3
"""Explicit central-data reset for a newly deployed host; plan by default.

No remote operations, DROP DATABASE, TRUNCATE or disabled foreign-key checks.
"""
import argparse
import hashlib
import json
import os
import pathlib
import re
import subprocess
import sys
import tempfile

DATABASE = 'lord_radius_core'
KEEP = set('audit_actions audit_entity_types currencies deployment_types master_admins network_followup_alert_settings payment_plans plan_addons plan_deployment_options'.split())
CLEAR = set('central_audit_logs customers database_backup_jobs database_backup_verifications environment_component_versions environment_notifications environment_provisioning_jobs environment_provisioning_steps environment_releases environment_upgrade_jobs lord_nas lord_nas_api_credentials lord_nas_endpoints lord_nas_status_logs nas_registry nas_tunnels ovpn_gateways payment_order_events payment_orders schema_versions subscription_addons subscription_licenses subscriptions tenant_databases tenant_environment_status tenant_environments tenant_managers tenants user_ui_preferences'.split())
FILTERED = {'database_servers', 'server_ssh_connections', 'platform_settings'}
UNITS = ['radius-lord-backend.service', 'radius-lord-frontend.service', 'radius-lord-deploy.service', 'radius-lord-deploy.timer']


def mysql(sql):
    return subprocess.check_output(['mysql', '--skip-reconnect', '--batch', '--raw', '--skip-column-names', DATABASE, '-e', sql], text=True, stderr=subprocess.DEVNULL, timeout=60).splitlines()


def identifier(name):
    if not re.fullmatch(r'[a-zA-Z0-9_]+', name):
        raise ValueError('Unexpected SQL identifier')
    return '`' + name + '`'


def inspect(args):
    rows = mysql("SELECT TABLE_NAME,ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()")
    engines = dict(row.split('\t') for row in rows)
    if set(engines) != KEEP | CLEAR | FILTERED:
        raise ValueError('Unexpected central table inventory; review before reset')
    if any(engine != 'InnoDB' for engine in engines.values()):
        raise ValueError('All central tables must be transactional InnoDB tables')
    if mysql('SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE()'):
        raise ValueError('Review central triggers before reset')
    if mysql("SELECT EVENT_NAME FROM information_schema.EVENTS WHERE EVENT_SCHEMA=DATABASE() AND STATUS='ENABLED'"):
        raise ValueError('Review enabled database events before reset')
    if mysql("SELECT TABLE_SCHEMA FROM information_schema.KEY_COLUMN_USAGE WHERE REFERENCED_TABLE_SCHEMA=DATABASE() AND TABLE_SCHEMA<>DATABASE()"):
        raise ValueError('Another database references this central database; review before reset')
    server = mysql(f"SELECT COUNT(*) FROM database_servers WHERE id={args.keep_server} AND host='127.0.0.1' AND status='active' AND archived_at IS NULL")
    ssh = mysql(f"SELECT COUNT(*) FROM server_ssh_connections WHERE database_server_id={args.keep_server} AND host='127.0.0.1' AND port=3001")
    radius = mysql(f"SELECT COUNT(*) FROM platform_settings WHERE id={args.keep_radius} AND setting_group='free_radius' AND JSON_UNQUOTE(JSON_EXTRACT(setting_value,'$.host'))='127.0.0.1'")
    hosting = mysql("SELECT COUNT(*) FROM platform_settings WHERE setting_group='local_hosting'")
    admins = mysql("SELECT COUNT(*) FROM master_admins WHERE status='active'")
    if server != ['1'] or ssh != ['1'] or radius != ['1'] or hosting != ['1'] or int(admins[0]) < 1:
        raise ValueError('Required new infrastructure, hosting or administrator record is missing/different')
    # Child tables are deleted before parent tables. Unknown cycles fail closed.
    edges = [row.split('\t') for row in mysql("SELECT DISTINCT TABLE_NAME,REFERENCED_TABLE_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE CONSTRAINT_SCHEMA=DATABASE() AND REFERENCED_TABLE_SCHEMA=DATABASE()")]
    if any(child in KEEP and parent in CLEAR | FILTERED for child, parent in edges):
        raise ValueError('A retained catalog references operational data; explicit review required')
    remaining = CLEAR | FILTERED
    order = []
    while remaining:
        leaves = sorted(table for table in remaining if not any(parent == table and child in remaining for child, parent in edges))
        if not leaves:
            raise ValueError('Cyclic foreign keys require an explicit reviewed reset order')
        order.extend(leaves)
        remaining -= set(leaves)
    counts = {table: int(mysql('SELECT COUNT(*) FROM ' + identifier(table))[0]) for table in sorted(engines)}
    keep_setting = f"(id={args.keep_radius} AND setting_group='free_radius') OR setting_group IN ('local_hosting','auth_revoked_sessions') OR (setting_group='radius_bootstrap' AND setting_key='test_{args.keep_radius}')"
    return order, counts, keep_setting


def apply(args, order, counts, keep_setting):
    for unit in UNITS:
        state = subprocess.check_output(['systemctl', 'show', unit, '-p', 'ActiveState', '--value'], text=True).strip()
        if state != 'inactive':
            raise ValueError('Stop web services, deployment worker and timer before applying: ' + unit)
    directory = pathlib.Path(tempfile.mkdtemp(prefix='lord-before-clean-reset-', dir='/root'))
    os.chmod(directory, 0o700)
    backup = directory / 'central.sql'
    with backup.open('xb') as stream:
        os.chmod(backup, 0o600)
        subprocess.run(['mysqldump', '--single-transaction', '--no-tablespaces', '--routines', '--events', '--triggers', DATABASE], stdout=stream, stderr=subprocess.DEVNULL, check=True, timeout=600)
        stream.flush()
        os.fsync(stream.fileno())
    if backup.stat().st_size == 0:
        raise ValueError('Empty backup; reset blocked')
    digest = hashlib.sha256(backup.read_bytes()).hexdigest()
    (directory / 'central.sql.sha256').write_text(digest + '  central.sql\n')
    (directory / 'plan.json').write_text(json.dumps({'keepServer': args.keep_server, 'keepRadius': args.keep_radius, 'beforeCounts': counts, 'deleteOrder': order}, indent=2))
    print('Backup: ' + str(backup), flush=True)
    # A duplicate assertion key aborts the batch. Connection close rolls back all DML.
    statements = ["SET SESSION innodb_lock_wait_timeout=10", "CREATE TEMPORARY TABLE reset_assertion (id INT PRIMARY KEY) ENGINE=InnoDB", "INSERT INTO reset_assertion VALUES (1)", "START TRANSACTION"]
    def assertion(condition):
        statements.append('INSERT INTO reset_assertion SELECT 1 WHERE NOT (' + condition + ')')
    # Prevent changes between inventory/backup and application from going unnoticed.
    for table, count in counts.items():
        assertion(f'(SELECT COUNT(*) FROM {identifier(table)})={count}')
    for table in order:
        where = '1=1'
        if table == 'database_servers':
            where = f'id<>{args.keep_server}'
        elif table == 'server_ssh_connections':
            where = f'database_server_id<>{args.keep_server}'
        elif table == 'platform_settings':
            where = 'NOT (' + keep_setting + ')'
        statements.append('DELETE FROM ' + identifier(table) + ' WHERE ' + where)
    for table in sorted(CLEAR):
        assertion(f'(SELECT COUNT(*) FROM {identifier(table)})=0')
    for table in sorted(KEEP):
        assertion(f'(SELECT COUNT(*) FROM {identifier(table)})={counts[table]}')
    assertion(f'(SELECT COUNT(*) FROM database_servers WHERE id={args.keep_server})=1')
    assertion('(SELECT COUNT(*) FROM database_servers)=1')
    assertion(f"(SELECT COUNT(*) FROM platform_settings WHERE id={args.keep_radius} AND setting_group='free_radius')=1")
    statements += ['COMMIT', "SELECT 'Central operational reset committed'"]
    result = subprocess.run(['mysql', '--skip-reconnect', '--batch', DATABASE], input=';\n'.join(statements) + ';\n', text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=300)
    if result.returncode:
        raise ValueError('Reset failed; inspect database state before retrying. Backup: ' + str(backup))
    print(result.stdout.strip())
    print('Only central database rows were changed. Tenant databases, CHR, FreeRADIUS files, MySQL accounts, uploads and deployment secrets were not modified.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--keep-server', type=int, required=True)
    parser.add_argument('--keep-radius', type=int, required=True)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    if os.geteuid() != 0 or args.keep_server < 1 or args.keep_radius < 1:
        raise ValueError('Run as root with explicit positive infrastructure IDs')
    order, counts, keep_setting = inspect(args)
    if args.apply:
        apply(args, order, counts, keep_setting)
    else:
        print(json.dumps({'mode': 'plan-only', 'database': DATABASE, 'keepServer': args.keep_server, 'keepRadius': args.keep_radius, 'preserveTables': sorted(KEEP), 'clearTables': {t: counts[t] for t in sorted(CLEAR)}, 'platformSettingsToRemove': int(mysql('SELECT COUNT(*) FROM platform_settings WHERE NOT (' + keep_setting + ')')[0]), 'retainedSettingGroups': ['local_hosting', 'auth_revoked_sessions', 'free_radius (selected ID only)', 'radius_bootstrap (selected ID only)'], 'deleteOrder': order}, indent=2))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print('Reset stopped: ' + (str(error) if isinstance(error, ValueError) else type(error).__name__), file=sys.stderr)
        sys.exit(1)
