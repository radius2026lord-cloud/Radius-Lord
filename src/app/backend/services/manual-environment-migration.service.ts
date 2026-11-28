import {readFile} from 'fs/promises';
import {join} from 'path';
import type {RowDataPacket} from 'mysql2/promise';
import {db} from '../config/db';
import {splitTenantTemplate} from './tenant-template.service';

const lockName = 'radius-lord:central-manual-environment-migration';

export async function migrateManualEnvironment() {
  const connection = await db.pool.getConnection();
  let locked = false;
  try {
    const [locks] = await connection.query<RowDataPacket[]>('SELECT GET_LOCK(?, 30) AS acquired', [lockName]);
    locked = Number(locks[0]?.acquired) === 1;
    if (!locked) throw new Error('MANUAL_ENVIRONMENT_MIGRATION_LOCK_TIMEOUT');

    const [columns] = await connection.query<RowDataPacket[]>(`
      SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA=DATABASE()
        AND ((TABLE_NAME='payment_orders' AND COLUMN_NAME IN ('plan_id','status'))
          OR (TABLE_NAME='subscriptions' AND COLUMN_NAME='plan_id'))`);
    const planColumns = columns.filter(column => column.COLUMN_NAME === 'plan_id');
    const status = columns.find(column => column.COLUMN_NAME === 'status');
    const previousType = "enum('pending','awaiting_confirmation','paid','completed','cancelled','expired')";
    const newType = previousType.slice(0, -1) + ",'manual_authorized')";
    if (columns.length !== 3 || planColumns.length !== 2 ||
        planColumns.some(column => column.COLUMN_TYPE !== 'bigint unsigned') ||
        !status || ![previousType, newType].includes(status.COLUMN_TYPE)) {
      throw new Error('MANUAL_ENVIRONMENT_CENTRAL_SCHEMA_UNEXPECTED');
    }
    if (status.COLUMN_TYPE !== newType || planColumns.some(column => column.IS_NULLABLE !== 'YES')) {
      const source = await readFile(join(__dirname, '../migrations/20261106_manual_environment.sql'), 'utf8');
      for (const statement of splitTenantTemplate(source)) await connection.query(statement);
    }
    const [contacts] = await connection.query<RowDataPacket[]>(`
      SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, CHARACTER_SET_NAME, COLLATION_NAME
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='customers' AND COLUMN_NAME IN ('email','phone')`);
    if (contacts.length !== 2) throw new Error('MANUAL_ENVIRONMENT_CUSTOMER_SCHEMA_UNEXPECTED');
    const changes = contacts.filter(column => column.IS_NULLABLE !== 'YES').map(column => {
      if (!/^varchar\([0-9]+\)$/.test(column.COLUMN_TYPE)
          || !/^[a-zA-Z0-9_]+$/.test(column.CHARACTER_SET_NAME)
          || !/^[a-zA-Z0-9_]+$/.test(column.COLLATION_NAME)) {
        throw new Error('MANUAL_ENVIRONMENT_CUSTOMER_SCHEMA_UNEXPECTED');
      }
      return `MODIFY COLUMN \`${column.COLUMN_NAME}\` ${column.COLUMN_TYPE} CHARACTER SET ${column.CHARACTER_SET_NAME} COLLATE ${column.COLLATION_NAME} NULL DEFAULT NULL`;
    });
    if (changes.length) await connection.query('ALTER TABLE customers ' + changes.join(', '));
  } finally {
    try {
      if (locked) await connection.query('SELECT RELEASE_LOCK(?)', [lockName]);
    } finally {
      connection.release();
    }
  }
}
