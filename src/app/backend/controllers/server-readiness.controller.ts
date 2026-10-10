import {Response} from 'express';
import {AuthenticatedRequest} from '../middleware/auth.middleware';
import {readServerReadiness,checkServerReadiness} from '../services/server-readiness.service';
import {savePrivateSetting} from '../services/radius-provision.service';
import {writeAuditLog} from '../services/audit.service';
export async function getServerReadiness(req:AuthenticatedRequest,res:Response){res.setHeader('Cache-Control','no-store');try{res.json(await readServerReadiness());}catch{res.status(503).json({message:'تعذر قراءة جاهزية الخوادم؛ تحقق من ترحيلات البنية التحتية.'});}}
export async function runServerReadiness(req:AuthenticatedRequest,res:Response){try{void checkServerReadiness().catch(()=>console.warn('Manual server readiness failed.'));res.status(202).json({message:'بدأ فحص الخوادم؛ ستظهر النتائج تلقائيًا.'});}catch{res.status(503).json({message:'تعذر بدء الفحص.'});}}
export async function saveServerReadinessSchedule(req:AuthenticatedRequest,res:Response){const intervalMinutes=Number(req.body?.intervalMinutes);if(![1,5,10,15,30,60].includes(intervalMinutes))return res.status(400).json({message:'اختر فاصل فحص صالحًا.'});try{await savePrivateSetting('server_readiness','schedule',{intervalMinutes});await writeAuditLog(req,{actionCode:'UPDATE',entityTypeCode:'PLATFORM_SETTINGS',description:'تعديل الفحص التلقائي لجاهزية الخوادم',metadata:{intervalMinutes}});res.json({intervalMinutes});}catch{res.status(503).json({message:'تعذر حفظ فاصل الفحص.'});}}
