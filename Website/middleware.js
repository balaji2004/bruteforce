import { NextResponse } from 'next/server';

export function middleware(request) {
  // Simple passthrough middleware
  // The locale handling is done via next-intl's plugin in next.config.mjs
  return NextResponse.next();
}

export const config = {
  // Match all pathnames except for
  // - … if they start with `/api`, `/_next` or `/_vercel`
  // - … the ones containing a dot (e.g. `favicon.ico`)
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']
};

