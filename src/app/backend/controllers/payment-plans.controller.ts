import { Response } from 'express';
import { db } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { writeAuditLog } from '../services/audit.service';

const mapPlan=(r:any)=>({id:r.id,name:r.name,durationMonths:r.duration_months,maxTenants:r.max_tenants,maxSubscribers:r.max_subscribers,maxNas:r.max_nas,price:Number(r.price),currency:r.currency,description:r.description,isFeatured:Boolean(r.is_featured),status:r.status,createdAt:r.created_at,updatedAt:r.updated_at});

export async function listPaymentPlansController(req:AuthenticatedRequest,res:Response){
 try{const [rows]=await db.query('SELECT * FROM payment_plans ORDER BY is_featured DESC, id DESC');return res.json({success:true,plans:(rows as any[]).map(mapPlan)});}
 catch(e){console.error('List payment plans error:',e);return res.status(500).json({success:false,message:'تعذر تحميل خطط الاشتراك حاليًا.'});}
}

export async function createPaymentPlanController(req:AuthenticatedRequest,res:Response){
 try{
  const name=String(req.body.name??'').trim(), currency=String(req.body.currency??'USD').trim().toUpperCase(), description=String(req.body.description??'').trim()||null;
  const durationMonths=Number(req.body.durationMonths), maxTenants=Number(req.body.maxTenants), maxSubscribers=Number(req.body.maxSubscribers), maxNas=Number(req.body.maxNas), price=Number(req.body.price);
  const isFeatured=Boolean(req.body.isFeatured), status=String(req.body.status??'active');
  if(!name||name.length>150||!Number.isInteger(durationMonths)||durationMonths<1||![maxTenants,maxSubscribers,maxNas].every(v=>Number.isInteger(v)&&v>=0)||!Number.isFinite(price)||price<0||currency.length>10||!['active','inactive','disabled'].includes(status)) return res.status(400).json({success:false,message:'بيانات الخطة غير صالحة.'});
  const [result]=await db.query('INSERT INTO payment_plans (name,duration_months,max_tenants,max_subscribers,max_nas,price,currency,description,is_featured,status) VALUES (?,?,?,?,?,?,?,?,?,?)',[name,durationMonths,maxTenants,maxSubscribers,maxNas,price,currency,description,isFeatured?1:0,status]);
  const id=(result as any).insertId;
  await writeAuditLog(req,{actionCode:'CREATE',entityTypeCode:'PAYMENT_PLAN',entityId:id,description:`إنشاء خطة اشتراك ${name}`,metadata:{name,durationMonths,maxTenants,maxSubscribers,maxNas,price,currency,status}});
  const [rows]=await db.query('SELECT * FROM payment_plans WHERE id=? LIMIT 1',[id]);
  return res.status(201).json({success:true,message:'تم إنشاء الخطة بنجاح.',plan:mapPlan((rows as any[])[0])});
 }catch(e){console.error('Create payment plan error:',e);return res.status(500).json({success:false,message:'تعذر إنشاء الخطة حاليًا. تأكد من وجود max_tenants و PAYMENT_PLAN في قاموس التدقيق.'});}
}

export async function updatePaymentPlanController(req:AuthenticatedRequest,res:Response){
 try{
  const id=Number(req.params.id); if(!Number.isInteger(id)||id<1)return res.status(400).json({success:false,message:'معرّف الخطة غير صالح.'});
  const [beforeRows]=await db.query('SELECT * FROM payment_plans WHERE id=? LIMIT 1',[id]); const before=(beforeRows as any[])[0]; if(!before)return res.status(404).json({success:false,message:'الخطة غير موجودة.'});
  const name=String(req.body.name??'').trim(), currency=String(req.body.currency??'USD').trim().toUpperCase(), description=String(req.body.description??'').trim()||null;
  const durationMonths=Number(req.body.durationMonths), maxTenants=Number(req.body.maxTenants), maxSubscribers=Number(req.body.maxSubscribers), maxNas=Number(req.body.maxNas), price=Number(req.body.price), isFeatured=Boolean(req.body.isFeatured), status=String(req.body.status??'active');
  if(!name||!Number.isInteger(durationMonths)||durationMonths<1||![maxTenants,maxSubscribers,maxNas].every(v=>Number.isInteger(v)&&v>=0)||!Number.isFinite(price)||price<0||!['active','inactive','disabled'].includes(status))return res.status(400).json({success:false,message:'بيانات الخطة غير صالحة.'});
  await db.query('UPDATE payment_plans SET name=?,duration_months=?,max_tenants=?,max_subscribers=?,max_nas=?,price=?,currency=?,description=?,is_featured=?,status=? WHERE id=?',[name,durationMonths,maxTenants,maxSubscribers,maxNas,price,currency,description,isFeatured?1:0,status,id]);
  await writeAuditLog(req,{actionCode:'UPDATE',entityTypeCode:'PAYMENT_PLAN',entityId:id,description:`تعديل خطة الاشتراك #${id}`,metadata:{before:mapPlan(before),after:{name,durationMonths,maxTenants,maxSubscribers,maxNas,price,currency,description,isFeatured,status}}});
  const [rows]=await db.query('SELECT * FROM payment_plans WHERE id=? LIMIT 1',[id]); return res.json({success:true,message:'تم تحديث الخطة بنجاح.',plan:mapPlan((rows as any[])[0])});
 }catch(e){console.error('Update payment plan error:',e);return res.status(500).json({success:false,message:'تعذر تحديث الخطة حاليًا.'});}
}