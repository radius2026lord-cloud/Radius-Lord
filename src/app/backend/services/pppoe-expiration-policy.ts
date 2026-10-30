// Absolute UTC deadline. FreeRADIUS expiration computes Session-Timeout on
// every authentication; never persist a decreasing countdown in radreply.
export async function syncPppoeExpiration(app:any,username:string,deadline?:Date){
 // Read the stored UTC DATETIME in SQL, avoiding mysql2/host timezone casts.
 let epoch:number;
 if(deadline)epoch=Math.floor(deadline.getTime()/1000);
 else{
 const [rows]:any=await app.query(`SELECT TIMESTAMPDIFF(SECOND,'1970-01-01 00:00:00',COALESCE(s.grace_expires_at,s.expires_at)) epoch
  FROM radius_identities r JOIN pppoe_accounts a ON a.radius_identity_id=r.id
  JOIN pppoe_subscriptions s ON s.id=(SELECT latest.id FROM pppoe_subscriptions latest
   WHERE latest.account_id=a.id AND latest.service_role='base' ORDER BY latest.id DESC LIMIT 1 FOR UPDATE)
  WHERE r.current_username=? FOR UPDATE`,[username]);
 epoch=Number(rows[0]?.epoch);
 }
 if(!Number.isSafeInteger(epoch)||epoch<1||epoch>4294967295)throw new Error('PPPOE_LIFECYCLE_TIME');
 await app.query("DELETE FROM radreply WHERE username=? AND attribute='Session-Timeout'",[username]);
 await app.query("DELETE FROM radcheck WHERE username=? AND attribute='Expiration'",[username]);
 await app.query("INSERT INTO radcheck(username,attribute,op,value) VALUES(?,'Expiration',':=',?)",[username,String(epoch)]);
}
