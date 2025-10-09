import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

/**
 * Middleware for basic authentication checks
 * 
 * NOTE: Page-level authorization is now handled by the WithPageAccess component
 * which checks database-driven page permissions. This middleware only ensures
 * the user is authenticated (has a valid session).
 */

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for public routes, API routes, and static files
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/static/') ||
    pathname === '/' ||
    pathname === '/login' ||
    pathname === '/unauthorized' ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Get the token from the request
  const token = await getToken({ 
    req: request, 
    secret: process.env.NEXTAUTH_SECRET 
  });

  // If no token, redirect to login
  if (!token) {
    const url = new URL('/', request.url);
    url.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(url);
  }

  // User is authenticated, allow the request to proceed
  // Page-level authorization will be handled by WithPageAccess component
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, etc (public files)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.svg|.*\\.png).*)',
  ]
};