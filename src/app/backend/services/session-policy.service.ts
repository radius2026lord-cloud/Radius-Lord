import jwt from 'jsonwebtoken';
import type {Response} from 'express';
import {env} from '../config/env';

export const SESSION_IDLE_SECONDS=60*60;
export const SESSION_IDLE_MS=SESSION_IDLE_SECONDS*1000;

// The browser sends elapsed time, so device timezone and clock offsets do not set expiry.
export function renewVerifiedSession(payload:Record<string,unknown>,activityAgeMs:unknown){
 if(typeof activityAgeMs!=='number'||!Number.isInteger(activityAgeMs)||activityAgeMs<0||activityAgeMs>180000)throw new Error('SESSION_ACTIVITY_REQUIRED');
 const {iat:_iat,exp:_exp,nbf:_nbf,...claims}=payload;
 const issued=Math.floor(Date.now()/1000);
 const lifetime=SESSION_IDLE_SECONDS-Math.ceil(activityAgeMs/1000);
 return {
  token:jwt.sign({...claims,iat:issued},env.JWT_SECRET,{algorithm:'HS256',expiresIn:lifetime}),
  expiresAt:issued+lifetime,
  maxAge:lifetime*1000,
 };
}

export function writeSessionCookie(res:Response,kind:'central'|'network',token:string,maxAge=SESSION_IDLE_MS){
 res.cookie(kind==='central'?'token':'network_token',token,{
  httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',
  path:kind==='central'?'/':'/api/network',maxAge,
 });
}
