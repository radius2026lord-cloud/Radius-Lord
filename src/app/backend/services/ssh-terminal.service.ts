import { createHash, createHmac, randomBytes } from 'crypto';
import { isIP } from 'net';
import type { Server } from 'http';
import { Client, ClientChannel } from 'ssh2';
import { WebSocket, WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import type { Response } from 'express';
import { db } from '../config/db';
import { env } from '../config/env';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import { writeAuditLog } from './audit.service';
import { encryptProvisioningSecret, decryptProvisioningSecret, provisioningKey } from './provisioning-secrets.service';

const tableSql = `CREATE TABLE IF NOT EXISTS server_ssh_connections (
 database_server_id BIGINT UNSIGNED PRIMARY KEY,
 host VARCHAR(253) NOT NULL, port INT UNSIGNED NOT NULL, username VARCHAR(64) NOT NULL,
 auth_method VARCHAR(16) NOT NULL, secret_encrypted MEDIUMTEXT NOT NULL,
 passphrase_encrypted TEXT NULL, host_fingerprint VARCHAR(80) NOT NULL,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;
let schema: Promise<unknown> | undefined;
function ensureSchema() {
  if (!schema) schema = db.query(tableSql).catch(e => { schema = undefined; throw e; });
  return schema;
}
type Config = { id: number; host: string; port: number; username: string; authMethod: 'password' | 'key'; secret: string; passphrase: string; fingerprint: string };
async function savedConfig(id: number): Promise<Config | null> {
  await ensureSchema();
  const [rows]: any = await db.query('SELECT c.* FROM server_ssh_connections c JOIN database_servers s ON s.id=c.database_server_id WHERE c.database_server_id=? AND s.archived_at IS NULL', [id]);
  const c = rows[0];
  return c ? { id, host: c.host, port: c.port, username: c.username, authMethod: c.auth_method, secret: decryptProvisioningSecret(c.secret_encrypted), passphrase: c.passphrase_encrypted ? decryptProvisioningSecret(c.passphrase_encrypted) : '', fingerprint: c.host_fingerprint } : null;
}
function serverId(req: AuthenticatedRequest) {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) throw new Error('معرّف الخادم غير صالح.');
  return id;
}
async function readConfig(req: AuthenticatedRequest): Promise<Config> {
  const id = serverId(req), b = req.body || {};
  const [rows]: any = await db.query('SELECT id FROM database_servers WHERE id=? AND archived_at IS NULL', [id]);
  if (!rows.length) throw new Error('الخادم غير موجود.');
  const old = await savedConfig(id);
  const host = String(b.host || '').trim(), port = Number(b.port), username = String(b.username || '').trim();
  if ((!isIP(host) && !/^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(host)) || !Number.isInteger(port) || port < 1 || port > 65535 || !/^[a-z_][a-z0-9_.-]{0,63}$/i.test(username) || !['password', 'key'].includes(b.authMethod)) throw new Error('أكمل عنوان SSH والمنفذ واسم المستخدم وطريقة الدخول.');
  const same = old && old.host === host && old.port === port && old.username === username && old.authMethod === b.authMethod;
  if (b.secret !== undefined && (typeof b.secret !== 'string' || b.secret.length > 32768)) throw new Error('بيانات الدخول غير صالحة.');
  if (b.passphrase !== undefined && (typeof b.passphrase !== 'string' || b.passphrase.length > 512)) throw new Error('عبارة مرور المفتاح غير صالحة.');
  const secret = b.secret || (same ? old.secret : '');
  if (!secret) throw new Error('أدخل كلمة المرور أو المفتاح الخاص.');
  const fingerprint = String(b.fingerprint || '').trim();
  if (fingerprint && !/^SHA256:[A-Za-z0-9+/]{43}$/.test(fingerprint)) throw new Error('بصمة SSH غير صالحة.');
  return { id, host, port, username, authMethod: b.authMethod, secret, passphrase: same && !b.secret && !b.passphrase ? old.passphrase : String(b.passphrase || ''), fingerprint };
}
const hash = (c: Config) => createHmac('sha256', provisioningKey()).update(JSON.stringify(c)).digest('hex');
const hostHash = (key: Buffer) => 'SHA256:' + createHash('sha256').update(key).digest('base64').replace(/=+$/, '');
function options(c: Config, observed?: (value: string) => void) {
  return { host: c.host, port: c.port, username: c.username, readyTimeout: 12000, keepaliveInterval: 15000, keepaliveCountMax: 2,
    ...(c.authMethod === 'password' ? { password: c.secret } : { privateKey: c.secret, passphrase: c.passphrase || undefined }),
    hostVerifier: (key: Buffer) => { const value = hostHash(key); observed?.(value); return Boolean(c.fingerprint) && value === c.fingerprint; } };
}
function errorMessage(e: unknown) {
  const level = (e as any)?.level, code = (e as any)?.code;
  if (level === 'client-authentication') return 'رفض SSH بيانات الدخول؛ تحقق من المستخدم وكلمة المرور أو المفتاح.';
  if (code === 'ECONNREFUSED') return 'منفذ SSH يرفض الاتصال؛ تحقق من خدمة SSH والمنفذ.';
  if (code === 'ENOTFOUND') return 'تعذر العثور على عنوان مخدم SSH.';
  if (code === 'ETIMEDOUT' || level === 'client-timeout') return 'انتهت مهلة الاتصال بمخدم SSH.';
  return 'تعذر إكمال اتصال SSH. تحقق من الشبكة وبيانات الدخول وإعداد الخدمة.';
}
function fail(res: Response, e: unknown) {
  res.status(400).json({ message: e instanceof Error && !('code' in e) && !('level' in e) ? e.message : errorMessage(e) });
}
export async function getSshConnection(req: AuthenticatedRequest, res: Response) {
  res.setHeader('Cache-Control', 'no-store');
  try { const c = await savedConfig(serverId(req)); res.json({ connection: c ? { host: c.host, port: c.port, username: c.username, authMethod: c.authMethod, fingerprint: c.fingerprint, hasSecret: true } : null }); } catch { res.status(503).json({ message: 'تعذر تحميل إعدادات SSH. تحقق من صلاحية إنشاء جدول إعدادات SSH في القاعدة المركزية.' }); }
}
let inspections = 0;
export async function inspectSshConnection(req: AuthenticatedRequest, res: Response) {
  if (inspections >= 4) return res.status(429).json({ message: 'فحوص SSH مشغولة؛ أعد المحاولة بعد قليل.' });
  inspections++;
  const client = new Client(); let observed = '';
  try {
    const c = await readConfig(req);
    await new Promise<void>((resolve, reject) => { client.once('ready', resolve); client.once('error', reject); client.once('close', () => reject(new Error('أغلق المخدم اتصال الفحص.'))); client.connect(options(c, value => { observed = value; })); });
    // A real PTY is required by the terminal, so check shell permission too.
    await new Promise<void>((resolve, reject) => { client.shell({ term: 'xterm-256color', cols: 80, rows: 24 }, (err, stream) => { if (err) return reject(err); stream.on('error', reject); stream.close(); resolve(); }); });
    await writeAuditLog(req, { actionCode: 'UPDATE', entityTypeCode: 'DATABASE_SERVER', entityId: c.id, description: 'نجح فحص اتصال SSH وفتح الطرفية', metadata: { operation: 'ssh_inspect', port: c.port } });
    const verified = jwt.sign({ kind: 'ssh-inspect', admin: req.auth!.accountId, hash: hash(c) }, provisioningKey(), { algorithm: 'HS256', expiresIn: '10m' });
    res.json({ verified, message: 'نجح اتصال SSH وفتح الطرفية. يمكنك حفظ الاتصال.' });
  } catch (e) {
    if (observed && observed !== String(req.body?.fingerprint || '').trim()) res.status(400).json({ fingerprint: observed, message: 'لم يتم اعتماد بصمة المخدم. طابقها مع بصمة المخدم الموثوقة، ثم اعتمدها وأعد الفحص. لم تُرسل بيانات الدخول.' });
    else fail(res, e);
  } finally { client.destroy(); inspections--; }
}
export async function saveSshConnection(req: AuthenticatedRequest, res: Response) {
  try {
    const c = await readConfig(req); let proof: any;
    try { proof = jwt.verify(String(req.body?.verified || ''), provisioningKey(), { algorithms: ['HS256'] }); } catch { throw new Error('افحص اتصال SSH قبل الحفظ.'); }
    if (proof.kind !== 'ssh-inspect' || proof.admin !== req.auth!.accountId || proof.hash !== hash(c)) throw new Error('تغيرت بيانات SSH؛ أعد الفحص قبل الحفظ.');
    const conn = await db.pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(`INSERT INTO server_ssh_connections (database_server_id,host,port,username,auth_method,secret_encrypted,passphrase_encrypted,host_fingerprint) VALUES (?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE host=VALUES(host),port=VALUES(port),username=VALUES(username),auth_method=VALUES(auth_method),secret_encrypted=VALUES(secret_encrypted),passphrase_encrypted=VALUES(passphrase_encrypted),host_fingerprint=VALUES(host_fingerprint)`, [c.id,c.host,c.port,c.username,c.authMethod,encryptProvisioningSecret(c.secret),c.passphrase ? encryptProvisioningSecret(c.passphrase) : null,c.fingerprint]);
      await writeAuditLog(req, { actionCode: 'UPDATE', entityTypeCode: 'DATABASE_SERVER', entityId: c.id, description: 'حفظ اتصال SSH للمخدم بعد التحقق من بصمته', metadata: { operation: 'ssh_save', port: c.port, authMethod: c.authMethod } }, conn);
      await conn.commit();
    } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
    closeServerSessions(c.id);
    let discovery;
    try{discovery=await discoverInstalledRadius(c.id);}catch{discovery={status:'failed',message:'تم حفظ SSH، لكن تعذر اكتشاف FreeRADIUS؛ راجع صلاحيات القراءة والخدمة.'};}
    res.json({ message: 'تم حفظ اتصال SSH بشكل مشفّر.', discovery });
  } catch (e) { fail(res, e); }
}
type Ticket = { adminId: number; serverId: number; expires: number; config?: Config };
const tickets = new Map<string, Ticket>();
const sessions = new Set<{ adminId: number; serverId: number; close: () => void }>();
export function closeAdminSshSessions(adminId: number) { for (const s of Array.from(sessions)) if (s.adminId === adminId) s.close(); for (const [key,t] of Array.from(tickets)) if (t.adminId === adminId) tickets.delete(key); }
function closeServerSessions(id: number) { for (const s of Array.from(sessions)) if (s.serverId === id) s.close(); for (const [key,t] of Array.from(tickets)) if (t.serverId === id) tickets.delete(key); }
export async function createSshTicket(req: AuthenticatedRequest, res: Response) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const id = serverId(req); let config: Config | undefined;
    if (req.body?.verified) {
      config = await readConfig(req);
      let proof: any;
      try { proof = jwt.verify(String(req.body.verified), provisioningKey(), { algorithms: ['HS256'] }); } catch { throw new Error('افحص اتصال SSH قبل فتح الطرفية.'); }
      if (proof.kind !== 'ssh-inspect' || proof.admin !== req.auth!.accountId || proof.hash !== hash(config)) throw new Error('تغيرت بيانات SSH؛ أعد الفحص.');
    } else if (!await savedConfig(id)) throw new Error('أدخل بيانات SSH ثم اتصل بالمخدم.');
    for (const [key, t] of Array.from(tickets)) if (t.expires < Date.now() || t.adminId === req.auth!.accountId) tickets.delete(key);
    if (tickets.size >= 64) throw new Error('الطرفيات مشغولة؛ أعد المحاولة بعد قليل.');
    const ticket = randomBytes(32).toString('base64url'); tickets.set(ticket, { adminId: req.auth!.accountId, serverId: id, expires: Date.now() + 30000, config });
    setTimeout(() => tickets.delete(ticket), 30000).unref();
    res.json({ ticket });
  } catch (e) { fail(res, e); }
}

export function attachSshTerminal(server: Server) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 16384, perMessageDeflate: false });
  server.on('upgrade', (request, socket, head) => {
    if (request.url?.split('?')[0] !== '/api/admin/ssh/terminal') return socket.destroy();
    let payload: any;
    try {
      if (request.headers.origin !== new URL(env.FRONTEND_URL).origin) throw new Error('Origin');
      const cookie = request.headers.cookie?.split(';').map(p => p.trim()).find(p => p.startsWith('token='));
      if (!cookie) throw new Error('Auth');
      payload = jwt.verify(decodeURIComponent(cookie.slice(6)), env.JWT_SECRET, { algorithms: ['HS256'] });
      if (payload.accountType !== 'master_admin' || !Number.isSafeInteger(Number(payload.sub)) || Number(payload.sub) < 1) throw new Error('Role');
    } catch { socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); return socket.destroy(); }
    if (wss.clients.size >= 16) return socket.destroy();
    wss.handleUpgrade(request, socket, head, ws => {
      const client = new Client(); let stream: ClientChannel | undefined, starting = false, closed = false, ready = false;
      let record: { adminId: number; serverId: number; close: () => void } | undefined;
      let lastInput = Date.now(), outputBytes = 0, inputBytes = 0, fingerprintMismatch = false;
      const send = (data: unknown) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data)); };
      const authTimeout = setTimeout(() => close('انتهت مهلة فتح الجلسة.'), 10000);
      const lifetime = setTimeout(() => close('أغلقت الجلسة بعد ساعة. يمكنك فتح جلسة جديدة.'), 60 * 60 * 1000);
      const maintenance = setInterval(() => {
        if (Date.now() - lastInput > 5 * 60 * 1000) return close('أغلقت الجلسة بعد خمس دقائق دون إدخال.');
        if (payload.exp && Date.now() >= payload.exp * 1000) return close('انتهت جلسة تسجيل الدخول.');
        if (ws.bufferedAmount > 1024 * 1024) return close('تعذر مواكبة مخرجات الطرفية؛ أعد الاتصال.');
        outputBytes = 0; inputBytes = 0;
      }, 1000);
      function close(reason = 'تم فصل الجلسة.') {
        if (closed) return; closed = true;
        clearTimeout(authTimeout); clearTimeout(lifetime); clearInterval(maintenance);
        stream?.destroy(); client.destroy(); send({ type: 'closed', message: reason }); ws.close();
        if (record) {
          sessions.delete(record);
          void writeAuditLog(request as AuthenticatedRequest, { actionCode: 'UPDATE', entityTypeCode: 'DATABASE_SERVER', entityId: record.serverId, description: 'إغلاق طرفية SSH', metadata: { operation: 'ssh_close', reason } }).catch(() => console.error('SSH close audit failed'));
        }
      }
      (request as AuthenticatedRequest).auth = { accountId: Number(payload.sub), accountType: 'master_admin', username: payload.username ?? null };
      client.on('error', e => close(fingerprintMismatch ? 'تغيرت بصمة المخدم؛ تحقق منها وأعد فحص اتصال SSH قبل فتح الطرفية.' : errorMessage(e)));
      client.on('close', () => close());
      ws.on('error', () => close()); ws.on('close', () => close());
      ws.on('message', async (raw, binary) => {
        if (closed) return;
        let msg: any; try { if (binary) throw new Error(); msg = JSON.parse(raw.toString()); } catch { return close('رسالة الطرفية غير صالحة.'); }
        if (msg.type === 'connect') {
          if (starting) return close('الجلسة مفتوحة بالفعل.'); starting = true;
          const ticket = tickets.get(String(msg.ticket)); tickets.delete(String(msg.ticket));
          if (!ticket || ticket.expires < Date.now() || ticket.adminId !== Number(payload.sub)) return close('طلب فتح الطرفية غير صالح أو انتهت صلاحيته.');
          if (sessions.size >= 8 || Array.from(sessions).some(s => s.adminId === ticket.adminId)) return close('لديك طرفية مفتوحة، أو بلغ عدد الجلسات الحد المتاح.');
          record = { adminId: ticket.adminId, serverId: ticket.serverId, close: () => close() }; sessions.add(record);
          try {
            const c = ticket.config ?? await savedConfig(ticket.serverId); if (closed) return; if (!c) throw new Error('لم يعد اتصال SSH متاحًا.');
            await writeAuditLog(request as AuthenticatedRequest, { actionCode: 'UPDATE', entityTypeCode: 'DATABASE_SERVER', entityId: c.id, description: 'طلب فتح طرفية SSH للمدير الرئيسي', metadata: { operation: 'ssh_open', port: c.port } });
            if (closed) return;
            client.once('ready', () => {
              client.shell({ term: 'xterm-256color', cols: 80, rows: 24 }, (err, channel) => {
                if (err || closed) { channel?.destroy(); return close('تعذر فتح الطرفية على المخدم.'); }
                stream = channel; ready = true; clearTimeout(authTimeout); send({ type: 'ready' });
                const output = (data: Buffer) => { outputBytes += data.length; if (outputBytes > 512 * 1024 || ws.bufferedAmount > 1024 * 1024) return close('مخرجات الطرفية كبيرة؛ أغلقت الجلسة.'); send({ type: 'output', data: data.toString('base64') }); };
                stream.on('data', output); stream.stderr.on('data', output);
                stream.on('close', () => close()); stream.on('error', () => close('تعذر استمرار الطرفية.'));
              });
            });
            client.connect(options(c, value => { fingerprintMismatch = value !== c.fingerprint; }));
          } catch { close('تعذر فتح جلسة SSH؛ تحقق من إعدادات المخدم وسجل النظام.'); }
        } else if (msg.type === 'disconnect') close();
        else if (msg.type === 'input' && ready && typeof msg.data === 'string' && msg.data.length <= 8192) {
          inputBytes += Buffer.byteLength(msg.data);
          if (inputBytes > 65536 || (stream?.writableLength || 0) > 65536) return close('الإدخال كبير أو المخدم مشغول؛ أعد الاتصال.');
          lastInput = Date.now(); stream?.write(msg.data);
        }
        else if (msg.type === 'resize' && ready && Number.isInteger(msg.cols) && Number.isInteger(msg.rows) && msg.cols >= 20 && msg.cols <= 500 && msg.rows >= 5 && msg.rows <= 200) stream?.setWindow(msg.rows, msg.cols, 0, 0);
        else close('رسالة الطرفية غير صالحة.');
      });
    });
  });
  server.on('close', () => { for (const s of Array.from(sessions)) s.close(); wss.close(); });
}

// Fixed read-only inspection; never accept a shell command from the request.
export async function inspectInstalledRadius(serverId: number) {
  const c = await savedConfig(serverId);
  if (!c) throw new Error('احفظ اتصال SSH موثوقًا لمخدم Ubuntu أولًا.');
  const client = new Client();
  try {
    await new Promise<void>((resolve,reject)=>{client.once('ready',resolve);client.once('error',reject);client.once('close',()=>reject(new Error('انقطع SSH.')));client.connect(options(c));});
    await new Promise<void>((resolve,reject)=>{
      const timer=setTimeout(()=>{client.destroy();reject(new Error('انتهت مهلة فحص FreeRADIUS.'));},20000);
      client.exec('test -x /usr/sbin/freeradius && systemctl is-active --quiet freeradius && sudo -n /usr/sbin/freeradius -C >/dev/null 2>&1', (error,stream)=>{
        if(error){clearTimeout(timer);return reject(error);}
        stream.resume();stream.stderr.resume();
        stream.once('error',(e:Error)=>{clearTimeout(timer);reject(e);});
        stream.once('close',(code:number)=>{clearTimeout(timer);code===0?resolve():reject(new Error('تحقق من وجود FreeRADIUS وتشغيله وصلاحية sudo لفحص إعداداته.'));});
      });
    });
  } finally { client.destroy(); }
}

// Discovery reads public service metadata only, never configuration secrets.
export async function discoverInstalledRadius(serverId:number,add=false){
 const c=await savedConfig(serverId);if(!c)throw new Error('SSH unavailable');
 const client=new Client();
 try{
  await new Promise<void>((resolve,reject)=>{client.once('ready',resolve);client.once('error',reject);client.once('close',()=>reject(new Error('SSH closed')));client.connect(options(c));});
  const output=await new Promise<string>((resolve,reject)=>{
   const timer=setTimeout(()=>{client.destroy();reject(new Error('Discovery timeout'));},15000);
   client.exec('test -x /usr/sbin/freeradius || exit 3; /usr/sbin/freeradius -v 2>/dev/null | head -n 1; systemctl is-active freeradius; systemctl show freeradius --property=FragmentPath --value; exit 0',(error,stream)=>{
    if(error){clearTimeout(timer);reject(error);return;}
    let out='';stream.on('data',(data:Buffer)=>{out+=data.toString();if(out.length>4096){clearTimeout(timer);client.destroy();reject(new Error('Discovery output too large'));}});stream.stderr.resume();
    stream.once('error',(e:Error)=>{clearTimeout(timer);reject(e);});
    stream.once('close',(code:number)=>{clearTimeout(timer);code===0?resolve(out):reject(new Error('FreeRADIUS not installed'));});
   });
  });
  const lines=output.trim().split('\n');
  const discovery={status:'discovered',version:lines[0]??'',serviceState:lines[1]??'unknown',unitPath:lines[2]??'',checkedAt:new Date().toISOString()};
  if(!add)return {...discovery,host:c.host,sshServerId:serverId};
  const key='ssh_server_'+serverId;
  const lock=await db.pool.getConnection();
  try{
   await lock.beginTransaction();
   const [rows]:any=await lock.query("SELECT id,setting_value FROM platform_settings WHERE setting_group='free_radius' AND setting_key=? FOR UPDATE",[key]);
   const old=rows[0]?JSON.parse(rows[0].setting_value):null;
   // Do not infer listening ports or shared secrets from service presence.
   const config=old?{...old,host:c.host,sshServerId:serverId,discovery,lastHealth:null}:{name:'FreeRADIUS — '+c.host,host:c.host,sshServerId:serverId,authPort:1812,accountingPort:1813,testUsername:'',tenantDatabaseId:null,secretEncrypted:null,testPasswordEncrypted:null,discovery,lastHealth:null};
   if(old&&old.host!==c.host){config.secretEncrypted=null;config.testPasswordEncrypted=null;}
   await lock.query("INSERT INTO platform_settings (setting_group,setting_key,setting_value,value_type,is_public) VALUES ('free_radius',?,?,'json',0) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)",[key,JSON.stringify(config)]);
   await lock.commit();
  }catch(e){await lock.rollback();throw e;}finally{lock.release();}
  const infrastructure=await import('./infrastructure-health.service');
  if(await infrastructure.readInfrastructureSelection())void infrastructure.checkInfrastructure().catch(()=>{});
  return {...discovery,host:c.host,sshServerId:serverId};
 }finally{client.destroy();}
}
