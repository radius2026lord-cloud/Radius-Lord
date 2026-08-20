import crypto from 'crypto';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

import { db } from '../../config/db';
import { env } from '../../config/env';
import { NasDetails } from '../../models/nas_Model';
import {
  CreateNasInput,
  NasApiCredentialsInput,
  NasEndpointInput,
  UpdateNasInput,
} from '../../schemas/nas.schema';

class NasServiceError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const encryptionKey = crypto
  .createHash('sha256')
  .update(env.NAS_ENCRYPTION_KEY)
  .digest();

function encryptPassword(password: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);
  const encrypted = Buffer.concat([
    cipher.update(password, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
}

async function insertApiCredentials(
  connection: any,
  nasId: number,
  api: NasApiCredentialsInput,
) {
  const passwordEncrypted = api.password
    ? encryptPassword(api.password)
    : null;

  await connection.execute(
    `INSERT INTO lord_nas_api_credentials
      (nas_id, enabled, api_host, api_port, use_ssl, username, password_encrypted)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      nasId,
      api.enabled === false ? 0 : 1,
      api.api_host ?? null,
      api.api_port ?? 8728,
      api.use_ssl ? 1 : 0,
      api.username ?? null,
      passwordEncrypted,
    ],
  );
}

async function insertEndpoints(
  connection: any,
  nasId: number,
  endpoints: NasEndpointInput[],
) {
  for (const endpoint of endpoints) {
    await connection.execute(
      `INSERT INTO lord_nas_endpoints
        (nas_id, service, protocol, internal_host, internal_port,
         external_host, external_port, enabled, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nasId,
        endpoint.service,
        endpoint.protocol ?? 'tcp',
        endpoint.internal_host ?? null,
        endpoint.internal_port,
        endpoint.external_host ?? null,
        endpoint.external_port ?? null,
        endpoint.enabled === false ? 0 : 1,
        endpoint.description ?? null,
      ],
    );
  }
}

export class NasService {
  static async list() {
    const [rows] = await db.query(
      `SELECT
        ln.id,
        ln.radius_nas_id,
        ln.name,
        ln.host,
        ln.vendor,
        ln.model,
        ln.auth_port,
        ln.acct_port,
        ln.coa_port,
        ln.location,
        ln.description,
        ln.status,
        ln.connection_status,
        ln.last_seen_at,
        ln.created_at,
        ln.updated_at,
        n.nasname,
        n.shortname,
        n.type,
        n.description AS radius_description,
        (SELECT COUNT(*) FROM lord_nas_endpoints e WHERE e.nas_id = ln.id) AS endpoint_count,
        EXISTS(
          SELECT 1 FROM lord_nas_api_credentials a
          WHERE a.nas_id = ln.id AND a.enabled = 1
        ) AS api_enabled
       FROM lord_nas ln
       INNER JOIN nas n ON n.id = ln.radius_nas_id
       ORDER BY ln.id DESC`,
    );

    return rows;
  }

  static async getById(id: number): Promise<NasDetails> {
    const [nasRows] = await db.query(
      `SELECT ln.*, n.nasname, n.shortname, n.type, n.ports, n.secret,
              n.server, n.community, n.description AS radius_description
       FROM lord_nas ln
       INNER JOIN nas n ON n.id = ln.radius_nas_id
       WHERE ln.id = ? LIMIT 1`,
      [id],
    );

    const rows = nasRows as RowDataPacket[];
    if (!rows.length) throw new NasServiceError(404, 'NAS غير موجود');

    const row = rows[0];

    const [apiRows] = await db.query(
      `SELECT id, nas_id, enabled, api_host, api_port, use_ssl, username,
              status, last_connected_at, created_at, updated_at
       FROM lord_nas_api_credentials
       WHERE nas_id = ? LIMIT 1`,
      [id],
    );

    const [endpointRows] = await db.query(
      `SELECT * FROM lord_nas_endpoints
       WHERE nas_id = ? ORDER BY id ASC`,
      [id],
    );

    return {
      id: row.id,
      radius_nas_id: row.radius_nas_id,
      name: row.name,
      host: row.host,
      vendor: row.vendor,
      model: row.model,
      auth_port: row.auth_port,
      acct_port: row.acct_port,
      coa_port: row.coa_port,
      location: row.location,
      description: row.description,
      status: row.status,
      connection_status: row.connection_status,
      last_seen_at: row.last_seen_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
      radius: {
        id: row.radius_nas_id,
        nasname: row.nasname,
        shortname: row.shortname,
        type: row.type,
        ports: row.ports,
        secret: row.secret,
        server: row.server,
        community: row.community,
        description: row.radius_description,
      },
      api_credentials: (apiRows as RowDataPacket[])[0] ?? null,
      endpoints: endpointRows as any,
    };
  }

  static async create(input: CreateNasInput) {
    const connection = await db.pool.getConnection();

    try {
      await connection.beginTransaction();

      const [duplicateRows] = await connection.execute<RowDataPacket[]>(
        'SELECT id FROM nas WHERE nasname = ? LIMIT 1',
        [input.nasname],
      );
      if (duplicateRows.length) {
        throw new NasServiceError(409, 'يوجد NAS بنفس nasname مسبقًا');
      }

      const [radiusResult] = await connection.execute<ResultSetHeader>(
        `INSERT INTO nas
          (nasname, shortname, type, ports, secret, server, community, description)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          input.nasname.trim(),
          input.shortname ?? null,
          input.type ?? 'other',
          input.ports ?? null,
          input.secret,
          input.server ?? null,
          input.community ?? null,
          input.radius_description ?? 'RADIUS Client',
        ],
      );

      const radiusNasId = radiusResult.insertId;

      const [lordResult] = await connection.execute<ResultSetHeader>(
        `INSERT INTO lord_nas
          (radius_nas_id, name, host, vendor, model, auth_port, acct_port,
           coa_port, location, description, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          radiusNasId,
          input.name.trim(),
          input.host.trim(),
          input.vendor ?? 'MikroTik',
          input.model ?? null,
          input.auth_port ?? 1812,
          input.acct_port ?? 1813,
          input.coa_port ?? 3799,
          input.location ?? null,
          input.description ?? null,
          input.status ?? 'active',
        ],
      );

      const lordNasId = lordResult.insertId;

      if (input.api_credentials) {
        await insertApiCredentials(connection, lordNasId, input.api_credentials);
      }

      if (input.endpoints?.length) {
        await insertEndpoints(connection, lordNasId, input.endpoints);
      }

      await connection.commit();
      return await this.getById(lordNasId);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async update(id: number, input: UpdateNasInput) {
    const connection = await db.pool.getConnection();

    try {
      await connection.beginTransaction();

      const [existingRows] = await connection.execute<RowDataPacket[]>(
        `SELECT ln.id, ln.radius_nas_id
         FROM lord_nas ln WHERE ln.id = ? LIMIT 1`,
        [id],
      );
      if (!existingRows.length) throw new NasServiceError(404, 'NAS غير موجود');

      const radiusNasId = existingRows[0].radius_nas_id;

      if (input.nasname !== undefined) {
        const [duplicateRows] = await connection.execute<RowDataPacket[]>(
          'SELECT id FROM nas WHERE nasname = ? AND id <> ? LIMIT 1',
          [input.nasname, radiusNasId],
        );
        if (duplicateRows.length) {
          throw new NasServiceError(409, 'يوجد NAS آخر بنفس nasname');
        }
      }

      const radiusFields: string[] = [];
      const radiusValues: unknown[] = [];
      const radiusMap: Record<string, unknown> = {
        nasname: input.nasname,
        shortname: input.shortname,
        type: input.type,
        ports: input.ports,
        secret: input.secret,
        server: input.server,
        community: input.community,
        description: input.radius_description,
      };

      for (const [field, value] of Object.entries(radiusMap)) {
        if (value !== undefined) {
          radiusFields.push(`${field} = ?`);
          radiusValues.push(value);
        }
      }

      if (radiusFields.length) {
        await connection.execute(
          `UPDATE nas SET ${radiusFields.join(', ')} WHERE id = ?`,
          [...radiusValues, radiusNasId],
        );
      }

      const lordFields: string[] = [];
      const lordValues: unknown[] = [];
      const lordMap: Record<string, unknown> = {
        name: input.name,
        host: input.host,
        vendor: input.vendor,
        model: input.model,
        auth_port: input.auth_port,
        acct_port: input.acct_port,
        coa_port: input.coa_port,
        location: input.location,
        description: input.description,
        status: input.status,
      };

      for (const [field, value] of Object.entries(lordMap)) {
        if (value !== undefined) {
          lordFields.push(`${field} = ?`);
          lordValues.push(value);
        }
      }

      if (lordFields.length) {
        await connection.execute(
          `UPDATE lord_nas SET ${lordFields.join(', ')} WHERE id = ?`,
          [...lordValues, id],
        );
      }

      if (input.api_credentials !== undefined) {
        if (input.api_credentials === null) {
          await connection.execute(
            'DELETE FROM lord_nas_api_credentials WHERE nas_id = ?',
            [id],
          );
        } else {
          const [apiRows] = await connection.execute<RowDataPacket[]>(
            'SELECT id, password_encrypted FROM lord_nas_api_credentials WHERE nas_id = ? LIMIT 1',
            [id],
          );

          if (!apiRows.length) {
            await insertApiCredentials(connection, id, input.api_credentials);
          } else {
            const api = input.api_credentials;
            const apiFields: string[] = [];
            const apiValues: unknown[] = [];

            if (api.enabled !== undefined) {
              apiFields.push('enabled = ?');
              apiValues.push(api.enabled ? 1 : 0);
            }
            if (api.api_host !== undefined) {
              apiFields.push('api_host = ?');
              apiValues.push(api.api_host);
            }
            if (api.api_port !== undefined) {
              apiFields.push('api_port = ?');
              apiValues.push(api.api_port);
            }
            if (api.use_ssl !== undefined) {
              apiFields.push('use_ssl = ?');
              apiValues.push(api.use_ssl ? 1 : 0);
            }
            if (api.username !== undefined) {
              apiFields.push('username = ?');
              apiValues.push(api.username);
            }
            if (api.password !== undefined && api.password !== null) {
              apiFields.push('password_encrypted = ?');
              apiValues.push(encryptPassword(api.password));
            }

            if (apiFields.length) {
              await connection.execute(
                `UPDATE lord_nas_api_credentials
                 SET ${apiFields.join(', ')} WHERE nas_id = ?`,
                [...apiValues, id],
              );
            }
          }
        }
      }

      if (input.endpoints !== undefined) {
        await connection.execute(
          'DELETE FROM lord_nas_endpoints WHERE nas_id = ?',
          [id],
        );
        if (input.endpoints.length) {
          await insertEndpoints(connection, id, input.endpoints);
        }
      }

      await connection.commit();
      return await this.getById(id);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async setStatus(id: number, status: 'active' | 'disabled') {
    const [result] = await db.query(
      'UPDATE lord_nas SET status = ? WHERE id = ?',
      [status, id],
    );

    if ((result as ResultSetHeader).affectedRows === 0) {
      throw new NasServiceError(404, 'NAS غير موجود');
    }

    return await this.getById(id);
  }

  static async remove(id: number) {
    const connection = await db.pool.getConnection();

    try {
      await connection.beginTransaction();

      const [rows] = await connection.execute<RowDataPacket[]>(
        'SELECT radius_nas_id FROM lord_nas WHERE id = ? LIMIT 1',
        [id],
      );
      if (!rows.length) throw new NasServiceError(404, 'NAS غير موجود');

      const radiusNasId = rows[0].radius_nas_id;

      await connection.execute('DELETE FROM lord_nas WHERE id = ?', [id]);
      await connection.execute('DELETE FROM nas WHERE id = ?', [radiusNasId]);

      await connection.commit();
      return { success: true };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

export { NasServiceError };
