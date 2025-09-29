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

interface PowerDataRecord {
  date: string;
  hourly_records: number;
  "1a": number;
  "1b": number;
  "2a": number;
  "2b": number;
  "3a": number;
  "3b": number;
  "4m3": number;
  "5m2": number;
  ph: number | null;
  first_reading: string;
  last_reading: string;
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
  const [powerData, setPowerData] = useState<PowerDataRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [powerDataLoading, setPowerDataLoading] = useState(true);

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

  useEffect(() => {
    const fetchPowerData = async () => {
      console.log('🔄 Fetching power data...');
      try {
        if (!session?.user?.email) {
          console.log('❌ No session or email, skipping power data fetch');
          setPowerDataLoading(false);
          return;
        }

        console.log('✅ Session found, proceeding with power data fetch');

        // Create authorization header
        const userInfo = {
          email: session.user.email,
          name: session.user.name || session.user.email,
          image: session.user.image || ""
        };
        const authHeader = `Bearer ${btoa(JSON.stringify(userInfo))}`;

        console.log('📡 Making request to /api/proxy/nocodb');

        // Fetch power data from NocoDB - Daily aggregated data for last 70 days
        const response = await fetch('/api/proxy/nocodb', {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: `
              SELECT
                DATE(timestamp) as date,
                COUNT(*) as hourly_records,
                ROUND(AVG(\`1A\`), 2) as avg_1A,
                ROUND(AVG(\`1B\`), 2) as avg_1B,
                ROUND(AVG(\`2A\`), 2) as avg_2A,
                ROUND(AVG(\`2B\`), 2) as avg_2B,
                ROUND(AVG(\`3A\`), 2) as avg_3A,
                ROUND(AVG(\`3B\`), 2) as avg_3B,
                ROUND(AVG(\`4M3\`), 2) as avg_4M3,
                ROUND(AVG(\`5M2\`), 2) as avg_5M2,
                ROUND(AVG(ph), 2) as avg_ph,
                MIN(timestamp) as first_reading,
                MAX(timestamp) as last_reading
              FROM \`Hoyanger Power Data\`
              WHERE timestamp >= DATE_SUB(CURDATE(), INTERVAL 70 DAY)
              GROUP BY DATE(timestamp)
              ORDER BY date DESC
            `
          })
        });

        console.log('📊 Response status:', response.status);

        if (response.ok) {
          const data = await response.json();
          console.log('✅ Power data received:', data);
          console.log('✅ Power data rows:', data.rows);
          console.log('✅ Power data rows length:', data.rows?.length);
          setPowerData(data.rows || []);
        } else {
          const errorText = await response.text();
          console.error('❌ Failed to fetch power data:', response.status, response.statusText, errorText);
        }
      } catch (error) {
        console.error('💥 Error fetching power data:', error);
      } finally {
        setPowerDataLoading(false);
      }
    };

