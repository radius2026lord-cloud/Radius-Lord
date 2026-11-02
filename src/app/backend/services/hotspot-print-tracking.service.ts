import {withNetwork} from './network-runtime.service';
import {managerAccess} from './network-manager-access.service';

export async function hotspotPrintSummaries(app:any,ids:number[]){
 if(!ids.length)return {available:true,items:[]};
 try{
  const [items]:any=await app.query(`SELECT b.id,
   (SELECT COUNT(*) FROM hotspot_batch_cards bc JOIN hotspot_card_print_marks m ON m.account_id=bc.account_id WHERE bc.batch_id=b.id) printed_count,
   (SELECT MAX(j.confirmed_at) FROM hotspot_card_output_jobs j WHERE j.batch_id=b.id AND j.output_kind='print') last_printed_at,
   (SELECT mgr.full_name FROM hotspot_card_output_jobs j JOIN managers mgr ON mgr.id=j.actor_manager_id WHERE j.batch_id=b.id AND j.output_kind='print' ORDER BY j.confirmed_at DESC,j.id DESC LIMIT 1) last_printed_by,
   (SELECT COUNT(*) FROM hotspot_card_output_jobs j WHERE j.batch_id=b.id AND j.output_kind='pdf') pdf_exports,
   (SELECT MAX(j.confirmed_at) FROM hotspot_card_output_jobs j WHERE j.batch_id=b.id AND j.output_kind='pdf') last_pdf_at
   FROM hotspot_card_batches b WHERE b.id IN (${ids.map(()=>'?').join(',')})`,ids);
  return {available:true,items};
 }catch(e:any){if(e?.code==='ER_NO_SUCH_TABLE')return {available:false,items:[]};throw e;}
}
function invalid():never{throw new Error('HOTSPOT_PRINT_INPUT');}
export async function confirmHotspotBatchOutput(scope:any,input:any){
 const batchId=Number(input?.batchId),requestId=String(input?.requestId||''),kind=input?.kind;
 if(!Number.isSafeInteger(batchId)||batchId<1||!['print','pdf'].includes(kind)||! /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)||!Array.isArray(input?.serials)||!input.serials.length||input.serials.length>1000)invalid();
 const serials:number[]=[...new Set<number>(input.serials.map((v:any)=>{const n=Number(v);if(!Number.isSafeInteger(n)||n<1)invalid();return n;}))].sort((a,b)=>a-b);
 return withNetwork(scope,async app=>{
  const access=await managerAccess(app,scope.managerId,scope.authVersion);if(access.role!=='principal')throw new Error('NETWORK_AUTH');
  await app.beginTransaction();try{
   const [batches]:any=await app.query('SELECT id,name FROM hotspot_card_batches WHERE id=? AND owner_manager_id=? FOR UPDATE',[batchId,scope.managerId]);
   if(!batches[0])throw new Error('HOTSPOT_PRINT_UNAVAILABLE');
   const [cards]:any=await app.query('SELECT account_id,serial_no FROM hotspot_batch_cards WHERE batch_id=? AND owner_manager_id=? ORDER BY serial_no',[batchId,scope.managerId]);
   if(!cards.length||cards.length!==serials.length||cards.some((card:any,index:number)=>Number(card.serial_no)!==serials[index]))invalid();
   const [existing]:any=await app.query('SELECT batch_id,actor_manager_id,output_kind,serials_json FROM hotspot_card_output_jobs WHERE id=?',[requestId]);
   if(existing.length){const stored=typeof existing[0].serials_json==='string'?JSON.parse(existing[0].serials_json):existing[0].serials_json;if(Number(existing[0].batch_id)!==batchId||Number(existing[0].actor_manager_id)!==Number(scope.managerId)||existing[0].output_kind!==kind||JSON.stringify(stored)!==JSON.stringify(serials))throw new Error('HOTSPOT_PRINT_CONFLICT');const summary=await hotspotPrintSummaries(app,[batchId]);await app.commit();return {success:true,duplicate:true,summary:summary.items[0]};}
   await app.query('INSERT INTO hotspot_card_output_jobs(id,batch_id,actor_manager_id,output_kind,card_count,serials_json,confirmed_at) VALUES(?,?,?,?,?,?,UTC_TIMESTAMP(6))',[requestId,batchId,scope.managerId,kind,serials.length,JSON.stringify(serials)]);
   if(kind==='print')await app.query('INSERT INTO hotspot_card_print_marks(account_id,last_job_id,printed_at) VALUES '+cards.map(()=>'(?,?,UTC_TIMESTAMP(6))').join(',')+' ON DUPLICATE KEY UPDATE last_job_id=VALUES(last_job_id),printed_at=UTC_TIMESTAMP(6)',cards.flatMap((c:any)=>[c.account_id,requestId]));
   const [actors]:any=await app.query('SELECT id,full_name FROM managers WHERE id=?',[scope.managerId]);
   await app.query("INSERT INTO activity_log(actor_manager_id,actor_snapshot,actor_kind,action_code,target_type,target_id,after_data,result) VALUES(?,?,'manager',?,'hotspot_batch',?,?,'success')",[scope.managerId,JSON.stringify({id:actors[0]?.id,full_name:actors[0]?.full_name}),kind==='print'?'hotspot.batches.print_confirm':'hotspot.batches.pdf_confirm',batchId,JSON.stringify({batchName:batches[0].name,cardCount:serials.length,outputKind:kind,requestId})]);
   const summary=await hotspotPrintSummaries(app,[batchId]);await app.commit();return {success:true,summary:summary.items[0]};
  }catch(e){await app.rollback();throw e;}
 });
}
