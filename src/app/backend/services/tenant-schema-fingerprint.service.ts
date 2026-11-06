import {createHash} from 'crypto';
import {escapeId, type Connection, type RowDataPacket} from 'mysql2/promise';

export async function tenantSchemaFingerprint(connection: Connection, database: string) {
  const [schemas] = await connection.query<RowDataPacket[]>(
    'SELECT DEFAULT_CHARACTER_SET_NAME, DEFAULT_COLLATION_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=?',
    [database],
  );
  const [tables] = await connection.query<RowDataPacket[]>(
    'SELECT TABLE_NAME, TABLE_TYPE FROM information_schema.TABLES WHERE TABLE_SCHEMA=? ORDER BY BINARY TABLE_NAME',
    [database],
  );
  if (!schemas.length || !tables.some(table => table.TABLE_TYPE === 'BASE TABLE')) {
    throw new Error('TENANT_SCHEMA_NOT_VISIBLE');
  }

  const objects = tables.map(table => ({
    name: String(table.TABLE_NAME),
    type: table.TABLE_TYPE === 'VIEW' ? 'VIEW' : 'TABLE',
  }));
  const extraObjects = [
    ['ROUTINES', 'ROUTINE_SCHEMA', 'ROUTINE_NAME', 'ROUTINE_TYPE'],
    ['TRIGGERS', 'TRIGGER_SCHEMA', 'TRIGGER_NAME', "'TRIGGER'"],
    ['EVENTS', 'EVENT_SCHEMA', 'EVENT_NAME', "'EVENT'"],
  ];
  for (const [table, schema, name, type] of extraObjects) {
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT ${name} name, ${type} type FROM information_schema.${table} WHERE ${schema}=? ORDER BY BINARY ${name}, type`,
      [database],
    );
    for (const row of rows) objects.push({name: row.name, type: row.type});
  }

  const qualified = escapeId(database) + '.';
  const definitions = [];
  for (const {name, type} of objects) {
    const [rows] = await connection.query<RowDataPacket[]>(
      `SHOW CREATE ${type} ${qualified}${escapeId(name)}`,
    );
    const definition = rows[0]?.[type === 'EVENT' ? 'Create Event' : type === 'TRIGGER' ? 'SQL Original Statement' : 'Create ' + type[0] + type.slice(1).toLowerCase()];
    if (typeof definition !== 'string') throw new Error('TENANT_SCHEMA_DEFINITION_NOT_VISIBLE');

    const normalized = definition
      .replace(/\bDEFINER=`(?:[^`]|\x60\x60)*`@`(?:[^`]|\x60\x60)*`\s*/i, '')
      .split(qualified).join('`__tenant_schema__`.')
      .replace(/\) ENGINE=[^\r\n]*/i, options => options.replace(/\sAUTO_INCREMENT=\d+/i, ''));
    definitions.push([type, name, normalized]);
  }
  return createHash('sha256').update(JSON.stringify([schemas[0], definitions])).digest('hex');
}
