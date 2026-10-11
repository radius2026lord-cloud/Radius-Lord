import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const origin=request.headers.get('origin');
  if(request.headers.get('sec-fetch-site')==='cross-site'||(origin&&origin!==request.nextUrl.origin))return NextResponse.json({success:false,message:'مصدر الطلب غير مصرح.'},{status:403});
  // Notify the backend so SSH sessions in other tabs are closed as well.
  const backend=(process.env.BACKEND_API_URL||process.env.NEXT_PUBLIC_API_URL||"http://localhost:4001").replace(/\/$/,"");
  try {
    const backendResponse=await fetch(`${backend}/api/auth/logout`,{method:"POST",headers:{cookie:request.headers.get("cookie")||"",...(origin?{origin}:{})},cache:"no-store",signal:AbortSignal.timeout(5000)});
    if(!backendResponse.ok&&backendResponse.status!==401)return NextResponse.json({success:false,message:'تعذر إلغاء الجلسة على الخادم. أعد المحاولة.'},{status:503,headers:{'Cache-Control':'no-store'}});
  } catch {
    return NextResponse.json({success:false,message:'تعذر الاتصال بالخادم لإلغاء الجلسة. أعد المحاولة.'},{status:503,headers:{'Cache-Control':'no-store'}});
  }
  const response = NextResponse.json({ success: true });

  response.cookies.set("token", "", {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    expires: new Date(0),
  });

  return response;
}
