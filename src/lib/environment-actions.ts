export type EnvironmentAction={label:string;description:string;kind:'purchase'|'navigate'|'progress'|'cleanup';href?:string};
type State={archived?:boolean;cleanupStatus?:string|null;canDelete?:boolean;canRequest:boolean;status?:string;blockedReason:string|null;job?:{status:string;currentStep:string|null;errorCode:string|null}|null};
// A review action never changes a historical purchase or retries a destructive operation.
export function environmentAction(state:State,paymentStatus:string,code=state.job?.errorCode??''):EnvironmentAction|null{
 const reason=state.blockedReason??'',step=state.job?.currentStep??'';
 if(state.cleanupStatus==='failed'&&state.canDelete)return {kind:'cleanup',label:'استكمال تنظيف البيئة',description:'توقف تنظيف بعض الموارد. افتح نافذة الحذف وراجع التأكيد لاستكمال الخطوات المتبقية.'};
 if(state.archived||state.status==='ready')return null;
 if(['queued','running'].includes(state.job?.status??''))return {kind:'progress',label:'متابعة مراحل التجهيز',description:'الطلب مسجل. افتح المراحل لمتابعة التنفيذ ونتيجة كل خطوة.'};
 if(!['paid','completed'].includes(paymentStatus))return {kind:'purchase',label:'مراجعة الدفع',description:'راجع عملية الدفع وأكد الاستلام من صفحة عمليات الدفع قبل طلب تجهيز البيئة.'};
 if(/حدود الشراء|بيانات الاستضافة|مدة الشراء|ملكية|الربط المركزي|لا تطابق|الرخصة/.test(reason))return {kind:'purchase',label:'مراجعة بيانات الشراء',description:'راجع بيانات الطلب الأصلي وربط الشبكة والرخصة. القيم التاريخية الناقصة تحتاج تثبيتًا من سجل الشراء الموثق؛ لا تُستبدل بحدود الخطة الحالية تلقائيًا.'};
 if(code==='INFRASTRUCTURE_NOT_READY'||reason.includes('صحة البنية التحتية')||step==='infrastructure_preflight')return {kind:'navigate',label:'فتح صفحة التحقق',href:'/Dashboard/infrastructure-health',description:'تحقق من الخدمات غير الجاهزة في صفحة صحة البنية التحتية، ثم ارجع وحدّث حالة الاشتراك.'};
 if(code.startsWith('HOSTING_'))return {kind:'navigate',label:'ضبط الوصول للمنصة',href:'/Dashboard/settings?tab=hosting',description:'راجع عنوان المخدم أو الدومين ومنفذ التطبيق، ثم ارجع إلى الاشتراك وحدّث الحالة.'};
 if(code.startsWith('OVPN_')||step==='network_ovpn')return {kind:'navigate',label:'مراجعة بوابة OpenVPN',href:'/Dashboard/connection-servers',description:'راجع اتصال البوابة والشهادات والـProfile والعناوين المتاحة، ثم أعد محاولة التجهيز.'};
 if(code.startsWith('RADIUS_')||step==='network_radius'||step==='network_radius_verify')return {kind:'navigate',label:'مراجعة مخدم FreeRADIUS',href:'/Dashboard/radius-servers',description:'راجع خدمة FreeRADIUS واتصال SSH واختبار المصادقة والمحاسبة، ثم أعد محاولة التجهيز.'};
 if(/^(DATABASE_|TENANT_DB_|MYSQL_|NO_DATABASE_)/.test(code)||step.startsWith('database_'))return {kind:'navigate',label:'مراجعة مخدم قاعدة البيانات',href:'/Dashboard/database-servers',description:'راجع اتصال مخدم القاعدة وحساب التجهيز وصلاحياته والسعة المتاحة، ثم أعد المحاولة.'};
 if(code==='ENVIRONMENT_BOOTSTRAP_PENDING')return {kind:'progress',label:'مراجعة مراحل التجهيز',description:'قاعدة البيئة جاهزة. راجع المراحل المتبقية ثم أعد محاولة التجهيز من هذا الاشتراك.'};
 if(state.job?.status==='failed'||state.status==='failed')return {kind:'progress',label:'عرض تفاصيل التعثر',description:'راجع المرحلة المتوقفة ورمز المشكلة لتحديد الإجراء المطلوب قبل إعادة المحاولة.'};
 if(reason)return {kind:'purchase',label:'مراجعة سبب التعطيل',description:reason};
 return null;
}
