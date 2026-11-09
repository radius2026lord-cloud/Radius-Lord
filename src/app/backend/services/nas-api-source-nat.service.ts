import {isIP} from 'net';
import type {RouterApi} from './routeros-api.service';

type Scope={environmentId:number;nasId:number;tunnelAddress:string};
type SourceNat=Scope&{sourceAddress:string;gatewayTunnelAddress:string;apiPort:number};
type Rule=Record<string,string>;
const properties='.id,comment,chain,action,protocol,src-address,dst-address,dst-port,to-addresses,to-ports,src-port,disabled,invalid,dynamic,in-interface,out-interface,src-address-list,dst-address-list,connection-mark,routing-mark';
const on=(value:string|undefined)=>value==='yes'||value==='true';
const host=(value:string|undefined)=>String(value||'').replace(/\/32$/,'');
const fail=(code:string):never=>{throw new Error(code);};
function validateScope(scope:Scope){
 if(!Number.isSafeInteger(scope.environmentId)||scope.environmentId<1||!Number.isSafeInteger(scope.nasId)||scope.nasId<1||isIP(scope.tunnelAddress)!==4)fail('NAS_API_SNAT_SCOPE_INVALID');
}
export function nasApiSourceNatMarker(scope:Pick<Scope,'environmentId'|'nasId'>){
 return `Lord_Rdius-Cloud | ENV-${scope.environmentId} | NAS-${scope.nasId} | API-SNAT`;
}
const plain=(rule:Rule)=>rule.chain==='srcnat'&&rule.action==='src-nat'&&rule.protocol==='tcp'&&!on(rule.dynamic)&&
 !['to-ports','src-port','in-interface','out-interface','src-address-list','dst-address-list','connection-mark','routing-mark'].some(key=>Boolean(rule[key]));
function same(rule:Rule,input:SourceNat){
 return plain(rule)&&host(rule['src-address'])===input.sourceAddress&&host(rule['dst-address'])===input.tunnelAddress&&
  Number(rule['dst-port'])===input.apiPort&&host(rule['to-addresses'])===input.gatewayTunnelAddress&&!on(rule.disabled)&&!on(rule.invalid);
}
// Managed host rules for other endpoints are disjoint. Do not keep moving them
// ahead of each other on every poll when a CHR serves many networks.
function canPrecede(rule:Rule,input:SourceNat){
 if(rule.chain!=='srcnat'||on(rule.disabled))return true;
 const ours=/^Lord_Rdius-Cloud \| ENV-[1-9][0-9]* \| NAS-[1-9][0-9]* \| API-SNAT$/.test(rule.comment||'');
 if(!ours||!plain(rule)||isIP(host(rule['src-address']))!==4||isIP(host(rule['dst-address']))!==4||!Number.isInteger(Number(rule['dst-port'])))return false;
 return host(rule['src-address'])!==input.sourceAddress||host(rule['dst-address'])!==input.tunnelAddress||Number(rule['dst-port'])!==input.apiPort;
}

