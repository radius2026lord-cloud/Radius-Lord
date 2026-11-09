import {isIP} from 'net';
import {encryptProvisioningSecret,decryptProvisioningSecret} from './provisioning-secrets.service';
export type NasLinkMode='direct'|'ovpn';
export function directAddress(value:unknown){
 const address=String(value??'').trim();
 if(isIP(address)!==4||address.startsWith('127.')||Number(address.split('.')[0])===0||Number(address.split('.')[0])>=224)throw new Error('NAS_DIRECT_ADDRESS_INVALID');
 return address;
}
export function validateNasLink(input:any){
 const mode=input?.mode??'ovpn';
 if(mode!=='direct'&&mode!=='ovpn')throw new Error('NAS_LINK_MODE_INVALID');
 if(mode==='ovpn')return {mode:'ovpn'} as const;
 const managementAddress=directAddress(input.managementAddress),radiusAddress=directAddress(input.radiusAddress||managementAddress);
 const apiSourceAddress=directAddress(input.apiSourceAddress),apiPort=Number(input.apiPort??8728);
 const apiUsername=String(input.apiUsername??'').trim(),apiPassword=String(input.apiPassword??'');
 if(!Number.isInteger(apiPort)||apiPort<1||apiPort>65535||!apiUsername||apiUsername.length>64||!apiPassword||apiPassword.length>128||/[^\x21-\x7e]/.test(apiUsername+apiPassword))throw new Error('NAS_DIRECT_CREDENTIALS_INVALID');
 return {mode:'direct',managementAddress,radiusAddress,apiSourceAddress,apiPort,apiUsername,apiPassword} as const;
}
export async function saveEnvironmentNasLink(central:any,scope:{environmentId:number;tenantId:number;subscriptionId:number},input:ReturnType<typeof validateNasLink>){
 const value=input.mode==='direct'?{...input,apiPassword:undefined,apiPasswordEncrypted:encryptProvisioningSecret(input.apiPassword)}:input;
 await central.query("INSERT INTO platform_settings (setting_group,setting_key,setting_value,value_type,is_public) VALUES ('environment_nas_link',?,?,'json',0)",['environment_'+scope.environmentId,JSON.stringify({...scope,...value})]);
}
async function storedEnvironmentNasLink(central:any,job:any){
 const [rows]:any=await central.query("SELECT setting_value FROM platform_settings WHERE setting_group='environment_nas_link' AND setting_key=?",['environment_'+job.environment_id]);
 if(!rows[0])return {mode:'ovpn'};
 const value=typeof rows[0].setting_value==='string'?JSON.parse(rows[0].setting_value):rows[0].setting_value;
 if(Number(value.environmentId)!==Number(job.environment_id)||Number(value.tenantId)!==Number(job.tenant_id)||Number(value.subscriptionId)!==Number(job.subscription_id))throw new Error('NAS_LINK_SCOPE_INVALID');
 if(value.mode!=='direct'&&value.mode!=='ovpn')throw new Error('NAS_LINK_MODE_INVALID');
 return value;
}
export async function readEnvironmentNasMode(central:any,job:any):Promise<NasLinkMode>{
 return (await storedEnvironmentNasLink(central,job)).mode;
}
export async function readEnvironmentNasLink(central:any,job:any){
 const value=await storedEnvironmentNasLink(central,job);
 return validateNasLink({...value,apiPassword:value.mode==='direct'?decryptProvisioningSecret(value.apiPasswordEncrypted):undefined});
}
export const directNasSchema=`CREATE TABLE IF NOT EXISTS nas_direct_connections (
 nas_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
 management_address VARCHAR(45) NOT NULL,
 radius_address VARCHAR(45) NOT NULL,
 api_source_address VARCHAR(45) NOT NULL,
 configuration_snapshot JSON NOT NULL,
 synced_at DATETIME(6) NOT NULL,
 CONSTRAINT fk_nas_direct_lord FOREIGN KEY(nas_id) REFERENCES lord_nas(id)
) ENGINE=InnoDB`;
