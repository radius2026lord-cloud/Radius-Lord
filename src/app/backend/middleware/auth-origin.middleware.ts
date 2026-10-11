import type {Request,Response,NextFunction} from 'express';
import {env} from '../config/env';
import {db} from '../config/db';
import {readHostingPreflight} from '../services/hosting-preflight.service';
let hostingOrigin:string|null=null,checkedAt=0;
export async function requireAuthOrigin(req:Request,res:Response,next:NextFunction){
 res.setHeader('Cache-Control','no-store');
 if(['GET','HEAD','OPTIONS'].includes(req.method))return next();
 if(req.headers['sec-fetch-site']==='cross-site')return res.status(403).json({success:false,message:'مصدر الطلب غير مصرح.'});
 const origin=req.headers.origin;if(!origin)return next();
 try{if(origin===new URL(env.FRONTEND_URL).origin)return next();
 if(Date.now()-checkedAt>30000){const hosting=await readHostingPreflight((sql,params)=>db.query(sql,params));hostingOrigin=new URL(hosting.baseUrl).origin;checkedAt=Date.now();}
 if(origin===hostingOrigin)return next();
 }catch{/* An unknown origin is never trusted when configuration cannot be read. */}
 return res.status(403).json({success:false,message:'مصدر الطلب غير مصرح.'});
}
