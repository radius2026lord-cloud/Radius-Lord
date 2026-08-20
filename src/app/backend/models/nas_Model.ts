export type NasAdministrativeStatus = 'active' | 'disabled';
export type NasConnectionStatus = 'unknown' | 'online' | 'offline';
export type NasApiStatus = 'unknown' | 'connected' | 'failed';
export type NasEndpointService =
  | 'winbox'
  | 'api'
  | 'webfig'
  | 'coa'
  | 'ssh'
  | 'custom';
export type NasEndpointProtocol = 'tcp' | 'udp';

export interface RadiusNas {
  id: number;
  nasname: string;
  shortname: string | null;
  type: string | null;
  ports: number | null;
  secret: string;
  server: string | null;
  community: string | null;
  description: string | null;
}

export interface LordNas {
  id: number;
  radius_nas_id: number;
  name: string;
  host: string;
  vendor: string;
  model: string | null;
  auth_port: number;
  acct_port: number;
  coa_port: number;
  location: string | null;
  description: string | null;
  status: NasAdministrativeStatus;
  connection_status: NasConnectionStatus;
  last_seen_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface LordNasApiCredentials {
  id: number;
  nas_id: number;
  enabled: 0 | 1;
  api_host: string | null;
  api_port: number;
  use_ssl: 0 | 1;
  username: string | null;
  password_encrypted: string | null;
  status: NasApiStatus;
  last_connected_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface LordNasEndpoint {
  id: number;
  nas_id: number;
  service: NasEndpointService;
  protocol: NasEndpointProtocol;
  internal_host: string | null;
  internal_port: number;
  external_host: string | null;
  external_port: number | null;
  enabled: 0 | 1;
  description: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface NasDetails extends LordNas {
  radius: RadiusNas;
  api_credentials: Omit<LordNasApiCredentials, 'password_encrypted'> | null;
  endpoints: LordNasEndpoint[];
}
