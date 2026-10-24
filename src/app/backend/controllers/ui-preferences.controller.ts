import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import { db } from '../config/db';

let tableReady: Promise<void> | null = null;

function ensurePreferencesTable() {
  if (!tableReady) {
    tableReady = db.query(`CREATE TABLE IF NOT EXISTS user_ui_preferences (
      owner_key VARCHAR(191) NOT NULL,
      preferences_json JSON NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (owner_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`).then(() => undefined).catch(error => {
      tableReady = null;
      throw error;
    });
  }
  return tableReady;
}

export const defaultUiPreferences = {
  footer: {
    showNetwork: true, showNas: true, showStatus: true, showCpu: true,
    showRam: true, showUptime: true, showConnected: true, showClock: true, showExpiry: true,
    rotateNas: false, rotateSeconds: 15, clock24h: true,
  },
  homepage: {
    showOverview: true, showLicense: true, showExpiry: true,
    showShortcuts: true, showActivity: true,
  },
};

function normalize(input: any) {
  const b = input?.footer ?? {}, h = input?.homepage ?? {};
  const bool = (value: unknown, fallback: boolean) => typeof value === 'boolean' ? value : fallback;
  const seconds = Number(b.rotateSeconds);
  return {
    footer: {
      showNetwork: bool(b.showNetwork, true), showNas: bool(b.showNas, true),
      showStatus: bool(b.showStatus, true), showCpu: bool(b.showCpu, true),
      showRam: bool(b.showRam, true), showUptime: bool(b.showUptime, true),
      showConnected: bool(b.showConnected, true), showClock: true, showExpiry: bool(b.showExpiry, true),
      rotateNas: bool(b.rotateNas, false), rotateSeconds: Number.isFinite(seconds) ? Math.max(5, Math.min(120, Math.round(seconds))) : 15,
      clock24h: bool(b.clock24h, true),
    },
    homepage: {
      showOverview: bool(h.showOverview, true), showLicense: bool(h.showLicense, true),
      showExpiry: bool(h.showExpiry, true), showShortcuts: bool(h.showShortcuts, true),
      showActivity: bool(h.showActivity, true),
    },
  };
}

async function read(ownerKey: string) {
  await ensurePreferencesTable();
  const [rows]: any = await db.query('SELECT preferences_json FROM user_ui_preferences WHERE owner_key=? LIMIT 1', [ownerKey]);
  const value = rows?.[0]?.preferences_json;
  if (!value) return defaultUiPreferences;
  try { return normalize(typeof value === 'string' ? JSON.parse(value) : value); } catch { return defaultUiPreferences; }
}

async function save(ownerKey: string, value: unknown) {
  await ensurePreferencesTable();
  const preferences = normalize(value);
  await db.query('INSERT INTO user_ui_preferences (owner_key,preferences_json) VALUES (?,?) ON DUPLICATE KEY UPDATE preferences_json=VALUES(preferences_json)', [ownerKey, JSON.stringify(preferences)]);
  return preferences;
}

export async function getMasterUiPreferences(req: AuthenticatedRequest, res: Response) {
  try { return res.json({ success: true, preferences: await read(`master_admin:${req.auth!.accountId}`) }); }
  catch (error) { console.error('[ui-preferences] read failed:', (error as any)?.code || error); return res.status(503).json({ success: false, message: 'تعذر تحميل تفضيلات الواجهة. تحقق من اتصال قاعدة البيانات وصلاحيات الحساب.' }); }
}

export async function saveMasterUiPreferences(req: AuthenticatedRequest, res: Response) {
  try { return res.json({ success: true, preferences: await save(`master_admin:${req.auth!.accountId}`, req.body?.preferences) }); }
  catch (error) { console.error('[ui-preferences] save failed:', (error as any)?.code || error); return res.status(503).json({ success: false, message: 'تعذر حفظ تفضيلات الواجهة. تحقق من اتصال قاعدة البيانات وصلاحيات الحساب.' }); }
}

export async function readUiPreferences(ownerKey: string) { return read(ownerKey); }
export async function writeUiPreferences(ownerKey: string, value: unknown) { return save(ownerKey, value); }

let followUpTableReady:Promise<void>|null=null;
async function ensureFollowUpTable(){if(!followUpTableReady)followUpTableReady=db.query(`CREATE TABLE IF NOT EXISTS network_followup_alert_settings (environment_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,expiry_days TINYINT UNSIGNED NOT NULL DEFAULT 7,quota_percent TINYINT UNSIGNED NOT NULL DEFAULT 80,updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`).then(()=>undefined).catch(error=>{followUpTableReady=null;throw error;});return followUpTableReady;}
export async function readNetworkFollowUpSettings(environmentId:number){await ensureFollowUpTable();const [rows]:any=await db.query('SELECT expiry_days expiryDays,quota_percent quotaPercent FROM network_followup_alert_settings WHERE environment_id=?',[environmentId]);return {expiryDays:Number(rows?.[0]?.expiryDays??7),quotaPercent:Number(rows?.[0]?.quotaPercent??80)};}
export async function writeNetworkFollowUpSettings(environmentId:number,input:any){const expiryDays=Number(input?.expiryDays),quotaPercent=Number(input?.quotaPercent);if(!Number.isInteger(expiryDays)||expiryDays<1||expiryDays>30||!Number.isInteger(quotaPercent)||quotaPercent<50||quotaPercent>99)throw new Error('FOLLOWUP_SETTINGS_INPUT');await ensureFollowUpTable();await db.query('INSERT INTO network_followup_alert_settings(environment_id,expiry_days,quota_percent) VALUES(?,?,?) ON DUPLICATE KEY UPDATE expiry_days=VALUES(expiry_days),quota_percent=VALUES(quota_percent)',[environmentId,expiryDays,quotaPercent]);return {expiryDays,quotaPercent};}
