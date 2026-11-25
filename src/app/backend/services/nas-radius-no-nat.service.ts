import {isIP} from 'net';
import {isLicenseNasName} from './nas-resource-identity.service';
import {nasResourceTag} from './nas-resource-scope.service';
import type {RouterApi} from './routeros-api.service';

type Scope={environmentId:number;nasId:number;tunnelAddress:string;resourceName?:string};
type Input=Scope&{radiusAddress:string;authPort:number;accountingPort:number};
type Rule=Record<string,string>;
const fields='.id,comment,chain,action,protocol,src-address,dst-address,dst-port,disabled,invalid,dynamic,to-addresses,to-ports,src-port,in-interface,out-interface,src-address-list,dst-address-list,connection-mark,routing-mark';
const host=(s:string)=>String(s||'').replace(/\/32$/,'');
const on=(s:string)=>s==='yes'||s==='true';
const fail=(code:string):never=>{throw new Error(code);};
function validate(s:Scope){
 if(!Number.isSafeInteger(s.environmentId)||s.environmentId<1||!Number.isSafeInteger(s.nasId)||s.nasId<1||isIP(s.tunnelAddress)!==4||s.tunnelAddress==='0.0.0.0'||s.resourceName&&!isLicenseNasName(s.resourceName))fail('NAS_RADIUS_NAT_SCOPE_INVALID');
}
const markers=(s:Scope)=>[s.resourceName?s.resourceName+' | RADIUS-NoNAT':nasResourceTag(s.environmentId,s.nasId,'RADIUS-NoNAT'),nasResourceTag(s.environmentId,s.nasId,'RADIUS-NoNAT')];
const plain=(r:Rule)=>r.chain==='srcnat'&&r.action==='accept'&&r.protocol==='udp'&&!on(r.dynamic)&&!['to-addresses','to-ports','src-port','in-interface','out-interface','src-address-list','dst-address-list','connection-mark','routing-mark'].some(k=>Boolean(r[k]));
const ports=(r:Rule)=>String(r['dst-port']||'').split(',').map(Number).sort((a,b)=>a-b).join(',');
const desiredPorts=(i:Input)=>[i.authPort,i.accountingPort].sort((a,b)=>a-b).join(',');
const same=(r:Rule,i:Input)=>plain(r)&&host(r['src-address'])===i.tunnelAddress&&host(r['dst-address'])===i.radiusAddress&&ports(r)===desiredPorts(i)&&!on(r.disabled)&&!on(r.invalid);
// TCP rules cannot affect this UDP exception. Disjoint exact managed UDP
// exceptions may precede it, avoiding order churn across tenants.
function precedes(r:Rule,i:Input){
 if(r.chain!=='srcnat'||on(r.disabled)||r.protocol==='tcp')return true;
 const managed=/^(?:rl-[A-Za-z0-9][A-Za-z0-9_-]{0,49}-nas-[1-9][0-9]*|Lord_Rdius-Cloud \| ENV-[1-9][0-9]* \| NAS-[1-9][0-9]*) \| RADIUS-NoNAT$/.test(r.comment||'');
 return managed&&plain(r)&&isIP(host(r['src-address']))===4&&isIP(host(r['dst-address']))===4&&(host(r['src-address'])!==i.tunnelAddress||host(r['dst-address'])!==i.radiusAddress);
}
// The caller holds the gateway lock and validates central NAS/tunnel ownership.
export async function ensureNasRadiusNoNat(api:RouterApi,i:Input){
 validate(i);
 if(isIP(i.radiusAddress)!==4||i.radiusAddress==='0.0.0.0'||[i.authPort,i.accountingPort].some(p=>!Number.isInteger(p)||p<1||p>65535)||i.authPort===i.accountingPort)fail('NAS_RADIUS_NAT_SCOPE_INVALID');
 const [marker,legacy]=markers(i),read=()=>api.command('/ip/firewall/nat/print',{'.proplist':fields});
 let rules=await read(),owned=rules.filter(r=>r.comment===marker||r.comment===legacy);
 if(owned.length>1)fail('NAS_RADIUS_NAT_AMBIGUOUS');
 const old=owned[0];
 // Never repurpose a same-comment rule belonging to another tunnel or service.
 if(old&&(!plain(old)||host(old['src-address'])!==i.tunnelAddress||!old['.id']))fail('NAS_RADIUS_NAT_CONFLICT');
 const desired={chain:'srcnat',action:'accept',protocol:'udp','src-address':i.tunnelAddress+'/32','dst-address':i.radiusAddress+'/32','dst-port':desiredPorts(i),disabled:'no',comment:marker};
 if(old){if(!same(old,i)||old.comment!==marker)await api.command('/ip/firewall/nat/set',{'.id':old['.id'],...desired});}
 else{const first=rules.find(r=>!precedes(r,i));await api.command('/ip/firewall/nat/add',{...desired,...(first?.['.id']?{'place-before':first['.id']}:{})});}
 rules=await read();owned=rules.filter(r=>r.comment===marker||r.comment===legacy);
 if(owned.length!==1||!same(owned[0],i))fail('NAS_RADIUS_NAT_VERIFY_FAILED');
 const id=owned[0]['.id'],index=rules.findIndex(r=>r['.id']===id),blocking=rules.slice(0,index).find(r=>!precedes(r,i));
 if(blocking){await api.command('/ip/firewall/nat/move',{'.id':id,destination:blocking['.id']});rules=await read();}
 const verified=rules.findIndex(r=>r['.id']===id);
 if(verified<0||!same(rules[verified],i)||rules.slice(0,verified).some(r=>!precedes(r,i)))fail('NAS_RADIUS_NAT_VERIFY_FAILED');
 await ensureStandardRadiusPorts(api,i);
 return {marker,id};
}
export async function removeNasRadiusNoNat(api:RouterApi,s:Scope){
 validate(s);const tags=markers(s),rules=await api.command('/ip/firewall/nat/print',{'.proplist':fields}),owned=rules.filter(r=>tags.includes(r.comment));
 if(owned.length>1||owned.some(r=>!plain(r)||host(r['src-address'])!==s.tunnelAddress||!r['.id']))fail('NAS_RADIUS_NAT_CLEANUP_CONFLICT');
 const base=tags[0].replace(/ \| RADIUS-NoNAT$/,''),forwarded=rules.filter(r=>[base+' | RADIUS-Auth',base+' | RADIUS-Acct'].includes(r.comment));
 if(forwarded.length>2||forwarded.some(r=>r.chain!=='dstnat'||r.action!=='dst-nat'||r.protocol!=='udp'||host(r['src-address'])!==s.tunnelAddress||on(r.dynamic)||!r['.id']))fail('NAS_RADIUS_NAT_CLEANUP_CONFLICT');
 for(const r of [...owned,...forwarded])await api.command('/ip/firewall/nat/remove',{'.id':r['.id']});
}

