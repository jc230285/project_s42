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

interface HoyangerEnergyRecord {
  [key: string]: any; // Flexible to handle all fields from the view
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
  const [energyReportData, setEnergyReportData] = useState<HoyangerEnergyRecord[]>([]);
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
    const fetchEnergyReportData = async () => {
      console.log('🔄 Fetching energy report data...');
      try {
        if (!session?.user?.email) {
          console.log('❌ No session or email, skipping energy report data fetch');
          setPowerDataLoading(false);
          return;
        }

        console.log('✅ Session found, proceeding with energy report data fetch');

        // Create authorization header
        const userInfo = {
          email: session.user.email,
          name: session.user.name || session.user.email,
          image: session.user.image || ""
        };
        const authHeader = `Bearer ${btoa(JSON.stringify(userInfo))}`;

        console.log('📡 Making request to /api/proxy/nocodb');

        // Fetch power data from NocoDB - Using the v_HoyangerEnergyReport view
        const response = await fetch('/api/proxy/nocodb', {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: `SELECT * FROM \`v_HoyangerEnergyReport\``
          })
        });

        console.log('📊 Response status:', response.status);

        if (response.ok) {
          const data = await response.json();
          console.log('✅ Energy report data received:', data);
          console.log('✅ Energy report rows:', data.rows);
          console.log('✅ Energy report rows length:', data.rows?.length);
          
          // Show all fields for the first record to understand the structure
          if (data.rows && data.rows.length > 0) {
            console.log('📋 First record fields:', Object.keys(data.rows[0]));
            console.log('📋 First record data:', data.rows[0]);
          }
          
          setEnergyReportData(data.rows || []);
        } else {
          const errorText = await response.text();
          console.error('❌ Failed to fetch energy report data:', response.status, response.statusText, errorText);
        }
      } catch (error) {
        console.error('💥 Error fetching energy report data:', error);
      } finally {
        setPowerDataLoading(false);
      }
    };

    if (session) {
      console.log('🚀 Session available, attempting to fetch energy report data');
      fetchEnergyReportData();
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

  console.log('🔍 Energy report data state:', { energyReportData, powerDataLoading, energyReportDataLength: energyReportData.length });

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

        {/* Energy Report Data Section */}
        <div className="bg-card shadow-sm rounded-lg p-6 border border-border">
          <h2 className="text-lg font-medium text-foreground mb-4">Hoyanger Energy Report (v_HoyangerEnergyReport)</h2>
          
          {powerDataLoading ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-muted-foreground">Loading energy report data...</p>
            </div>
          ) : energyReportData.length > 0 ? (
            <div className="space-y-6">
              {/* Key Metrics Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
                  <h4 className="font-medium text-blue-800 dark:text-blue-200 text-sm mb-1">Latest Date</h4>
                  <p className="text-lg font-bold text-blue-900 dark:text-blue-100">{energyReportData[0]?.date || 'N/A'}</p>
                </div>
                <div className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg p-4 border border-green-200 dark:border-green-700">
                  <h4 className="font-medium text-green-800 dark:text-green-200 text-sm mb-1">Total Wh (Latest)</h4>
                  <p className="text-lg font-bold text-green-900 dark:text-green-100">{energyReportData[0]?.total_Wh ? energyReportData[0].total_Wh.toFixed(2) : 'N/A'}</p>
                </div>
                <div className="bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg p-4 border border-purple-200 dark:border-purple-700">
                  <h4 className="font-medium text-purple-800 dark:text-purple-200 text-sm mb-1">Avg Watts (Latest)</h4>
                  <p className="text-lg font-bold text-purple-900 dark:text-purple-100">{energyReportData[0]?.avg_W ? energyReportData[0].avg_W.toFixed(2) : 'N/A'}</p>
                </div>
                <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 rounded-lg p-4 border border-yellow-200 dark:border-yellow-700">
                  <h4 className="font-medium text-yellow-800 dark:text-yellow-200 text-sm mb-1">USD Equivalent</h4>
                  <p className="text-lg font-bold text-yellow-900 dark:text-yellow-100">${energyReportData[0]?.usd_equivalent ? energyReportData[0].usd_equivalent.toFixed(2) : 'N/A'}</p>
                </div>
                <div className={`rounded-lg p-4 border ${(() => {
                  const latestRecord = energyReportData[0];
                  if (!latestRecord?.total_Wh_converted || !latestRecord?.usd_equivalent) return 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-700';
                  const nokToUsd = latestRecord.total_Wh_converted / 10.85; // Approximate NOK to USD conversion
                  const profit = latestRecord.usd_equivalent - nokToUsd;
                  return profit >= 0 
                    ? 'bg-gradient-to-r from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 border-emerald-200 dark:border-emerald-700'
                    : 'bg-gradient-to-r from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 border-red-200 dark:border-red-700';
                })()}`}>
                  <h4 className={`font-medium text-sm mb-1 ${(() => {
                    const latestRecord = energyReportData[0];
                    if (!latestRecord?.total_Wh_converted || !latestRecord?.usd_equivalent) return 'text-gray-800 dark:text-gray-200';
                    const nokToUsd = latestRecord.total_Wh_converted / 10.85;
                    const profit = latestRecord.usd_equivalent - nokToUsd;
                    return profit >= 0 ? 'text-emerald-800 dark:text-emerald-200' : 'text-red-800 dark:text-red-200';
                  })()}`}>Profit/Loss</h4>
                  <p className={`text-lg font-bold ${(() => {
                    const latestRecord = energyReportData[0];
                    if (!latestRecord?.total_Wh_converted || !latestRecord?.usd_equivalent) return 'text-gray-900 dark:text-gray-100';
                    const nokToUsd = latestRecord.total_Wh_converted / 10.85;
                    const profit = latestRecord.usd_equivalent - nokToUsd;
                    return profit >= 0 ? 'text-emerald-900 dark:text-emerald-100' : 'text-red-900 dark:text-red-100';
                  })()}`}>
                    {(() => {
                      const latestRecord = energyReportData[0];
                      if (!latestRecord?.total_Wh_converted || !latestRecord?.usd_equivalent) return 'N/A';
                      const nokToUsd = latestRecord.total_Wh_converted / 10.85;
                      const profit = latestRecord.usd_equivalent - nokToUsd;
                      return `$${profit.toFixed(2)}`;
                    })()}
                  </p>
                </div>
                <div className={`rounded-lg p-4 border ${(() => {
                  const latestRecord = energyReportData[0];
                  if (!latestRecord?.total_Wh_converted || !latestRecord?.usd_equivalent) return 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-700';
                  const nokToUsd = latestRecord.total_Wh_converted / 10.85;
                  const profit = latestRecord.usd_equivalent - nokToUsd;
                  const profitPercentage = (profit / nokToUsd) * 100;
                  return profitPercentage >= 0 
                    ? 'bg-gradient-to-r from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 border-emerald-200 dark:border-emerald-700'
                    : 'bg-gradient-to-r from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 border-red-200 dark:border-red-700';
                })()}`}>
                  <h4 className={`font-medium text-sm mb-1 ${(() => {
                    const latestRecord = energyReportData[0];
                    if (!latestRecord?.total_Wh_converted || !latestRecord?.usd_equivalent) return 'text-gray-800 dark:text-gray-200';
                    const nokToUsd = latestRecord.total_Wh_converted / 10.85;
                    const profit = latestRecord.usd_equivalent - nokToUsd;
                    const profitPercentage = (profit / nokToUsd) * 100;
                    return profitPercentage >= 0 ? 'text-emerald-800 dark:text-emerald-200' : 'text-red-800 dark:text-red-200';
                  })()}`}>Profit %</h4>
                  <p className={`text-lg font-bold ${(() => {
                    const latestRecord = energyReportData[0];
                    if (!latestRecord?.total_Wh_converted || !latestRecord?.usd_equivalent) return 'text-gray-900 dark:text-gray-100';
                    const nokToUsd = latestRecord.total_Wh_converted / 10.85;
                    const profit = latestRecord.usd_equivalent - nokToUsd;
                    const profitPercentage = (profit / nokToUsd) * 100;
                    return profitPercentage >= 0 ? 'text-emerald-900 dark:text-emerald-100' : 'text-red-900 dark:text-red-100';
                  })()}`}>
                    {(() => {
                      const latestRecord = energyReportData[0];
                      if (!latestRecord?.total_Wh_converted || !latestRecord?.usd_equivalent) return 'N/A';
                      const nokToUsd = latestRecord.total_Wh_converted / 10.85;
                      const profit = latestRecord.usd_equivalent - nokToUsd;
                      const profitPercentage = (profit / nokToUsd) * 100;
                      return `${profitPercentage >= 0 ? '+' : ''}${profitPercentage.toFixed(2)}%`;
                    })()}
                  </p>
                </div>
              </div>

              {/* Fields Overview */}
              <div className="bg-muted/50 rounded-lg p-4">
                <h3 className="font-medium text-foreground mb-2">Available Fields ({Object.keys(energyReportData[0]).length})</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
                  {Object.keys(energyReportData[0]).map((field, index) => (
                    <div key={index} className="bg-card px-3 py-1 rounded border text-foreground font-mono">
                      {field}
                    </div>
                  ))}
                </div>
              </div>

              {/* Data Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-muted">
                    <tr>
                      {Object.keys(energyReportData[0]).map((field) => (
                        <th key={field} className={`px-3 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                          field === 'date' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200' :
                          field === 'total_Wh' || field === 'total_Wh_converted' || field === 'avg_W' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' :
                          field === 'S19_Watts' || field.includes('Ratio') ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200' :
                          field === 'currency_amount' || field === 'usd_equivalent' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          {field}
                        </th>
                      ))}
                      {/* Add calculated columns */}
                      <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200">
                        Cost_USD
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200">
                        Profit_USD
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200">
                        Profit_%
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-card divide-y divide-border">
                    {energyReportData.map((record, index) => (
                      <tr key={index} className="hover:bg-muted/50">
                        {Object.entries(record).map(([field, value], fieldIndex) => (
                          <td key={fieldIndex} className={`px-3 py-4 whitespace-nowrap text-sm ${
                            field === 'date' ? 'font-mono font-bold text-blue-700 dark:text-blue-300' :
                            field === 'total_Wh' || field === 'total_Wh_converted' || field === 'avg_W' ? 'font-bold text-green-700 dark:text-green-300' :
                            field === 'S19_Watts' || field.includes('Ratio') ? 'font-bold text-purple-700 dark:text-purple-300' :
                            field === 'currency_amount' || field === 'usd_equivalent' ? 'font-bold text-yellow-700 dark:text-yellow-300' :
                            field.includes('_W') ? 'text-orange-600 dark:text-orange-400' :
                            'text-foreground'
                          }`}>
                            {value !== null && value !== undefined ? (
                              typeof value === 'number' ? (
                                field.toLowerCase().includes('date') || field.toLowerCase().includes('time') ? 
                                  new Date(value).toLocaleString() :
                                field === 'total_Wh' || field === 'total_Wh_converted' || field === 'avg_W' ? 
                                  value.toFixed(2) :
                                field === 'S19_Watts' ? 
                                  value.toString() :
                                field.includes('Ratio') || field === 'currency_amount' || field === 'usd_equivalent' ? 
                                  value.toFixed(6) :
                                field === 'ph' ? 
                                  value.toFixed(7) :
                                field.includes('_W') ? 
                                  value.toFixed(1) :
                                value % 1 !== 0 ? value.toFixed(3) : value.toString()
                              ) : (
                                field.toLowerCase().includes('date') || field.toLowerCase().includes('time') ? 
                                  new Date(value).toLocaleString() : 
                                  value.toString()
                              )
                            ) : (
                              <span className="text-muted-foreground">NULL</span>
                            )}
                          </td>
                        ))}
                        {/* Add calculated columns */}
                        <td className="px-3 py-4 whitespace-nowrap text-sm font-bold text-orange-700 dark:text-orange-300">
                          {record.total_Wh_converted ? `$${(record.total_Wh_converted / 10.85).toFixed(6)}` : 'N/A'}
                        </td>
                        <td className={`px-3 py-4 whitespace-nowrap text-sm font-bold ${(() => {
                          if (!record.total_Wh_converted || !record.usd_equivalent) return 'text-gray-500';
                          const nokToUsd = record.total_Wh_converted / 10.85;
                          const profit = record.usd_equivalent - nokToUsd;
                          return profit >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300';
                        })()}`}>
                          {(() => {
                            if (!record.total_Wh_converted || !record.usd_equivalent) return 'N/A';
                            const nokToUsd = record.total_Wh_converted / 10.85;
                            const profit = record.usd_equivalent - nokToUsd;
                            return `$${profit.toFixed(6)}`;
                          })()}
                        </td>
                        <td className={`px-3 py-4 whitespace-nowrap text-sm font-bold ${(() => {
                          if (!record.total_Wh_converted || !record.usd_equivalent) return 'text-gray-500';
                          const nokToUsd = record.total_Wh_converted / 10.85;
                          const profit = record.usd_equivalent - nokToUsd;
                          const profitPercentage = (profit / nokToUsd) * 100;
                          return profitPercentage >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300';
                        })()}`}>
                          {(() => {
                            if (!record.total_Wh_converted || !record.usd_equivalent) return 'N/A';
                            const nokToUsd = record.total_Wh_converted / 10.85;
                            const profit = record.usd_equivalent - nokToUsd;
                            const profitPercentage = (profit / nokToUsd) * 100;
                            return `${profitPercentage >= 0 ? '+' : ''}${profitPercentage.toFixed(2)}%`;
                          })()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-4 text-sm text-muted-foreground">
                  Showing all {energyReportData.length} records from v_HoyangerEnergyReport view.
                </div>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">No energy report data available.</p>
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