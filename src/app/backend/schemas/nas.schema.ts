import {
  NasAdministrativeStatus,
  NasEndpointProtocol,
  NasEndpointService,
} from '../models/nas_Model';

export interface NasEndpointInput {
  service: NasEndpointService;
  protocol?: NasEndpointProtocol;
  internal_host?: string | null;
  internal_port: number;
  external_host?: string | null;
  external_port?: number | null;
  enabled?: boolean;
  description?: string | null;
}

export interface NasApiCredentialsInput {
  enabled?: boolean;
  api_host?: string | null;
  api_port?: number;
  use_ssl?: boolean;
  username?: string | null;
  password?: string | null;
}

export interface CreateNasInput {
  nasname: string;
  shortname?: string | null;
  type?: string;
  ports?: number | null;
  secret: string;
  server?: string | null;
  community?: string | null;
  radius_description?: string | null;

  name: string;
  host: string;
  vendor?: string;
  model?: string | null;
  auth_port?: number;
  acct_port?: number;
  coa_port?: number;
  location?: string | null;
  description?: string | null;
  status?: NasAdministrativeStatus;

  api_credentials?: NasApiCredentialsInput | null;
  endpoints?: NasEndpointInput[];
}

export interface UpdateNasInput {
  nasname?: string;
  shortname?: string | null;
  type?: string;
  ports?: number | null;
  secret?: string;
  server?: string | null;
  community?: string | null;
  radius_description?: string | null;

  name?: string;
  host?: string;
  vendor?: string;
  model?: string | null;
  auth_port?: number;
  acct_port?: number;
  coa_port?: number;
  location?: string | null;
  description?: string | null;
  status?: NasAdministrativeStatus;

  api_credentials?: NasApiCredentialsInput | null;
  endpoints?: NasEndpointInput[];
}

type ValidationSuccess<T> = { success: true; data: T };
type ValidationFailure = { success: false; message: string };
export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

const services: NasEndpointService[] = [
  'winbox',
  'api',
  'webfig',
  'coa',
  'ssh',
  'custom',
];
const protocols: NasEndpointProtocol[] = ['tcp', 'udp'];
const statuses: NasAdministrativeStatus[] = ['active', 'disabled'];

const isPort = (value: unknown): value is number =>
  Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 65535;

const nullableString = (value: unknown) =>
  value === undefined || value === null || typeof value === 'string';

function validateEndpoint(endpoint: unknown): string | null {
  if (!endpoint || typeof endpoint !== 'object') return 'بيانات endpoint غير صحيحة';
  const e = endpoint as Record<string, unknown>;
  if (!services.includes(e.service as NasEndpointService)) return 'نوع خدمة endpoint غير مدعوم';
  if (e.protocol !== undefined && !protocols.includes(e.protocol as NasEndpointProtocol)) {
    return 'protocol يجب أن يكون tcp أو udp';
  }
  if (!isPort(e.internal_port)) return 'internal_port غير صحيح';
  if (e.external_port !== undefined && e.external_port !== null && !isPort(e.external_port)) {
    return 'external_port غير صحيح';
  }
  if (!nullableString(e.internal_host) || !nullableString(e.external_host) || !nullableString(e.description)) {
    return 'حقول endpoint النصية غير صحيحة';
  }
  return null;
}

function validateApi(api: unknown): string | null {
  if (api === null || api === undefined) return null;
  if (typeof api !== 'object') return 'بيانات API غير صحيحة';
  const a = api as Record<string, unknown>;
  if (a.api_port !== undefined && !isPort(a.api_port)) return 'api_port غير صحيح';
  if (!nullableString(a.api_host) || !nullableString(a.username) || !nullableString(a.password)) {
    return 'حقول API النصية غير صحيحة';
  }
  return null;
}

export function validateCreateNas(body: unknown): ValidationResult<CreateNasInput> {
  if (!body || typeof body !== 'object') return { success: false, message: 'بيانات الطلب غير صحيحة' };
  const b = body as Record<string, unknown>;

  if (typeof b.nasname !== 'string' || !b.nasname.trim()) {
    return { success: false, message: 'nasname مطلوب' };
  }
  if (typeof b.secret !== 'string' || !b.secret.trim()) {
    return { success: false, message: 'RADIUS secret مطلوب' };
  }
  if (typeof b.name !== 'string' || !b.name.trim()) {
    return { success: false, message: 'اسم NAS مطلوب' };
  }
  if (typeof b.host !== 'string' || !b.host.trim()) {
    return { success: false, message: 'host مطلوب' };
  }

  for (const key of ['auth_port', 'acct_port', 'coa_port']) {
    if (b[key] !== undefined && !isPort(b[key])) {
      return { success: false, message: `${key} غير صحيح` };
    }
  }

  if (b.status !== undefined && !statuses.includes(b.status as NasAdministrativeStatus)) {
    return { success: false, message: 'status يجب أن يكون active أو disabled' };
  }

  const apiError = validateApi(b.api_credentials);
  if (apiError) return { success: false, message: apiError };

  if (b.endpoints !== undefined) {
    if (!Array.isArray(b.endpoints)) return { success: false, message: 'endpoints يجب أن تكون مصفوفة' };
    for (const endpoint of b.endpoints) {
      const error = validateEndpoint(endpoint);
      if (error) return { success: false, message: error };
    }
  }

  return { success: true, data: b as unknown as CreateNasInput };
}

export function validateUpdateNas(body: unknown): ValidationResult<UpdateNasInput> {
  if (!body || typeof body !== 'object') return { success: false, message: 'بيانات الطلب غير صحيحة' };
  const b = body as Record<string, unknown>;

  for (const key of ['nasname', 'secret', 'name', 'host']) {
    if (b[key] !== undefined && (typeof b[key] !== 'string' || !(b[key] as string).trim())) {
      return { success: false, message: `${key} غير صحيح` };
    }
  }

  for (const key of ['auth_port', 'acct_port', 'coa_port']) {
    if (b[key] !== undefined && !isPort(b[key])) {
      return { success: false, message: `${key} غير صحيح` };
    }
  }

  if (b.status !== undefined && !statuses.includes(b.status as NasAdministrativeStatus)) {
    return { success: false, message: 'status يجب أن يكون active أو disabled' };
  }

  const apiError = validateApi(b.api_credentials);
  if (apiError) return { success: false, message: apiError };

  if (b.endpoints !== undefined) {
    if (!Array.isArray(b.endpoints)) return { success: false, message: 'endpoints يجب أن تكون مصفوفة' };
    for (const endpoint of b.endpoints) {
      const error = validateEndpoint(endpoint);
      if (error) return { success: false, message: error };
    }
  }

  return { success: true, data: b as unknown as UpdateNasInput };
}
