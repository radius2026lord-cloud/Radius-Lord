"use client";
import {createElement} from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {QRCodeSVG} from 'qrcode.react';
import {hotspotLoginUrl,type HotspotPrintCard} from './hotspot-card-template';
// Generate QR locally; account credentials never go to a QR provider.
export async function hotspotQrSvgs(base:string,cards:HotspotPrintCard[]):Promise<string[]>{
 await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
 const host=document.createElement('div');host.setAttribute('aria-hidden','true');host.style.cssText='position:fixed;width:1px;height:1px;left:-10000px;overflow:hidden';document.body.appendChild(host);const root=createRoot(host),result:string[]=[];
 try{for(let i=0;i<cards.length;i++){const value=hotspotLoginUrl(base,cards[i]);flushSync(()=>root.render(createElement(QRCodeSVG,{value,size:192,level:'M',marginSize:4,bgColor:'#ffffff',fgColor:'#0f172a'})));const svg=host.querySelector('svg');if(!svg)throw Error('تعذر إنشاء QR.');result.push(svg.outerHTML.replace('width="192"','width="100%"').replace('height="192"','height="100%"'));if(i&&i%25===0)await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));}return result;}finally{root.unmount();host.remove();}
}
