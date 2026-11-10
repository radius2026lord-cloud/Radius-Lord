#!/usr/bin/env python3
"""Explicit host setup phases. Never sourced as a shell configuration file."""
import argparse, getpass, hashlib, ipaddress, json, os, pathlib, pwd, re, secrets, shutil, subprocess, sys, tempfile
ROOT=pathlib.Path('/srv/radius-lord')
def run(args,**kwargs):
    return subprocess.run(args,check=True,**kwargs)
def profile(path):
    p=pathlib.Path(path)
    if p.stat().st_size>128*1024: raise ValueError('Profile too large')
    data=json.loads(p.read_text()); h=data.get('hosting',{})
    if data.get('schemaVersion')!=1 or h.get('access_mode')!='domain': raise ValueError('A version 1 domain deployment profile is required')
    domain=h.get('domain','')
    if len(domain)>253 or not re.fullmatch(r'(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?',domain): raise ValueError('Invalid domain')
    for key in ('public_ip','local_ip'):
        if ipaddress.ip_address(h.get(key,'')).version!=4: raise ValueError('IPv4 required')
    for key in ('public_https_port','local_https_port'):
        if type(h.get(key)) is not int or not 1<=h[key]<=65535: raise ValueError('Invalid HTTPS port')
    return data
def atomic(path,text,owner=None):
    path.parent.mkdir(parents=True,exist_ok=True)
    fd,tmp=tempfile.mkstemp(prefix='.radius-',dir=path.parent)
    try:
        with os.fdopen(fd,'w') as stream: stream.write(text)
        os.chmod(tmp,0o600)
        if owner: os.chown(tmp,owner.pw_uid,owner.pw_gid)
        os.replace(tmp,path)
    finally:
        if os.path.exists(tmp): os.unlink(tmp)
def env_quote(value):
    if any(c in value for c in ('\n','\r','\0')): raise ValueError('Control characters are not allowed')
    if "'" in value: raise ValueError('Single quotes are not supported in environment values')
    return "'"+value+"'"
def credentials(path):
    p=pathlib.Path(path)
    if p.is_symlink() or p.stat().st_mode&0o077 or p.stat().st_uid not in (0,os.geteuid()) or p.stat().st_size>16384: raise ValueError('Secrets file must be private (0600), owned by root/current user, and not a symlink')
    data=json.loads(p.read_text())
    for key in ('dbPassword','gatewayEncryptionKey'):
        if not isinstance(data.get(key),str) or not data[key]: raise ValueError('Missing secret '+key)
    if not re.fullmatch(r'[a-fA-F0-9]{64}',data['gatewayEncryptionKey']): raise ValueError('Use the EXISTING 64-hex encryption key when restoring data')
    data.setdefault('dbName','lord_radius_core');data.setdefault('dbUser','radiusplatform');data.setdefault('dbHost','127.0.0.1');data.setdefault('dbPort',3306)
    if not re.fullmatch(r'[a-zA-Z][a-zA-Z0-9_]{2,31}',data['dbUser']) or data['dbUser'].lower()=='root': raise ValueError('Use a dedicated database user')
    if not re.fullmatch(r'[a-zA-Z][a-zA-Z0-9_]{0,63}',data['dbName']): raise ValueError('Invalid database name')
    if data['dbHost'] not in ('localhost','127.0.0.1') or type(data['dbPort']) is not int or data['dbPort']!=3306: raise ValueError('This database bootstrap supports local MySQL:3306 only; configure remote databases separately')
    if any(any(c in value for c in ('\n','\r','\0')) for value in data.values() if isinstance(value,str)):raise ValueError('Secret values cannot contain control characters')
    data.setdefault('jwtSecret',secrets.token_hex(32))
    if any(data[key].startswith(('REPLACE_','COPY_')) for key in ('dbPassword','jwtSecret')):raise ValueError('Replace example placeholders with private values')
    if len(data['jwtSecret'])<32 or len(data['dbPassword'])<12: raise ValueError('Use JWT >=32 and database password >=12 characters')
    return data
def mysql_defaults(data,path):
    # MySQL option files use different escaping from systemd/dotenv.
    esc=lambda v:'"'+str(v).replace('\\','\\\\').replace('"','\\"')+'"'
    atomic(path,'[client]\nuser='+esc(data['dbUser'])+'\npassword='+esc(data['dbPassword'])+'\nhost=localhost\nprotocol=socket\n')
