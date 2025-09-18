import { getServerSession } from "next-auth";
import { getSession as getClientSession } from "next-auth/react";
import { authOptions } from "../app/api/auth/[...nextauth]";

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
