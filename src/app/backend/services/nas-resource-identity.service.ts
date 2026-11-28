// License is the stable network identity. Never normalize it into a colliding name.
export async function nasLicensePrefix(central:any,environmentId:number):Promise<string>{
 if(!Number.isSafeInteger(environmentId)||environmentId<1)throw new Error('NAS_SNAPSHOT_SCOPE');
 const [rows]:any=await central.query('SELECT t.license_number FROM tenant_environments e JOIN tenants t ON t.id=e.tenant_id WHERE e.id=?',[environmentId]);
 const license=String(rows[0]?.license_number||'');
 if(!/^[A-Za-z0-9][A-Za-z0-9_-]{0,49}$/.test(license))throw new Error('NAS_LICENSE_IDENTITY_INVALID');
 return 'rl-'+license;
}
export function nasLicenseName(prefix:string,id:number,kind:'nas'|'slot'='nas'){
 if(!/^rl-[A-Za-z0-9][A-Za-z0-9_-]{0,49}$/.test(prefix)||!Number.isSafeInteger(id)||id<1)throw new Error('NAS_LICENSE_IDENTITY_INVALID');
 const name=prefix+'-'+kind+'-'+id;
 if(name.length>63)throw new Error('NAS_LICENSE_IDENTITY_INVALID');
 return name;
}
export const isLicenseNasName=(name:string)=>/^rl-[A-Za-z0-9][A-Za-z0-9_-]{0,49}-(?:nas|slot)-[1-9][0-9]*$/.test(name);


export function nasOvpnName(environmentId:number,id:number,kind:'nas'|'slot'='nas'){
 if(![environmentId,id].every(value=>Number.isSafeInteger(value)&&value>0))throw new Error('NAS_SNAPSHOT_SCOPE');
 return 'rl-e'+environmentId+(kind==='slot'?'-s':'-n')+id;
}

export function networkResourceSlug(name:unknown):string{
 const value=String(name??'').trim();
 return /^[A-Za-z0-9][A-Za-z0-9 -]{0,14}$/.test(value)
  ? value.toLowerCase().replace(/[ -]+/g,'-').replace(/-$/,'') : '';
}

export function namedNasOvpnName(name:unknown,environmentId:number,id:number,kind:'nas'|'slot'='nas'){
 const fallback=nasOvpnName(environmentId,id,kind),slug=networkResourceSlug(name);
 return slug?'rl-'+slug+'-'+fallback.slice(3):fallback;
}

export function ownsNamedNasOvpnName(value:string,environmentId:number,id:number,kind:'nas'|'slot'='nas'){
 const fallback=nasOvpnName(environmentId,id,kind);
 const suffix='-'+fallback.slice(3);
 return value===fallback||value.startsWith('rl-')&&value.endsWith(suffix)
  && /^[a-z0-9](?:[a-z0-9-]{0,13}[a-z0-9])?$/.test(value.slice(3,-suffix.length));
}

export function tenantDatabaseName(tenantId:number,portalSlug:unknown){
 const slug=networkResourceSlug(portalSlug);
 const suffix=slug.replace(/-/g,'_');
 return slug&&!/^zone_[0-9]+$/.test(suffix)
  ? 'rl_tenant_'+suffix : 'rl_tenant_zone_'+String(tenantId).padStart(6,'0');
}

export const isManagedTenantDatabaseName=(name:string)=>
 /^rl_tenant_(?:zone_[0-9]+|[0-9]+_[a-f0-9]{16}|[a-z0-9](?:[a-z0-9_]{0,13}[a-z0-9])?)$/.test(name);
