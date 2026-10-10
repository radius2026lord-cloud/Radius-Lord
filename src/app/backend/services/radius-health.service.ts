import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { createSocket } from 'dgram';
import { lookup } from 'dns/promises';

const md5 = (value: Buffer) => createHash('md5').update(value).digest();
const attribute = (type: number, value: Buffer) => {
  if (value.length > 253) throw new Error('RADIUS_ATTRIBUTE_TOO_LONG');
  return Buffer.concat([Buffer.from([type, value.length + 2]), value]);
};
const text = (type: number, value: string) => attribute(type, Buffer.from(value));
const number = (type: number, value: number) => { const b = Buffer.alloc(4); b.writeUInt32BE(value); return attribute(type, b); };
function packet(code: number, authenticator: Buffer, attributes: Buffer[]) {
  const body = Buffer.concat(attributes), header = Buffer.alloc(20);
  header[0] = code; header[1] = randomBytes(1)[0]; header.writeUInt16BE(20 + body.length, 2); authenticator.copy(header, 4);
  return Buffer.concat([header, body]);
}
function password(value: string, secret: Buffer, authenticator: Buffer) {
  const source = Buffer.from(value);
  if (!source.length || source.length > 128) throw new Error('RADIUS_PASSWORD_LENGTH');
  const plain = Buffer.alloc(Math.ceil(source.length / 16) * 16); source.copy(plain);
  const result = Buffer.alloc(plain.length); let previous = authenticator;
  for (let start = 0; start < plain.length; start += 16) {
    const hash = md5(Buffer.concat([secret, previous]));
    for (let i = 0; i < 16; i++) result[start+i] = plain[start+i] ^ hash[i];
    previous = result.subarray(start, start+16);
  }
  return result;
}
async function exchange(host: string, port: number, request: Buffer, secret: Buffer, access: boolean) {
  let dnsTimer: NodeJS.Timeout | undefined;
  const address = await Promise.race([lookup(host, { family: 4 }), new Promise<never>((_, reject) => { dnsTimer = setTimeout(()=>reject(new Error('RADIUS_DNS_TIMEOUT')), 3000); })]).finally(()=>clearTimeout(dnsTimer));
  return new Promise<number>((resolve, reject) => {
    const socket = createSocket('udp4'); let finished = false;
    const timer = setTimeout(()=>finish(new Error('RADIUS_TIMEOUT')), 4000);
    function finish(error?: Error, code?: number) {
      if (finished) return; finished = true; clearTimeout(timer);
      try { socket.close(); } catch { /* Socket may not yet be bound. */ }
      if (error) reject(error); else resolve(code!);
    }
    socket.on('error', ()=>finish(new Error('RADIUS_NETWORK_ERROR')));
    socket.on('message', message => {
      if (message.length < 20 || message.length > 4096 || message[1] !== request[1] || message.readUInt16BE(2) !== message.length) return;
      if (!(access ? [2,3,11] : [5]).includes(message[0])) return;
      let messageAuthenticator = -1;
      for (let offset=20; offset<message.length;) {
        if (offset+2>message.length || message[offset+1]<2 || offset+message[offset+1]>message.length) return;
        if (message[offset] === 33) return; // No Proxy-State was sent.
        if (message[offset] === 80) {
          if (message[offset+1]!==18 || messageAuthenticator!==-1) return;
          messageAuthenticator = offset+2;
        }
        offset += message[offset+1];
      }
      const expected = md5(Buffer.concat([message.subarray(0,4), request.subarray(4,20), message.subarray(20), secret]));
      if (!timingSafeEqual(expected, message.subarray(4,20))) return;
      if (access) {
        if (messageAuthenticator === -1) return;
        const signed = Buffer.from(message); request.copy(signed,4,4,20); signed.fill(0,messageAuthenticator,messageAuthenticator+16);
        const signature = createHmac('md5',secret).update(signed).digest();
        if (!timingSafeEqual(signature,message.subarray(messageAuthenticator,messageAuthenticator+16))) return;
      }
      finish(undefined,message[0]);
    });
    socket.connect(port,address.address,()=>{if(!finished)socket.send(request,error=>{if(error)finish(new Error('RADIUS_NETWORK_ERROR'));});});
  });
}
export async function probeRadius(config: { host: string; authPort: number; accountingPort: number; secret: string; testUsername: string; testPassword: string }) {
  const secret = Buffer.from(config.secret), authenticator = randomBytes(16);
  const auth = packet(1,authenticator,[attribute(80,Buffer.alloc(16)),text(1,config.testUsername),attribute(2,password(config.testPassword,secret,authenticator)),text(32,'radius-lord-health'),number(6,2)]);
  createHmac('md5',secret).update(auth).digest().copy(auth,22);
  const code = await exchange(config.host,config.authPort,auth,secret,true);
  if (code !== 2) return { service: 'responding', authentication: code === 3 ? 'rejected' : 'challenge', accounting: 'not_checked', sessionId: null };
  const sessionId = 'rl-health-'+randomBytes(12).toString('hex');
  // A standalone Stop record, never a fabricated active subscriber session.
  const accounting = packet(4,Buffer.alloc(16),[text(1,config.testUsername),text(32,'radius-lord-health'),number(40,2),text(44,sessionId),number(46,0),number(49,1)]);
  md5(Buffer.concat([accounting,secret])).copy(accounting,4);
  try {
    await exchange(config.host,config.accountingPort,accounting,secret,false);
    return { service: 'responding', authentication: 'accepted', accounting: 'acknowledged', sessionId };
  } catch {
    return { service: 'responding', authentication: 'accepted', accounting: 'unavailable', sessionId };
  }
}
