import { Response } from 'express';
import { db } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { writeAuditLog } from '../services/audit.service';

const mapOption=(r:any)=>({id:r.option_id,deploymentTypeId:r.deployment_type_id,code:r.deployment_code,nameAr:r.deployment_name_ar,nameEn:r.deployment_name_en,description:r.deployment_description,price:Number(r.option_price),isDefault:Boolean(r.is_default),status:r.option_status});
const mapAddon=(r:any)=>({id:r.id,planId:r.plan_id,deploymentTypeId:r.deployment_type_id,code:r.code,nameAr:r.name_ar,nameEn:r.name_en,description:r.description,price:Number(r.price),status:r.status});
const mapPlan=(r:any,options:any[]=[])=>({id:r.id,name:r.name,durationMonths:r.duration_months,maxTenants:r.max_tenants,maxSubscribers:r.max_subscribers,maxNas:r.max_nas,price:Number(options.find((o:any)=>o.isDefault)?.price??options[0]?.price??r.price??0),currencyId:r.currency_id,currency:r.currency_code??r.currency,currencyNameAr:r.currency_name_ar??null,currencySymbol:r.currency_symbol??null,description:r.description,isFeatured:Boolean(r.is_featured),status:r.status,createdAt:r.created_at,updatedAt:r.updated_at,deploymentOptions:options});

const basePlanSql=`SELECT p.*,c.code currency_code,c.name_ar currency_name_ar,c.symbol currency_symbol
 FROM payment_plans p LEFT JOIN currencies c ON c.id=p.currency_id`;
async function loadOptions(planIds:number[]){
 if(!planIds.length)return new Map<number,any[]>();
 const marks=planIds.map(()=>'?').join(',');
 const [rows]=await db.query(`SELECT o.plan_id,o.id option_id,o.deployment_type_id,o.price option_price,o.is_default,o.status option_status,
 dt.code deployment_code,dt.name_ar deployment_name_ar,dt.name_en deployment_name_en,dt.description deployment_description
 FROM plan_deployment_options o JOIN deployment_types dt ON dt.id=o.deployment_type_id
 WHERE o.plan_id IN (${marks}) ORDER BY o.is_default DESC,dt.sort_order,o.id`,planIds);
 const map=new Map<number,any[]>(); for(const r of rows as any[]){const list=map.get(r.plan_id)??[];list.push(mapOption(r));map.set(r.plan_id,list)} return map;
}
async function loadAddons(planIds:number[]){
 if(!planIds.length)return new Map<number,any[]>();
 const marks=planIds.map(()=>'?').join(',');
 const [rows]=await db.query(`SELECT * FROM plan_addons WHERE plan_id IN (${marks}) AND status='active' ORDER BY sort_order,id`,planIds);
 const map=new Map<number,any[]>();for(const r of rows as any[]){const list=map.get(r.plan_id)??[];list.push(mapAddon(r));map.set(r.plan_id,list)}return map;
}
async function plansFromRows(rows:any[]){const ids=rows.map(r=>Number(r.id));const [options,addons]=await Promise.all([loadOptions(ids),loadAddons(ids)]);return rows.map(r=>({...mapPlan(r,options.get(Number(r.id))??[]),addons:addons.get(Number(r.id))??[]}));}

export async function listCurrenciesController(req:AuthenticatedRequest,res:Response){try{const [rows]=await db.query("SELECT id,code,name_ar nameAr,name_en nameEn,symbol,status FROM currencies WHERE status='active' ORDER BY sort_order,id");return res.json({success:true,currencies:rows});}catch(e){console.error(e);return res.status(500).json({success:false,message:'تعذر تحميل العملات.'});}}
export async function listDeploymentTypesController(req:AuthenticatedRequest,res:Response){try{const [rows]=await db.query("SELECT id,code,name_ar nameAr,name_en nameEn,description,status FROM deployment_types WHERE status='active' ORDER BY sort_order,id");return res.json({success:true,deploymentTypes:rows});}catch(e){console.error(e);return res.status(500).json({success:false,message:'تعذر تحميل أنواع الاستضافة.'});}}

