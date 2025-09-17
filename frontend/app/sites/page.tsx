"use client";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';

export default function SitesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (status !== "loading" && !session) {
      router.push('/');
    }
  }, [session, status, router]);

  const handleNocoDBSync = async () => {
    setIsSyncing(true);

    try {
      const response = await fetch('http://localhost:8000/nocodb-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      
      if (data.status === 'success') {
        toast.success(`NocoDB sync completed successfully! ${data.rows_updated || 0} updated, ${data.rows_inserted || 0} inserted, ${data.rows_deleted || 0} deleted.`);
      } else {
        toast.error(`NocoDB sync failed: ${data.message || 'Unknown error'}`);
      }
    } catch (error) {
      toast.error(`Failed to connect to backend: ${error}`);
    } finally {
      setIsSyncing(false);
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
          <h1 className="text-3xl font-bold text-foreground">Sites</h1>
          <p className="mt-2 text-muted-foreground">Manage and monitor project sites</p>
        </div>

        <div className="bg-card shadow-sm rounded-lg p-6 border border-border">
          <h2 className="text-lg font-medium text-foreground mb-4">Site Overview</h2>
          <p className="text-muted-foreground mb-4">
            This page will display project sites and their details.
          </p>
        </div>

        <div className="bg-card shadow-sm rounded-lg p-6 border border-border">
          <h2 className="text-lg font-medium text-foreground mb-4">NocoDB Schema Sync</h2>
          <p className="text-muted-foreground mb-4">
            Synchronize NocoDB table schemas and metadata with the backend database.
          </p>

          <Button
            onClick={handleNocoDBSync}
            disabled={isSyncing}
          >
            {isSyncing ? 'Syncing...' : 'Run NocoDB Sync'}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}