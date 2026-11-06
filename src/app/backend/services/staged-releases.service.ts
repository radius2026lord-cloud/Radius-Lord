import {createHash, createPublicKey, randomUUID, verify} from 'crypto';
import {createWriteStream} from 'fs';
import {mkdir, readFile, readdir, rename, rm, writeFile} from 'fs/promises';
import {isAbsolute, join} from 'path';
import {Transform, type Readable} from 'stream';
import {pipeline} from 'stream/promises';

const versionPattern = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const maxBytes = 100 * 1024 * 1024;

export class ReleaseUploadError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

function releaseDirectory() {
  const path = process.env.RADIUS_RELEASE_STAGING_DIR;
  return path && isAbsolute(path) ? path : undefined;
}

export async function listStagedReleases() {
  const root = releaseDirectory();
  const uploadEnabled = Boolean(root && process.env.RADIUS_RELEASE_PUBLIC_KEY);
  if (!root) return {uploadEnabled, releases: []};
  const entries = await readdir(root, {withFileTypes: true}).catch(error => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  const releases = await Promise.all(entries
    .filter(entry => entry.isDirectory() && versionPattern.test(entry.name))
    .map(async entry => JSON.parse(await readFile(join(root, entry.name, 'release.json'), 'utf8'))));
  return {uploadEnabled, releases: releases.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))};
}

export async function stageRelease(stream: Readable, manifestHeader?: string, signatureHeader?: string) {
  const root = releaseDirectory();
  const key = process.env.RADIUS_RELEASE_PUBLIC_KEY;
  if (!root || !key) throw new ReleaseUploadError(503, 'رفع الحزم يحتاج إلى ضبط مجلد الإصدارات ومفتاح التحقق على الاستضافة.');
  if (!manifestHeader || manifestHeader.length > 8192 || !signatureHeader || signatureHeader.length > 128) {
    throw new ReleaseUploadError(400, 'أرفق بيان الإصدار وتوقيعه.');
  }

  const manifest = Buffer.from(manifestHeader, 'base64');
  const signature = Buffer.from(signatureHeader, 'base64');
  const publicKey = createPublicKey(key.replace(/\\n/g, '\n'));
  if (publicKey.asymmetricKeyType !== 'ed25519' || !verify(null, manifest, publicKey, signature)) {
    throw new ReleaseUploadError(400, 'توقيع الإصدار غير صالح.');
  }

  let value;
  try { value = JSON.parse(manifest.toString('utf8')); } catch {
    throw new ReleaseUploadError(400, 'بيان الإصدار غير صالح.');
  }
  if (!value || typeof value.version !== 'string' || value.version.length > 32 || !versionPattern.test(value.version) ||
      typeof value.changes !== 'string' || !value.changes.trim() || value.changes.length > 4000 ||
      typeof value.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(value.sha256) ||
      !Number.isSafeInteger(value.bytes) || value.bytes < 1 || value.bytes > maxBytes) {
    throw new ReleaseUploadError(400, 'تحقق من رقم الإصدار وسجل التغييرات وحجم الحزمة.');
  }

  const version = 'v' + value.version.replace(/^v/, '');
  const release = {version, changes: value.changes, sha256: value.sha256, bytes: value.bytes, receivedAt: new Date().toISOString()};
  await mkdir(root, {recursive: true, mode: 0o700});
  const temporary = join(root, '.incoming-' + randomUUID());
  await mkdir(temporary, {mode: 0o700});
  try {
    const hash = createHash('sha256');
    let bytes = 0;
    const meter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        bytes += chunk.length;
        if (bytes > release.bytes) {
          callback(new ReleaseUploadError(413, 'حجم الحزمة يتجاوز الحجم الموقّع.'));
          return;
        }
        hash.update(chunk);
        callback(null, chunk);
      },
    });
    await pipeline(stream, meter, createWriteStream(join(temporary, 'bundle.zip'), {flags: 'wx', mode: 0o600}));
    if (bytes !== release.bytes || hash.digest('hex') !== release.sha256) {
      throw new ReleaseUploadError(400, 'بصمة الحزمة أو حجمها يختلف عن بيان الإصدار.');
    }
    await writeFile(join(temporary, 'release.json'), JSON.stringify(release), {mode: 0o600});
    await writeFile(join(temporary, 'manifest.json'), manifest, {mode: 0o600});
    await writeFile(join(temporary, 'manifest.sig'), signature, {mode: 0o600});
    try {
      await rename(temporary, join(root, version));
    } catch (error) {
      if (['EEXIST', 'ENOTEMPTY'].includes((error as NodeJS.ErrnoException).code || '')) {
        throw new ReleaseUploadError(409, 'رقم الإصدار موجود مسبقًا.');
      }
      throw error;
    }
    return release;
  } finally {
    await rm(temporary, {recursive: true, force: true});
  }
}