// NAS uses standard ports. Source-scoped DNAT selects the isolated environment
// listener; it preserves the source so RADIUS-NoNAT still applies after DNAT.
async function ensureStandardRadiusPorts(api:RouterApi,i:Input){
 const base=markers(i)[0].replace(/ \| RADIUS-NoNAT$/,'');
 for(const [label,external,internal] of [['Auth',1812,i.authPort],['Acct',1813,i.accountingPort]] as const){
  const marker=base+' | RADIUS-'+label;
  const read=()=>api.command('/ip/firewall/nat/print',{'.proplist':fields});
  let rules=await read(),owned=rules.filter(r=>r.comment===marker);
  if(owned.length>1)fail('NAS_RADIUS_PORT_NAT_AMBIGUOUS');
  const old=owned[0];
  if(old&&(old.chain!=='dstnat'||old.action!=='dst-nat'||old.protocol!=='udp'||host(old['src-address'])!==i.tunnelAddress||on(old.dynamic)||!old['.id']||['src-port','in-interface','out-interface','src-address-list','dst-address-list','connection-mark','routing-mark'].some(k=>Boolean(old[k]))))fail('NAS_RADIUS_PORT_NAT_CONFLICT');
  if(external===internal){if(old)await api.command('/ip/firewall/nat/remove',{'.id':old['.id']});continue;}
  const desired={chain:'dstnat',action:'dst-nat',protocol:'udp','src-address':i.tunnelAddress+'/32','dst-address':i.radiusAddress+'/32','dst-port':String(external),'to-addresses':i.radiusAddress,'to-ports':String(internal),disabled:'no',comment:marker};
  const matches=(r:Rule)=>Object.entries(desired).every(([k,v])=>k==='src-address'||k==='dst-address'?host(r[k])===host(v):k==='disabled'?!on(r[k]):r[k]===v)&&!on(r.invalid);
  // Skip only rules proven disjoint; all other earlier DNAT rules may intercept.
  const safe=(r:Rule)=>r.chain!=='dstnat'||on(r.disabled)||r.protocol==='tcp'||(isIP(host(r['src-address']))===4&&host(r['src-address'])!==i.tunnelAddress)||(r.protocol==='udp'&&/^\d+$/.test(r['dst-port']||'')&&Number(r['dst-port'])!==external);
  if(old){if(!matches(old))await api.command('/ip/firewall/nat/set',{'.id':old['.id'],...desired});}
  else{const first=rules.find(r=>!safe(r));await api.command('/ip/firewall/nat/add',{...desired,...(first?.['.id']?{'place-before':first['.id']}:{})});}
  rules=await read();owned=rules.filter(r=>r.comment===marker);
  if(owned.length!==1||!matches(owned[0]))fail('NAS_RADIUS_PORT_NAT_VERIFY_FAILED');
  const id=owned[0]['.id'],at=rules.findIndex(r=>r['.id']===id),blocking=rules.slice(0,at).find(r=>!safe(r));
  if(blocking){await api.command('/ip/firewall/nat/move',{'.id':id,destination:blocking['.id']});rules=await read();}
  const verified=rules.findIndex(r=>r['.id']===id);
  if(verified<0||!matches(rules[verified])||rules.slice(0,verified).some(r=>!safe(r)))fail('NAS_RADIUS_PORT_NAT_VERIFY_FAILED');
 }
}
