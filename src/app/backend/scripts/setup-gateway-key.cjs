// Run from the backend directory. Never print or replace an existing secret.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const dotenv = require('dotenv');
const filename = path.resolve(__dirname, '../.env');
const text = fs.existsSync(filename) ? fs.readFileSync(filename, 'utf8') : '';
const parsed = dotenv.parse(text);
const inherited = process.env.GATEWAY_ENCRYPTION_KEY;
const existing = inherited || parsed.GATEWAY_ENCRYPTION_KEY;
if (existing) {
 if (!/^[a-f0-9]{64}$/i.test(existing)) { console.error('مفتاح التشفير الموجود غير صالح؛ لم يتم تغييره.'); process.exitCode = 1; }
 else console.log('مفتاح تشفير البوابة موجود؛ تم الإبقاء عليه.');
} else {
 const value = crypto.randomBytes(32).toString('hex');
 const lines = text.split(/\r?\n/).filter(line => !/^\s*(?:export\s+)?GATEWAY_ENCRYPTION_KEY\s*=/.test(line));
 const content = lines.join('\n').replace(/\s*$/, '') + '\nGATEWAY_ENCRYPTION_KEY=' + value + '\n';
 // Exclusive lock prevents concurrent setup commands from creating different keys.
 const lockfile = filename + '.gateway-key.lock';
 let lock;
 try {
  lock = fs.openSync(lockfile, 'wx', 0o600);
  const fresh = fs.existsSync(filename) ? fs.readFileSync(filename, 'utf8') : '';
  if (fresh !== text) throw new Error('changed');
  fs.writeFileSync(filename, content, { mode: 0o600 });
  console.log('تم إنشاء مفتاح التشفير وحفظه في إعدادات الباك إند دون عرضه. أعد تشغيل الباك إند.');
 } catch { console.error('تعذر حفظ مفتاح التشفير؛ تحقق من صلاحية الكتابة ثم أعد المحاولة.'); process.exitCode = 1; }
 finally { if (lock !== undefined) { fs.closeSync(lock); fs.unlinkSync(lockfile); } }
}
