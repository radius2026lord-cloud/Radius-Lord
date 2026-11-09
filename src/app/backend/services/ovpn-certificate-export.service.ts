import {X509Certificate,createPrivateKey,createPublicKey} from 'crypto';
import type {RouterApi} from './routeros-api.service';

// The export command can finish before the file contents are completely readable.
// Only read the exact filenames reserved by the caller; never enumerate private keys.
export async function readExportedOvpnPem(api:RouterApi,name:string,kind:'certificate'|'private-key'){
 for(let attempt=0;attempt<8;attempt++){
  const files=await api.command('/file/print',{'.proplist':'.id,name,size'},['?name='+name]);
  if(files.length>1)throw new Error('OVPN_EXPORT_FILE_AMBIGUOUS');
  if(files[0]){
   if(Number(files[0].size)>4096)throw new Error('OVPN_EXPORT_FILE_TOO_LARGE');
   const value=String((await api.command('/file/get',{'.id':files[0]['.id'],'value-name':'contents'}))[0]?.ret??'').replace(/^\uFEFF/,'').replace(/\r\n/g,'\n');
   if(Buffer.byteLength(value,'utf8')>4096)throw new Error('OVPN_EXPORT_FILE_TOO_LARGE');
   const block=value.match(/-----BEGIN (CERTIFICATE|(?:ENCRYPTED |RSA |EC )?PRIVATE KEY)-----[\s\S]*?-----END \1-----/);
   if(block&&(kind==='certificate'?block[1]==='CERTIFICATE':block[1].endsWith('PRIVATE KEY')))return block[0]+'\n';
  }
  if(attempt<7)await new Promise<void>(resolve=>setTimeout(resolve,250));
 }
 throw new Error('OVPN_EXPORT_FILE_INCOMPLETE');
}

const fingerprint=(value:string)=>value.replace(/[:\s]/g,'').toLowerCase();
export function verifyExportedOvpnCertificate(input:{caPem:string;certPem:string;keyPem:string;passphrase:string;caFingerprint:string;clientFingerprint:string}){
 let authority:X509Certificate,client:X509Certificate;
 const reject=(code:string,diagnostics:Record<string,unknown>={}):never=>{
  // No PEM, private keys, passphrases or raw OpenSSL error messages in logs.
  console.error('[ovpn-certificate-export]',{code,backendNow:new Date().toISOString(),openssl:process.versions.openssl,...diagnostics});
  throw new Error(code);
 };
 try{authority=new X509Certificate(input.caPem);}catch{return reject('OVPN_EXPORT_CA_PARSE_FAILED');}
 try{client=new X509Certificate(input.certPem);}catch{return reject('OVPN_EXPORT_CLIENT_PARSE_FAILED');}
 if(fingerprint(authority.fingerprint256)!==fingerprint(input.caFingerprint))return reject('OVPN_EXPORT_CA_FINGERPRINT_MISMATCH');
 if(fingerprint(client.fingerprint256)!==fingerprint(input.clientFingerprint))return reject('OVPN_EXPORT_CLIENT_FINGERPRINT_MISMATCH');
 let privateKey:ReturnType<typeof createPrivateKey>;
 try{privateKey=createPrivateKey({key:input.keyPem,format:'pem',passphrase:input.passphrase});}
 catch(error){const cryptoCode=String((error as {code?:string})?.code||'UNKNOWN');return reject(cryptoCode==='ERR_OSSL_EVP_UNSUPPORTED'?'OVPN_EXPORT_KEY_CIPHER_UNSUPPORTED':'OVPN_EXPORT_KEY_DECRYPT_FAILED',{cryptoCode:/^[A-Z0-9_]+$/.test(cryptoCode)?cryptoCode:'UNKNOWN'});}
 const publicKey=createPublicKey(privateKey).export({type:'spki',format:'der'}),expected=client.publicKey.export({type:'spki',format:'der'});
 if(!publicKey.equals(expected))return reject('OVPN_EXPORT_PRIVATE_KEY_MISMATCH');
 let verified=false;try{verified=client.verify(authority.publicKey);}catch{/* Fail closed. */}
 if(!verified)return reject('OVPN_EXPORT_SIGNATURE_INVALID');
 const times={clientFrom:client.validFrom,clientTo:client.validTo,authorityFrom:authority.validFrom,authorityTo:authority.validTo};
 const start=[Date.parse(times.clientFrom),Date.parse(times.authorityFrom)],end=[Date.parse(times.clientTo),Date.parse(times.authorityTo)],now=Date.now();
 if([...start,...end].some(time=>!Number.isFinite(time)))return reject('OVPN_EXPORT_CERTIFICATE_DATES_INVALID',times);
 if(start.some(time=>time>now))return reject('OVPN_CERTIFICATE_CLOCK_MISMATCH',times);
 if(end.some(time=>time<=now))return reject('OVPN_EXPORT_CERTIFICATE_EXPIRED',times);
}
