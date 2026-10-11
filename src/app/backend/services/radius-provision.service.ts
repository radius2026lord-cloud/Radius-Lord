import {isIP} from 'net';
import {randomBytes} from 'crypto';
import {lookup} from 'dns/promises';
import mysql from 'mysql2/promise';
import {db} from '../config/db';
import {readFileSync} from 'fs';
import {join} from 'path';
import {runManagedRadiusScript,readSshSource} from './ssh-terminal.service';
import {splitTenantTemplate} from './tenant-template.service';
import {encryptProvisioningSecret,decryptProvisioningSecret} from './provisioning-secrets.service';
import {probeRadius} from './radius-health.service';
const error=(code:string)=>{throw new Error(code);};
export async function readPrivateSetting(group:string,key:string){const [rows]:any=await db.query('SELECT setting_value FROM platform_settings WHERE setting_group=? AND setting_key=?',[group,key]);return rows[0]?JSON.parse(rows[0].setting_value):null;}
export async function savePrivateSetting(group:string,key:string,value:any){await db.query("INSERT INTO platform_settings (setting_group,setting_key,setting_value,value_type,is_public) VALUES (?,?,?,'json',0) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)",[group,key,JSON.stringify(value)]);}
const quote=(value:string)=>'"'+value.replace(/\\/g,'\\\\').replace(/\"/g,'\\"').replace(/\$/g,'\\$').replace(/[\r\n]/g,'')+'"';
export async function applyRadiusDatabase(options:{sshServerId:number;radiusHost:string;databaseHost:string;databasePort:number;databaseName:string;username:string;password:string;authPort:number;accountingPort:number;name:string;secret:string;clients?:Array<{name:string;address:string;secret:string}>}){
 if(!/^rl_(?:test_[0-9]+|env_[0-9]+)$/.test(options.name))error('RADIUS_RESOURCE_NAME');
 const [ssh]:any=await db.query('SELECT host FROM server_ssh_connections WHERE database_server_id=?',[options.sshServerId]);
 const [radiusAddresses,sshAddresses]=await Promise.all([lookup(options.radiusHost,{all:true}),lookup(ssh[0]?.host??'',{all:true})]);
 if(!radiusAddresses.some(a=>sshAddresses.some(b=>a.address===b.address)))error('RADIUS_SSH_HOST_MISMATCH');
 const source=await readSshSource(options.sshServerId);
 const name=options.name;
 const module=`# Radius Lord managed ${name}\nsql ${name} {\n dialect = "mysql"\n driver = "rlm_sql_mysql"\n server = ${quote(options.databaseHost)}\n port = ${options.databasePort}\n login = ${quote(options.username)}\n password = ${quote(options.password)}\n radius_db = ${quote(options.databaseName)}\n acct_table1 = "radacct"\n acct_table2 = "radacct"\n postauth_table = "radpostauth"\n authcheck_table = "radcheck"\n authreply_table = "radreply"\n groupcheck_table = "radgroupcheck"\n groupreply_table = "radgroupreply"\n usergroup_table = "radusergroup"\n client_table = "nas"\n read_clients = no\n group_attribute = "${name}-SQL-Group"\n pool {\n start = 0\n min = 0\n max = 4\n spare = 1\n uses = 0\n lifetime = 0\n idle_timeout = 60\n }\n $INCLUDE \${modconfdir}/sql/main/mysql/queries.conf\n}\n`;
 const clients=(options.clients??[]).map(client=>{if(!/^rl_nas_[0-9]+$/.test(client.name)||isIP(client.address)!==4||!client.secret||client.secret.length>60||/[\r\n]/.test(client.secret))error('RADIUS_NAS_CLIENT_INVALID');return ` client ${client.name} {\n ipaddr = ${client.address}\n secret = ${quote(client.secret)}\n }\n`;}).join('');
 const site=`# Radius Lord managed ${name}\nserver ${name} {\n listen {\n type = auth\n ipaddr = *\n port = ${options.authPort}\n }\n listen {\n type = acct\n ipaddr = *\n port = ${options.accountingPort}\n }\n client rl_backend {\n ipaddr = ${source}\n secret = ${quote(options.secret)}\n require_message_authenticator = yes\n }\n${clients} authorize {\n ${name}\n chap\n mschap\n pap\n }\n authenticate {\n Auth-Type CHAP {\n chap\n }\n Auth-Type MS-CHAP {\n mschap\n }\n Auth-Type PAP {\n pap\n }\n }\n preacct {\n acct_unique\n }\n accounting {\n ${name}\n }\n}\n`;
 const payload=Buffer.from(JSON.stringify({name,module,site,redactValues:[options.password,options.secret,...(options.clients??[]).map(c=>c.secret)]})).toString('base64');
 // Fixed Python operation; credentials travel over encrypted SSH stdin, never argv/logs.
 const script=`import base64,json,pathlib,os,subprocess,fcntl,tarfile,time\np=json.loads(base64.b64decode('${payload}'))\nroot=pathlib.Path('/etc/freeradius/3.0')\nif not root.is_dir(): raise SystemExit(21)\nlock=open('/run/lock/radius-lord.lock','w');fcntl.flock(lock,fcntl.LOCK_EX)\nbackup=pathlib.Path('/var/backups/radius-lord');backup.mkdir(mode=0o700,parents=True,exist_ok=True)\nos.chmod(backup,0o700)\nwith tarfile.open(backup/(p['name']+'-'+str(time.time_ns())+'.tar.gz'),'w:gz') as archive: archive.add(root,arcname='freeradius')\npaths=[root/'mods-enabled'/p['name'],root/'sites-enabled'/p['name']]\nold=[]\nfor path in paths:\n if path.is_symlink(): raise SystemExit(22)\n data=path.read_bytes() if path.exists() else None\n if data is not None and not data.startswith(('# Radius Lord managed '+p['name']+'\\n').encode()): raise SystemExit(23)\n old.append(data)\ndiag=backup/'last-operation.log'\nfd=os.open(diag,os.O_WRONLY|os.O_CREAT|os.O_TRUNC|os.O_NOFOLLOW,0o600);os.fchmod(fd,0o600)\nlog=os.fdopen(fd,'w')\ndef note(text):\n for value in p['redactValues']:\n  if value: text=text.replace(value,'[REDACTED]')\n log.write(text+'\\n');log.flush()\ndef run(args):\n note('STEP: '+' '.join(args))\n result=subprocess.run(args,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=40)\n note(result.stdout[-32768:].decode('utf8','replace'));note('EXIT: '+str(result.returncode))\n return result.returncode==0\nwas_active=run(['systemctl','is-active','--quiet','freeradius'])\nnote('INITIAL_STATE: '+('running' if was_active else 'stopped'))\nif old==[p['module'].encode(),p['site'].encode()] and was_active and run(['/usr/sbin/freeradius','-C']):\n print('radius_lord_applied');raise SystemExit(0)\ndef restore():\n for path,data in zip(paths,old):\n  if data is None: path.unlink(missing_ok=True)\n  else: path.write_bytes(data);os.chmod(path,0o640)\ntry:\n for path,text in zip(paths,[p['module'],p['site']]):\n  tmp=path.with_name('.'+path.name+'.rl-tmp');tmp.write_text(text);os.chmod(tmp,0o640)\n  import grp\n  os.chown(tmp,0,grp.getgrnam('freerad').gr_gid);os.replace(tmp,path)\n if not run(['/usr/sbin/freeradius','-C']): raise RuntimeError('config')\n action='restart' if was_active else 'start'\n if not run(['systemctl',action,'freeradius']): raise RuntimeError(action)\n if not run(['systemctl','is-active','--quiet','freeradius']): raise RuntimeError('inactive')\nexcept Exception as failure:\n note('FAILED: '+str(failure));note('ROLLBACK: restoring previous configuration')\n restore();run(['systemctl','restart','freeradius']);raise SystemExit(24)\nprint('radius_lord_applied')\n`;
 await runManagedRadiusScript(options.sshServerId,script);
 return source;
}
export async function radiusDatabaseHost(server:any,radiusHost:string){const [a,b]=await Promise.all([lookup(server.host,{all:true}),lookup(radiusHost,{all:true})]);return a.some(x=>b.some(y=>x.address===y.address))?'127.0.0.1':server.host;}
export async function radiusAccountHosts(server:any,radiusHost:string){const address=(await lookup(radiusHost,{family:4})).address;return (await radiusDatabaseHost(server,radiusHost))==='127.0.0.1'?['localhost','127.0.0.1']:[address];}
export async function grantRadiusAccounts(admin:mysql.Connection,server:any,radiusHost:string,username:string,password:string,databaseName:string){
 if(!/^rl(?:r|t)_[a-z0-9_]+$/.test(username)||!/^rl_(?:tenant_(?:zone_[0-9]+|[0-9]+_[a-f0-9]{16})|infrastructure_[a-z0-9_]+)$/.test(databaseName))error('RADIUS_DATABASE_SCOPE');
 const hosts=await radiusAccountHosts(server,radiusHost);
 for(const host of hosts){const account=mysql.escape(username)+'@'+mysql.escape(host);await admin.query(`CREATE USER IF NOT EXISTS ${account} IDENTIFIED BY ${mysql.escape(password)} WITH MAX_USER_CONNECTIONS 4`);
  await admin.query(`ALTER USER ${account} IDENTIFIED BY ${mysql.escape(password)} WITH MAX_USER_CONNECTIONS 4`);
  for(const table of ['radcheck','radreply','radusergroup','radgroupcheck','radgroupreply','nas','nasreload'])await admin.query(`GRANT SELECT ON \`${databaseName}\`.\`${table}\` TO ${account}`);
  for(const table of ['radacct','radpostauth'])await admin.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON \`${databaseName}\`.\`${table}\` TO ${account}`);
 }
}
export async function verifyRadiusDatabase(config:any,connection:mysql.Connection){
 const health=await probeRadius({host:config.host,authPort:config.authPort,accountingPort:config.accountingPort,secret:decryptProvisioningSecret(config.secretEncrypted),testUsername:config.testUsername,testPassword:decryptProvisioningSecret(config.testPasswordEncrypted)});
 if(health.authentication!=='accepted'||health.accounting!=='acknowledged')error('RADIUS_AUTH_ACCOUNTING_FAILED');
 const [records]:any=await connection.query('SELECT radacctid FROM radacct WHERE acctsessionid=? AND username=? AND acctstoptime IS NOT NULL',[health.sessionId,config.testUsername]);
 if(!records[0])error('RADIUS_ACCOUNTING_DATABASE_MISMATCH');
 const rejected=await probeRadius({host:config.host,authPort:config.authPort,accountingPort:config.accountingPort,secret:decryptProvisioningSecret(config.secretEncrypted),testUsername:config.testUsername,testPassword:randomBytes(24).toString('hex')});
 if(rejected.authentication!=='rejected')error('RADIUS_REJECT_CHECK_FAILED');
 // Test rows are never active subscriber sessions.
 await connection.query('DELETE FROM radacct WHERE acctsessionid=? AND username=?',[health.sessionId,config.testUsername]);
 return {...health,accounting:'verified',database:'verified',overall:'healthy',checkedAt:new Date().toISOString()};
}
export async function bootstrapRadiusTest(radiusId:number,databaseServerId:number){
 const lock=await db.pool.getConnection();let acquired=false;let admin:mysql.Connection|undefined;let stage="load_configuration";
 try{
 const [locked]:any=await lock.query("SELECT GET_LOCK('radius-lord:radius-setup',0) acquired");acquired=Boolean(locked[0]?.acquired);if(!acquired)error('RADIUS_SETUP_BUSY');
 const [rows]:any=await db.query("SELECT setting_value FROM platform_settings WHERE id=? AND setting_group='free_radius'",[radiusId]);
 if(!rows[0])error('RADIUS_NOT_FOUND');const original=rows[0].setting_value,c=JSON.parse(original);if(!c.sshServerId){const [ssh]:any=await db.query('SELECT c.database_server_id FROM server_ssh_connections c JOIN database_servers s ON s.id=c.database_server_id WHERE c.host=? AND s.archived_at IS NULL',[c.host]);if(ssh.length!==1)error('RADIUS_SSH_REQUIRED');c.sshServerId=ssh[0].database_server_id;}
 const [servers]:any=await db.query("SELECT * FROM database_servers WHERE id=? AND archived_at IS NULL AND status='active'",[databaseServerId]);const server=servers[0];if(!server||server.tls_required)error('RADIUS_AUTOMATION_REQUIRES_LOCAL_MYSQL_WITHOUT_TLS');
 const key='test_'+radiusId;let state=await readPrivateSetting('radius_bootstrap',key);
 if(state&&state.databaseServerId!==databaseServerId)error('RADIUS_TEST_DATABASE_SERVER_CHANGED');
 if(!state){state={databaseServerId,name:'rl_infrastructure_auto_'+radiusId,username:'rlt_'+radiusId+'_'+randomBytes(4).toString('hex'),passwordEncrypted:encryptProvisioningSecret(randomBytes(32).toString('hex')),secretEncrypted:encryptProvisioningSecret(randomBytes(32).toString('hex')),testUsername:'rl_probe_'+radiusId,testPasswordEncrypted:encryptProvisioningSecret(randomBytes(24).toString('hex'))};await savePrivateSetting('radius_bootstrap',key,state);}
 const [tenant]:any=await db.query('SELECT id FROM tenant_databases WHERE db_name=?',[state.name]);if(tenant[0])error('RADIUS_TEST_DATABASE_SCOPE');
 stage="database_connection";
 admin=await mysql.createConnection({host:server.host,port:server.port,user:server.provisioning_username,password:decryptProvisioningSecret(server.provisioning_password_encrypted),connectTimeout:8000});
 stage="database_ownership";
 const [exists]:any=await admin.query('SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=?',[state.name]);
 if(exists[0]){const [owner]:any=await admin.query(`SELECT marker FROM \`${state.name}\`.rl_probe_owner LIMIT 1`).catch(()=>[[],[]]);if(owner[0]?.marker!==key)error('RADIUS_TEST_DATABASE_NOT_OWNED');}
 stage="create_database";
 if(!exists[0]){await admin.query(`CREATE DATABASE \`${state.name}\``);await admin.query(`CREATE TABLE \`${state.name}\`.rl_probe_owner (marker VARCHAR(100) PRIMARY KEY)`);await admin.query(`INSERT INTO \`${state.name}\`.rl_probe_owner VALUES (?)`,[key]);state.databaseCreated=true;await savePrivateSetting('radius_bootstrap',key,state);}
 stage="select_database";
 await admin.changeUser({database:state.name});
 stage="create_schema";
 for(const sql of splitTenantTemplate(readFileSync(join(__dirname,'../tenant-schema/vendor/freeradius-mysql-schema.sql'),'utf8')))await admin.query(sql);
 stage="radius_accounts";
 await grantRadiusAccounts(admin,server,c.host,state.username,decryptProvisioningSecret(state.passwordEncrypted),state.name);
 // Separate reader/probe account for the backend source, limited to this test schema.
 stage="probe_account";
 const [source]:any=await admin.query('SELECT USER() source');const clientHost=String(source[0].source).split('@').slice(1).join('@');if(!clientHost||/[\x00-\x20%_\x27\x22\\]/.test(clientHost))error('RADIUS_TEST_CLIENT_HOST');
 const account=mysql.escape(state.username)+'@'+mysql.escape(clientHost);await admin.query(`CREATE USER IF NOT EXISTS ${account} IDENTIFIED BY ${mysql.escape(decryptProvisioningSecret(state.passwordEncrypted))} WITH MAX_USER_CONNECTIONS 4`);await admin.query(`GRANT SELECT ON \`${state.name.replace(/_/g,'\\_')}\`.* TO ${account}`);
 stage="test_user";
 await admin.query('DELETE FROM radcheck WHERE username=?',[state.testUsername]);await admin.query("INSERT INTO radcheck (username,attribute,op,value) VALUES (?,'Cleartext-Password',':=',?)",[state.testUsername,decryptProvisioningSecret(state.testPasswordEncrypted)]);
 // 18120 is occupied by the stock FreeRADIUS inner-tunnel listener.
 const databaseHost=await radiusDatabaseHost(server,c.host);const authPort=19120,accountingPort=19121;
 stage="apply_radius";
 await applyRadiusDatabase({sshServerId:c.sshServerId,radiusHost:c.host,databaseHost,databasePort:server.port,databaseName:state.name,username:state.username,password:decryptProvisioningSecret(state.passwordEncrypted),authPort,accountingPort,name:'rl_test_'+radiusId,secret:decryptProvisioningSecret(state.secretEncrypted)});
 stage="verify_radius";
 const config={...c,authPort,accountingPort,secretEncrypted:state.secretEncrypted,testUsername:state.testUsername,testPasswordEncrypted:state.testPasswordEncrypted,tenantDatabaseId:null,probeDatabaseHost:server.host,probeDatabasePort:server.port,probeDatabaseName:state.name,probeDatabaseUsername:state.username,probeDatabasePasswordEncrypted:state.passwordEncrypted,probeDatabaseTls:false,bootstrapDatabaseServerId:databaseServerId,lastHealth:await verifyRadiusDatabase({...state,host:c.host,authPort,accountingPort},admin)};
 const [saved]:any=await db.query("UPDATE platform_settings SET setting_value=? WHERE id=? AND setting_group='free_radius' AND BINARY setting_value=BINARY ?",[JSON.stringify(config),radiusId,original]);if(!saved.affectedRows)error('RADIUS_CONFIG_CHANGED_DURING_SETUP');
 return config.lastHealth;
 }catch(reason){const failure=reason instanceof Error?reason:new Error("RADIUS_SETUP_FAILED");Object.assign(failure,{setupStage:stage});throw failure;}finally{await admin?.end().catch(()=>{});if(acquired)await lock.query("SELECT RELEASE_LOCK('radius-lord:radius-setup')");lock.release();}
}

