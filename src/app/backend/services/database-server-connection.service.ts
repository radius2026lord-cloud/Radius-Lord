import type {ConnectionOptions} from 'mysql2/promise';
import {decryptProvisioningSecret} from './provisioning-secrets.service';
export function provisioningDatabaseOptions(server:any):ConnectionOptions{
 if(server.tls_ca_reference)throw new Error('CUSTOM_CA_NOT_SUPPORTED_YET');
 return {host:server.host,port:Number(server.port),user:server.provisioning_username,password:decryptProvisioningSecret(server.provisioning_password_encrypted),connectTimeout:10000,...(server.tls_required?{ssl:{rejectUnauthorized:true}}:{})};
}
