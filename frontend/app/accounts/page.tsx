"use client";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import DashboardLayout from '@/components/DashboardLayout';
import { WithScale42Access } from '@/components/WithScale42Access';

export default function AccountsPage() {
  return (
    // <WithScale42Access>
      <AccountsPageContent />
    // </WithScale42Access>
  );
}

function AccountsPageContent() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status !== "loading" && !session) {
      router.push('/');
    }
  }, [session, status, router]);

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
          <h1 className="text-3xl font-bold text-foreground">Account Management</h1>
          <p className="mt-2 text-muted-foreground">Manage customer accounts and billing</p>
        </div>

        <div className="bg-card shadow-sm rounded-lg p-6 border border-border">
          <h2 className="text-lg font-medium text-foreground mb-4">Account Overview</h2>
          <p className="text-muted-foreground">
            This page will display customer accounts, billing information, and account management tools.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}