"use client";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import DashboardLayout from '@/components/DashboardLayout';
import { hasUserGroup } from '@/lib/auth-utils';
import toast from 'react-hot-toast';
import { ExternalLink, X } from 'lucide-react';

interface TableRecord {
  [key: string]: any;
}

function ReceiptsPage() {
  const { data: session, status } = useSession();
  const [tableData, setTableData] = useState<TableRecord[]>([]);
  const [filteredData, setFilteredData] = useState<TableRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Filter states
  const [filters, setFilters] = useState({
    username: '',
    from: '',
    company: '',
    companyCardUsed: '',
    project: ''
  });

  // Check if user has Scale42 access
  const hasScale42Access = hasUserGroup(session, 'Scale42');

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

  // Apply filters whenever tableData or filters change
  useEffect(() => {
    applyFilters();
  }, [tableData, filters]);

  // Get unique values for dropdown filters
  const getUniqueValues = (fieldName: string) => {
    const values = tableData
      .map(record => record[fieldName])
      .filter(value => value && value !== '')
      .filter((value, index, self) => self.indexOf(value) === index)
      .sort();
    return ['', ...values]; // Add empty option for "All"
  };

  const applyFilters = () => {
    let filtered = [...tableData];

    if (filters.username) {
      filtered = filtered.filter(record => 
        record.username?.toLowerCase().includes(filters.username.toLowerCase())
      );
    }
    if (filters.from) {
      filtered = filtered.filter(record => 
        record.From?.toLowerCase().includes(filters.from.toLowerCase())
      );
    }
    if (filters.company) {
      filtered = filtered.filter(record => 
        record.Company?.toLowerCase().includes(filters.company.toLowerCase())
      );
    }
    if (filters.companyCardUsed) {
      filtered = filtered.filter(record => 
        record['Company Card Used']?.toLowerCase().includes(filters.companyCardUsed.toLowerCase())
      );
    }
    if (filters.project) {
      filtered = filtered.filter(record => 
        record.Project?.toLowerCase().includes(filters.project.toLowerCase())
      );
    }

    setFilteredData(filtered);
  };

  const clearFilters = () => {
    setFilters({
      username: '',
      from: '',
      company: '',
      companyCardUsed: '',
      project: ''
    });
  };

  const fetchTableData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await makeAuthenticatedRequest(
        `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/nocodb/table/m5xvvb2x5ub9c72`
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || `Failed to fetch table data (${response.status})`);
      }

      const data = await response.json();
      console.log('📊 Receipt Data:', data);
      setTableData(data.list || []);
      toast.success('Receipt data loaded successfully');
    } catch (error) {
      console.error('❌ Error fetching table data:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load receipt data';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Format date as dd/mm/yyyy
  const formatDate = (dateString: any) => {
    if (!dateString) return '-';
    
    try {
      let date: Date;
      
      // Try parsing dd/mm/yyyy format first
      if (typeof dateString === 'string' && dateString.includes('/')) {
        const parts = dateString.split('/');
        if (parts.length === 3) {
          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
          const year = parseInt(parts[2], 10);
          date = new Date(year, month, day);
          
          if (!isNaN(date.getTime())) {
            const formattedDay = String(date.getDate()).padStart(2, '0');
            const formattedMonth = String(date.getMonth() + 1).padStart(2, '0');
            const formattedYear = date.getFullYear();
            return `${formattedDay}/${formattedMonth}/${formattedYear}`;
          }
        }
      }
      
      // Fallback to standard Date parsing
      date = new Date(dateString);
      
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
          <h1 className="text-3xl font-bold text-foreground">Receipt Tracker</h1>
          <p className="mt-2 text-muted-foreground">Manage and track all Scale42 receipts</p>
        </div>

        {/* Receipt Tracker Table */}
        <div className="bg-card rounded-lg border border-border">
          <div className="px-6 py-4 border-b border-border flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Scale42 Receipt Tracker</h3>
            </div>
            {tableData.length > 0 && tableData[0]?.webViewLink && (
              <a
                href="https://t.me/+V-RgN2TACVkwNzk0"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Upload to Telegram
              </a>
            )}
          </div>

          {loading ? (
            <div className="p-6 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-muted-foreground">Loading receipt data...</p>
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
            <>
              {/* Filters */}
              <div className="px-6 py-4 bg-muted/50 border-b border-border">
                <div className="flex flex-wrap gap-3 items-end">
                  <div className="flex-1 min-w-[150px]">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">From</label>
                    <input
                      type="text"
                      value={filters.from}
                      onChange={(e) => setFilters({...filters, from: e.target.value})}
                      placeholder="Filter by from..."
                      className="w-full px-3 py-1.5 text-sm border border-border rounded bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div className="flex-1 min-w-[150px]">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Username</label>
                    <select
                      value={filters.username}
                      onChange={(e) => setFilters({...filters, username: e.target.value})}
                      className="w-full px-3 py-1.5 text-sm border border-border rounded bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      {getUniqueValues('username').map((value, idx) => (
                        <option key={idx} value={value}>
                          {value || 'All'}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1 min-w-[150px]">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Company Card</label>
                    <select
                      value={filters.companyCardUsed}
                      onChange={(e) => setFilters({...filters, companyCardUsed: e.target.value})}
                      className="w-full px-3 py-1.5 text-sm border border-border rounded bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      {getUniqueValues('Company Card Used').map((value, idx) => (
                        <option key={idx} value={value}>
                          {value || 'All'}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1 min-w-[150px]">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Company</label>
                    <select
                      value={filters.company}
                      onChange={(e) => setFilters({...filters, company: e.target.value})}
                      className="w-full px-3 py-1.5 text-sm border border-border rounded bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      {getUniqueValues('Company').map((value, idx) => (
                        <option key={idx} value={value}>
                          {value || 'All'}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1 min-w-[150px]">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Project</label>
                    <select
                      value={filters.project}
                      onChange={(e) => setFilters({...filters, project: e.target.value})}
                      className="w-full px-3 py-1.5 text-sm border border-border rounded bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      {getUniqueValues('Project').map((value, idx) => (
                        <option key={idx} value={value}>
                          {value || 'All'}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={clearFilters}
                    className="px-4 py-1.5 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors flex items-center gap-1"
                  >
                    <X className="w-4 h-4" />
                    Clear
                  </button>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  Showing {filteredData.length} of {tableData.length} records
                </div>
              </div>

              {/* Table */}
              <div className="relative overflow-x-auto" style={{ maxHeight: '600px' }}>
                <table className="w-full divide-y divide-border">
                  <thead className="bg-muted sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                        Date
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                        From
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                        Username
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                        Total Amount
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                        Company
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-card divide-y divide-border">
                    {filteredData.map((record, index) => (
                      <tr key={index} className="hover:bg-accent group">
                        {/* Date */}
                        <td className="px-4 py-3 text-sm text-foreground whitespace-nowrap">
                          {formatDate(record.invoiceDate)}
                        </td>
                        
                        {/* From (truncated with link and tooltip) */}
                        <td className="px-4 py-3 text-sm relative">
                          <div className="group/tooltip">
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
                            
                            {/* Tooltip with full details - Fixed to bottom-right */}
                            {(record.name || record.shortDescription || record.invoiceNumber || record.To || record.card || record.dueDate || record.Project || record['Company Card Used'] || record['User Description'] || record.Receipt || record.Image) && (
                              <div className="invisible group-hover/tooltip:visible fixed bottom-4 right-4 w-96 p-4 bg-gray-900 text-white text-xs rounded-lg shadow-2xl z-50 border border-gray-700">
                                <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
                                  {/* Image/Receipt Preview */}
                                  {(record.Receipt || record.Image || record.receipt || record.image) && (() => {
                                    const imageUrl = record.Receipt || record.Image || record.receipt || record.image;
                                    // Handle NocoDB attachment format
                                    let imgSrc = '';
                                    if (typeof imageUrl === 'string') {
                                      try {
                                        const parsed = JSON.parse(imageUrl);
                                        if (Array.isArray(parsed) && parsed.length > 0) {
                                          imgSrc = parsed[0].url || parsed[0].signedUrl || parsed[0].path || '';
                                        } else if (parsed.url || parsed.signedUrl || parsed.path) {
                                          imgSrc = parsed.url || parsed.signedUrl || parsed.path;
                                        } else {
                                          imgSrc = imageUrl;
                                        }
                                      } catch (e) {
                                        // If not JSON, treat as direct URL
                                        imgSrc = imageUrl;
                                      }
                                    } else if (Array.isArray(imageUrl) && imageUrl.length > 0) {
                                      imgSrc = imageUrl[0].url || imageUrl[0].signedUrl || imageUrl[0].path || '';
                                    } else if (imageUrl?.url || imageUrl?.signedUrl || imageUrl?.path) {
                                      imgSrc = imageUrl.url || imageUrl.signedUrl || imageUrl.path;
                                    }

                                    return imgSrc ? (
                                      <div className="mb-3 border-b border-gray-700 pb-3">
                                        <div className="font-semibold text-blue-300 mb-2">Receipt Image:</div>
                                        <img 
                                          src={imgSrc} 
                                          alt="Receipt" 
                                          className="w-full h-auto rounded border border-gray-600 max-h-[300px] object-contain bg-white"
                                          onError={(e) => {
                                            const target = e.target as HTMLImageElement;
                                            target.style.display = 'none';
                                          }}
                                        />
                                        <a
                                          href={imgSrc}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-blue-400 hover:text-blue-300 underline text-xs mt-1 inline-block"
                                        >
                                          Open full resolution →
                                        </a>
                                      </div>
                                    ) : null;
                                  })()}
                                  
                                  {record.name && (
                                    <div><span className="font-semibold text-blue-300">Name:</span> <span className="text-gray-100">{record.name}</span></div>
                                  )}
                                  {record.shortDescription && (
                                    <div><span className="font-semibold text-blue-300">Description:</span> <span className="text-gray-100">{record.shortDescription}</span></div>
                                  )}
                                  {record.invoiceNumber && (
                                    <div><span className="font-semibold text-blue-300">Invoice #:</span> <span className="text-gray-100">{record.invoiceNumber}</span></div>
                                  )}
                                  {record.From && (
                                    <div><span className="font-semibold text-blue-300">From:</span> <span className="text-gray-100">{record.From}</span></div>
                                  )}
                                  {record.To && (
                                    <div><span className="font-semibold text-blue-300">To:</span> <span className="text-gray-100">{record.To}</span></div>
                                  )}
                                  {record.card && (
                                    <div><span className="font-semibold text-blue-300">Card:</span> <span className="text-gray-100">{record.card}</span></div>
                                  )}
                                  {record.dueDate && (
                                    <div><span className="font-semibold text-blue-300">Due Date:</span> <span className="text-gray-100">{formatDate(record.dueDate)}</span></div>
                                  )}
                                  {record.Project && (
                                    <div><span className="font-semibold text-blue-300">Project:</span> <span className="text-gray-100">{record.Project}</span></div>
                                  )}
                                  {record.Company && (
                                    <div><span className="font-semibold text-blue-300">Company:</span> <span className="text-gray-100">{record.Company}</span></div>
                                  )}
                                  {record['Company Card Used'] && (
                                    <div><span className="font-semibold text-blue-300">Company Card:</span> <span className="text-gray-100">{record['Company Card Used']}</span></div>
                                  )}
                                  {record['User Description'] && (
                                    <div><span className="font-semibold text-blue-300">User Desc:</span> <span className="text-gray-100">{record['User Description']}</span></div>
                                  )}
                                  {record['Currency Code'] && (
                                    <div><span className="font-semibold text-blue-300">Currency:</span> <span className="text-gray-100">{record['Currency Code']}</span></div>
                                  )}
                                  {record.Country && (
                                    <div><span className="font-semibold text-blue-300">Country:</span> <span className="text-gray-100">{record.Country}</span></div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                        
                        {/* Username */}
                        <td className="px-4 py-3 text-sm text-foreground whitespace-nowrap">
                          {record.username || '-'}
                        </td>
                        
                        {/* Total Amount with Currency Code */}
                        <td className="px-4 py-3 text-sm text-foreground whitespace-nowrap">
                          {record['Total Amount'] && record['Currency Code'] 
                            ? `${record['Total Amount']} ${record['Currency Code']}`
                            : record['Total Amount'] || '-'}
                        </td>
                        
                        {/* Company */}
                        <td className="px-4 py-3 text-sm text-foreground whitespace-nowrap">
                          {record.Company || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

export default ReceiptsPage;
