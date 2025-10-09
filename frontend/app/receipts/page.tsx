"use client";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import DashboardLayout from '@/components/DashboardLayout';
import { hasUserGroup } from '@/lib/auth-utils';
import toast from 'react-hot-toast';
import { ExternalLink, X, Edit, Trash2, Save } from 'lucide-react';

interface TableRecord {
  [key: string]: any;
}

function ReceiptsPage() {
  const { data: session, status } = useSession();
  const [tableData, setTableData] = useState<TableRecord[]>([]);
  const [filteredData, setFilteredData] = useState<TableRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [companies, setCompanies] = useState<string[]>([]);
  
  // Modal states
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<TableRecord | null>(null);
  const [editedRecord, setEditedRecord] = useState<TableRecord | null>(null);
  
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
    console.log('🔍 Receipts Page - hasScale42Access:', hasScale42Access, 'status:', status);
    if (hasScale42Access && status === "authenticated") {
      console.log('✅ Fetching receipt data...');
      fetchTableData();
      fetchCompanies();
    } else if (status === "authenticated" && !hasScale42Access) {
      console.log('⛔ User does not have Scale42 access');
      setError('You do not have permission to view receipts');
    }
  }, [hasScale42Access, status]);

  // Fetch companies list
  const fetchCompanies = async () => {
    try {
      console.log('📡 Fetching companies list...');
      const response = await makeAuthenticatedRequest('/api/proxy/companies');
      console.log('📡 Companies API response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('📊 Companies data:', data);
        // API returns { companies: [...] } structure
        const companiesArray = data.companies || data;
        const companyNames = companiesArray.map((company: any) => company.full_name).filter(Boolean).sort();
        console.log('✅ Company names:', companyNames);
        setCompanies(companyNames);
      }
    } catch (error) {
      console.error('❌ Error fetching companies:', error);
    }
  };

  // Apply filters whenever tableData or filters change
  useEffect(() => {
    applyFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        `/api/proxy/nocodb/table/${process.env.NEXT_PUBLIC_NOCODB_RECEIPTS_TABLE_ID || 'msspusqx9ee9xkd'}`
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || `Failed to fetch table data (${response.status})`);
      }

      const data = await response.json();
      console.log('📊 Receipt Data:', data);
      
      let records = data.records || data.list || [];
      
      // Sort by invoiceDate (newest first)
      records = records.sort((a: any, b: any) => {
        const dateA = new Date(a.invoiceDate || 0);
        const dateB = new Date(b.invoiceDate || 0);
        return dateB.getTime() - dateA.getTime();
      });
      
      console.log('📊 Records count:', records.length);
      
      setTableData(records);
      toast.success(`Receipt data loaded successfully (${records.length} records)`);
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

  // Handle row click to open edit modal
  const handleRowClick = (record: TableRecord) => {
    setSelectedRecord(record);
    setEditedRecord({ ...record });
    setEditModalOpen(true);
  };

  // Handle delete click
  const handleDeleteClick = (record: TableRecord, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click
    setSelectedRecord(record);
    setDeleteModalOpen(true);
  };

  // Handle delete confirmation
  const handleDeleteConfirm = async () => {
    const driveId = selectedRecord?.driveid || selectedRecord?.driveId;
    
    if (!driveId) {
      toast.error('No Drive ID found for this record');
      console.error('Selected record:', selectedRecord);
      return;
    }

    try {
      console.log('🗑️ Deleting record with Drive ID:', driveId);
      
      const response = await fetch('https://n8n.edbmotte.com/webhook/85451c83-58de-4c9c-92b1-2d1f5771bf97', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          driveId: driveId
        }),
      });

      console.log('🌐 Webhook response status:', response.status);

      if (!response.ok) {
        throw new Error(`Delete webhook failed: ${response.status}`);
      }

      toast.success('Delete request sent successfully');
      setDeleteModalOpen(false);
      setSelectedRecord(null);
      
      // Refresh the table data
      fetchTableData();
    } catch (error) {
      console.error('❌ Error deleting record:', error);
      toast.error('Failed to delete record');
    }
  };

  // Handle save edit
  const handleSaveEdit = async () => {
    if (!editedRecord || !selectedRecord) {
      toast.error('No record selected');
      return;
    }

    const recordId = editedRecord.Id || selectedRecord.Id;
    if (!recordId) {
      toast.error('Record ID not found');
      return;
    }

    try {
      console.log('💾 Saving record:', recordId);
      console.log('📝 Updated data:', editedRecord);

      // Get the table ID from environment or use the receipts table ID
      const tableId = process.env.NEXT_PUBLIC_NOCODB_RECEIPTS_TABLE_ID || 'msspusqx9ee9xkd';

      // Prepare the field data (exclude metadata fields)
      const fieldData: any = {};
      Object.keys(editedRecord).forEach(key => {
        // Skip system fields that shouldn't be updated
        if (!['Id', 'CreatedAt', 'UpdatedAt'].includes(key)) {
          fieldData[key] = editedRecord[key];
        }
      });

      console.log('📤 Sending update request...');
      console.log('Table ID:', tableId);
      console.log('Record ID:', recordId);
      console.log('Field data:', fieldData);

      const response = await makeAuthenticatedRequest(
        `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/nocodb/update-row`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            table_id: tableId,
            row_id: String(recordId),
            field_data: fieldData
          }),
        }
      );

      console.log('📡 Update response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        console.error('❌ Update error:', errorData);
        throw new Error(errorData.detail || `Failed to update record (${response.status})`);
      }

      const result = await response.json();
      console.log('✅ Update result:', result);

      toast.success('Record updated successfully');
      setEditModalOpen(false);
      setSelectedRecord(null);
      setEditedRecord(null);
      
      // Refresh the table data
      fetchTableData();
    } catch (error) {
      console.error('❌ Error saving record:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save record';
      toast.error(errorMessage);
    }
  };

  // Handle field change in edit modal
  const handleFieldChange = (fieldName: string, value: any) => {
    if (!editedRecord) return;
    setEditedRecord({
      ...editedRecord,
      [fieldName]: value
    });
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
                      <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                        Total Amount
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                        Company
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-card divide-y divide-border">
                    {filteredData.map((record, index) => (
                      <tr 
                        key={index} 
                        className="hover:bg-accent group cursor-pointer"
                        onClick={() => handleRowClick(record)}
                      >
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
                            {(record.name || record.shortDescription || record.invoiceNumber || record.To || record.card || record.dueDate || record.Project || record['Company Card Used'] || record['User Description'] || record.Receipt || record.Image || record.thumbnailLink) && (
                              <div className="invisible group-hover/tooltip:visible fixed bottom-4 right-4 w-96 p-4 bg-gray-900 text-white text-xs rounded-lg shadow-2xl z-50 border border-gray-700">
                                <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
                                  {/* Thumbnail Image Preview */}
                                  {record.thumbnailLink && (
                                    <div className="mb-3 border-b border-gray-700 pb-3">
                                      <div className="font-semibold text-blue-300 mb-2">Receipt Preview:</div>
                                      <img 
                                        src={String(record.thumbnailLink)} 
                                        alt="Receipt Thumbnail" 
                                        className="w-full h-auto rounded border border-gray-600 max-h-[200px] object-contain bg-white"
                                        onError={(e) => {
                                          const target = e.target as HTMLImageElement;
                                          target.style.display = 'none';
                                        }}
                                      />
                                    </div>
                                  )}

                                  {/* Image/Receipt Preview (fallback for old records) */}
                                  {!record.thumbnailLink && (record.Receipt || record.Image || record.receipt || record.image) && (() => {
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
                        <td className="px-4 py-3 text-sm text-foreground whitespace-nowrap text-right">
                          {record['Total Amount'] != null && record['Currency Code'] 
                            ? `${Number(record['Total Amount']).toFixed(2)} ${record['Currency Code']}`
                            : record['Total Amount'] != null 
                              ? Number(record['Total Amount']).toFixed(2)
                              : '-'}
                        </td>
                        
                        {/* Company */}
                        <td className="px-4 py-3 text-sm text-foreground whitespace-nowrap">
                          {record.Company || '-'}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 text-sm text-foreground whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRowClick(record);
                              }}
                              className="p-1.5 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => handleDeleteClick(record, e)}
                              className="p-1.5 text-red-600 hover:bg-red-100 rounded transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Edit Modal */}
        {editModalOpen && editedRecord && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-card rounded-lg border border-border w-[95vw] h-[95vh] flex flex-col">
              {/* Header */}
              <div className="px-6 py-4 border-b border-border flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold text-foreground">Edit Receipt</h3>
                  {editedRecord.webViewLink && (
                    <a
                      href={String(editedRecord.webViewLink)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      View in Drive
                    </a>
                  )}
                </div>
                <button
                  onClick={() => {
                    setEditModalOpen(false);
                    setSelectedRecord(null);
                    setEditedRecord(null);
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {/* Content - Scrollable */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
                  {/* Left side - Image */}
                  <div className="flex flex-col">
                    {(editedRecord.driveid || editedRecord.driveId || editedRecord.thumbnailLink) ? (
                      <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-2">
                          Receipt Image
                        </label>
                        <img
                          src={
                            editedRecord.driveid || editedRecord.driveId
                              ? `https://drive.google.com/uc?export=download&id=${editedRecord.driveid || editedRecord.driveId}`
                              : String(editedRecord.thumbnailLink)
                          }
                          alt="Receipt"
                          className="w-full h-auto rounded border border-border object-contain bg-white max-h-[80vh]"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            // Try different Google Drive image URLs
                            if (target.src.includes('uc?export=download')) {
                              // Try direct view as fallback
                              const driveId = editedRecord.driveid || editedRecord.driveId;
                              target.src = `https://drive.google.com/uc?export=view&id=${driveId}`;
                            } else if (target.src.includes('uc?export=view') && editedRecord.thumbnailLink) {
                              // Fallback to thumbnail
                              target.src = String(editedRecord.thumbnailLink);
                            } else if (target.src.includes('uc?export=view')) {
                              // Try thumbnail with driveId
                              const driveId = editedRecord.driveid || editedRecord.driveId;
                              target.src = `https://drive.google.com/thumbnail?id=${driveId}&sz=w2000`;
                            } else {
                              // Last resort: hide the image
                              target.style.display = 'none';
                            }
                          }}
                        />
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full border border-border rounded bg-muted">
                        <p className="text-muted-foreground">No image available</p>
                      </div>
                    )}
                  </div>

                  {/* Right side - Form fields */}
                  <div className="space-y-4">
                    {/* Custom field order */}
                    {(() => {
                      const fieldOrder = [
                        'Phase',
                        'invoiceNumber',
                        'Company',
                        'username',
                        'invoiceDate',
                        'Currency Code',
                        'Total Amount',
                        'AccountName',
                        'shortDescription',
                        'User Description',
                        'Company Card Used',
                        'From',
                        'To',
                        'card',
                        'Project',
                        'dueDate',
                        'Country'
                      ];
                      
                      const skipFields = ['Id', 'CreatedAt', 'UpdatedAt', 'driveId', 'driveid', 'webViewLink', 'thumbnailLink', 'photoLink', 'chatid', 'messageid'];
                      
                      // Fields that should be displayed 2 per row (shorter fields)
                      const shortFields = ['Phase', 'invoiceNumber', 'username', 'invoiceDate', 'Currency Code', 'Total Amount', 'Company Card Used', 'card', 'dueDate', 'Country'];
                      
                      // Render fields in custom order, then remaining fields
                      const renderedKeys = new Set<string>();
                      const orderedFields: string[] = [];
                      
                      // First, render fields in specified order
                      fieldOrder.forEach(key => {
                        if (editedRecord.hasOwnProperty(key) && !skipFields.includes(key)) {
                          renderedKeys.add(key);
                          orderedFields.push(key);
                        }
                      });
                      
                      // Then add any remaining fields not in the order list
                      Object.keys(editedRecord).forEach(key => {
                        if (!renderedKeys.has(key) && !skipFields.includes(key)) {
                          orderedFields.push(key);
                        }
                      });
                      
                      const renderField = (key: string) => {
                        // Company searchable dropdown with datalist
                        if (key === 'Company') {
                          return (
                            <div key={key}>
                              <label className="block text-sm font-medium text-muted-foreground mb-1">
                                {key}
                              </label>
                              <input
                                type="text"
                                list="companies-list"
                                value={editedRecord[key] || ''}
                                onChange={(e) => handleFieldChange(key, e.target.value)}
                                placeholder="Type to search companies..."
                                className="w-full px-3 py-2 border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                              />
                              <datalist id="companies-list">
                                {companies.map((company, idx) => (
                                  <option key={idx} value={company} />
                                ))}
                              </datalist>
                            </div>
                          );
                        }
                        
                        // Phase dropdown
                        if (key === 'Phase') {
                          return (
                            <div key={key}>
                              <label className="block text-sm font-medium text-muted-foreground mb-1">
                                {key}
                              </label>
                              <select
                                value={editedRecord[key] || ''}
                                onChange={(e) => handleFieldChange(key, e.target.value)}
                                className="w-full px-3 py-2 border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                              >
                                <option value="">Select phase...</option>
                                <option value="1">1 - Uploaded</option>
                                <option value="2">2 - OCR/AI Complete</option>
                                <option value="3">3 - Uploader Updated</option>
                              </select>
                            </div>
                          );
                        }
                        
                        // Date fields
                        if (key === 'invoiceDate' || key === 'dueDate') {
                          // Convert date to YYYY-MM-DD format for input
                          const dateValue = editedRecord[key] ? new Date(editedRecord[key]).toISOString().split('T')[0] : '';
                          return (
                            <div key={key}>
                              <label className="block text-sm font-medium text-muted-foreground mb-1">
                                {key}
                              </label>
                              <input
                                type="date"
                                value={dateValue}
                                onChange={(e) => handleFieldChange(key, e.target.value)}
                                className="w-full px-3 py-2 border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                              />
                            </div>
                          );
                        }
                        
                        // Number fields with decimals (Total Amount)
                        if (key === 'Total Amount') {
                          return (
                            <div key={key}>
                              <label className="block text-sm font-medium text-muted-foreground mb-1">
                                {key}
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                value={editedRecord[key] != null ? editedRecord[key] : ''}
                                onChange={(e) => handleFieldChange(key, e.target.value ? parseFloat(e.target.value) : null)}
                                className="w-full px-3 py-2 border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                              />
                            </div>
                          );
                        }
                        
                        // Regular text inputs
                        return (
                          <div key={key}>
                            <label className="block text-sm font-medium text-muted-foreground mb-1">
                              {key}
                            </label>
                            <input
                              type="text"
                              value={editedRecord[key] || ''}
                              onChange={(e) => handleFieldChange(key, e.target.value)}
                              className="w-full px-3 py-2 border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                          </div>
                        );
                      };
                      
                      // Group fields into rows
                      const rows: React.ReactElement[] = [];
                      let i = 0;
                      
                      while (i < orderedFields.length) {
                        const currentKey = orderedFields[i];
                        const nextKey = orderedFields[i + 1];
                        
                        // If current field is short and next field is also short, put them on same row
                        if (shortFields.includes(currentKey) && nextKey && shortFields.includes(nextKey)) {
                          rows.push(
                            <div key={`row-${i}`} className="grid grid-cols-2 gap-4">
                              {renderField(currentKey)}
                              {renderField(nextKey)}
                            </div>
                          );
                          i += 2;
                        } else {
                          // Otherwise, render full width
                          rows.push(renderField(currentKey));
                          i += 1;
                        }
                      }
                      
                      return rows;
                    })()}
                  </div>
                </div>
              </div>

              {/* Footer - Buttons */}
              <div className="px-6 py-4 border-t border-border flex justify-end gap-3 shrink-0">
                <button
                  onClick={() => {
                    setEditModalOpen(false);
                    setSelectedRecord(null);
                    setEditedRecord(null);
                  }}
                  className="px-4 py-2 border border-border rounded hover:bg-accent transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteModalOpen && selectedRecord && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-card rounded-lg border border-border max-w-md w-full">
              <div className="px-6 py-4 border-b border-border">
                <h3 className="text-lg font-semibold text-foreground">Confirm Delete</h3>
              </div>
              
              <div className="p-6">
                <p className="text-foreground mb-4">
                  Are you sure you want to delete this receipt?
                </p>
                <div className="bg-muted p-3 rounded text-sm">
                  <div><span className="font-semibold">From:</span> {selectedRecord.From || 'N/A'}</div>
                  <div><span className="font-semibold">Date:</span> {formatDate(selectedRecord.invoiceDate)}</div>
                  <div><span className="font-semibold">Amount:</span> {selectedRecord['Total Amount']} {selectedRecord['Currency Code']}</div>
                  <div><span className="font-semibold">Drive ID:</span> {selectedRecord.driveid || selectedRecord.driveId || 'N/A'}</div>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
                <button
                  onClick={() => {
                    setDeleteModalOpen(false);
                    setSelectedRecord(null);
                  }}
                  className="px-4 py-2 border border-border rounded hover:bg-accent transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

export default ReceiptsPage;
