import {randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import mysql from 'mysql2/promise';
import {splitTenantTemplate} from '../services/tenant-template.service';
import {tenantSchemaFingerprint} from '../services/tenant-schema-fingerprint.service';

async function fingerprintTemplate(connection: mysql.Connection) {
  const template = await readFile(join(__dirname, '../tenant-schema/create_tenant_database.sql'), 'utf8');
  const statements = splitTenantTemplate(template);
  const database = 'rl_tenant_qa_' + randomBytes(8).toString('hex');
  const identifier = mysql.escapeId(database);
  await connection.query(`CREATE DATABASE ${identifier} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  try {
    await connection.query(`USE ${identifier}`);
    for (const sql of statements) {
      await connection.query({sql, timeout: 30000});
    }
    return await tenantSchemaFingerprint(connection, database);
  } finally {
    await connection.query(`DROP DATABASE ${identifier}`);
  }
}

async function main() {
  const [reference, candidate] = process.argv.slice(2);
  const user = process.env.SCHEMA_VERIFY_USER;
  if (!reference || !user || candidate === reference || (reference === '--from-template' && candidate)) {
    throw new Error('Use: ts-node scripts/verify-tenant-schema.ts --from-template | REFERENCE_DB [CANDIDATE_DB], with SCHEMA_VERIFY_USER configured.');
  }
  const connection = await mysql.createConnection({
    host: process.env.SCHEMA_VERIFY_HOST || 'localhost',
    port: Number(process.env.SCHEMA_VERIFY_PORT || 3306),
    user,
    password: process.env.SCHEMA_VERIFY_PASSWORD,
    socketPath: process.env.SCHEMA_VERIFY_SOCKET,
    connectTimeout: 10000,
  });
  try {
    const fingerprint = reference === '--from-template'
      ? await fingerprintTemplate(connection)
      : await tenantSchemaFingerprint(connection, reference);
    if (candidate && await tenantSchemaFingerprint(connection, candidate) !== fingerprint) {
      throw new Error('TENANT_SCHEMA_MISMATCH');
    }
    console.log('TENANT_SCHEMA_REFERENCE_SHA256=' + fingerprint);
  } finally {
    await connection.end();
  }
}

main().catch(error => {
  console.error(error.code || error.message);
  process.exitCode = 1;
});
