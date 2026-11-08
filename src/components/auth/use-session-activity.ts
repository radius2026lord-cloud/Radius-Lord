"use client";

import {useEffect,useRef} from "react";

type Options={
 enabled:boolean;
 endpoint:string;
 onExpired:()=>void;
 onRenewed?:(result:any)=>void;
};

// Only recent user input renews a session. Background API reads never call this endpoint.
export default function useSessionActivity({enabled,endpoint,onExpired,onRenewed}:Options){
 const callbacks=useRef({onExpired,onRenewed});
 callbacks.current={onExpired,onRenewed};
 useEffect(()=>{
  if(!enabled)return;
  const prefix="radius-lord:activity:"+endpoint+":";
  let activity=0,lastWrite=0,lastAttempt=0,consumed=0,renewed=0,inFlight=false;
  const controller=new AbortController();
  function stored(name:string,fallback:number){
   try{
    const value=Number(localStorage.getItem(prefix+name));
    return Number.isFinite(value)&&value>0&&value<=Date.now()?value:fallback;
   }catch{return fallback;}
  }
  function save(name:string,value:number){try{localStorage.setItem(prefix+name,String(value));}catch{}}
  function record(event?:Event){
   if(document.visibilityState!=="visible"||event&&!event.isTrusted)return;
   const now=Date.now();
   activity=now;
   if(now-lastWrite>=5000||now<lastWrite){save("last",now);lastWrite=now;}
  }
  async function renew(){
   if(inFlight||controller.signal.aborted||document.visibilityState!=="visible")return;
   const now=Date.now();
   if(lastAttempt>now)lastAttempt=0;
   if(renewed>now)renewed=0;
   if(activity>now)activity=0;
   const latest=Math.max(activity,stored("last",0));
   const used=Math.max(consumed,stored("consumed",0));
   const lastRenewed=Math.max(renewed,stored("renewed",0));
   if(!latest||latest<=used||now-latest>180000||now-lastAttempt<60000||now-lastRenewed<120000)return;
   inFlight=true;lastAttempt=now;
   try{
    const response=await fetch(endpoint,{method:"POST",credentials:"include",cache:"no-store",signal:controller.signal,headers:{"Content-Type":"application/json"},body:JSON.stringify({activityAgeMs:Math.max(0,Date.now()-latest)})});
    if(controller.signal.aborted)return;
    if(response.status===401){callbacks.current.onExpired();return;}
    if(!response.ok)return;
    const data=await response.json();
    if(controller.signal.aborted)return;
    consumed=latest;renewed=Date.now();
    save("consumed",consumed);save("renewed",renewed);
    callbacks.current.onRenewed?.(data);
   }catch{/* An interrupted connection does not prove that authentication has expired. */}
   finally{inFlight=false;}
  }
  async function tick(){
   try{
    if(typeof navigator.locks!=="undefined"){
     await navigator.locks.request(prefix,{ifAvailable:true},async lock=>{if(lock)await renew();});
    }else await renew();
   }catch{await renew();}
  }
  const inputEvents=["pointerdown","keydown","wheel","touchstart"] as const;
  for(const event of inputEvents)window.addEventListener(event,record,{passive:true,capture:true});
  record();
  void tick();
  const timer=setInterval(()=>void tick(),30000);
  return()=>{
   controller.abort();clearInterval(timer);
   for(const event of inputEvents)window.removeEventListener(event,record,true);
  };
 },[enabled,endpoint]);
}
