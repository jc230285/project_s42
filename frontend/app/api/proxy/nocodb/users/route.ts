import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    // Get the session
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get the authorization header from the request
    const authHeader = request.headers.get('authorization');
    
    // Call backend /users endpoint directly to get database users
    const backendUrl = `${process.env.BACKEND_BASE_URL}/users`;
    
    console.log('🔄 Proxying users request to:', backendUrl);
    
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { 'Authorization': authHeader } : {}),
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Backend error:', response.status, errorText);
      return NextResponse.json(
        { error: `Backend error: ${errorText}` },
        { status: response.status }
      );
    }

    const users = await response.json();
    
    // Extract only name and nocobdid, sorted by name
    const simplifiedUsers = users
      .map((user: any) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        nocobdid: user.nocobdid
      }))
      .sort((a: any, b: any) => {
        // Sort by name first, then by nocobdid
        if (a.name && b.name) {
          const nameCompare = a.name.localeCompare(b.name);
          if (nameCompare !== 0) return nameCompare;
        }
        if (a.nocobdid && b.nocobdid) {
          return a.nocobdid.localeCompare(b.nocobdid);
        }
        return 0;
      });

    console.log('✅ Returning', simplifiedUsers.length, 'users');
    
    return NextResponse.json(simplifiedUsers);
    
  } catch (error) {
    console.error('❌ Error in users proxy:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