def db_prepare(data):
    # Root socket auth is used only to create the scoped account, never for the app.
    text="SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name='"+data['dbName']+"';"
    found=subprocess.check_output(['mysql','-Nse',text],text=True).strip()
    if found!='0': raise ValueError('Database already exists. Existing databases/accounts are never overwritten by setup.')
    if subprocess.check_output(['mysql','-Nse',"SELECT COUNT(*) FROM mysql.user WHERE user='"+data['dbUser']+"' AND host='localhost'"],text=True).strip()!='0':raise ValueError('Database user already exists; its password/grants will not be modified')
    esc=lambda v:v.replace("'","''")
    sql="SET SESSION sql_mode='NO_BACKSLASH_ESCAPES';\nCREATE DATABASE `"+data['dbName']+"` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\n"
    # No ALTER USER: a reused account is not silently assigned a new password.
    sql+="CREATE USER '"+data['dbUser']+"'@'localhost' IDENTIFIED BY '"+esc(data['dbPassword'])+"';\n"
    sql+="GRANT ALL PRIVILEGES ON `"+data['dbName']+"`.* TO '"+data['dbUser']+"'@'localhost';\n"
    run(['mysql'],input=sql,text=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
def verify_central(data,user,dump_sha=None):
    manifest=json.loads((pathlib.Path(__file__).parent/'central-baseline.manifest.json').read_text())
    expected=manifest['tables']
    with tempfile.TemporaryDirectory(prefix='radius-verify-') as temporary:
        cnf=pathlib.Path(temporary)/'mysql.cnf';mysql_defaults(data,cnf)
        args=['mysql','--defaults-extra-file='+str(cnf),'--batch','--raw','--skip-column-names',data['dbName']]
        columns=subprocess.check_output(args+['-e',"SELECT TABLE_NAME,COLUMN_NAME FROM information_schema.columns WHERE table_schema=DATABASE() ORDER BY TABLE_NAME,ORDINAL_POSITION"],text=True,stderr=subprocess.DEVNULL)
        actual={}
        for line in columns.splitlines():
            table,column=line.split('\t');actual.setdefault(table,set()).add(column)
        indexes=subprocess.check_output(args+['-e',"SELECT TABLE_NAME,INDEX_NAME,COLUMN_NAME FROM information_schema.statistics WHERE table_schema=DATABASE() AND NON_UNIQUE=0 ORDER BY TABLE_NAME,INDEX_NAME,SEQ_IN_INDEX"],text=True,stderr=subprocess.DEVNULL)
        unique={}
        for line in indexes.splitlines():
            table,name,column=line.split('\t');unique.setdefault((table,name),[]).append(column)
        missing_tables=[table for table in expected if table not in actual]
        missing_columns=[table+'.'+column for table,definition in expected.items() for column in definition['columns'] if column not in actual.get(table,set())]
        bad_indexes=[table+'.'+name for table,definition in expected.items() for name,columns in definition['uniqueIndexes'].items() if unique.get((table,name))!=columns]
        if missing_tables or missing_columns or bad_indexes:
            raise ValueError('Central reference mismatch: '+json.dumps({'missingTables':missing_tables,'missingColumns':missing_columns,'differentUniqueIndexes':bad_indexes}))
    receipt={'database':data['dbName'],'sha256':dump_sha,'centralTablesVerified':True,'centralReferenceVersion':manifest['schemaVersion'],'checkedDimensions':manifest['checkedDimensions'],'migrationsVerified':False,'tenantDatabasesVerified':False}
    atomic(ROOT/'shared/central-import-receipt.json',json.dumps(receipt,indent=2),pwd.getpwnam(user))
    print('Central reference verified: '+str(len(expected))+' tables. Tenant databases were not changed or certified.')
def db_import(data,path,expected,user):
    source=pathlib.Path(path)
    digest=hashlib.sha256()
    with source.open('rb') as stream:
        for block in iter(lambda:stream.read(1024*1024),b''):digest.update(block)
    if not re.fullmatch('[a-f0-9]{64}',expected) or digest.hexdigest()!=expected:raise ValueError('Approved dump SHA256 does not match')
    with tempfile.TemporaryDirectory(prefix='radius-import-') as temporary:
        cnf=pathlib.Path(temporary)/'mysql.cnf';mysql_defaults(data,cnf)
        args=['mysql','--defaults-extra-file='+str(cnf),data['dbName']]
        count=subprocess.check_output(args+['-Nse',"SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE()"],text=True).strip()
        if count!='0':raise ValueError('Import requires an empty target database; no existing application data will be replaced')
        with source.open('rb') as stream:run(args,stdin=stream,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    verify_central(data,user,expected)
def configure(data,settings,user):
    shared=ROOT/'shared';owner=pwd.getpwnam(user)
    if any((shared/name).exists() for name in ('root.env','backend.env')): raise ValueError('Environment files exist. Review/edit them explicitly; setup will not replace secrets or URLs.')
    h=settings['hosting'];url='https://'+h['domain']+(':'+str(h['public_https_port']) if h['public_https_port']!=443 else '')
    backend={'NODE_ENV':'production','PORT':'4001','BIND_HOST':'127.0.0.1','DB_HOST':data['dbHost'],'DB_PORT':str(data['dbPort']),'DB_NAME':data['dbName'],'DB_USER':data['dbUser'],'DB_PASS':data['dbPassword'],'JWT_SECRET':data['jwtSecret'],'GATEWAY_ENCRYPTION_KEY':data['gatewayEncryptionKey'],'FRONTEND_URL':url,'RADIUS_RELEASE_STAGING_DIR':str(shared/'staged-releases'),'RADIUS_HOST_RELEASE_ROOT':str(ROOT)}
    frontend={'NODE_ENV':'production','PORT':'3000','BACKEND_API_URL':'http://127.0.0.1:4001'}
    encoded=lambda values:'\n'.join(k+'='+env_quote(v) for k,v in values.items())+'\n'
    backend_text,frontend_text=encoded(backend),encoded(frontend)
    atomic(shared/'backend.env',backend_text,owner);atomic(shared/'root.env',frontend_text,owner)
    for path in ('staged-releases',):
        target=shared/path;target.mkdir(exist_ok=True,mode=0o700);os.chown(target,owner.pw_uid,owner.pw_gid)
    atomic(shared/'deployment-profile.json',json.dumps(settings,ensure_ascii=False,indent=2),owner)
def apache(settings):
    h=settings['hosting']
    if h['local_https_port']!=443:raise ValueError('Custom internal HTTPS ports need an explicit Apache Listen/vhost review; no partial configuration is applied')
    path=pathlib.Path('/etc/apache2/sites-available/radius-lord.conf')
    if path.exists():raise ValueError('Apache vhost exists; review it rather than replacing a working HTTPS configuration')
    for site in pathlib.Path('/etc/apache2/sites-enabled').glob('*'):
        if re.search(r'(?im)^\s*Server(?:Name|Alias)\s+.*\b'+re.escape(h['domain'])+r'(?:\s|$)',site.read_text()):raise ValueError('Domain already belongs to an enabled Apache site; review it first')
    content=f'''# Managed initial HTTP vhost. certbot --apache adds HTTPS after DNS validation.
<VirtualHost *:80>
    ServerName {h['domain']}
    ProxyRequests Off
    ProxyPreserveHost On
    RequestHeader set X-Forwarded-Proto "http"
    LimitRequestBody 110100480
    ProxyTimeout 180
    # WebSocket must precede the catch-all. HTTP auth/API routes stay in Next.js.
    ProxyPass "/api/admin/ssh/terminal" "ws://127.0.0.1:4001/api/admin/ssh/terminal"
    ProxyPassReverse "/api/admin/ssh/terminal" "ws://127.0.0.1:4001/api/admin/ssh/terminal"
    ProxyPass "/" "http://127.0.0.1:3000/"
    ProxyPassReverse "/" "http://127.0.0.1:3000/"
    ErrorLog ${{APACHE_LOG_DIR}}/radius-lord-error.log
    CustomLog ${{APACHE_LOG_DIR}}/radius-lord-access.log combined
</VirtualHost>
'''
    atomic(path,content);os.chmod(path,0o644)
    try:run(['apache2ctl','configtest']);run(['a2ensite','radius-lord']);run(['apache2ctl','configtest']);run(['systemctl','reload','apache2'])
    except Exception:
        subprocess.run(['a2dissite','radius-lord'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        raise
def main():
    p=argparse.ArgumentParser();p.add_argument('action',choices=['plan','configure','database-prepare','database-import','database-verify','apache','verify']);p.add_argument('--profile',required=True);p.add_argument('--secrets');p.add_argument('--user',default='radiusdeploy');p.add_argument('--dump');p.add_argument('--sha256');args=p.parse_args()
    settings=profile(args.profile)
    if args.action=='plan':
        print(json.dumps({'root':str(ROOT),'hosting':settings['hosting'],'infrastructure':settings.get('infrastructure'), 'preserve':['Netplan','FreeRADIUS configuration','existing databases','encryption keys'],'needs':['system Node.js 24','approved central dump','private secrets file','backup hook','approved migration hook','DNS/HTTPS/CHR route verification']},ensure_ascii=False,indent=2));return
    if os.geteuid()!=0:raise ValueError('Run this setup phase as root')
    if args.action in ('configure','database-prepare','database-import','database-verify'):
        if not args.secrets:raise ValueError('--secrets private JSON file is required')
        data=credentials(args.secrets)
        if args.action=='configure':configure(data,settings,args.user)
        elif args.action=='database-prepare':db_prepare(data)
        elif args.action=='database-verify':verify_central(data,args.user)
        else:
            if not args.dump or not args.sha256:raise ValueError('--dump and --sha256 are required')
            db_import(data,args.dump,args.sha256,args.user)
    elif args.action=='apache':apache(settings)
    elif args.action=='verify':
        run(['apache2ctl','configtest']);run(['sudo','-u',args.user,'python3',str(ROOT/'repository.git/hooks/radius-deploy.py'),'inspect'])
if __name__=='__main__':
    try:main()
    except Exception as error:
        # Never print SQL, secret values, subprocess command arguments or traceback.
        print('Setup stopped: '+(str(error) if isinstance(error,ValueError) else type(error).__name__),file=sys.stderr);sys.exit(1)
