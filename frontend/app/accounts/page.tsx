"use client";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import DashboardLayout from '@/components/DashboardLayout';
import { WithScale42Access } from '@/components/WithScale42Access';

interface Company {
  id: number;
  full_name: string;
  registration_number?: string;
  company_type?: string;
  company_status?: string;
  incorporated_on?: string;
  address_line1?: string;
  address_city?: string;
  address_post_code?: string;
  address_country_iso2?: string;
  description_of_business?: string;
  business_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone_number?: string;
  type?: string;
  user_id?: number;
  public_id?: string;
  avatar_url?: string;
  date_of_birth?: string;
  wise_profile?: string;
  next_accounts_made_up_to?: string;
  due_by_next_accounts?: string;
  next_statement_date?: string;
  due_by_next_statement?: string;
  registered_office_address?: string;
  directors?: string;
  filings?: string;
  address_line2?: string;
  address_state_code?: string;
  address_country_iso3?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: any; // Allow additional fields
}

interface CompanySummary {
  total_companies: number;
  active_companies: number;
  dissolved_companies: number;
  type_breakdown: Record<string, number>;
  status_breakdown: Record<string, number>;
}

interface CompaniesResponse {
  companies: Company[];
  summary: CompanySummary;
  source: string;
}

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
  const [companies, setCompanies] = useState<Company[]>([]);
  const [summary, setSummary] = useState<CompanySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "loading" && !session) {
      router.push('/');
    }
  }, [session, status, router]);

  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        if (!session?.user?.email) {
          throw new Error("No session available");
        }

        const userInfo = {
          email: session.user.email,
          name: session.user.name || session.user.email,
          image: session.user.image || ""
        };
        const authHeader = `Bearer ${btoa(JSON.stringify(userInfo))}`;

        const response = await fetch('/api/proxy/companies', {
          headers: {
            'Authorization': authHeader,
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch companies: ${response.status}`);
        }

        const data: CompaniesResponse = await response.json();
        setCompanies(data.companies || []);
        setSummary(data.summary);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load companies data');
      } finally {
        setLoading(false);
      }
    };

    if (session) {
      fetchCompanies();
    }
  }, [session]);

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
          <h1 className="text-3xl font-bold text-foreground">Company Accounts</h1>
          <p className="mt-2 text-muted-foreground">Overview of all registered companies and their status information</p>
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <p className="text-destructive">{error}</p>
          </div>
        )}

        <div className="bg-card shadow-sm rounded-lg border border-border">
          <div className="p-6">
            <h2 className="text-lg font-medium text-foreground mb-4">Companies Overview</h2>
            
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <span className="ml-2 text-muted-foreground">Loading companies data...</span>
              </div>
            ) : companies.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center">No companies data available</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 font-medium text-foreground">Company Name</th>
                      <th className="text-left py-3 px-4 font-medium text-foreground">Registration Number</th>
                      <th className="text-left py-3 px-4 font-medium text-foreground">Type</th>
                      <th className="text-left py-3 px-4 font-medium text-foreground">Status</th>
                      <th className="text-left py-3 px-4 font-medium text-foreground">Incorporated</th>
                      <th className="text-left py-3 px-4 font-medium text-foreground">Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {companies.map((company) => (
                      <tr key={company.id} className="border-b border-border/50 hover:bg-muted/50">
                        <td className="py-3 px-4 text-foreground font-medium">{company.full_name}</td>
                        <td className="py-3 px-4 text-foreground">{company.registration_number || '-'}</td>
                        <td className="py-3 px-4 text-foreground">{company.company_type || '-'}</td>
                        <td className="py-3 px-4 text-foreground">
                          <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                            company.company_status?.toLowerCase().includes('active') 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : company.company_status?.toLowerCase().includes('dissolved')
                              ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                          }`}>
                            {company.company_status || 'Unknown'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-foreground">
                          {company.incorporated_on ? new Date(company.incorporated_on).toLocaleDateString() : '-'}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {[company.address_city, company.address_post_code].filter(Boolean).join(', ') || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {!loading && companies.length > 0 && summary && (
          <div className="bg-card shadow-sm rounded-lg p-6 border border-border">
            <h3 className="text-lg font-medium text-foreground mb-4">Company Statistics</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-sm text-muted-foreground">Total Companies</p>
                <p className="text-2xl font-bold text-foreground">{summary.total_companies}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-sm text-muted-foreground">Active Companies</p>
                <p className="text-2xl font-bold text-foreground">{summary.active_companies}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-sm text-muted-foreground">Dissolved Companies</p>
                <p className="text-2xl font-bold text-foreground">{summary.dissolved_companies}</p>
              </div>
            </div>
            
            {Object.keys(summary.status_breakdown).length > 0 && (
              <div className="mt-6">
                <h4 className="text-md font-medium text-foreground mb-3">Status Breakdown</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {Object.entries(summary.status_breakdown).map(([status, count]) => (
                    <div key={status} className="bg-muted/30 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-foreground">{count}</p>
                      <p className="text-sm text-muted-foreground">{status}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}