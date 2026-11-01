"use client";
import {useRef,useState} from 'react';
import type {HotspotCardDesign} from '@/lib/hotspot-card-template';

// Snapshots share immutable image strings; pointer gestures occupy one history entry.
export default function useHotspotDesignHistory(scope:string,design:HotspotCardDesign|undefined,apply:(design:HotspotCardDesign)=>void){
 const [,refresh]=useState(0);
 const state=useRef<{scope:string;past:HotspotCardDesign[];future:HotspotCardDesign[];gesture:HotspotCardDesign|null;lastKey:string;lastAt:number}>({scope,past:[],future:[],gesture:null,lastKey:'',lastAt:0});
 const live=useRef(design);live.current=design;
 if(state.current.scope!==scope)state.current={scope,past:[],future:[],gesture:null,lastKey:'',lastAt:0};
 const notify=()=>refresh(value=>value+1);
 const reset=()=>{state.current={scope,past:[],future:[],gesture:null,lastKey:'',lastAt:0};notify();};
 const push=(value:HotspotCardDesign)=>{state.current.past=[...state.current.past.slice(-39),value];state.current.future=[];};
 const beginGesture=()=>{if(state.current.scope===scope&&live.current&&!state.current.gesture)state.current.gesture=live.current;};
 const endGesture=()=>{if(state.current.scope!==scope)return;const before=state.current.gesture;state.current.gesture=null;if(before&&live.current&&JSON.stringify(before)!==JSON.stringify(live.current)){push(before);state.current.lastKey='';notify();}};
 const change=(patch:Partial<HotspotCardDesign>)=>{
  const before=live.current;if(state.current.scope!==scope||!before||!Object.entries(patch).some(([key,value])=>JSON.stringify(before[key as keyof HotspotCardDesign])!==JSON.stringify(value)))return;
  const next={...before,...patch},key=Object.keys(patch).sort().join('|'),now=Date.now();
  if(!state.current.gesture){if(key!==state.current.lastKey||now-state.current.lastAt>700||!state.current.past.length)push(before);else state.current.future=[];state.current.lastKey=key;state.current.lastAt=now;}
  live.current=next;apply(next);notify();
 };
 const undo=()=>{if(state.current.scope!==scope)return;endGesture();const target=state.current.past.pop();if(!target||!live.current)return;state.current.future=[...state.current.future.slice(-39),live.current];state.current.lastKey='';live.current=target;apply(target);notify();};
 const redo=()=>{if(state.current.scope!==scope)return;endGesture();const target=state.current.future.pop();if(!target||!live.current)return;state.current.past=[...state.current.past.slice(-39),live.current];state.current.lastKey='';live.current=target;apply(target);notify();};
 return {change,undo,redo,reset,beginGesture,endGesture,canUndo:state.current.past.length>0,canRedo:state.current.future.length>0};
}
