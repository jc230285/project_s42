import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

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
      if (user) {
        token.email = user.email;
        token.name = user.name;
        token.sub = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        (session.user as any).id = token.sub;
      }
      return session;
    },
    async signIn({ user, account, profile }) {
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
