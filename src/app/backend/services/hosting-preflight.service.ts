import { isIP } from 'net';

export class HostingPreflightError extends Error {
  constructor(public code: string) { super(code); }
}

// Configuration validation only. This does not certify HTTP, tenant isolation or RADIUS.
// Called for every provisioning attempt, including retries of successful database steps.
export async function readHostingPreflight(query: (sql: string, params?: any[]) => Promise<any>) {
  const [rows]: any = await query('SELECT setting_value FROM platform_settings WHERE setting_group=? AND setting_key=?', ['local_hosting', 'shared_cloud_connection']);
  if (!rows[0]) throw new HostingPreflightError('HOSTING_SETTINGS_REQUIRED');
  let settings: any;
  try { settings = JSON.parse(rows[0].setting_value); }
  catch { throw new HostingPreflightError('HOSTING_SETTINGS_INVALID'); }
  if (!settings || typeof settings !== 'object') throw new HostingPreflightError('HOSTING_SETTINGS_INVALID');
  const mode = settings.access_mode ?? 'domain';
  const ip = String(settings.local_ip ?? '');
  const parts = ip.split('.').map(Number);
  const privateIp = isIP(ip) === 4 && (parts[0] === 10 || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168));
  if (!privateIp) throw new HostingPreflightError('HOSTING_SETTINGS_INVALID');
  const port = Number(mode === 'local_ip' ? settings.local_app_port : settings.public_https_port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new HostingPreflightError('HOSTING_SETTINGS_INVALID');
  if (mode === 'local_ip') return { mode, baseUrl: `http://${ip}${port === 80 ? '' : `:${port}`}` };
  const domain = String(settings.domain ?? '');
  if (mode !== 'domain' || domain.length > 253 || !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(domain) || isIP(domain) || isIP(String(settings.public_ip ?? '')) !== 4)
    throw new HostingPreflightError('HOSTING_SETTINGS_INVALID');
  return { mode, baseUrl: `https://${domain}${port === 443 ? '' : `:${port}`}` };
}
