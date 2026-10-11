import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {createHash} from 'crypto';
import {db} from '../config/db';
import {env} from '../config/env';
import {networkScope,validateLocalLicense,withNetwork} from './network-runtime.service';

// Locate the provisioned principal by its central directory, but verify the
// current password and license in the isolated network database.
export async function loginNetworkPrincipal(username:string,password:string){
 const [rows]:any=await db.query(`SELECT t.slug FROM tenants t
 JOIN tenant_environments e ON e.tenant_id=t.id
 JOIN subscription_licenses l ON l.tenant_id=t.id AND l.status='active'
 JOIN subscriptions s ON s.id=l.subscription_id AND s.tenant_id=t.id AND s.status='active' AND s.expires_at>CURRENT_TIMESTAMP
 JOIN platform_settings r ON r.setting_group='environment_runtime' AND r.setting_key=CONCAT('environment_',e.id)
 WHERE t.archived_at IS NULL AND e.archived_at IS NULL AND t.status='active' AND e.status='ready'
 AND JSON_UNQUOTE(JSON_EXTRACT(r.setting_value,'$.username'))=? LIMIT 101`,[username]);
 console.info('[network-login]',{stage:'directory',candidateCount:rows.length});
 if(rows.length>100)throw new Error('NETWORK_LOGIN_DIRECTORY_CAPACITY');
 let match:{token:string;redirectTo:string}|null=null;
 for(let offset=0;offset<rows.length;offset+=4){
  const batch=await Promise.all(rows.slice(offset,offset+4).map(async(row:any)=>{
   const scope=await networkScope(row.slug);
   return withNetwork(scope,async app=>{await validateLocalLicense(app,scope);
    const [managers]:any=await app.query({sql:"SELECT id,password_hash FROM managers WHERE username=? AND manager_type='principal' AND is_enabled=1 AND archived_at IS NULL LIMIT 1",values:[username],timeout:5000});
    const manager=managers[0];if(!manager||!await bcrypt.compare(password,manager.password_hash))return null;
    return {token:jwt.sign({kind:'network-manager',tenantId:scope.tenant_id,environmentId:scope.environment_id,authVersion:createHash('sha256').update(manager.password_hash).digest('hex'),sub:String(manager.id),slug:scope.slug},env.JWT_SECRET,{algorithm:'HS256',expiresIn:'20m'}),redirectTo:`/network/${encodeURIComponent(scope.slug)}`};
   });
  }));
  for(const candidate of batch){if(!candidate)continue;if(match)throw new Error('NETWORK_LOGIN_AMBIGUOUS');match=candidate;}
 }
 console.info('[network-login]',{stage:'verification',result:match?'matched':'no_matching_credentials'});
 return match;
}
