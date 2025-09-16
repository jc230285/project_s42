import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function GET(req: NextRequest) {
  try {
    const token = await getToken({ 
      req, 
      secret: process.env.NEXTAUTH_SECRET 
    });
    
    if (!token) {
      return NextResponse.json({ error: "No token found" }, { status: 401 });
    }

    // Return the raw token (which is already a JWT)
    return NextResponse.json({ token: token });
  } catch (error) {
    console.error("Error getting token:", error);
    return NextResponse.json({ error: "Failed to get token" }, { status: 500 });
  }
}