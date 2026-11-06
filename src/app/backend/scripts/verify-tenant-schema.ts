import mysql from 'mysql2/promise';
import {tenantSchemaFingerprint} from '../services/tenant-schema-fingerprint.service';

async function main() {
  const [reference, candidate] = process.argv.slice(2);
  const user = process.env.SCHEMA_VERIFY_USER;
  if (!reference || !user || candidate === reference) {
    throw new Error('Use: ts-node scripts/verify-tenant-schema.ts REFERENCE_DB [CANDIDATE_DB], with SCHEMA_VERIFY_USER configured.');
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
    const fingerprint = await tenantSchemaFingerprint(connection, reference);
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
