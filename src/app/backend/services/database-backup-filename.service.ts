type Source={id:string;database_name:string;created_at:string|Date;metadata?:{startedAt?:string;timezone?:string}};
export function backupFilename(job:Source,fallbackTimezone='UTC'){
 const name=job.database_name.replace(/[^A-Za-z0-9_-]/g,'_').slice(0,64)||'database';
 const at=new Date(job.metadata?.startedAt??job.created_at);
 const timezone=job.metadata?.timezone||fallbackTimezone;
 let formatter:Intl.DateTimeFormat;
 try{formatter=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});}catch{formatter=new Intl.DateTimeFormat('en-CA',{timeZone:'UTC',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});}
 const p=Object.fromEntries(formatter.formatToParts(Number.isFinite(at.getTime())?at:new Date(0)).map(p=>[p.type,p.value]));
 return name+'_'+p.year+'-'+p.month+'-'+p.day+'_'+p.hour+'-'+p.minute+'-'+p.second+'.sql.gz';
}
