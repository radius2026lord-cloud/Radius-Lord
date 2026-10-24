import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import { db } from '../config/db';

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
  const [rows]: any = await db.query('SELECT preferences_json FROM user_ui_preferences WHERE owner_key=? LIMIT 1', [ownerKey]);
  const value = rows?.[0]?.preferences_json;
  if (!value) return defaultUiPreferences;
  try { return normalize(typeof value === 'string' ? JSON.parse(value) : value); } catch { return defaultUiPreferences; }
}

async function save(ownerKey: string, value: unknown) {
  const preferences = normalize(value);
  await db.query('INSERT INTO user_ui_preferences (owner_key,preferences_json) VALUES (?,?) ON DUPLICATE KEY UPDATE preferences_json=VALUES(preferences_json)', [ownerKey, JSON.stringify(preferences)]);
  return preferences;
}

export async function getMasterUiPreferences(req: AuthenticatedRequest, res: Response) {
  try { return res.json({ success: true, preferences: await read(`master_admin:${req.auth!.accountId}`) }); }
  catch { return res.status(503).json({ success: false, message: 'تعذر تحميل تفضيلات الواجهة. تحقق من تطبيق ترقية قاعدة البيانات.' }); }
}

export async function saveMasterUiPreferences(req: AuthenticatedRequest, res: Response) {
  try { return res.json({ success: true, preferences: await save(`master_admin:${req.auth!.accountId}`, req.body?.preferences) }); }
  catch { return res.status(503).json({ success: false, message: 'تعذر حفظ تفضيلات الواجهة. تحقق من تطبيق ترقية قاعدة البيانات.' }); }
}

export async function readUiPreferences(ownerKey: string) { return read(ownerKey); }
export async function writeUiPreferences(ownerKey: string, value: unknown) { return save(ownerKey, value); }
