import {isIP} from 'net';
import {isLicenseNasName} from './nas-resource-identity.service';
import {nasResourceTag} from './nas-resource-scope.service';
import type {RouterApi} from './routeros-api.service';

type Scope={environmentId:number;nasId:number;tunnelAddress:string;resourceName?:string};
type Input=Omit<Scope,'resourceName'>&{radiusAddress:string;gatewayAddress:string;authPort:number;accountingPort:number};
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
const listPrefix='rl-radius-env-';
const environmentList=(s:Scope)=>listPrefix+s.environmentId;
const memberMarker=(s:Scope)=>environmentList(s)+' | NAS-'+s.nasId;
const memberFields='.id,list,address,comment,disabled,dynamic';
const managedList=/^rl-radius-env-[1-9][0-9]*$/;
const exactHost=(address:string)=>isIP(host(address))===4;
const validMember=(row:Rule,s:Scope)=>row.list===environmentList(s)&&row.comment===memberMarker(s)&&host(row.address)===s.tunnelAddress&&!on(row.dynamic)&&Boolean(row['.id']);
const memberships=(api:RouterApi)=>api.command('/ip/firewall/address-list/print',{'.proplist':memberFields});

function planRules(i:Input):Rule[]{
 const list=environmentList(i);
 const udp={protocol:'udp','src-address-list':list,disabled:'no'};
 const forward=(label:string,external:number,internal:number)=>({
  ...udp,chain:'dstnat',action:'dst-nat','dst-address':i.gatewayAddress+'/32','dst-port':String(external),
  'to-addresses':i.radiusAddress,'to-ports':String(internal),comment:list+' | RADIUS-'+label,
 });
 return [
  {...udp,chain:'srcnat',action:'accept','dst-address':i.radiusAddress+'/32','dst-port':i.authPort+','+i.accountingPort,comment:list+' | RADIUS-NoNAT'},
  forward('Auth',1812,i.authPort),
  forward('Acct',1813,i.accountingPort),
 ];
}

const readRules=(api:RouterApi)=>api.command('/ip/firewall/nat/print',{'.proplist':fields});
async function ensureEnvironmentRule(api:RouterApi,rules:Rule[],desired:Rule){
 const owned=(rule:Rule)=>rule.comment===desired.comment;
 const matches=(rule:Rule)=>!on(rule.invalid)&&Object.entries(desired).every(([key,value])=>{
  if(key==='dst-address'||key==='to-addresses')return host(rule[key])===host(value);
  if(key==='disabled')return !on(rule.disabled);
  return rule[key]===value;
 });
 const hasExtraMatch=(rule:Rule)=>['src-address','src-port','in-interface','out-interface','dst-address-list','connection-mark','routing-mark'].some(key=>Boolean(rule[key]));
 const sameRule=(rule:Rule)=>!hasExtraMatch(rule)&&matches(rule);
 const safeBefore=(rule:Rule)=>{
  if(rule.chain!==desired.chain||on(rule.disabled)||rule.protocol==='tcp')return true;
  if(exactHost(rule['dst-address'])&&host(rule['dst-address'])!==host(desired['dst-address']))return true;
  const list=rule['src-address-list']||'';
  if(managedList.test(list)&&list!==desired['src-address-list']&&rule.comment?.startsWith(list+' | RADIUS-'))return true;
  const port=rule['dst-port']||'';
  return rule.protocol==='udp'&&/^\d+(,\d+)*$/.test(port)&&port.split(',').every(value=>!desired['dst-port'].split(',').includes(value));
 };
 const existing=rules.filter(owned);
 if(existing.length>1)fail('NAS_RADIUS_ENV_RULE_AMBIGUOUS');
 const [old]=existing;
 if(old){
  if(!old['.id']||on(old.dynamic)||old.chain!==desired.chain||old.action!==desired.action||old.protocol!=='udp'||old['src-address-list']!==desired['src-address-list']||hasExtraMatch(old))fail('NAS_RADIUS_ENV_RULE_CONFLICT');
  if(sameRule(old)&&rules.slice(0,rules.indexOf(old)).every(safeBefore))return rules;
  if(!sameRule(old))await api.command('/ip/firewall/nat/set',{'.id':old['.id'],...desired});
 }else{
  const first=rules.find(rule=>!safeBefore(rule));
  await api.command('/ip/firewall/nat/add',{...desired,...(first?.['.id']?{'place-before':first['.id']}:{})});
 }
 rules=await readRules(api);
 let index=rules.findIndex(owned);
 if(index<0||rules.filter(owned).length!==1||!sameRule(rules[index]))fail('NAS_RADIUS_ENV_RULE_VERIFY_FAILED');
 const blocker=rules.slice(0,index).find(rule=>!safeBefore(rule));
 if(blocker){
  await api.command('/ip/firewall/nat/move',{'.id':rules[index]['.id'],destination:blocker['.id']});
  rules=await readRules(api);index=rules.findIndex(owned);
 }
 if(index<0||rules.filter(owned).length!==1||!sameRule(rules[index])||rules.slice(0,index).some(rule=>!safeBefore(rule)))fail('NAS_RADIUS_ENV_RULE_VERIFY_FAILED');
 return rules;
}