    if (session) {
      console.log('🚀 Session available, attempting to fetch power data');
      fetchPowerData();
    } else {
      console.log('⏳ No session yet, waiting...');
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

  console.log('🔍 Power data state:', { powerData, powerDataLoading, powerDataLength: powerData.length });

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Hoyanger Power</h1>
          <p className="mt-2 text-muted-foreground">Hoyanger power plant management and monitoring</p>
        </div>

        {/* Wise Accounts Widgets */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {loading ? (
            <>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-card shadow-sm rounded-lg p-6 border border-border">
                  <div className="animate-pulse">
                    <div className="h-4 bg-muted rounded w-3/4 mb-3"></div>
                    <div className="h-8 bg-muted rounded w-1/2 mb-2"></div>
                    <div className="h-3 bg-muted rounded w-2/3"></div>
                  </div>
                </div>
              ))}
            </>
          ) : wiseAccountsData ? (
            <>
              {/* BTC Amount Widget */}
              <div className="bg-card shadow-sm rounded-lg p-6 border border-border hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-muted-foreground">BTC Amount</h3>
                  <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-full">
                    <svg className="w-4 h-4 text-orange-600 dark:text-orange-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                  </div>
                </div>
                <div className="text-2xl font-bold text-foreground mb-1">
                  {wiseAccountsData.conversions.total_btc.toFixed(8)}
                </div>
                <div className="text-sm text-muted-foreground">
                  Bitcoin Holdings
                </div>
                <div className="text-xs text-green-600 mt-2">
                  {wiseAccountsData.conversions.rates_source === 'live' ? '🟢 Live Rates' : '🟡 Cached Rates'}
                </div>
              </div>

              {/* GBP Equivalent Widget */}
              <div className="bg-card shadow-sm rounded-lg p-6 border border-border hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-muted-foreground">GBP Equivalent</h3>
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                    <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/>
                    </svg>
                  </div>
                </div>
                <div className="text-2xl font-bold text-foreground mb-1">
                  £{wiseAccountsData.conversions.btc_to_gbp.toLocaleString('en-GB', { maximumFractionDigits: 2 })}
                </div>
                <div className="text-sm text-muted-foreground">
                  British Pounds
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  Updated: {new Date(wiseAccountsData.conversions.rates_timestamp).toLocaleTimeString()}
                </div>
              </div>

              {/* NOK Equivalent Widget */}
              <div className="bg-card shadow-sm rounded-lg p-6 border border-border hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-muted-foreground">NOK Equivalent</h3>
                  <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
                    <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/>
                    </svg>
                  </div>
                </div>
                <div className="text-2xl font-bold text-foreground mb-1">
                  kr{wiseAccountsData.conversions.btc_to_nok.toLocaleString('nb-NO', { maximumFractionDigits: 2 })}
                </div>
                <div className="text-sm text-muted-foreground">
                  Norwegian Kroner
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  Updated: {new Date(wiseAccountsData.conversions.rates_timestamp).toLocaleTimeString()}
                </div>
              </div>

              {/* USD Equivalent Widget */}
              <div className="bg-card shadow-sm rounded-lg p-6 border border-border hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-muted-foreground">USD Equivalent</h3>
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-full">
                    <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/>
                    </svg>
                  </div>
                </div>
                <div className="text-2xl font-bold text-foreground mb-1">
                  ${wiseAccountsData.conversions.btc_to_usd.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                </div>
                <div className="text-sm text-muted-foreground">
                  US Dollars
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  Updated: {new Date(wiseAccountsData.conversions.rates_timestamp).toLocaleTimeString()}
                </div>
              </div>
            </>
          ) : (
            <>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-card shadow-sm rounded-lg p-6 border border-border">
                  <div className="text-center text-muted-foreground">
                    <p className="text-sm">Unable to load data</p>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Individual Accounts Widgets */}
        <div>
          <h2 className="text-lg font-medium text-foreground mb-4">Individual Accounts</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {loading ? (
              <>
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="bg-card shadow-sm rounded-lg p-6 border border-border">
                    <div className="animate-pulse">
                      <div className="h-4 bg-muted rounded w-3/4 mb-3"></div>
                      <div className="h-8 bg-muted rounded w-1/2 mb-2"></div>
                      <div className="h-3 bg-muted rounded w-2/3"></div>
                    </div>
                  </div>
                ))}
              </>
            ) : wiseAccountsData?.accounts ? (
              <>
                {wiseAccountsData.accounts.map((account) => (
                  <div key={account.id} className="bg-card shadow-sm rounded-lg p-6 border border-border hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-muted-foreground truncate" title={account.name}>
                        {account.name.length > 20 ? `${account.name.substring(0, 20)}...` : account.name}
                      </h3>
                      <div className={`p-2 rounded-full ${
                        account.currency === 'BTC' 
                          ? 'bg-orange-100 dark:bg-orange-900/30' 
                          : 'bg-purple-100 dark:bg-purple-900/30'
                      }`}>
                        {account.currency === 'BTC' ? (
                          <svg className="w-4 h-4 text-orange-600 dark:text-orange-400" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/>
                          </svg>
                        )}
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-foreground mb-1">
                      {account.currency === 'BTC' 
                        ? account.amount_value?.toFixed(8) || '0.00000000'
                        : account.amount_value?.toLocaleString() || '0'
                      }
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {account.currency}
                    </div>
                  </div>
                ))}
                
                {/* Add empty widgets if less than 4 accounts to maintain grid layout */}
                {wiseAccountsData.accounts.length < 4 && (
                  <>
                    {Array.from({ length: 4 - wiseAccountsData.accounts.length }).map((_, i) => (
                      <div key={`empty-${i}`} className="bg-card/50 shadow-sm rounded-lg p-6 border border-border border-dashed">
                        <div className="text-center text-muted-foreground/50">
                          <p className="text-sm">No additional account</p>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </>
            ) : (
              <>
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="bg-card shadow-sm rounded-lg p-6 border border-border">
                    <div className="text-center text-muted-foreground">
                      <p className="text-sm">Unable to load account data</p>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Power Data Section */}
        <div className="bg-card shadow-sm rounded-lg p-6 border border-border">
          <h2 className="text-lg font-medium text-foreground mb-4">Hoyanger Power Data</h2>
          
          {powerDataLoading ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-muted-foreground">Loading power data...</p>
            </div>
          ) : powerData.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Hours
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      1A
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      1B
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      2A
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      2B
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      3A
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      3B
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      4M3
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      5M2
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      pH
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-card divide-y divide-border">
                  {powerData.map((record, index) => (
                    <tr key={index} className="hover:bg-muted/50">
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-foreground font-mono">
                        {new Date(record.date).toLocaleDateString('en-GB')}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-foreground">
                        {record.hourly_records}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-foreground">
                        {record["1a"] !== null && record["1a"] !== undefined ? record["1a"].toFixed(2) : '-'}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-foreground">
                        {record["1b"] !== null && record["1b"] !== undefined ? record["1b"].toFixed(2) : '-'}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-foreground">
                        {record["2a"] !== null && record["2a"] !== undefined ? record["2a"].toFixed(2) : '-'}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-foreground">
                        {record["2b"] !== null && record["2b"] !== undefined ? record["2b"].toFixed(2) : '-'}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-foreground">
                        {record["3a"] !== null && record["3a"] !== undefined ? record["3a"].toFixed(2) : '-'}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-foreground">
                        {record["3b"] !== null && record["3b"] !== undefined ? record["3b"].toFixed(2) : '-'}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-foreground">
                        {record["4m3"] !== null && record["4m3"] !== undefined ? record["4m3"].toFixed(2) : '-'}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-foreground">
                        {record["5m2"] !== null && record["5m2"] !== undefined ? record["5m2"].toFixed(2) : '-'}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-foreground">
                        {record.ph !== null && record.ph !== undefined ? (
                          <span className={`font-medium ${
                            record.ph >= 7 && record.ph <= 14 ? 'text-blue-600' : 
                            record.ph >= 0 && record.ph < 7 ? 'text-orange-600' : 
                            'text-red-600'
                          }`}>
                            {record.ph.toFixed(3)}
                          </span>
                        ) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 text-sm text-muted-foreground">
                Showing first daily record for the last 70 days. Data refreshes automatically.
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">No power data available.</p>
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