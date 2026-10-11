"use client";
import {useEffect,useRef,type ComponentProps} from 'react';
import {Check,Minus} from 'lucide-react';

/** Native checkbox semantics with the project's shared focus and color treatment. */
export default function ProjectCheckbox({indeterminate=false,className='',...props}:Omit<ComponentProps<'input'>,'type'> & {indeterminate?:boolean}){
 const ref=useRef<HTMLInputElement>(null);
 useEffect(()=>{if(ref.current)ref.current.indeterminate=indeterminate;},[indeterminate]);
 return <span className={`relative inline-flex h-5 w-5 shrink-0 ${className}`}>
  <input {...props} ref={ref} type="checkbox" aria-checked={indeterminate?'mixed':props.checked} className="peer absolute inset-0 z-10 m-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"/>
  <span aria-hidden="true" className={`grid h-full w-full place-items-center rounded-md border shadow-sm transition-colors duration-200 peer-focus-visible:ring-4 peer-focus-visible:ring-blue-500/20 peer-focus-visible:ring-offset-2 peer-disabled:opacity-50 dark:peer-focus-visible:ring-offset-slate-900 ${props.checked||indeterminate?'border-blue-500 bg-blue-500 text-white':'border-slate-300 bg-white dark:border-slate-500 dark:bg-slate-900/50'}`}>
   {indeterminate?<Minus className="h-3.5 w-3.5" strokeWidth={3}/>:props.checked?<Check className="h-3.5 w-3.5" strokeWidth={3}/>:null}
  </span>
 </span>;
}
