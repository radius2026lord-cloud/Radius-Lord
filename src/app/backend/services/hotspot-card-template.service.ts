import {withNetwork,validateLocalLicense} from './network-runtime.service';
const fields=['speed','quota','duration','price','serial','expiry','contacts'];
const defaultDesign={accent:'#0758e9',layout:'modern',size:'86x54',align:'center',fontSize:11,logo:'',title:'',note:'احتفظ ببيانات بطاقتك ولا تشاركها.',fields:['speed','quota','duration','serial']};
const defaultLibrary={templates:[{id:'default',name:'القالب الأساسي',draft:defaultDesign,approved:defaultDesign}],defaultId:'default',packageTemplates:{}};
function invalid():never{throw new Error('HOTSPOT_TEMPLATE_INPUT');}
function design(v:any){
 if(!v||!/^#[0-9a-f]{6}$/i.test(v.accent)||!['modern','stripe','simple'].includes(v.layout)||!['86x54','90x50','54x86'].includes(v.size)||!['center','right'].includes(v.align)||!Number.isInteger(v.fontSize)||v.fontSize<9||v.fontSize>14)invalid();
 if(typeof v.title!=='string'||v.title.length>60||typeof v.note!=='string'||v.note.length>100||typeof v.logo!=='string'||v.logo.length>80000||v.logo&&!/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(v.logo))invalid();
 if(!Array.isArray(v.fields)||v.fields.length>7||new Set(v.fields).size!==v.fields.length||v.fields.some((field:any)=>!fields.includes(field)))invalid();
 const sheet=v.sheet;if(sheet!==undefined&&(!sheet||!['A4','A5'].includes(sheet.paper)||!Number.isInteger(sheet.columns)||sheet.columns<1||sheet.columns>5||!Number.isInteger(sheet.rows)||sheet.rows<1||sheet.rows>10||!Number.isFinite(sheet.margin)||sheet.margin<5||sheet.margin>20||!Number.isFinite(sheet.gap)||sheet.gap<0||sheet.gap>5||!['2x2','2x3','2x4','2x5','3x4','3x5','3x6','4x5'].includes(sheet.columns+'x'+sheet.rows)||sheet.paper==='A5'&&sheet.columns*sheet.rows>12))invalid();
 if(v.showLabels!==undefined&&typeof v.showLabels!=='boolean'||v.backgroundMode!==undefined&&!['solid','gradient'].includes(v.backgroundMode)||v.backgroundColor!==undefined&&!/^#[a-f0-9]{6}$/i.test(v.backgroundColor)||v.gradientColor!==undefined&&!/^#[a-f0-9]{6}$/i.test(v.gradientColor)||v.gradientAngle!==undefined&&(!Number.isFinite(v.gradientAngle)||v.gradientAngle<0||v.gradientAngle>360))invalid();
 const selectedContactPhones=v.selectedContactPhones||[];if(!Array.isArray(selectedContactPhones)||selectedContactPhones.length>6||new Set(selectedContactPhones).size!==selectedContactPhones.length||selectedContactPhones.some((phone:any)=>typeof phone!=='string'||phone.length>80))invalid();
 const hidden=v.hidden||[];if(!Array.isArray(hidden)||hidden.length>14||new Set(hidden).size!==hidden.length||hidden.some((key:any)=>!['brand','logo','package','username','password','note',...fields,'qr'].includes(key)))invalid();
 const textColor=String(v.textColor||'#0f172a');if(!/^#[a-f0-9]{6}$/i.test(textColor))invalid();const background=String(v.background||''),loginUrl=String(v.loginUrl||'').trim();
 if(background.length>180000||background&&!/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(background)||loginUrl.length>500||v.customLayout!==undefined&&typeof v.customLayout!=='boolean'||v.showQr!==undefined&&typeof v.showQr!=='boolean')invalid();
 if(loginUrl){try{const u=new URL(loginUrl);if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.hash||u.searchParams.has('username')||u.searchParams.has('password'))invalid();}catch{invalid();}}if(v.showQr&&!loginUrl)invalid();
 const elementStyles:Record<string,any>={};if(v.elementStyles!==undefined){if(!v.elementStyles||typeof v.elementStyles!=='object'||Array.isArray(v.elementStyles)||Object.keys(v.elementStyles).length>14)invalid();for(const [key,style] of Object.entries(v.elementStyles) as [string,any][]){if(!['brand','logo','package','username','password','note',...fields,'qr'].includes(key)||!style||!Number.isInteger(style.fontSize)||style.fontSize<8||style.fontSize>28||!/^#[a-f0-9]{6}$/i.test(style.color)||typeof style.bold!=='boolean'||!['left','center','right'].includes(style.align))invalid();elementStyles[key]={fontSize:style.fontSize,color:style.color,bold:style.bold,align:style.align};}}
 const positions:Record<string,{x:number;y:number;width:number}>={};const keys=['brand','logo','package','username','password','note',...fields,'qr'];
 if(v.positions!==undefined){if(!v.positions||typeof v.positions!=='object'||Array.isArray(v.positions)||Object.keys(v.positions).length>14)invalid();for(const [key,p] of Object.entries(v.positions) as [string,any][]){if(!keys.includes(key)||!p||![p.x,p.y,p.width].every(Number.isFinite)||p.x<0||p.y<0||p.x>98||p.y>98||p.width<5||p.width>100||p.x+p.width>100.1)invalid();positions[key]={x:p.x,y:p.y,width:p.width};}}
 return {sheet:sheet?{paper:sheet.paper,columns:sheet.columns,rows:sheet.rows,margin:sheet.margin,gap:sheet.gap}:undefined,showLabels:Boolean(v.showLabels),selectedContactPhones,backgroundMode:v.backgroundMode||'solid',backgroundColor:v.backgroundColor||'#ffffff',gradientColor:v.gradientColor||'#dbeafe',gradientAngle:v.gradientAngle??135,hidden,elementStyles,textColor,background,loginUrl,customLayout:Boolean(v.customLayout),showQr:Boolean(v.showQr),positions,accent:v.accent,layout:v.layout,size:v.size,align:v.align,fontSize:v.fontSize,logo:v.logo,title:v.title.trim(),note:v.note.trim(),fields:v.fields};
}
function normalize(v:any){
 if(!v||!Array.isArray(v.templates)||!v.templates.length||v.templates.length>20||JSON.stringify(v).length>3000000)invalid();
 const ids=new Set<string>();const templates=v.templates.map((t:any)=>{if(!t||typeof t.id!=='string'||!/^[a-z0-9_-]{1,64}$/i.test(t.id)||ids.has(t.id)||typeof t.name!=='string'||!t.name.trim()||t.name.length>60)invalid();ids.add(t.id);return {id:t.id,name:t.name.trim(),draft:design(t.draft),approved:t.approved===null?null:design(t.approved)};});
 if(!templates.some((t:any)=>t.id===v.defaultId&&t.approved)||!v.packageTemplates||typeof v.packageTemplates!=='object'||Array.isArray(v.packageTemplates)||Object.keys(v.packageTemplates).length>1000)invalid();
 const packageTemplates:Record<string,string>={};for(const [key,value] of Object.entries(v.packageTemplates)){if(!/^[1-9]\d*$/.test(key)||!Number.isSafeInteger(Number(key))||!templates.some((t:any)=>t.id===value&&t.approved))invalid();packageTemplates[key]=String(value);}
 return {templates,defaultId:String(v.defaultId),packageTemplates};
}
function decode(row:any){return row?normalize(typeof row.library_json==='string'?JSON.parse(row.library_json):row.library_json):defaultLibrary;}
async function contactOptions(app:any){const [settings]:any=await app.query('SELECT primary_contact_phone phone FROM network_settings WHERE id=1');const [rows]:any=await app.query('SELECT phone,label FROM network_contact_numbers WHERE network_settings_id=1 ORDER BY display_order,id');const found=new Set<string>(),result:{phone:string;label:string}[]=[];for(const row of [{phone:settings[0]?.phone,label:'رقم الشبكة الأساسي'},...rows]){const phone=String(row.phone||'').trim();if(phone&&!found.has(phone)){found.add(phone);result.push({phone,label:String(row.label||'رقم تواصل')});}}return result;}
function currentContacts(library:any,options:{phone:string}[]){const valid=new Set(options.map(p=>p.phone));for(const template of library.templates)for(const key of ['draft','approved'])if(template[key])template[key].selectedContactPhones=(template[key].selectedContactPhones||[]).filter((phone:string)=>valid.has(phone));return library;}
export async function readHotspotCardTemplates(scope:any){return withNetwork(scope,async app=>{await validateLocalLicense(app,scope);const [rows]:any=await app.query('SELECT library_json,revision FROM network_hotspot_card_templates WHERE id=1');const [packages]:any=await app.query('SELECT p.id,p.name,p.login_mode,v.download_bps,v.upload_bps,v.quota_bytes,v.duration_value,v.duration_mode,t.name_ar unit_name,p.base_price,p.currency_code FROM hotspot_packages p LEFT JOIN hotspot_package_versions v ON v.id=(SELECT x.id FROM hotspot_package_versions x WHERE x.package_id=p.id ORDER BY x.version_no DESC LIMIT 1) LEFT JOIN time_units t ON t.id=v.duration_unit_id WHERE p.archived_at IS NULL ORDER BY p.name,p.id');const options=await contactOptions(app);return {library:currentContacts(decode(rows[0]),options),revision:Number(rows[0]?.revision||0),packages,contactOptions:options};});}
export async function saveHotspotCardTemplates(scope:any,input:any){
 const library=normalize(input?.library),revision=Number(input?.revision);if(!Number.isSafeInteger(revision)||revision<0)invalid();
 return withNetwork(scope,async app=>{await validateLocalLicense(app,scope);
 const options=await contactOptions(app),allowedPhones=new Set(options.map(p=>p.phone));for(const template of library.templates)for(const design of [template.draft,template.approved])if(design?.selectedContactPhones.some((phone:string)=>!allowedPhones.has(phone)))invalid();
 const packageIds=Object.keys(library.packageTemplates);if(packageIds.length){const [valid]:any=await app.query('SELECT id FROM hotspot_packages WHERE id IN (?)',[packageIds]);if(valid.length!==packageIds.length)invalid();}
 await app.beginTransaction();try{
  await app.query('INSERT IGNORE INTO network_hotspot_card_templates(id,library_json,revision) VALUES(1,?,0)',[JSON.stringify(defaultLibrary)]);
  const [rows]:any=await app.query('SELECT revision FROM network_hotspot_card_templates WHERE id=1 FOR UPDATE');if(Number(rows[0].revision)!==revision)throw new Error('HOTSPOT_TEMPLATE_CONFLICT');
  await app.query('UPDATE network_hotspot_card_templates SET library_json=?,revision=revision+1,updated_by=? WHERE id=1',[JSON.stringify(library),scope.managerId]);await app.commit();
 }catch(e){await app.rollback();throw e;}
 return {library,revision:revision+1};
 });
}
export async function readHotspotPrintableCards(scope:any,kind:any,value:any){
 const id=Number(value);if(!['batch','standalone'].includes(kind)||!Number.isSafeInteger(id)||id<1)invalid();
 return withNetwork(scope,async app=>{await validateLocalLicense(app,scope);
 const [settings]:any=await app.query('SELECT timezone FROM network_settings WHERE id=1');
 let metadata:any,cards:any[];
 if(kind==='batch'){
  const [rows]:any=await app.query(`SELECT p.id package_id,p.name package_name,v.download_bps,v.upload_bps,v.quota_bytes,v.duration_value,v.duration_mode,t.name_ar unit_name,b.unit_price price,b.currency_code,b.login_mode
   FROM hotspot_card_batches b JOIN hotspot_package_versions v ON v.id=b.package_version_id JOIN hotspot_packages p ON p.id=v.package_id JOIN time_units t ON t.id=v.duration_unit_id WHERE b.id=? AND b.owner_manager_id=?`,[id,scope.managerId]);metadata=rows[0];if(!metadata)throw new Error('HOTSPOT_TEMPLATE_NOT_FOUND');
  const [items]:any=await app.query(`SELECT bc.serial_no serial,r.current_username username,(SELECT period.expires_at FROM hotspot_service_periods period WHERE period.account_id=a.id ORDER BY period.id DESC LIMIT 1) expiry,(SELECT rc.value FROM radcheck rc WHERE rc.username=r.current_username AND rc.attribute='Cleartext-Password' ORDER BY rc.id DESC LIMIT 1) password
   FROM hotspot_batch_cards bc JOIN hotspot_accounts a ON a.id=bc.account_id JOIN radius_identities r ON r.id=a.radius_identity_id WHERE bc.batch_id=? AND bc.owner_manager_id=? ORDER BY bc.serial_no LIMIT 1000`,[id,scope.managerId]);cards=items.map((c:any)=>({...c,loginMode:metadata.login_mode}));
 }else{
  const [rows]:any=await app.query(`SELECT a.id,r.current_username username,a.login_mode,(SELECT rc.value FROM radcheck rc WHERE rc.username=r.current_username AND rc.attribute='Cleartext-Password' ORDER BY rc.id DESC LIMIT 1) password,
   p.id package_id,p.name package_name,v.download_bps,v.upload_bps,v.quota_bytes,v.duration_value,v.duration_mode,t.name_ar unit_name,sp.price_snapshot price,sp.currency_code,sp.expires_at expiry
   FROM hotspot_accounts a JOIN hotspot_standalone_cards sc ON sc.account_id=a.id JOIN radius_identities r ON r.id=a.radius_identity_id
   LEFT JOIN hotspot_service_periods sp ON sp.id=(SELECT period.id FROM hotspot_service_periods period WHERE period.account_id=a.id ORDER BY period.id DESC LIMIT 1)
   LEFT JOIN hotspot_package_versions v ON v.id=sp.package_version_id LEFT JOIN hotspot_packages p ON p.id=v.package_id LEFT JOIN time_units t ON t.id=v.duration_unit_id
   WHERE a.id=? AND a.account_kind='standalone' AND a.archived_at IS NULL`,[id]);metadata=rows[0];if(!metadata)throw new Error('HOTSPOT_TEMPLATE_NOT_FOUND');cards=[{serial:String(id),username:metadata.username,password:metadata.password,loginMode:metadata.login_mode,expiry:metadata.expiry}];
 }
 return {contactOptions:await contactOptions(app),packageId:Number(metadata.package_id||0),packageName:metadata.package_name||'هوتسبوت',downloadBps:String(metadata.download_bps||0),uploadBps:String(metadata.upload_bps||0),quotaBytes:metadata.quota_bytes==null?null:String(metadata.quota_bytes),duration:metadata.duration_value?`${metadata.duration_value} ${metadata.unit_name||''}${metadata.duration_mode==='connected_time'?' · وقت استخدام':' · متواصل'}`:'—',price:metadata.price==null?'—':`${metadata.price} ${metadata.currency_code||''}`,timezone:String(settings[0]?.timezone||'Asia/Damascus'),cards:cards.map((c:any)=>({serial:String(c.serial),username:String(c.username),password:String(c.password||''),loginMode:c.loginMode,expiry:c.expiry||null}))};
 });
}