export async function listActivePaymentPlansController(req:AuthenticatedRequest,res:Response){
 try{const [rows]=await db.query(basePlanSql+" WHERE p.status='active' ORDER BY p.is_featured DESC,p.id DESC");return res.json({success:true,plans:await plansFromRows(rows as any[])});}
 catch(e){console.error("List active payment plans error:",e);return res.status(500).json({success:false,message:"تعذر تحميل الخطط المتاحة حاليًا."});}
}
export async function listPaymentPlansController(req:AuthenticatedRequest,res:Response){
 try{const [rows]=await db.query(basePlanSql+' ORDER BY p.is_featured DESC,p.id DESC');return res.json({success:true,plans:await plansFromRows(rows as any[])});}
 catch(e){console.error('List payment plans error:',e);return res.status(500).json({success:false,message:'تعذر تحميل خطط الاشتراك حاليًا.'});}
}
export async function getPaymentPlanController(req:AuthenticatedRequest,res:Response){
 try{const id=Number(req.params.id);if(!Number.isInteger(id)||id<1)return res.status(400).json({success:false,message:'معرّف الخطة غير صالح.'});const [rows]=await db.query(basePlanSql+' WHERE p.id=? LIMIT 1',[id]);const row=(rows as any[])[0];if(!row)return res.status(404).json({success:false,message:'الخطة غير موجودة.'});const [options,addons]=await Promise.all([loadOptions([id]),loadAddons([id])]);return res.json({success:true,plan:{...mapPlan(row,options.get(id)??[]),addons:addons.get(id)??[]}});}
 catch(e){console.error('Get payment plan error:',e);return res.status(500).json({success:false,message:'تعذر تحميل الخطة حاليًا.'});}
}
function normalizeBody(body:any){
 const name=String(body.name??'').trim(),description=String(body.description??'').trim()||null,status=String(body.status??'active');
 const durationMonths=Number(body.durationMonths),maxTenants=Number(body.maxTenants),maxSubscribers=Number(body.maxSubscribers),maxNas=Number(body.maxNas),currencyId=Number(body.currencyId);
 const deploymentOptions=Array.isArray(body.deploymentOptions)?body.deploymentOptions.map((o:any)=>({deploymentTypeId:Number(o.deploymentTypeId),price:Number(o.price),isDefault:Boolean(o.isDefault),status:String(o.status??'active')})):[];
 const addons=Array.isArray(body.addons)?body.addons.map((a:any)=>({deploymentTypeId:Number(a.deploymentTypeId),code:String(a.code??'').trim(),nameAr:String(a.nameAr??'').trim(),nameEn:String(a.nameEn??'').trim(),description:String(a.description??'').trim()||null,price:Number(a.price),status:String(a.status??'active')})):[];
 return {name,description,status,durationMonths,maxTenants,maxSubscribers,maxNas,currencyId,deploymentOptions,addons,isFeatured:Boolean(body.isFeatured)};
}
function validPlan(x:any){const optionIds=x.deploymentOptions.map((o:any)=>o.deploymentTypeId);const addonKeys=x.addons.map((a:any)=>`${a.deploymentTypeId}:${a.code}`);return x.name&&x.name.length<=150&&Number.isInteger(x.durationMonths)&&x.durationMonths>=1&&[x.maxTenants,x.maxSubscribers,x.maxNas].every((v:number)=>Number.isInteger(v)&&v>=0)&&Number.isInteger(x.currencyId)&&x.currencyId>0&&['active','inactive','disabled'].includes(x.status)&&x.deploymentOptions.length>0&&new Set(optionIds).size===optionIds.length&&x.deploymentOptions.every((o:any)=>Number.isInteger(o.deploymentTypeId)&&o.deploymentTypeId>0&&Number.isFinite(o.price)&&o.price>=0&&['active','inactive'].includes(o.status))&&new Set(addonKeys).size===addonKeys.length&&x.addons.every((a:any)=>Number.isInteger(a.deploymentTypeId)&&optionIds.includes(a.deploymentTypeId)&&a.code&&a.code.length<=60&&a.nameAr&&a.nameAr.length<=150&&a.nameEn&&a.nameEn.length<=150&&Number.isFinite(a.price)&&a.price>=0&&['active','inactive'].includes(a.status));}
async function saveOptions(planId:number,options:any[]){await db.query('DELETE FROM plan_deployment_options WHERE plan_id=?',[planId]);for(let i=0;i<options.length;i++){const o=options[i];await db.query('INSERT INTO plan_deployment_options (plan_id,deployment_type_id,price,is_default,status) VALUES (?,?,?,?,?)',[planId,o.deploymentTypeId,o.price,(o.isDefault||(!options.some((x:any)=>x.isDefault)&&i===0))?1:0,o.status]);}}
async function saveAddons(planId:number,addons:any[]){await db.query('DELETE FROM plan_addons WHERE plan_id=?',[planId]);for(let i=0;i<addons.length;i++){const a=addons[i];await db.query('INSERT INTO plan_addons (plan_id,deployment_type_id,code,name_ar,name_en,description,price,status,sort_order) VALUES (?,?,?,?,?,?,?,?,?)',[planId,a.deploymentTypeId,a.code,a.nameAr,a.nameEn,a.description,a.price,a.status,i]);}}
export async function createPaymentPlanController(req:AuthenticatedRequest,res:Response){
 try{await ensurePaymentPlanAuditEntity();const x=normalizeBody(req.body);if(!validPlan(x))return res.status(400).json({success:false,message:'بيانات الخطة أو خيارات الاستضافة غير صالحة.'});
 const [cur]=await db.query('SELECT code FROM currencies WHERE id=? AND status=\'active\' LIMIT 1',[x.currencyId]);const currency=(cur as any[])[0];if(!currency)return res.status(400).json({success:false,message:'العملة غير صالحة.'});
 const defaultPrice=x.deploymentOptions.find((o:any)=>o.isDefault)?.price??x.deploymentOptions[0].price;
 const [result]=await db.query('INSERT INTO payment_plans (name,duration_months,max_tenants,max_subscribers,max_nas,price,currency,currency_id,description,is_featured,status) VALUES (?,?,?,?,?,?,?,?,?,?,?)',[x.name,x.durationMonths,x.maxTenants,x.maxSubscribers,x.maxNas,defaultPrice,currency.code,x.currencyId,x.description,x.isFeatured?1:0,x.status]);const id=(result as any).insertId;await saveOptions(id,x.deploymentOptions);await saveAddons(id,x.addons);
 await writeAuditLog(req,{actionCode:'CREATE',entityTypeCode:'PAYMENT_PLAN',entityId:id,description:`إنشاء خطة اشتراك ${x.name}`,metadata:x});const [rows]=await db.query(basePlanSql+' WHERE p.id=? LIMIT 1',[id]);const [opts,addons]=await Promise.all([loadOptions([id]),loadAddons([id])]);return res.status(201).json({success:true,message:'تم إنشاء الخطة بنجاح.',plan:{...mapPlan((rows as any[])[0],opts.get(id)??[]),addons:addons.get(id)??[]}});
 }catch(e){console.error('Create payment plan error:',e);return res.status(500).json({success:false,message:'تعذر إنشاء الخطة حاليًا.'});}}
