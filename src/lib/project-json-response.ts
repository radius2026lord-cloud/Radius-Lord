// Keep proxy/HTML/plain-text failures out of user-facing JSON parser errors.
export async function readProjectJson(response:Response,fallback:string):Promise<any>{
 let body:any;
 try{body=JSON.parse(await response.text());}catch{
  if(response.status===401||response.status===403)throw Error('تعذر التحقق من الجلسة. أعد تسجيل الدخول ثم حاول مجددًا.');
  if(response.status===413)throw Error('حجم الطلب أكبر من المسموح. قلّل حجم صور القالب ثم أعد المحاولة.');
  if(response.status>=500)throw Error('تعذر إكمال الاتصال بخادم التطبيق. تحقق من تشغيل الباكند ثم أعد المحاولة. لم يتم تأكيد نجاح العملية.');
  throw Error(fallback);
 }
 if(!body||typeof body!=='object'||Array.isArray(body))throw Error(fallback);
 if(!response.ok){const message=typeof body.message==='string'&&body.message.length<=400&&/[\u0600-\u06ff]/.test(body.message)&&!/[<>]/.test(body.message)?body.message:fallback;throw Error(message);}
 return body;
}
export function projectRequestMessage(error:unknown,fallback:string){return error instanceof Error&&/[\u0600-\u06ff]/.test(error.message)?error.message:fallback;}
