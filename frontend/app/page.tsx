
"use client";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import DashboardLayout from '@/components/DashboardLayout';
import { hasUserGroup } from '@/lib/auth-utils';
import toast from 'react-hot-toast';
import { ExternalLink } from 'lucide-react';

interface TableRecord {
  [key: string]: any;
}

export default function HomePage() {
  const { data: session, status } = useSession();
  const [tableData, setTableData] = useState<TableRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if user has Scale42 access
  const hasScale42Access = hasUserGroup(session, 'Scale42');

  console.log('🔍 HomePage Debug:', {
    sessionStatus: status,
    hasSession: !!session,
    userEmail: session?.user?.email,
    hasScale42Access,
    userGroups: (session?.user as any)?.groups,
  });

  const makeAuthenticatedRequest = async (url: string, options: RequestInit = {}) => {
    if (!session?.user?.email) {
      throw new Error('No session available');
    }

    const userInfo = {
      email: session.user.email,
      name: session.user.name || session.user.email,
      image: session.user.image || ''
    };

    const authHeader = `Bearer ${btoa(JSON.stringify(userInfo))}`;

    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    });
  };

  useEffect(() => {
    if (hasScale42Access && status === "authenticated") {
      fetchTableData();
    }
  }, [hasScale42Access, status]);

  const fetchTableData = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('📡 Fetching table data for Scale42 user...');

      // Use the backend proxy to fetch table data
      const response = await makeAuthenticatedRequest('/api/proxy/nocodb/table/msspusqx9ee9xkd');

      console.log('📡 API Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('❌ API Error:', errorData);
        throw new Error(`Failed to fetch table data: ${errorData.error || response.statusText}`);
      }

      const data = await response.json();
      console.log('✅ API Response data:', data);
      
      let records = data.records || data.list || [];
      
      // Sort by invoiceDate (newest first)
      records = records.sort((a: any, b: any) => {
        const dateA = new Date(a.invoiceDate || 0);
        const dateB = new Date(b.invoiceDate || 0);
        return dateB.getTime() - dateA.getTime();
      });
      
      console.log('📊 Records count:', records.length);

      setTableData(records);
    } catch (err) {
      console.error('❌ Error fetching table data:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch table data';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Format date as dd/mm/yyyy
  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Truncate text to specified length
  const truncateText = (text: string, maxLength: number = 30) => {
    if (!text) return '-';
    const str = String(text);
    return str.length > maxLength ? str.substring(0, maxLength) + '...' : str;
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

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="mt-2 text-muted-foreground">Welcome to Scale42 - Your renewable energy command center</p>
        </div>

        {/* Scale42 Table Widget - Only visible to Scale42 group */}
        {hasScale42Access && (
          <div className="bg-card rounded-lg border border-border">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Scale42 Data Table</h3>
                <p className="text-sm text-muted-foreground">Full table data from NocoDB table: msspusqx9ee9xkd</p>
              </div>
              {tableData.length > 0 && tableData[0]?.webViewLink && (
                <a
                  href={String(tableData[0].webViewLink)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  View in Drive
                </a>
              )}
            </div>

            {loading ? (
              <div className="p-6 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-2 text-muted-foreground">Loading table data...</p>
              </div>
            ) : error ? (
              <div className="p-6 text-center">
                <p className="text-red-500">Error: {error}</p>
                <button
                  onClick={fetchTableData}
                  className="mt-2 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
                >
                  Retry
                </button>
              </div>
            ) : tableData.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-muted-foreground">No data available</p>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[50vh]">
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        From
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Username
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Total Amount
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Company
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-card divide-y divide-border">
                    {tableData.map((record, index) => (
                      <tr key={index} className="hover:bg-accent group">
                        {/* Date */}
                        <td className="px-4 py-3 text-sm text-foreground whitespace-nowrap">
                          {formatDate(record.invoiceDate)}
                        </td>
                        
                        {/* From (truncated with link and tooltip) */}
                        <td className="px-4 py-3 text-sm relative group/tooltip">
                          {record.webViewLink ? (
                            <a 
                              href={String(record.webViewLink)} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1"
                            >
                              {truncateText(record.From, 25)}
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span>{truncateText(record.From, 25)}</span>
                          )}
                          
                          {/* Tooltip with full details */}
                          {(record.name || record.shortDescription || record.invoiceNumber || record.To || record.card || record.dueDate || record.Project || record['Company Card Used'] || record['User Description']) && (
                            <div className="invisible group-hover/tooltip:visible absolute z-10 left-0 top-full mt-1 w-80 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg">
                              <div className="space-y-1">
                                {record.name && (
                                  <div><span className="font-semibold">Name:</span> {record.name}</div>
                                )}
                                {record.shortDescription && (
                                  <div><span className="font-semibold">Description:</span> {record.shortDescription}</div>
                                )}
                                {record.invoiceNumber && (
                                  <div><span className="font-semibold">Invoice #:</span> {record.invoiceNumber}</div>
                                )}
                                {record.To && (
                                  <div><span className="font-semibold">To:</span> {record.To}</div>
                                )}
                                {record.card && (
                                  <div><span className="font-semibold">Card:</span> {record.card}</div>
                                )}
                                {record.dueDate && (
                                  <div><span className="font-semibold">Due Date:</span> {formatDate(record.dueDate)}</div>
                                )}
                                {record.Project && (
                                  <div><span className="font-semibold">Project:</span> {record.Project}</div>
                                )}
                                {record['Company Card Used'] && (
                                  <div><span className="font-semibold">Company Card:</span> {record['Company Card Used']}</div>
                                )}
                                {record['User Description'] && (
                                  <div><span className="font-semibold">User Desc:</span> {record['User Description']}</div>
                                )}
                              </div>
                            </div>
                          )}
                        </td>
                        
                        {/* Username */}
                        <td className="px-4 py-3 text-sm text-foreground">
                          {record.username || '-'}
                        </td>
                        
                        {/* Total Amount with Currency Code */}
                        <td className="px-4 py-3 text-sm text-foreground whitespace-nowrap">
                          {record['Total Amount'] && record['Currency Code'] 
                            ? `${record['Total Amount']} ${record['Currency Code']}`
                            : record['Total Amount'] || '-'}
                        </td>
                        
                        {/* Company */}
                        <td className="px-4 py-3 text-sm text-foreground">
                          {record.Company || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Public content for all users */}
        {!hasScale42Access && (
          <div className="text-center py-12">
            <h2 className="text-2xl font-semibold text-foreground mb-4">Welcome to Scale42</h2>
            <p className="text-muted-foreground">
              Your renewable energy command center. Please sign in to access the dashboard.
            </p>
            <div className="mt-4 p-4 bg-yellow-100 text-yellow-800 rounded">
              <p className="text-sm">Debug: {status === 'authenticated' ? `Logged in as ${session?.user?.email}, but no Scale42 access` : 'Not logged in'}</p>
              {status === 'authenticated' && (
                <p className="text-xs mt-2">Groups: {JSON.stringify((session?.user as any)?.groups || 'None')}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
