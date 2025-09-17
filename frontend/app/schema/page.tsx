"use client";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';

export default function SchemaPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [schemaInfo, setSchemaInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (status !== "loading" && !session) {
      router.push('/');
    }
  }, [session, status, router]);

  const handleGetSchemaInfo = async () => {
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:8000/nocodb-schema-info', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      setSchemaInfo(data);
      toast.success('Schema information retrieved successfully!');
    } catch (error) {
      toast.error(`Failed to get schema info: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Schema</h1>
          <p className="mt-2 text-muted-foreground">View and manage database schema information</p>
        </div>

        <div className="bg-card shadow-sm rounded-lg p-6 border border-border">
          <h2 className="text-lg font-medium text-foreground mb-4">Schema Overview</h2>
          <p className="text-muted-foreground mb-4">
            View detailed information about the NocoDB database schema, including tables, columns, and relationships.
          </p>

          <Button
            onClick={handleGetSchemaInfo}
            disabled={isLoading}
          >
            {isLoading ? 'Loading...' : 'Get Schema Info'}
          </Button>

          {schemaInfo && (
            <div className="mt-4 p-4 rounded-md border border-border bg-card">
              <h3 className="font-medium mb-2 text-foreground">Schema Information:</h3>
              <div className="space-y-2 text-sm">
                <pre className="mt-2 p-2 bg-muted rounded text-xs whitespace-pre-wrap overflow-x-auto border">
                  {JSON.stringify(schemaInfo, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>

        <div className="bg-card shadow-sm rounded-lg p-6 border border-border">
          <h2 className="text-lg font-medium text-foreground mb-4">Schema Management</h2>
          <p className="text-muted-foreground mb-4">
            Additional schema management tools will be available here.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}