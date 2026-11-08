import {readFile} from 'fs/promises';
import {join} from 'path';
import {runManagedRadiusScript,openBackupDownload} from './ssh-terminal.service';

const agentPath='/var/lib/radius-lord/database-backups/agent.py';
async function script(action:'start'|'status'|'download'|'remove'|'inspect'|'verify-start'|'verify-status',id:string,configuration?:unknown){
 if(!/^[a-f0-9-]{36}$/.test(id))throw Error('BACKUP_ID');
 const source=Buffer.from(await readFile(join(__dirname,'../scripts/database-backup-agent.py'),'utf8')).toString('base64');
 const payload=Buffer.from(JSON.stringify(configuration??{})).toString('base64');
 return `import base64,pathlib,subprocess,sys,os
os.umask(0o077)
root=pathlib.Path("/var/lib/radius-lord/database-backups")
root.mkdir(parents=True,exist_ok=True,mode=0o700)
agent=pathlib.Path("${agentPath}")
temporary=root/("agent-"+str(os.getpid())+".tmp")
temporary.write_bytes(base64.b64decode("${source}"))
temporary.chmod(0o700)
os.replace(temporary,agent)
result=subprocess.run([sys.executable,str(agent),"${action}","${id}"],input=base64.b64decode("${payload}"),check=True)
`;
}
export async function backupRemote(serverId:number,action:'start'|'status'|'remove'|'inspect'|'verify-start'|'verify-status',id:string,configuration?:unknown){
 return JSON.parse(await runManagedRadiusScript(serverId,await script(action,id,configuration)));
}
export async function backupStream(serverId:number,id:string){
 return openBackupDownload(serverId,await script('download',id));
}
