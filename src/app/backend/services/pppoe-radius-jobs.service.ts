import {sendRadiusDisconnectRows} from './network-radius-disconnect.service';

// Outbox entries target an accounting session, never every NAS or a username
// alone. INSERT IGNORE prevents a still-open accounting row from being retried
// every worker tick after its Disconnect-ACK.
export async function queuePppoeReauthentication(app:any,username:string){
 await app.query(`INSERT INTO pppoe_radius_jobs(radacctid,reason,next_attempt_at)
  SELECT radacctid,'reauth',UTC_TIMESTAMP(6) FROM radacct
  WHERE username=? AND acctstoptime IS NULL AND acctsessionid<>''
  ON DUPLICATE KEY UPDATE reason='reauth',revision=revision+1,attempts=0,next_attempt_at=UTC_TIMESTAMP(6),acknowledged_at=NULL`,[username]);
}

export async function processPppoeRadiusJobs(scope:any,app:any,forcedUsers:string[]=[]){
 const lockName='rl-pppoe-jobs:'+Number(scope.environment_id);
 const [lock]:any=await app.query('SELECT GET_LOCK(?,0) acquired',[lockName]);
 if(Number(lock[0]?.acquired)!==1)return;
 try{
 const usernames=Array.from(new Set(forcedUsers));
 if(usernames.length)await app.query(`INSERT IGNORE INTO pppoe_radius_jobs(radacctid,reason,next_attempt_at)
  SELECT radacctid,'reauth',UTC_TIMESTAMP(6) FROM radacct WHERE username IN (${usernames.map(()=>'?').join(',')}) AND acctstoptime IS NULL AND acctsessionid<>''`,usernames);
 // Keyset scan: stale sessions and unavailable NAS cannot starve later users.
 const [state]:any=await app.query('SELECT scan_cursor,cleanup_cursor FROM pppoe_radius_job_state WHERE id=1');
 const cursor=String(state[0]?.scan_cursor||'0');
 const [sessions]:any=await app.query(`SELECT ra.radacctid FROM radacct ra JOIN radius_identities ri ON ri.current_username=ra.username AND ri.service_kind='pppoe'
  WHERE ra.acctstoptime IS NULL AND ra.radacctid>? ORDER BY ra.radacctid LIMIT 100`,[cursor]);
 if(sessions.length){
  const ids=sessions.map((row:any)=>String(row.radacctid));
  await app.query(`INSERT IGNORE INTO pppoe_radius_jobs(radacctid,reason,next_attempt_at)
   SELECT DISTINCT ra.radacctid,'expiry',UTC_TIMESTAMP(6) FROM radacct ra
   JOIN radcheck rc ON rc.username=ra.username AND rc.attribute='Auth-Type' AND rc.value='Reject'
   WHERE ra.radacctid IN (${ids.map(()=>'?').join(',')}) AND ra.acctstoptime IS NULL AND ra.acctsessionid<>''`,ids);
 }
 await app.query('UPDATE pppoe_radius_job_state SET scan_cursor=? WHERE id=1',[sessions.length?String(sessions.at(-1).radacctid):'0']);
 // Advance a cleanup cursor instead of scanning every retained ACK each tick.
 const [cleanup]:any=await app.query('SELECT id FROM pppoe_radius_jobs WHERE id>? ORDER BY id LIMIT 100',[String(state[0]?.cleanup_cursor||'0')]);
 if(cleanup.length){
  const ids=cleanup.map((row:any)=>String(row.id));
  await app.query(`DELETE j FROM pppoe_radius_jobs j LEFT JOIN radacct ra ON ra.radacctid=j.radacctid
   WHERE j.id IN (${ids.map(()=>'?').join(',')}) AND (ra.radacctid IS NULL OR ra.acctstoptime IS NOT NULL OR (j.reason='expiry' AND NOT EXISTS(
    SELECT 1 FROM radcheck rc WHERE rc.username=ra.username AND rc.attribute='Auth-Type' AND rc.value='Reject')))`,ids);
 }
 await app.query('UPDATE pppoe_radius_job_state SET cleanup_cursor=? WHERE id=1',[cleanup.length?String(cleanup.at(-1).id):'0']);
 const [jobs]:any=await app.query(`SELECT j.id,j.revision,j.attempts,j.radacctid,ra.username,ra.acctsessionid,ra.nasipaddress,
  COALESCE(NULLIF(l.coa_host,''),ra.nasipaddress) coa_host,COALESCE(NULLIF(l.coa_port,0),3799) coa_port,n.secret
  FROM pppoe_radius_jobs j JOIN radacct ra ON ra.radacctid=j.radacctid
  JOIN nas n ON n.nasname=ra.nasipaddress JOIN lord_nas l ON l.radius_nas_id=n.id
  WHERE ra.acctstoptime IS NULL AND l.is_enabled=1 AND l.archived_at IS NULL AND FIND_IN_SET('ppp',l.radius_services)>0
   AND j.next_attempt_at<=UTC_TIMESTAMP(6)
   AND (j.reason<>'expiry' OR EXISTS(SELECT 1 FROM radcheck rc WHERE rc.username=ra.username AND rc.attribute='Auth-Type' AND rc.value='Reject'))
  ORDER BY j.next_attempt_at,j.id LIMIT 100`);
 if(!jobs.length)return;
 // Reserve a retry time before network I/O. A crash never loses a job and does
 // not produce a tight retry loop. No SQL transaction spans the SSH request.
 const versions=jobs.flatMap((job:any)=>[job.id,job.revision]);
 const versionFilter=jobs.map(()=>'(?,?)').join(',');
 await app.query(`UPDATE pppoe_radius_jobs SET next_attempt_at=TIMESTAMPADD(SECOND,LEAST(1800,30*POW(2,LEAST(attempts,6))),UTC_TIMESTAMP(6)),attempts=LEAST(attempts+1,65535) WHERE (id,revision) IN (${versionFilter})`,versions);
 let acknowledged=new Set<string>();
 try{const result=await sendRadiusDisconnectRows(scope,jobs);acknowledged=new Set(result.acknowledgedIds);}
 catch{console.error('[pppoe-radius-jobs]',{environmentId:Number(scope.environment_id),code:'RADIUS_BATCH_UNAVAILABLE',pending:jobs.length});return;}
 const accepted=jobs.filter((job:any)=>acknowledged.has(String(job.radacctid)));
 if(accepted.length)await app.query(`UPDATE pppoe_radius_jobs SET acknowledged_at=UTC_TIMESTAMP(6),next_attempt_at=UTC_TIMESTAMP(6)+INTERVAL 15 MINUTE WHERE (id,revision) IN (${accepted.map(()=>'(?,?)').join(',')})`,accepted.flatMap((job:any)=>[job.id,job.revision]));
 if(acknowledged.size<jobs.length)console.error('[pppoe-radius-jobs]',{environmentId:Number(scope.environment_id),code:'RADIUS_BATCH_UNACKNOWLEDGED',pending:jobs.length-acknowledged.size});
 }finally{await app.query('SELECT RELEASE_LOCK(?)',[lockName]);}
}
