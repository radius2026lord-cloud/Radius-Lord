import mysql from 'mysql2/promise';
import {db} from '../config/db';
import {decryptProvisioningSecret} from './provisioning-secrets.service';
import {probeRadius} from './radius-health.service';

export async function checkRadiusHealth(c: any) {
  let database: mysql.Connection | undefined;
  try {
    let result: any;
    try { result=await probeRadius({...c,secret:decryptProvisioningSecret(c.secretEncrypted),testPassword:decryptProvisioningSecret(c.testPasswordEncrypted)}); }
    catch { result={service:'unavailable',authentication:'not_checked',accounting:'not_checked',sessionId:null}; }
    let databaseStatus='not_checked';
    if(c.probeDatabasePasswordEncrypted||c.tenantDatabaseId) {
      try {
        let d:any;
        if(c.probeDatabasePasswordEncrypted){
          const [used]:any=await db.query('SELECT id FROM tenant_databases WHERE db_name=? LIMIT 1',[c.probeDatabaseName]);
          if(used[0]||!/^rl_infrastructure_[a-z0-9_]{1,40}$/.test(c.probeDatabaseName))throw new Error('PROBE_DATABASE_SCOPE');
          d={db_name:c.probeDatabaseName};
          database=await mysql.createConnection({host:c.probeDatabaseHost,port:c.probeDatabasePort,user:c.probeDatabaseUsername,password:decryptProvisioningSecret(c.probeDatabasePasswordEncrypted),database:c.probeDatabaseName,connectTimeout:4000,...(c.probeDatabaseTls?{ssl:{rejectUnauthorized:true}}:{})});
        }else{
          const [rows]:any=await db.query("SELECT d.*,s.tls_required,s.tls_ca_reference FROM tenant_databases d JOIN database_servers s ON s.id=d.database_server_id WHERE d.id=? AND d.status='active' AND d.credentials_state='ready' AND s.status='active' AND s.archived_at IS NULL",[c.tenantDatabaseId]);
          d=rows[0];if(!d||d.tls_ca_reference)throw new Error('DATABASE_UNAVAILABLE');
          database=await mysql.createConnection({host:d.db_host,port:d.db_port,user:d.db_username,password:decryptProvisioningSecret(d.app_password_encrypted),database:d.db_name,connectTimeout:4000,...(d.tls_required?{ssl:{rejectUnauthorized:true}}:{})});
        }
        const [scope]:any=await database.query({sql:'SELECT DATABASE() name',timeout:3000});
        if(scope[0]?.name!==d.db_name)throw new Error('DATABASE_SCOPE');
        await database.query({sql:'SELECT id FROM radcheck LIMIT 1',timeout:3000});
        databaseStatus='connected';
        if(result.accounting==='acknowledged'&&result.sessionId) {
          const [records]:any=await database.query({sql:'SELECT radacctid FROM radacct WHERE acctsessionid=? AND username=? AND acctstoptime IS NOT NULL LIMIT 1',timeout:3000},[result.sessionId,c.testUsername]);
          if(records[0]) {databaseStatus='verified';result.accounting='verified';} else result.accounting='record_missing';
        }
      } catch {databaseStatus='unavailable';}
    }
    return {checkedAt:new Date().toISOString(),...result,database:databaseStatus,overall:result.authentication==='accepted'&&result.accounting==='verified'&&databaseStatus==='verified'?'healthy':result.service==='responding'?'degraded':'unavailable'};
  } finally { await database?.end().catch(()=>{}); }
}
