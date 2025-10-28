import { NextResponse } from 'next/server';

export function middleware(request) {
  const locale = request.cookies.get('NEXT_LOCALE')?.value || 'en';
  const response = NextResponse.next();

  response.headers.set('x-locale', locale);

  return response;
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']
};
