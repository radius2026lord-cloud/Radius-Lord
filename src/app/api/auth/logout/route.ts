import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  // Notify the backend so SSH sessions in other tabs are closed as well.
  const backend=(process.env.BACKEND_API_URL||process.env.NEXT_PUBLIC_API_URL||"http://localhost:4001").replace(/\/$/,"");
  try {
    await fetch(`${backend}/api/auth/logout`,{method:"POST",headers:{cookie:request.headers.get("cookie")||""},cache:"no-store",signal:AbortSignal.timeout(5000)});
  } catch {
    // Local logout still clears the cookie; terminal idle and token expiry limits remain enforced.
    console.error("Backend logout notification unavailable");
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
