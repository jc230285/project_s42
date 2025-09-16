import { getServerSession } from "next-auth";
import { getSession as getClientSession } from "next-auth/react";
import { authOptions } from "../app/api/auth/[...nextauth]";

export async function getSession() {
  return await getServerSession(authOptions);
}

export async function makeAuthenticatedRequest(url: string, options: RequestInit = {}) {
  const session = await getClientSession();
  if (!session) {
    throw new Error("No active session");
  }

  // For client-side, we'll need to get the token from our API endpoint
  const tokenResponse = await fetch("/api/auth/token");
  const tokenData = await tokenResponse.json();
  
  if (!tokenData.token) {
    throw new Error("No valid token available");
  }

  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${tokenData.token}`,
    'Content-Type': 'application/json',
  };

  return fetch(url, {
    ...options,
    headers,
  });
}
