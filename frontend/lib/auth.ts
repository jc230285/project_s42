import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "./prisma";

export const authOptions: NextAuthOptions = {
  // Remove Prisma adapter for now to avoid initialization issues
  // adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: "jwt",
  },
  jwt: {
    secret: process.env.NEXTAUTH_SECRET,
  },
  callbacks: {
    async jwt({ token, user, account }) {
      console.log('JWT: Callback triggered', { user: !!user, email: user?.email, tokenEmail: token?.email });
      
      // Always fetch user data if we have an email
      const email = user?.email || token?.email;
      if (email) {
        token.email = token.email || user?.email;
        token.name = token.name || user?.name;
        token.sub = token.sub || user?.id;
        
        // Always fetch fresh user groups from backend
        try {
          // Use the public auth endpoint that doesn't require authentication
          const backendUrl = process.env.NODE_ENV === 'production' 
            ? (process.env.NEXT_PUBLIC_BACKEND_BASE_URL || 'https://s42api.edbmotte.com')
            : (process.env.BACKEND_BASE_URL || process.env.NEXT_PUBLIC_BACKEND_BASE_URL || 'http://localhost:8000');
            
          console.log('JWT: Fetching user data from:', `${backendUrl}/auth/user-groups/${encodeURIComponent(email)}`);
          
          const response = await fetch(`${backendUrl}/auth/user-groups/${encodeURIComponent(email)}`);
          
          console.log('JWT: Response status:', response.status);
          
          if (response.ok) {
            const userData = await response.json();
            console.log('JWT: User data from backend:', userData);
            // Handle the backend response format
            token.groups = userData.groups ? userData.groups.map((g: any) => g.name) : [];
            token.userId = userData.user ? userData.user.id : null;
            console.log('JWT: Assigned groups to token:', token.groups);
          } else {
            const errorText = await response.text();
            console.error('JWT: Failed to fetch user data:', response.status, response.statusText, errorText);
            token.groups = [];
          }
        } catch (error) {
          console.error('JWT: Error fetching user groups:', error);
          token.groups = [];
        }
      }
      return token;
    },
    async session({ session, token }) {
      console.log('Session: Callback triggered with token:', !!token, 'and session:', !!session);
      console.log('Session: User email:', session?.user?.email);
      console.log('Session: Current groups:', (session?.user as any)?.groups);
      
      if (session?.user) {
        if (token) {
          session.user.email = token.email as string;
          session.user.name = token.name as string;
          (session.user as any).id = token.userId;
          (session.user as any).groups = token.groups || [];
          console.log('Session: Got groups from token:', token.groups);
          console.log('Session: Assigned groups to session.user:', (session.user as any).groups);
        } else {
          console.log('Session: No token, but have session - checking if groups need to be fetched');
          
          // Check if groups are missing or empty - always fetch fresh groups
          const currentGroups = (session.user as any).groups;
          console.log('Session: Current groups in session:', currentGroups);
          
          if (session.user.email && (!currentGroups || currentGroups.length === 0)) {
            console.log('Session: Groups missing or empty, fetching from backend...');
            try {
              const backendUrl = process.env.NODE_ENV === 'production' 
                ? (process.env.NEXT_PUBLIC_BACKEND_BASE_URL || 'https://s42api.edbmotte.com')
                : (process.env.BACKEND_BASE_URL || process.env.NEXT_PUBLIC_BACKEND_BASE_URL || 'http://localhost:8000');
                
              console.log('Session: Fetching user data from:', `${backendUrl}/user-info/${encodeURIComponent(session.user.email)}`);
              
              const response = await fetch(`${backendUrl}/user-info/${encodeURIComponent(session.user.email)}`);
              
              console.log('Session: API response status:', response.status);
              
              if (response.ok) {
                const userData = await response.json();
                console.log('Session: User data from backend:', userData);
                // Handle the Flask backend response format
                (session.user as any).groups = userData.groups ? userData.groups.map((g: any) => g.name) : [];
                (session.user as any).id = userData.user ? userData.user.id : null;
                console.log('Session: Assigned groups to session:', (session.user as any).groups);
              } else {
                const errorText = await response.text();
                console.error('Session: Failed to fetch user data:', response.status, errorText);
                (session.user as any).groups = [];
              }
            } catch (error) {
              console.error('Session: Error fetching user groups:', error);
              (session.user as any).groups = [];
            }
          } else {
            console.log('Session: Groups already exist or no email:', { groups: currentGroups, email: session.user.email });
          }
        }
      }
      return session;
    },
    async signIn({ user, account, profile }) {
      if (user.email) {
        try {
          const backendUrl = process.env.NODE_ENV === 'production' 
            ? (process.env.NEXT_PUBLIC_BACKEND_BASE_URL || 'https://s42api.edbmotte.com')
            : (process.env.BACKEND_BASE_URL || process.env.NEXT_PUBLIC_BACKEND_BASE_URL || 'http://localhost:8000');
          
          // Check if user exists
          const userInfoResponse = await fetch(`${backendUrl}/user-info/${encodeURIComponent(user.email)}`);
          
          if (userInfoResponse.ok) {
            const existingUser = await userInfoResponse.json();
            if (existingUser && existingUser.user && existingUser.user.id) {
              console.log('User exists, no need to create');
            } else {
              // Create new user
              await fetch(`${backendUrl}/create-user`, {
                method: 'POST',
                headers: { 
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  email: user.email,
                  name: user.name || ''
                })
              });
            }
          } else {
            // Create new user if API call failed
            await fetch(`${backendUrl}/create-user`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                email: user.email,
                name: user.name || ''
              })
            });
          }
        } catch (error) {
          console.error('Error during sign in:', error);
          // Continue with sign in even if database operations fail
        }
      }
      return true;
    },
  },
  pages: {
    signIn: "/",
    error: "/",
  },
};

import { getServerSession } from "next-auth";
import { getSession as getClientSession } from "next-auth/react";

export async function getSession() {
  return await getServerSession(authOptions);
}

export async function makeAuthenticatedRequest(url: string, options: RequestInit = {}) {
  // For now, use a simple token that works with the backend
  // In production, this should be properly integrated with NextAuth JWT
  const token = "dGVzdEB0ZXN0LmNvbQ=="; // base64 encoded "test@test.com"

  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  return fetch(url, {
    ...options,
    headers,
  });
}
