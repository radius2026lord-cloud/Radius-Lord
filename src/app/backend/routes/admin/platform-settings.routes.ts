import {GitReleaseError,getGitReleases,getHostedGitReleases,inspectGitHosting,prepareGitRelease,sendGitRelease,refreshGitRelease} from '../../services/git-releases.service';
import {requireAuthOrigin} from '../../middleware/auth-origin.middleware';
import type {AuthenticatedRequest} from '../../middleware/auth.middleware';
import {listStagedReleases, ReleaseUploadError, stageRelease} from '../../services/staged-releases.service';
import {db} from '../../config/db';
import {getServerReadiness,runServerReadiness,saveServerReadinessSchedule} from "../../controllers/server-readiness.controller";
import {getInfrastructureHealth,saveInfrastructureSelection,runInfrastructureHealth} from '../../controllers/infrastructure-health.controller';
import {listRadiusServers,saveRadiusServer,radiusServerHealth,discoverRadiusServers,addDiscoveredRadiusServer,setupRadiusServer} from '../../controllers/radius-servers.controller';
import { getLocalHostingSettings, saveLocalHostingSettings } from '../../controllers/local-hosting.controller';
import {listDatabaseServers,inspectDatabaseServer,saveDatabaseServer,databaseServerHealth,setDatabaseServerAdmission} from '../../controllers/database-servers.controller';
import {getSshConnection,inspectSshConnection,saveSshConnection,createSshTicket} from '../../services/ssh-terminal.service';
import { env } from '../../config/env';
import { getOvpnSettings, updateOvpnSettings, inspectOvpnGateway, applyOvpnGateway, getOvpnGatewayHealth, selectOvpnHealthDashboard } from '../../controllers/ovpn-settings.controller';
import { Router } from 'express';
import { getContactPaymentSettingsController, updateContactPaymentSettingsController } from '../../controllers/platform-settings.controller';
import { getMasterUiPreferences, saveMasterUiPreferences } from '../../controllers/ui-preferences.controller';
import { authenticate, requireAccountType } from '../../middleware/auth.middleware';
const router=Router();
router.use(authenticate,requireAccountType('master_admin'));
function gitHandler(work:(req:AuthenticatedRequest)=>Promise<unknown>){
 return async(req:import('express').Request,res:import('express').Response)=>{
  res.set('Cache-Control','no-store');
  try{return res.json(await work(req as AuthenticatedRequest));}
  catch(error){
   return res.status(error instanceof GitReleaseError?error.status:503).json({message:error instanceof GitReleaseError?error.message:'تعذر إكمال عملية الإصدار. حدّث السجل ثم أعد المحاولة.'});
  }
 };
}
router.get('/system-updates/git',gitHandler(async()=>({...await getGitReleases(),hostedReleases:await getHostedGitReleases()})));
router.post('/system-updates/git/inspect',requireAuthOrigin,gitHandler(()=>inspectGitHosting()));
router.post('/system-updates/git/prepare',requireAuthOrigin,gitHandler(req=>prepareGitRelease(req.body,req.auth!.accountId)));
router.post('/system-updates/git/:version/send',requireAuthOrigin,gitHandler(req=>sendGitRelease(String(req.params.version),req.body?.commit)));
router.get('/system-updates/git/:version/status',gitHandler(req=>refreshGitRelease(String(req.params.version))));
router.get('/system-updates', async (_req, res) => {
  try {
    const [networks] = await db.query(
      'SELECT t.id AS tenantId, t.name, d.schema_version AS schemaVersion FROM tenant_databases d JOIN tenants t ON t.id=d.tenant_id WHERE d.status=? AND t.archived_at IS NULL ORDER BY t.id',
      ['active'],
    );
    res.json({
      ...(await listStagedReleases()),
      networks,
      currentVersion: process.env.RADIUS_RELEASE_VERSION || null,
      targetSchemaVersion: process.env.RADIUS_RELEASE_TENANT_SCHEMA_VERSION || null,
    });
  } catch {
    res.status(503).json({message: 'تعذّر تحميل سجل الإصدارات وإصدارات قواعد الشبكات.'});
  }
});
router.post('/system-updates', async (req, res) => {
  if (!req.is('application/octet-stream')) {
    res.status(415).json({message: 'صيغة إرسال الحزمة غير صالحة.'});
    return;
  }
  try {
    const release = await stageRelease(req, req.get('X-Release-Manifest'), req.get('X-Release-Signature'));
    res.status(201).json({release});
  } catch (error) {
    if (error instanceof ReleaseUploadError) {
      res.status(error.status).json({message: error.message});
      return;
    }
    res.status(503).json({message: 'تعذّر حفظ حزمة الإصدار.'});
  }
});
router.get('/ui-preferences',getMasterUiPreferences);
router.put('/ui-preferences',(req,res,next)=>{if(req.headers.origin!==new URL(env.FRONTEND_URL).origin)return res.status(403).json({message:'مصدر الطلب غير مصرح.'});return next();},saveMasterUiPreferences);
router.use('/server-readiness',(req,res,next)=>{
 if(req.method!=='GET'&&req.headers.origin!==new URL(env.FRONTEND_URL).origin)return res.status(403).json({message:'مصدر الطلب غير مصرح.'});
 return next();
});
router.get('/server-readiness',getServerReadiness);
router.post('/server-readiness/check',runServerReadiness);
router.put('/server-readiness/schedule',saveServerReadinessSchedule);

