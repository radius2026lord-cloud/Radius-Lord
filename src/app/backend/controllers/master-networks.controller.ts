import {Response} from 'express';
import {db} from '../config/db';
import {AuthenticatedRequest} from '../middleware/auth.middleware';

export async function listMasterNetworks(_req:AuthenticatedRequest,res:Response){
 res.set('Cache-Control','no-store');
 try{
  const [items]=await db.query(`SELECT t.id,t.name,t.slug,t.status,t.license_number licenseNumber,c.full_name ownerName,
   e.id environmentId,e.status environmentStatus,e.system_url systemUrl,
   d.db_name databaseName,ds.name databaseServerName,
   s.status subscriptionStatus,s.expires_at expiresAt,
   h.reported_at reportedAt,h.last_seen_at lastSeenAt,h.online_users_count onlineUsers,
   h.active_sessions_count activeSessions,h.database_status databaseStatus,h.radius_status radiusStatus
   FROM tenants t LEFT JOIN customers c ON c.id=t.customer_id
   LEFT JOIN tenant_environments e ON e.id=(SELECT MAX(e2.id) FROM tenant_environments e2 WHERE e2.tenant_id=t.id AND e2.archived_at IS NULL)
   LEFT JOIN tenant_databases d ON d.id=e.tenant_database_id AND d.tenant_id=t.id
   LEFT JOIN database_servers ds ON ds.id=d.database_server_id
   LEFT JOIN subscriptions s ON s.id=(SELECT MAX(s2.id) FROM subscriptions s2 WHERE s2.tenant_id=t.id)
   LEFT JOIN tenant_environment_status h ON h.environment_id=e.id
   WHERE t.archived_at IS NULL ORDER BY t.id DESC`);
  return res.json({items});
 }catch(error){console.error('[master-networks]',{code:(error as any)?.code});return res.status(500).json({message:'تعذر تحميل الشبكات.'});}
}
