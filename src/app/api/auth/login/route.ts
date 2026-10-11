import { NextRequest, NextResponse } from "next/server";

const BACKEND_API_URL = (
  process.env.BACKEND_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:4001"
).replace(/\/$/, "");

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const backendResponse = await fetch(`${BACKEND_API_URL}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const data = await backendResponse.json();
    const response = NextResponse.json(data, {
      status: backendResponse.status,
    });

    // Login may clear the central cookie and set a separate network cookie.
    // Preserve separate headers; a combined Set-Cookie string is unreliable.
    const headers=backendResponse.headers as Headers & {getSetCookie?:()=>string[]};
    const cookies=headers.getSetCookie?.() ?? (headers.get('set-cookie')?.split(/,(?=\s*[^;,=]+=[^;]*)/)||[]);
    for(const cookie of cookies)response.headers.append('set-cookie',cookie);

    return response;
  } catch (error) {
    console.error("Login proxy error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "تعذر الاتصال بخادم تسجيل الدخول.",
      },
      { status: 502 },
    );
  }
}
