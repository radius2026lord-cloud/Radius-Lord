import net from 'net';
import tls from 'tls';

export type ApiConnection = { host: string; port: number; username: string; password: string; secure: boolean };
export type RouterRow = Record<string,string>;
// Native RouterOS sentence API; commands are sequential and never evaluated as scripts.
export class RouterApi {
 private socket!: net.Socket;
 private buffer=Buffer.alloc(0);
 private words:string[]=[];
 private pending?: { resolve:(rows:RouterRow[])=>void; reject:(e:Error)=>void; rows:RouterRow[]; timer:ReturnType<typeof setTimeout>; failure?:Error };
 private closed=false;
 static async connect(config:ApiConnection) {
  const api=new RouterApi();
  await new Promise<void>((resolve,reject)=>{
   const timer=setTimeout(()=>{api.socket?.destroy();reject(new Error('تعذر الاتصال بالخادم خلال المهلة المحددة.'));},10000);
   const ready=()=>{clearTimeout(timer);resolve();};
   api.socket=config.secure ? tls.connect({host:config.host,port:config.port,servername:net.isIP(config.host)?undefined:config.host,rejectUnauthorized:true},ready) : net.createConnection({host:config.host,port:config.port},ready);
   api.socket.once('error',()=>{clearTimeout(timer);reject(new Error('تعذر اتصال API. تحقق من العنوان والمنفذ وشهادة TLS.'));});
   api.socket.on('data',(data:Buffer)=>api.receive(data));
   api.socket.on('error',()=>api.fail(new Error('انقطع اتصال API.')));
   api.socket.on('close',()=>{api.closed=true;api.fail(new Error('أغلق الخادم اتصال API.'));});
  });
  try {await api.command('/login',{name:config.username,password:config.password});return api;} catch {api.close();throw new Error('فشل تسجيل الدخول إلى API. تحقق من بيانات الدخول والصلاحيات.');}
 }
 private fail(e:Error){if(this.pending){clearTimeout(this.pending.timer);this.pending.reject(e);this.pending=undefined;}}
 private receive(data:Buffer){
  this.buffer=Buffer.concat([this.buffer,data]);
  if(this.buffer.length>4*1024*1024){this.fail(new Error('استجابة API تتجاوز الحجم المسموح.'));this.close();return;}
  try {while(this.buffer.length){
   const c=this.buffer[0]; let bytes:number,len:number;
   if(c<0x80){bytes=1;len=c;}else if(c<0xc0){bytes=2;if(this.buffer.length<bytes)return;len=((c&0x3f)<<8)|this.buffer[1];}else if(c<0xe0){bytes=3;if(this.buffer.length<bytes)return;len=((c&0x1f)<<16)|(this.buffer[1]<<8)|this.buffer[2];}else if(c<0xf0){bytes=4;if(this.buffer.length<bytes)return;len=((c&0xf)<<24)|(this.buffer[1]<<16)|(this.buffer[2]<<8)|this.buffer[3];}else if(c===0xf0){bytes=5;if(this.buffer.length<bytes)return;len=this.buffer.readUInt32BE(1);}else throw new Error('صيغة API غير مدعومة.');
   if(len>1024*1024)throw new Error('كلمة API تتجاوز الحجم المسموح.');
   if(this.buffer.length<bytes+len)return;
   const word=this.buffer.subarray(bytes,bytes+len).toString('utf8');this.buffer=this.buffer.subarray(bytes+len);
   if(len){this.words.push(word);if(this.words.length>1000)throw new Error('استجابة API غير صالحة.');}else{this.sentence(this.words);this.words=[];}
  }} catch(e){this.fail(e as Error);this.close();}
 }
 private sentence(words:string[]){
  const p=this.pending;if(!p)return;
  const row:RouterRow={};for(const word of words.slice(1)){if(word.startsWith('=')){const at=word.indexOf('=',1);if(at>0)row[word.slice(1,at)]=word.slice(at+1);}}
  if(words[0]==='!re'){p.rows.push(row);if(p.rows.length>10000){this.fail(new Error('عدد نتائج API كبير جدًا.'));this.close();}}
  // Never expose router error text: it may contain secrets or client-controlled content.
  if(words[0]==='!trap'||words[0]==='!fatal')p.failure=new Error('رفض MikroTik الأمر. تحقق من الصلاحيات والإعدادات المحددة.');
  if(words[0]==='!done'){clearTimeout(p.timer);this.pending=undefined;if(p.failure)p.reject(p.failure);else p.resolve(p.rows);}
  if(words[0]==='!fatal'){this.fail(p.failure!);this.close();}
 }
 command(path:string,attrs:Record<string,string>={},queries:string[]=[],timeout=15000):Promise<RouterRow[]>{
  if(this.closed)return Promise.reject(new Error('اتصال API مغلق.'));
  if(this.pending)return Promise.reject(new Error('أمر API آخر قيد التنفيذ.'));
  const words=[path,...Object.entries(attrs).map(([k,v])=>`=${k}=${v}`),...queries];
  const encode=(s:string)=>{const b=Buffer.from(s),n=b.length;let h:Buffer;if(n<0x80)h=Buffer.from([n]);else if(n<0x4000)h=Buffer.from([(n>>8)|0x80,n&255]);else if(n<0x200000)h=Buffer.from([(n>>16)|0xc0,(n>>8)&255,n&255]);else throw new Error('أمر API كبير جدًا.');return Buffer.concat([h,b]);};
  return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.fail(new Error('انتهت مهلة أمر API؛ أعد الفحص قبل إعادة المحاولة.'));this.close();},timeout);this.pending={resolve,reject,timer,rows:[]};try{this.socket.write(Buffer.concat([...words.map(encode),Buffer.from([0])]));}catch{this.fail(new Error('تعذر إرسال أمر API.'));this.close();}});
 }
 close(){this.closed=true;this.socket?.destroy();}
}
