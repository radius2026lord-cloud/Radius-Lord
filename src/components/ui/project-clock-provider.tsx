"use client";

import {createContext,useContext,useEffect,useState,type ReactNode} from "react";

const ClockContext=createContext(true);
export const useClock24h=()=>useContext(ClockContext);

// One account-scoped subscription for the whole workspace. No clock polling
// or changes to stored timestamps, timezones, or subscription calculations.
export function ProjectClockProvider({endpoint,children}:{endpoint:string;children:ReactNode}){
 const [clock24h,setClock24h]=useState(true);
 useEffect(()=>{
  const controller=new AbortController();let updated=false;
  setClock24h(true);
  const apply=(preferences:any)=>{if(typeof preferences?.footer?.clock24h==="boolean")setClock24h(preferences.footer.clock24h);};
  const changed=(event:Event)=>{const detail=(event as CustomEvent).detail;if(detail?.endpoint===endpoint){updated=true;apply(detail.preferences);}};
  window.addEventListener("rl-ui-preferences-updated",changed);
  void fetch(endpoint,{credentials:"include",cache:"no-store",signal:controller.signal}).then(response=>response.ok?response.json():null).then(data=>{if(!controller.signal.aborted&&!updated)apply(data?.preferences);}).catch(()=>{});
  return()=>{controller.abort();window.removeEventListener("rl-ui-preferences-updated",changed);};
 },[endpoint]);
 return <ClockContext.Provider value={clock24h}>{children}</ClockContext.Provider>;
}
