
"use client";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import DashboardLayout from '@/components/DashboardLayout';
import { hasUserGroup } from '@/lib/auth-utils';
import toast from 'react-hot-toast';

interface TableRecord {
  [key: string]: any;
}

export default function HomePage() {
  const { data: session, status } = useSession();
  const [tableData, setTableData] = useState<TableRecord[]>([]);
  const [activityData, setActivityData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activityError, setActivityError] = useState<string | null>(null);

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
      fetchActivityData();
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

  const fetchActivityData = async () => {
    try {
      setActivityLoading(true);
      setActivityError(null);

      console.log('📡 Fetching activity data (comments and audits)...');

      // Fetch from both projects and landplots tables
      const [projectsResponse, landplotsResponse] = await Promise.all([
        makeAuthenticatedRequest('/api/proxy/nocodb/table/m53ta9fzt0c3bwy'), // projects
        makeAuthenticatedRequest('/api/proxy/nocodb/table/myahep8nywxasol')  // landplots
      ]);

      console.log('📡 Projects response status:', projectsResponse.status);
      console.log('📡 Landplots response status:', landplotsResponse.status);

      if (!projectsResponse.ok) {
        const errorData = await projectsResponse.json().catch(() => ({ error: 'Unknown error' }));
        console.error('❌ Projects API Error:', errorData);
        throw new Error(`Failed to fetch projects: ${errorData.error || projectsResponse.statusText}`);
      }

      if (!landplotsResponse.ok) {
        const errorData = await landplotsResponse.json().catch(() => ({ error: 'Unknown error' }));
        console.error('❌ Landplots API Error:', errorData);
        throw new Error(`Failed to fetch landplots: ${errorData.error || landplotsResponse.statusText}`);
      }

      const projectsData = await projectsResponse.json();
      const landplotsData = await landplotsResponse.json();

      console.log('✅ Projects data:', projectsData);
      console.log('✅ Landplots data:', landplotsData);

      const projectsRecords = projectsData.records || projectsData.list || [];
      const landplotsRecords = landplotsData.records || landplotsData.list || [];

      // Collect all comments and audits
      const activities: any[] = [];

      // Process projects
      projectsRecords.forEach((record: any) => {
        if (record.Comments) {
          activities.push({
            type: 'comment',
            source: 'Project',
            sourceName: record.Project || 'Unknown Project',
            content: record.Comments,
            timestamp: record.UpdatedAt || record.CreatedAt || new Date().toISOString(),
            recordId: record.Id
          });
        }
        if (record.Audit) {
          activities.push({
            type: 'audit',
            source: 'Project',
            sourceName: record.Project || 'Unknown Project',
            content: record.Audit,
            timestamp: record.UpdatedAt || record.CreatedAt || new Date().toISOString(),
            recordId: record.Id
          });
        }
      });

      // Process landplots
      landplotsRecords.forEach((record: any) => {
        if (record.Comments) {
          activities.push({
            type: 'comment',
            source: 'Landplot',
            sourceName: record['Plot Number'] || 'Unknown Plot',
            content: record.Comments,
            timestamp: record.UpdatedAt || record.CreatedAt || new Date().toISOString(),
            recordId: record.Id
          });
        }
        if (record.Audit) {
          activities.push({
            type: 'audit',
            source: 'Landplot',
            sourceName: record['Plot Number'] || 'Unknown Plot',
            content: record.Audit,
            timestamp: record.UpdatedAt || record.CreatedAt || new Date().toISOString(),
            recordId: record.Id
          });
        }
      });

      // Sort by timestamp (newest first)
      activities.sort((a, b) => {
        const dateA = new Date(a.timestamp);
        const dateB = new Date(b.timestamp);
        return dateB.getTime() - dateA.getTime();
      });

      console.log('📊 Activity records count:', activities.length);
      setActivityData(activities);
    } catch (err) {
      console.error('❌ Error fetching activity data:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch activity data';
      setActivityError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setActivityLoading(false);
    }
  };

  // Format date as dd/mm/yyyy
  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    try {
      // Handle various date formats
      let date: Date;
      
      // If it's already in dd/mm/yyyy format (like "25/09/2025")
      if (dateString.includes('/') && dateString.split('/').length === 3) {
        const parts = dateString.split(' ')[0].split('/');
        if (parts.length === 3) {
          // Check if it's dd/mm/yyyy or mm/dd/yyyy
          const day = parseInt(parts[0]);
          const month = parseInt(parts[1]);
          const year = parseInt(parts[2]);
          
          if (day > 12) {
            // Definitely dd/mm/yyyy
            date = new Date(year, month - 1, day);
          } else if (month > 12) {
            // Definitely mm/dd/yyyy
            date = new Date(year, day - 1, month);
          } else {
            // Ambiguous, assume dd/mm/yyyy
            date = new Date(year, month - 1, day);
          }
        } else {
          date = new Date(dateString);
        }
      } else {
        date = new Date(dateString);
      }
      
      if (isNaN(date.getTime())) return '-';
      
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch (error) {
      console.error('Error formatting date:', dateString, error);
      return '-';
    }
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

        {/* Two widgets side by side */}
        {hasScale42Access && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Scale42 Receipt Widget */}
            <div className="bg-card rounded-lg border border-border">
              <div className="px-6 py-4 border-b border-border flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Recent Receipts</h3>
                <p className="text-sm text-muted-foreground">Last 10 receipts</p>
              </div>
              <a
                href="/receipts"
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
              >
                View All Receipts
              </a>
            </div>

            {loading ? (
              <div className="p-6 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-2 text-muted-foreground">Loading receipts...</p>
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
                <p className="text-muted-foreground">No receipts available</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {tableData.slice(0, 10).map((record, index) => (
                  <div key={index} className="px-6 py-3 hover:bg-accent transition-colors flex items-center justify-between">
                    {/* Left: Date and From */}
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatDate(record.invoiceDate)}
                      </div>
                      <div className="text-sm text-foreground truncate">
                        {truncateText(record.From, 50)}
                      </div>
                    </div>
                    
                    {/* Right: Total Amount */}
                    <div className="text-sm font-semibold text-foreground whitespace-nowrap ml-4">
                      {record['Total Amount'] && record['Currency Code'] 
                        ? `${record['Total Amount']} ${record['Currency Code']}`
                        : record['Total Amount'] || '-'}
                    </div>
                  </div>
                ))}
              </div>
            )}
            </div>

            {/* Activity Widget - Comments and Audits */}
            <div className="bg-card rounded-lg border border-border">
              <div className="px-6 py-4 border-b border-border">
              <h3 className="text-lg font-semibold text-foreground">Recent Activity</h3>
              <p className="text-sm text-muted-foreground">Latest comments and audits from Projects and Landplots</p>
            </div>

            {activityLoading ? (
              <div className="p-6 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-2 text-muted-foreground">Loading activity...</p>
              </div>
            ) : activityError ? (
              <div className="p-6 text-center">
                <p className="text-red-500">Error: {activityError}</p>
                <button
                  onClick={fetchActivityData}
                  className="mt-2 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
                >
                  Retry
                </button>
              </div>
            ) : activityData.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-muted-foreground">No activity available</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {activityData.slice(0, 10).map((activity, index) => (
                  <div key={index} className="px-6 py-3 hover:bg-accent transition-colors">
                    <div className="flex items-start gap-3">
                      {/* Icon based on type */}
                      <div className={`mt-1 px-2 py-1 rounded text-xs font-semibold ${
                        activity.type === 'comment' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {activity.type === 'comment' ? '💬' : '📋'}
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-muted-foreground">
                            {activity.source}:
                          </span>
                          <span className="text-xs font-semibold text-foreground">
                            {truncateText(activity.sourceName, 40)}
                          </span>
                        </div>
                        <p className="text-sm text-foreground line-clamp-2">
                          {activity.content}
                        </p>
                        <div className="text-xs text-muted-foreground mt-1">
                          {formatDate(activity.timestamp)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            </div>
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
