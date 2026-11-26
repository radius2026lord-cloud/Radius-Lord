import type {NasDiagnosticSignal} from '../app/backend/shared/nas-diagnostics';
export {currentNasSignal} from '../app/backend/shared/nas-diagnostics';
export type {NasDiagnosticState,NasDiagnosticSignal,NasDiagnostics} from '../app/backend/shared/nas-diagnostics';

export function nasApiStatusLabel(signal?:NasDiagnosticSignal){
 const state=signal?.state;
 return state==='ok'?'متصل':state==='failed'?'فشل الاتصال':state==='disabled'?'غير مفعّل':state==='stale'?'قراءة قديمة':'بانتظار الفحص';
}
