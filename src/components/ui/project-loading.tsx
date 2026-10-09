"use client";
import type {ReactNode} from "react";
import {Database} from "lucide-react";
import "./project-loading.css";

export default function ProjectLoading({children="جارٍ تحميل البيانات...",compact=false}:{children?:ReactNode;compact?:boolean}){
 return <div role="status" aria-live="polite" aria-atomic="true" className={`project-loading ${compact?"project-loading-compact":""}`}>
  <div aria-hidden="true" className="project-loading-orbit"><span className="project-loading-ring"/><span className="project-loading-core"><Database size={18} strokeWidth={1.8}/></span></div>
  <div className="project-loading-caption"><span>{children}</span><span aria-hidden="true" className="project-loading-dots"><i/><i/><i/></span></div>
  {!compact&&<span aria-hidden="true" className="project-loading-track"><i/></span>}
 </div>;
}
