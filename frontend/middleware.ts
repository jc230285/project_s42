import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Define protected routes that require Scale42 group membership
const SCALE42_PROTECTED_ROUTES = [
  '/projects',
  '/map',
  '/schema',
  '/hoyanger',
  '/accounts',
  '/users'
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if the route is protected
  const isProtectedRoute = SCALE42_PROTECTED_ROUTES.some(route => 
    pathname.startsWith(route)
  );

  if (!isProtectedRoute) {
    return NextResponse.next();
  }

  // Get the token from the request
  const token = await getToken({ 
    req: request, 
    secret: process.env.NEXTAUTH_SECRET 
  });

  // If no token, redirect to login
  if (!token) {
    const loginUrl = new URL('/api/auth/signin', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Check if user belongs to Scale42 group
  const userGroups = token.groups as string[] || [];
  console.log('Middleware: User groups from token:', userGroups);
  const hasScale42Access = userGroups.some(group => 
    group.toLowerCase() === 'scale42' || 
    group.toLowerCase() === 'scale-42' || 
    group.toLowerCase() === 'scale_42'
  );

  if (!hasScale42Access) {
    // Redirect to unauthorized page or dashboard
    const unauthorizedUrl = new URL('/unauthorized', request.url);
    return NextResponse.redirect(unauthorizedUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/projects/:path*',
    '/map/:path*',
    '/schema/:path*',
    '/hoyanger/:path*',
    '/accounts/:path*',
    '/users/:path*'
  ]
};