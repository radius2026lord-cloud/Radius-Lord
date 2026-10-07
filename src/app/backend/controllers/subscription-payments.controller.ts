import type { Response } from 'express';
import { db } from '../config/db';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';

export async function listSubscriptionPaymentsController(req:AuthenticatedRequest,res:Response){
  const id=String(req.params.id ?? ''),before=req.query.before;
  const valid=(value:string)=>/^[1-9][0-9]*$/.test(value)&&Number.isSafeInteger(Number(value));
  if(!valid(id)||(before!==undefined&&(typeof before!=='string'||!valid(before))))return res.status(400).json({success:false,message:'رقم الطلب أو مؤشر الصفحة غير صالح.'});
  try{
    const [orders]:any=await db.query('SELECT id,tenant_id,customer_id FROM payment_orders WHERE id=?',[Number(id)]);
    const order=orders[0];
    if(!order)return res.status(404).json({success:false,message:'طلب الاشتراك غير موجود.'});
    // Legacy unlinked orders cannot be grouped by owner: an owner can have multiple networks.
    const scope=order.tenant_id?'p.tenant_id=? AND p.customer_id=?':'p.id=? AND p.customer_id=?';
    const params:any[]=[order.tenant_id || order.id,order.customer_id];
    if(before!==undefined)params.push(Number(before));
    const [rows]:any=await db.query(`SELECT p.id,p.payment_code,p.payment_purpose,p.plan_name_snapshot,p.base_price,p.addons_total,p.total_amount,p.currency_code,p.status,p.requested_at,p.paid_at,m.full_name confirmed_by_name,m.username confirmed_by_username
      FROM payment_orders p LEFT JOIN master_admins m ON m.id=p.confirmed_by_master_admin_id
      WHERE ${scope} ${before!==undefined?'AND p.id<?':''} ORDER BY p.id DESC LIMIT 21`,params);
    const page=rows.slice(0,20);
    return res.json({success:true,scope:order.tenant_id?'network':'order',nextCursor:rows.length>20?page[page.length-1].id:null,payments:page.map((r:any)=>({id:r.id,paymentCode:r.payment_code,purpose:r.payment_purpose,planName:r.plan_name_snapshot,basePrice:String(r.base_price),addonsTotal:String(r.addons_total),totalAmount:String(r.total_amount),currency:r.currency_code,status:r.status,requestedAt:r.requested_at,paidAt:r.paid_at,confirmedBy:r.confirmed_by_name||r.confirmed_by_username||null}))});
  }catch(error){console.error('Subscription payment history failed:',(error as any)?.code || 'UNKNOWN');return res.status(500).json({success:false,message:'تعذر تحميل سجل الدفعات.'});}
}