router.get('/infrastructure-health',getInfrastructureHealth);
router.use('/infrastructure-health',(req,res,next)=>{
 if(req.method!=='GET'&&req.headers.origin!==new URL(env.FRONTEND_URL).origin)return res.status(403).json({message:'مصدر طلب فحص البنية التحتية غير مصرح.'});
 return next();
});
router.put('/infrastructure-health',saveInfrastructureSelection);
router.post('/infrastructure-health/check',runInfrastructureHealth);
router.use('/database-servers/:id/ssh', (req,res,next)=>{
 if(req.method==='GET')return next();
 if(req.headers.origin!==new URL(env.FRONTEND_URL).origin)return res.status(403).json({message:'مصدر طلب SSH غير مصرح.'});
 return next();
});
router.get('/database-servers/:id/ssh',getSshConnection);
router.post('/database-servers/:id/ssh/inspect',inspectSshConnection);
router.put('/database-servers/:id/ssh',saveSshConnection);
router.post('/database-servers/:id/ssh/ticket',createSshTicket);
router.get('/database-servers',listDatabaseServers);
router.get('/database-servers/:id/health',databaseServerHealth);
router.put('/database-servers/:id/admission',setDatabaseServerAdmission);
router.post('/database-servers/inspect',inspectDatabaseServer);
router.post('/database-servers/:id/inspect',inspectDatabaseServer);
router.post('/database-servers',saveDatabaseServer);
router.put('/database-servers/:id',saveDatabaseServer);
router.use('/radius-servers',(req,res,next)=>{
 if(req.method!=='GET'&&req.headers.origin!==new URL(env.FRONTEND_URL).origin)return res.status(403).json({message:'مصدر طلب FreeRADIUS غير مصرح.'});
 return next();
});
router.get('/radius-servers',listRadiusServers);
router.post('/radius-servers/discover',discoverRadiusServers);
router.post('/radius-servers/discover/:id/add',addDiscoveredRadiusServer);
router.post('/radius-servers',saveRadiusServer);
router.put('/radius-servers/:id',saveRadiusServer);
router.post('/radius-servers/:id/setup',setupRadiusServer);
router.post('/radius-servers/:id/health',radiusServerHealth);
router.get('/local-hosting',getLocalHostingSettings);
router.put('/local-hosting',(req,res,next)=>{
 if(req.headers.origin!==new URL(env.FRONTEND_URL).origin)return res.status(403).json({message:'مصدر طلب إعدادات الاستضافة غير مصرح.'});
 return next();
},saveLocalHostingSettings);
router.get('/contact-payment',getContactPaymentSettingsController);
router.put('/contact-payment',updateContactPaymentSettingsController);
router.get('/ovpn-gateways',getOvpnSettings);
router.get('/ovpn-gateways/:id/health',getOvpnGatewayHealth);
router.put('/ovpn-gateways/:id/dashboard-health',selectOvpnHealthDashboard);
router.post('/ovpn-gateways/inspect',inspectOvpnGateway);
router.post('/ovpn-gateways/:id/inspect',inspectOvpnGateway);
router.post('/ovpn-gateways/:id/apply',applyOvpnGateway);
router.post('/ovpn-gateways',updateOvpnSettings);
router.put('/ovpn-gateways/:id',updateOvpnSettings);
export default router;
