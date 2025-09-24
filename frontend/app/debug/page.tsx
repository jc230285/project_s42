'use client';

import { useSession } from 'next-auth/react';

export default function DebugPage() {
  const { data: session, status } = useSession();

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Debug Session</h1>
      
      <div className="mb-4">
        <strong>Status:</strong> {status}
      </div>
      
      <div className="mb-4">
        <strong>Session exists:</strong> {session ? 'Yes' : 'No'}
      </div>
      
      {session && (
        <div className="mb-4">
          <strong>User email:</strong> {session.user?.email}
        </div>
      )}
      
      {session && (
        <div className="mb-4">
          <strong>User groups:</strong> {JSON.stringify((session.user as any)?.groups)}
        </div>
      )}
      
      <div className="mt-6">
        <strong>Full session object:</strong>
        <pre className="bg-gray-100 p-4 rounded mt-2 overflow-auto">
          {JSON.stringify(session, null, 2)}
        </pre>
      </div>
    </div>
  );
}