export async function updatePaymentPlanController(req:AuthenticatedRequest,res:Response){
 try{await ensurePaymentPlanAuditEntity();const id=Number(req.params.id);if(!Number.isInteger(id)||id<1)return res.status(400).json({success:false,message:'معرّف الخطة غير صالح.'});const [beforeRows]=await db.query(basePlanSql+' WHERE p.id=? LIMIT 1',[id]);const before=(beforeRows as any[])[0];if(!before)return res.status(404).json({success:false,message:'الخطة غير موجودة.'});
 const [existingOptions,existingAddons]=await Promise.all([loadOptions([id]),loadAddons([id])]);const legacyOptions=(existingOptions.get(id)??[]).map((o:any)=>({deploymentTypeId:o.deploymentTypeId,price:o.price,isDefault:o.isDefault,status:o.status}));const legacyAddons=(existingAddons.get(id)??[]).map((a:any)=>({deploymentTypeId:a.deploymentTypeId,code:a.code,nameAr:a.nameAr,nameEn:a.nameEn,description:a.description,price:a.price,status:a.status}));const x=normalizeBody({...req.body,currencyId:req.body.currencyId??before.currency_id,deploymentOptions:Array.isArray(req.body.deploymentOptions)?req.body.deploymentOptions:legacyOptions,addons:Array.isArray(req.body.addons)?req.body.addons:legacyAddons});if(!validPlan(x))return res.status(400).json({success:false,message:'بيانات الخطة أو خيارات الاستضافة غير صالحة.'});const [cur]=await db.query("SELECT code FROM currencies WHERE id=? AND status='active' LIMIT 1",[x.currencyId]);const currency=(cur as any[])[0];if(!currency)return res.status(400).json({success:false,message:'العملة غير صالحة.'});const defaultPrice=x.deploymentOptions.find((o:any)=>o.isDefault)?.price??x.deploymentOptions[0].price;
 await db.query('UPDATE payment_plans SET name=?,duration_months=?,max_tenants=?,max_subscribers=?,max_nas=?,price=?,currency=?,currency_id=?,description=?,is_featured=?,status=? WHERE id=?',[x.name,x.durationMonths,x.maxTenants,x.maxSubscribers,x.maxNas,defaultPrice,currency.code,x.currencyId,x.description,x.isFeatured?1:0,x.status,id]);await saveOptions(id,x.deploymentOptions);await saveAddons(id,x.addons);
 await writeAuditLog(req,{actionCode:'UPDATE',entityTypeCode:'PAYMENT_PLAN',entityId:id,description:`تعديل خطة الاشتراك #${id}`,metadata:{before:mapPlan(before),after:x}});const [rows]=await db.query(basePlanSql+' WHERE p.id=? LIMIT 1',[id]);const [opts,addons]=await Promise.all([loadOptions([id]),loadAddons([id])]);return res.json({success:true,message:'تم تحديث الخطة بنجاح.',plan:{...mapPlan((rows as any[])[0],opts.get(id)??[]),addons:addons.get(id)??[]}});
 }catch(e){console.error('Update payment plan error:',e);return res.status(500).json({success:false,message:'تعذر تحديث الخطة حاليًا.'});}}
async function ensurePaymentPlanAuditEntity(){await db.query(`INSERT INTO audit_entity_types (code,name_ar,name_en,description,is_active) VALUES ('PAYMENT_PLAN','خطة اشتراك','Payment Plan','خطط اشتراكات Radius Lord',1) ON DUPLICATE KEY UPDATE name_ar=VALUES(name_ar),name_en=VALUES(name_en),description=VALUES(description),is_active=1`);}
