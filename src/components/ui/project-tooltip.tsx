"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export default function ProjectTooltip({label,children,disabled=false}:{label:string;children:React.ReactNode;disabled?:boolean}){
 const [visible,setVisible]=useState(false),[position,setPosition]=useState({top:0,left:0,below:false});const anchor=useRef<HTMLSpanElement>(null);
 const place=()=>{const el=anchor.current;if(!el)return;const r=el.getBoundingClientRect(),below=r.top<48;setPosition({top:below?r.bottom+9:r.top-9,left:r.left+r.width/2,below})};
 useEffect(()=>{if(!visible)return;place();const hide=()=>setVisible(false),move=()=>place();window.addEventListener("scroll",hide,true);window.addEventListener("resize",move);return()=>{window.removeEventListener("scroll",hide,true);window.removeEventListener("resize",move)}},[visible]);
 const tip=visible&&!disabled&&typeof document!=="undefined"?createPortal(<span role="tooltip" className="rl-tooltip pointer-events-none fixed z-[10000] -translate-x-1/2 whitespace-nowrap rounded-[8px] border border-[#b9cce0] bg-[#17386d] px-2 py-1 text-[10px] font-medium text-white opacity-100 shadow-lg dark:border-white/[.14] dark:bg-[#e7edf5] dark:text-[#173047]" style={{top:position.top,left:position.left,transform:`translate(-50%,${position.below?"0":"-100%"})`}}>{label}</span>,document.body):null;
 return <span ref={anchor} className="inline-flex" onMouseEnter={()=>{place();setVisible(true)}} onMouseLeave={()=>setVisible(false)} onFocus={()=>{place();setVisible(true)}} onBlur={()=>setVisible(false)}>{children}{tip}</span>
}