// The caller holds the gateway lock and validates central NAS/tunnel ownership.
export async function ensureNasRadiusNoNat(api:RouterApi,i:Input){
 validate(i);
 if([i.radiusAddress,i.gatewayAddress].some(address=>isIP(address)!==4||address==='0.0.0.0'||address.startsWith('127.'))||i.radiusAddress===i.gatewayAddress||[i.authPort,i.accountingPort].some(p=>!Number.isInteger(p)||p<1||p>65535)||i.authPort===i.accountingPort)fail('NAS_RADIUS_NAT_SCOPE_INVALID');
 const list=environmentList(i),marker=memberMarker(i);
 const verifyMembership=(rows:Rule[])=>{
  const managed=rows.filter(row=>managedList.test(row.list||''));
  const addresses=new Set<string>();
  for(const row of managed){
   const address=host(row.address);
   if(!exactHost(row.address)||on(row.dynamic)||!row.comment?.startsWith(row.list+' | NAS-')||addresses.has(address))fail('NAS_RADIUS_ENV_MEMBER_CONFLICT');
   addresses.add(address);
  }
  const scoped=managed.filter(row=>host(row.address)===i.tunnelAddress||row.comment===marker);
  if(scoped.length>1||scoped.some(row=>!validMember(row,i)))fail('NAS_RADIUS_ENV_MEMBER_CONFLICT');
  return scoped[0];
 };
 const member=verifyMembership(await memberships(api));
 let rules=await readRules(api);
 for(const rule of planRules(i))rules=await ensureEnvironmentRule(api,rules,rule);
 if(member&&!on(member.disabled))return;
 if(!member)await api.command('/ip/firewall/address-list/add',{list,address:i.tunnelAddress+'/32',comment:marker,disabled:'no'});
 else if(on(member.disabled))await api.command('/ip/firewall/address-list/set',{'.id':member['.id'],disabled:'no'});
 const verified=verifyMembership(await memberships(api));
 if(!verified||on(verified.disabled))fail('NAS_RADIUS_ENV_MEMBER_VERIFY_FAILED');
}
export async function removeNasRadiusNoNat(api:RouterApi,s:Scope){
 validate(s);const tags=markers(s),rules=await api.command('/ip/firewall/nat/print',{'.proplist':fields}),owned=rules.filter(r=>tags.includes(r.comment));
 if(owned.length>1||owned.some(r=>!plain(r)||host(r['src-address'])!==s.tunnelAddress||!r['.id']))fail('NAS_RADIUS_NAT_CLEANUP_CONFLICT');
 const base=tags[0].replace(/ \| RADIUS-NoNAT$/,''),forwarded=rules.filter(r=>[base+' | RADIUS-Auth',base+' | RADIUS-Acct'].includes(r.comment));
 if(forwarded.length>2||forwarded.some(r=>r.chain!=='dstnat'||r.action!=='dst-nat'||r.protocol!=='udp'||host(r['src-address'])!==s.tunnelAddress||on(r.dynamic)||!r['.id']))fail('NAS_RADIUS_NAT_CLEANUP_CONFLICT');
 const entries=await memberships(api);
 const members=entries.filter(row=>row.comment===memberMarker(s)||row.list===environmentList(s)&&host(row.address)===s.tunnelAddress);
 if(members.length>1||members.some(row=>!validMember(row,s)))fail('NAS_RADIUS_ENV_MEMBER_CONFLICT');
 const list=environmentList(s);
 const lastMember=entries.every(row=>row.list!==list||members.includes(row));
 const environmentRules=lastMember?rules.filter(row=>['Auth','Acct','NoNAT'].some(label=>row.comment===list+' | RADIUS-'+label)):[];
 if(environmentRules.some(row=>!row['.id']||on(row.dynamic)||row.protocol!=='udp'||row['src-address-list']!==list||row['src-address']||
  (row.comment.endsWith('NoNAT')?row.chain!=='srcnat'||row.action!=='accept':row.chain!=='dstnat'||row.action!=='dst-nat')))fail('NAS_RADIUS_ENV_RULE_CONFLICT');
 for(const row of members)await api.command('/ip/firewall/address-list/remove',{'.id':row['.id']});
 for(const r of [...owned,...forwarded,...environmentRules])await api.command('/ip/firewall/nat/remove',{'.id':r['.id']});
}
