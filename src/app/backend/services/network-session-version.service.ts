import {randomUUID} from 'crypto';
import {db} from '../config/db';
export async function networkSessionVersion(scope:any,managerId:number){
 const [rows]:any=await db.query("SELECT setting_value FROM platform_settings WHERE setting_group='network_session_versions' AND setting_key=?",['manager_'+scope.environment_id+'_'+managerId]);return rows[0]?.setting_value||'0';
}
export async function invalidateNetworkManager(central:any,scope:any,managerId:number){await central.query("INSERT INTO platform_settings(setting_group,setting_key,setting_value) VALUES('network_session_versions',?,?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)",['manager_'+scope.environment_id+'_'+managerId,randomUUID()]);}
