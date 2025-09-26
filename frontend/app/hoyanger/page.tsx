"use client";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import DashboardLayout from '@/components/DashboardLayout';
import { WithScale42Access } from '@/components/WithScale42Access';

interface WiseAccount {
  id: number;
  name: string;
  currency: string;
  amount_value: number;
  [key: string]: any;
}

interface WiseAccountsData {
  accounts: WiseAccount[];
  conversions: {
    total_btc: number;
    btc_to_gbp: number;
    btc_to_nok: number;
    btc_to_usd: number;
    rates_source: string;
    rates_timestamp: string;
  };
  summary: {
    total_accounts: number;
    total_btc_amount: number;
    currencies: string[];
  };
}

export default function HoyangerPage() {
  return (
    // <WithScale42Access>
      <HoyangerPageContent />
    // </WithScale42Access>
  );
}

function HoyangerPageContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [wiseAccountsData, setWiseAccountsData] = useState<WiseAccountsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status !== "loading" && !session) {
      router.push('/');
    }
  }, [session, status, router]);

  useEffect(() => {
    const fetchWiseAccounts = async () => {
      try {
        if (!session?.user?.email) {
          setLoading(false);
          return;
        }

        // Create authorization header like other API calls
        const userInfo = {
          email: session.user.email,
          name: session.user.name || session.user.email,
          image: session.user.image || ""
        };
        const authHeader = `Bearer ${btoa(JSON.stringify(userInfo))}`;

        const response = await fetch('/api/proxy/wise-accounts/hoyanger', {
          headers: {
            'Authorization': authHeader,
            'Accept': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          setWiseAccountsData(data);
        } else {
          console.error('Failed to fetch wise accounts:', response.status, response.statusText);
        }
      } catch (error) {
        console.error('Error fetching wise accounts:', error);
      } finally {
        setLoading(false);
      }
    };

    if (session) {
      fetchWiseAccounts();
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
          <h1 className="text-3xl font-bold text-foreground">Hoyanger Power</h1>
          <p className="mt-2 text-muted-foreground">Hoyanger power plant management and monitoring</p>
        </div>

        {/* Wise Accounts Section */}
        <div className="bg-card shadow-sm rounded-lg p-6 border border-border">
          <h2 className="text-lg font-medium text-foreground mb-4">Hoyanger Wise Accounts</h2>
          
          {loading ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-muted-foreground">Loading accounts...</p>
            </div>
          ) : wiseAccountsData ? (
            <div className="space-y-4">
              {/* BTC Conversion Table */}
              <div>
                <h3 className="text-md font-medium text-foreground mb-2">
                  BTC Amount & Conversions 
                  <span className="text-sm text-green-600 ml-2">
                    ({wiseAccountsData.conversions.rates_source === 'live' ? 'Live Rates' : 'Cached Rates'})
                  </span>
                </h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-border">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Currency
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Amount
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          GBP Equivalent
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          NOK Equivalent
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          USD Equivalent
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-card divide-y divide-border">
                      <tr>
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                          BTC
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-foreground">
                          {wiseAccountsData.conversions.total_btc.toFixed(8)}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-foreground">
                          £{wiseAccountsData.conversions.btc_to_gbp.toLocaleString('en-GB', { maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-foreground">
                          kr{wiseAccountsData.conversions.btc_to_nok.toLocaleString('nb-NO', { maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-foreground">
                          ${wiseAccountsData.conversions.btc_to_usd.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  Last updated: {new Date(wiseAccountsData.conversions.rates_timestamp).toLocaleString()}
                </div>
              </div>

              {/* Individual Accounts Table */}
              <div>
                <h3 className="text-md font-medium text-foreground mb-2">Individual Accounts ({wiseAccountsData.summary.total_accounts})</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-border">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Account Name
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Currency
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Amount Value
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-card divide-y divide-border">
                      {wiseAccountsData.accounts.map((account) => (
                        <tr key={account.id}>
                          <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                            {account.name}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-foreground">
                            {account.currency}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-foreground">
                            {account.currency === 'BTC' 
                              ? account.amount_value?.toFixed(8) 
                              : account.amount_value?.toLocaleString()
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Summary */}
              <div className="text-sm text-muted-foreground">
                <p>Currencies: {wiseAccountsData.summary.currencies.join(', ')}</p>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">Unable to load wise accounts data.</p>
          )}
        </div>

        <div className="bg-card shadow-sm rounded-lg p-6 border border-border">
          <h2 className="text-lg font-medium text-foreground mb-4">Power Plant Overview</h2>
          <p className="text-muted-foreground">
            This page will display Hoyanger power plant status, metrics, and controls.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}