import {readMasterNetworkTunnels,describeMasterNetworkTunnels} from '../services/master-network-tunnels.service';
import {readPrivateSetting,savePrivateSetting} from '../services/radius-provision.service';
import {validLimits} from '../services/subscription-environment.service';
import {Response} from 'express';
import {db} from '../config/db';
import {AuthenticatedRequest} from '../middleware/auth.middleware';

export async function listMasterNetworks(req:AuthenticatedRequest,res:Response){
 res.set('Cache-Control','no-store');
 const id=req.query.networkId;
 if(id!==undefined&&(typeof id!=='string'||!/^\d+$/.test(id)||!Number.isSafeInteger(Number(id))||Number(id)<1))return res.status(400).json({message:'معرّف الشبكة غير صالح.'});
 try{
  const [items]=await db.query(`SELECT t.id,t.name,t.slug,t.status,t.license_number licenseNumber,c.full_name ownerName,
   e.id environmentId,e.status environmentStatus,e.system_url systemUrl,
   d.db_name databaseName,ds.name databaseServerName,
   s.id subscriptionId,s.status subscriptionStatus,s.starts_at startsAt,s.expires_at expiresAt,
   ${id!==undefined?`s.plan_limits_snapshot planLimitsSnapshot,
   (SELECT COALESCE(SUM(a.quantity*a.nas_capacity_increment),0) FROM subscription_addons a WHERE a.tenant_id=t.id AND a.subscription_id=s.id AND a.status='active' AND (a.expires_at IS NULL OR a.expires_at>NOW())) additionalNas,`:''}
   (SELECT po.plan_name_snapshot FROM payment_orders po WHERE po.subscription_id=s.id AND po.tenant_id=t.id ORDER BY po.id DESC LIMIT 1) planName,
   upgrade.setting_value upgradeRequestSnapshot,renewal.setting_value renewalRequestSnapshot,p.setting_value metricsSnapshot,h.reported_at reportedAt,h.last_seen_at lastSeenAt,h.online_users_count onlineUsers,
   h.active_sessions_count activeSessions,h.database_status databaseStatus,h.radius_status radiusStatus
   FROM tenants t LEFT JOIN customers c ON c.id=t.customer_id
   LEFT JOIN tenant_environments e ON e.id=(SELECT MAX(e2.id) FROM tenant_environments e2 WHERE e2.tenant_id=t.id AND e2.archived_at IS NULL AND e2.ready_at IS NOT NULL)
   LEFT JOIN tenant_databases d ON d.id=e.tenant_database_id AND d.tenant_id=t.id
   LEFT JOIN database_servers ds ON ds.id=d.database_server_id
   LEFT JOIN subscriptions s ON s.id=(SELECT MAX(s2.id) FROM subscriptions s2 WHERE s2.tenant_id=t.id AND s2.starts_at IS NOT NULL)
   LEFT JOIN tenant_environment_status h ON h.environment_id=e.id
   LEFT JOIN platform_settings p ON p.setting_group=\'master_network_metrics\' AND p.setting_key=CONCAT(\'tenant_\',t.id)
   LEFT JOIN platform_settings renewal ON renewal.setting_group='subscription_renewal_requests' AND renewal.setting_key=CONCAT('tenant_',t.id)
   LEFT JOIN platform_settings upgrade ON upgrade.setting_group='subscription_upgrade_requests' AND upgrade.setting_key=CONCAT('tenant_',t.id)
   WHERE t.archived_at IS NULL AND e.id IS NOT NULL ${id!==undefined?'AND t.id=?':''} ORDER BY t.id DESC`,id!==undefined?[Number(id)]:[]);
  const [reminderSettings,tunnels]=await Promise.all([
   readSubscriptionReminderSettings(),
   readMasterNetworkTunnels((items as any[]).map(item=>Number(item.environmentId)),id!==undefined),
  ]);
  return res.json({reminderSettings,items:(items as any[]).map(({metricsSnapshot,renewalRequestSnapshot,upgradeRequestSnapshot,planLimitsSnapshot,additionalNas,...item})=>{
   let snapshot:any=null;
   try{snapshot=typeof metricsSnapshot==='string'?JSON.parse(metricsSnapshot):metricsSnapshot;}catch{}
   if(Number(snapshot?.environmentId)!==Number(item.environmentId))snapshot=null;
   let renewalRequest:any=null;try{const request=typeof renewalRequestSnapshot==='string'?JSON.parse(renewalRequestSnapshot):renewalRequestSnapshot;if(request&&request.status==='requested'&&Number(request.subscriptionId)===Number(item.subscriptionId)&&Date.parse(request.expiresAt)===new Date(item.expiresAt).getTime())renewalRequest={status:'requested',requestedAt:request.requestedAt,subscriptionId:request.subscriptionId,expiresAt:request.expiresAt};}catch{}
   let upgradeRequest:any=null;try{const request=typeof upgradeRequestSnapshot==='string'?JSON.parse(upgradeRequestSnapshot):upgradeRequestSnapshot;if(request?.status==='requested'&&Number(request.subscriptionId)===Number(item.subscriptionId))upgradeRequest={requestedAt:request.requestedAt,requestedPppoeLimit:request.requestedPppoeLimit,requestedNasLimit:request.requestedNasLimit,includeRenewal:request.includeRenewal};}catch{}
   const limits=validLimits(planLimitsSnapshot);
   const planLimits=limits?{pppoe:limits.maxSubscribers,nas:limits.maxNas===0?0:limits.maxNas+Number(additionalNas)}:null;
   return {...item,ovpn:describeMasterNetworkTunnels(tunnels,Number(item.environmentId),snapshot?.nasInventory,id!==undefined),planLimits,upgradeRequest,renewalRequest,metrics:snapshot?.metrics??null,metricsReadAt:snapshot?.readAt??null,
    metricsStatus:snapshot?.status??'pending',metricsScope:snapshot?.scope??null,
    metricsStale:!Number.isFinite(Date.parse(snapshot?.readAt??''))||Date.now()-Date.parse(snapshot.readAt)>6*60*1000};
  })});
 }catch(error){console.error('[master-networks]',{code:(error as any)?.code});return res.status(500).json({message:'تعذر تحميل الشبكات.'});}
}

export async function readSubscriptionReminderSettings(){
 const saved=await readPrivateSetting('subscription_notifications','renewal');
 return {expiryDays:Number(saved?.expiryDays)||7};
}
export async function getSubscriptionReminderSettings(_req:AuthenticatedRequest,res:Response){
 try{return res.json(await readSubscriptionReminderSettings());}catch{return res.status(503).json({message:'تعذر تحميل إعداد تنبيه التجديد.'});}
}
export async function saveSubscriptionReminderSettings(req:AuthenticatedRequest,res:Response){
 const expiryDays=Number(req.body?.expiryDays);
 if(!Number.isInteger(expiryDays)||expiryDays<1||expiryDays>90)return res.status(400).json({message:'أدخل عدد أيام من 1 إلى 90.'});
 try{await savePrivateSetting('subscription_notifications','renewal',{expiryDays});return res.json({expiryDays});}catch{return res.status(503).json({message:'تعذر حفظ إعداد تنبيه التجديد.'});}
}


