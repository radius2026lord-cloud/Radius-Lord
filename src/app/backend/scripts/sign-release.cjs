const {createHash, createPrivateKey, sign} = require('node:crypto');
const {createReadStream} = require('node:fs');
const {readFile, stat, writeFile} = require('node:fs/promises');

async function main() {
  const [version, archive, changesFile, privateKeyFile] = process.argv.slice(2);
  if (!/^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version || '') || version.length > 32 || !archive || !changesFile || !privateKeyFile) {
    throw new Error('Usage: node scripts/sign-release.cjs vX.Y.Z bundle.zip changes.txt private-key.pem');
  }
  const {size: bytes} = await stat(archive);
  if (!bytes || bytes > 100 * 1024 * 1024) throw new Error('Archive must be between 1 byte and 100 MiB.');
  const changes = (await readFile(changesFile, 'utf8')).trim();
  if (!changes || changes.length > 4000) throw new Error('Release notes must be between 1 and 4000 characters.');
  const key = createPrivateKey(await readFile(privateKeyFile));
  if (key.asymmetricKeyType !== 'ed25519') throw new Error('An Ed25519 signing key is required.');
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(archive)) hash.update(chunk);
  const manifest = Buffer.from(JSON.stringify({version, changes, bytes, sha256: hash.digest('hex')}));
  if (manifest.toString('base64').length > 8192) throw new Error('Release notes exceed the upload header size. Shorten them.');
  await writeFile(archive + '.manifest.json', manifest);
  await writeFile(archive + '.sig', sign(null, manifest, key));
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
