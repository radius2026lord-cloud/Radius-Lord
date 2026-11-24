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
