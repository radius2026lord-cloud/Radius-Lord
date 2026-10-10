import {NextRequest,NextResponse} from 'next/server';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest) {
  const nonce=request.nextUrl.searchParams.get('nonce');
  if(!nonce||!/^[a-f0-9]{32}$/.test(nonce))return NextResponse.json({message:'Invalid probe'},{status:400});
  const base=(process.env.BACKEND_API_URL||process.env.NEXT_PUBLIC_API_URL||'http://localhost:4001').replace(/\/$/,'');
  try {
    const response=await fetch(`${base}/api/platform-health?nonce=${nonce}`,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(4000)});
    const body=await response.json();
    if(!response.ok||body.application!=='radius-lord-backend'||body.nonce!==nonce)throw new Error();
    return NextResponse.json({application:'radius-lord',nonce,backend:'reachable'},{headers:{'Cache-Control':'no-store'}});
  }catch{return NextResponse.json({application:'radius-lord',backend:'unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
