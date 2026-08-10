import { NextResponse, type NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const token = req.cookies.get('token')?.value;
  const { pathname } = req.nextUrl;

  // إذا فتح المستخدم المسار الأساسي "/" نعيد توجيهه إلى "/login"
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  if (!token && pathname !== '/login') {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  if (token && pathname === '/login') {
    return NextResponse.redirect(new URL('/Dashboard', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/login', '/(client)/Dashboard'],
};
