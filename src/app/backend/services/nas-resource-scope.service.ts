export type NasResourceScope={tenant_id:number;environment_id:number;subscription_id:number};
const positive=(value:unknown)=>Number.isSafeInteger(Number(value))&&Number(value)>0;
export function assertNasResourceScope(snapshot:any,scope:NasResourceScope,nasId?:number){
 if(!snapshot||!positive(scope.tenant_id)||!positive(scope.environment_id)||!positive(scope.subscription_id)||
  Number(snapshot.tenantId)!==Number(scope.tenant_id)||Number(snapshot.environmentId)!==Number(scope.environment_id)||Number(snapshot.subscriptionId)!==Number(scope.subscription_id)||
  snapshot.deployment!=='shared_cloud'||nasId!==undefined&&!positive(nasId))throw new Error('NAS_SNAPSHOT_SCOPE');
 if(snapshot.connectionMode!=='direct'&&!positive(snapshot.gatewayId))throw new Error('NAS_SNAPSHOT_SCOPE');
}
export function nasResourceTag(environmentId:number,nasId:number,suffix=''){
 if(!positive(environmentId)||!positive(nasId))throw new Error('NAS_SNAPSHOT_SCOPE');
 return `Lord_Rdius-Cloud | ENV-${Number(environmentId)} | NAS-${Number(nasId)}`+(suffix?' | '+suffix:'');
}
export function nasRelayTags(environmentId:number,nasId:number){
 return [nasResourceTag(environmentId,nasId,'API-Relay'),`Lord_Radius_API_Relay_${Number(environmentId)}_${Number(nasId)}`];
}