export async function removeEnvironmentRadius(sshServerId:number,environmentId:number,databaseName:string){
 if(!Number.isSafeInteger(environmentId)||environmentId<1||!/^rl_tenant_(?:zone_[0-9]+|[0-9]+_[a-f0-9]{16})$/.test(databaseName))error('RADIUS_DELETE_SCOPE');
 const payload=Buffer.from(JSON.stringify({name:'rl_env_'+environmentId,database:databaseName})).toString('base64');
 const script=`import base64,json,pathlib,os,subprocess,fcntl\np=json.loads(base64.b64decode('${payload}'))\nroot=pathlib.Path('/etc/freeradius/3.0')\nif not root.is_dir(): raise SystemExit(21)\nlock=open('/run/lock/radius-lord.lock','w');fcntl.flock(lock,fcntl.LOCK_EX)\npaths=[root/'mods-enabled'/p['name'],root/'sites-enabled'/p['name']]\nold=[]\nfor path in paths:\n if path.is_symlink(): raise SystemExit(22)\n data=path.read_bytes() if path.exists() else None\n if data is not None and not data.startswith(('# Radius Lord managed '+p['name']+'\\n').encode()): raise SystemExit(23)\n old.append(data)\nif old[0] is not None and ('radius_db = "'+p['database']+'"').encode() not in old[0]: raise SystemExit(23)\ndef run(args): return subprocess.run(args,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=40).returncode==0\nwas_active=run(['systemctl','is-active','--quiet','freeradius'])\ntry:\n for path in paths: path.unlink(missing_ok=True)\n if not run(['/usr/sbin/freeradius','-C']): raise RuntimeError('config')\n if was_active and not run(['systemctl','restart','freeradius']): raise RuntimeError('restart')\n if was_active and not run(['systemctl','is-active','--quiet','freeradius']): raise RuntimeError('inactive')\nexcept Exception:\n import grp\n for path,data in zip(paths,old):\n  if data is not None:\n   path.write_bytes(data);os.chmod(path,0o640);os.chown(path,0,grp.getgrnam('freerad').gr_gid)\n if was_active: run(['systemctl','restart','freeradius'])\n raise SystemExit(24)\nprint('radius_lord_removed')\n`;
 await runManagedRadiusScript(sshServerId,script);
}
