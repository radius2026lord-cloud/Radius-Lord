export type NasDiagnosticState='ok'|'failed'|'warning'|'unknown'|'stale'|'disabled'|'not_applicable';
export type NasDiagnosticSignal={state:NasDiagnosticState;reason:string;checkedAt:string|null;lastSuccessAt:string|null;validUntil:string|null};
export type NasDiagnostics={generatedAt:string;scope:{tenantId:number;environmentId:number;subscriptionId:number;nasId:number;gatewayId:number|null}|null;link:NasDiagnosticSignal;api:NasDiagnosticSignal;radius:NasDiagnosticSignal;readings:NasDiagnosticSignal};
// Used with the server snapshot's clock, never with the device's wall clock.
export function currentNasSignal(signal:NasDiagnosticSignal,serverNow:number):NasDiagnosticSignal{
 const expires=Date.parse(signal.validUntil||'');
 return ['ok','failed','warning','unknown'].includes(signal.state)&&Number.isFinite(expires)&&serverNow>=expires?{...signal,state:'stale'}:signal;
}