// Caller holds the gateway lock and has checked central environment/NAS/tunnel
// ownership. This exact host/port rule persists; DNAT and forwarding stay temporary.
export async function ensureNasApiSourceNat(api:RouterApi,input:SourceNat){
 validateScope(input);
 if([input.sourceAddress,input.gatewayTunnelAddress].some(address=>isIP(address)!==4||address==='0.0.0.0')||
  !Number.isInteger(input.apiPort)||input.apiPort<1||input.apiPort>65535)fail('NAS_API_SNAT_SCOPE_INVALID');
 const marker=nasApiSourceNatMarker(input),testMarker=marker+'-TEST';
 const read=()=>api.command('/ip/firewall/nat/print',{'.proplist':properties});
 let rules=await read(),owned=rules.filter(rule=>rule.comment===marker);
 if(owned.length>1)fail('NAS_API_SNAT_AMBIGUOUS');
 let selected=owned[0],changed=false,adopted=false;
 const matchesTest=(rule:Rule)=>(rule.comment===testMarker||rule.comment==='TEMP_LR_API_SNAT_TEST')&&same(rule,input);
 if(!selected){
  const candidates=rules.filter(matchesTest);
  if(candidates.length>1)fail('NAS_API_SNAT_AMBIGUOUS');
  selected=candidates[0];adopted=Boolean(selected);
 }
 if(selected&&(!plain(selected)||!selected['.id']))fail('NAS_API_SNAT_CONFLICT');
 const desired={chain:'srcnat',action:'src-nat',protocol:'tcp','src-address':input.sourceAddress+'/32',
  'dst-address':input.tunnelAddress+'/32','dst-port':String(input.apiPort),'to-addresses':input.gatewayTunnelAddress,disabled:'no',comment:marker};
 if(selected){
  if(adopted||!same(selected,input)){await api.command('/ip/firewall/nat/set',{'.id':selected['.id'],...desired});changed=true;}
 }else{
  const first=rules.find(rule=>!canPrecede(rule,input));
  await api.command('/ip/firewall/nat/add',{...desired,...(first?.['.id']?{'place-before':first['.id']}:{})});changed=true;
 }
 if(changed)rules=await read();
 owned=rules.filter(rule=>rule.comment===marker);
 if(owned.length!==1||!same(owned[0],input))fail('NAS_API_SNAT_VERIFY_FAILED');
 const id=owned[0]['.id'],index=rules.findIndex(rule=>rule['.id']===id);
 const blocking=rules.slice(0,index).find(rule=>!canPrecede(rule,input));
 if(blocking){
  await api.command('/ip/firewall/nat/move',{'.id':id,destination:blocking['.id']});changed=true;rules=await read();
 }
 const verifiedIndex=rules.findIndex(rule=>rule['.id']===id);
 if(verifiedIndex<0||!same(rules[verifiedIndex],input)||rules.slice(0,verifiedIndex).some(rule=>!canPrecede(rule,input)))fail('NAS_API_SNAT_VERIFY_FAILED');
 return {id,marker,changed,adopted,sourceAddress:input.sourceAddress,targetAddress:input.tunnelAddress,port:input.apiPort,translatedSource:input.gatewayTunnelAddress};
}

// Remove only matching manual test rules after the managed path has actually
// completed an API operation, so an unsuccessful migration keeps its fallback.
export async function cleanupNasApiSourceNatTests(api:RouterApi,input:SourceNat){
 validateScope(input);const marker=nasApiSourceNatMarker(input);
 const rules=await api.command('/ip/firewall/nat/print',{'.proplist':properties});
 for(const rule of rules)if((rule.comment===marker+'-TEST'||rule.comment==='TEMP_LR_API_SNAT_TEST')&&same(rule,input))await api.command('/ip/firewall/nat/remove',{'.id':rule['.id']});
}

export async function removeNasApiGatewayRules(api:RouterApi,scope:Scope){
 validateScope(scope);const marker=nasApiSourceNatMarker(scope),relay=`Lord_Radius_API_Relay_${scope.environmentId}_${scope.nasId}`;
 const rules=await api.command('/ip/firewall/nat/print',{'.proplist':properties});
 const removals:Rule[]=[];
 for(const rule of rules){
  if(rule.comment===marker||rule.comment===marker+'-TEST'){
   if(!plain(rule)||host(rule['dst-address'])!==scope.tunnelAddress)fail('NAS_API_SNAT_CLEANUP_CONFLICT');
   removals.push(rule);
  }else if(rule.comment==='TEMP_LR_API_SNAT_TEST'&&plain(rule)&&host(rule['dst-address'])===scope.tunnelAddress){removals.push(rule);}
  else if(rule.comment===relay+'-src'||rule.comment===relay+'-dst'){
   if(host(rule.comment===relay+'-dst'?rule['to-addresses']:rule['dst-address'])!==scope.tunnelAddress)fail('NAS_API_SNAT_CLEANUP_CONFLICT');
   removals.push(rule);
  }
 }
 const filters=await api.command('/ip/firewall/filter/print',{'.proplist':'.id,comment,dst-address'});
 const relayFilters=filters.filter(rule=>rule.comment===relay+'-allow');
 if(relayFilters.some(rule=>host(rule['dst-address'])!==scope.tunnelAddress))fail('NAS_API_SNAT_CLEANUP_CONFLICT');
 for(const rule of relayFilters)await api.command('/ip/firewall/filter/remove',{'.id':rule['.id']});
 for(const rule of removals)await api.command('/ip/firewall/nat/remove',{'.id':rule['.id']});
}
