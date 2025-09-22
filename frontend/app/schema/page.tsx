'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import DashboardLayout from '@/components/DashboardLayout'
import { Button } from '@/components/ui/button'

export default function SchemaPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [schemaTableData, setSchemaTableData] = useState<any>(null)
  const [isLoadingTable, setIsLoadingTable] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)

  useEffect(() => {
    if (status !== "loading" && !session) {
      router.push('/');
    }
  }, [session, status, router]);

  useEffect(() => {
    // Auto-load schema table data when session is available
    if (session) {
      handleGetSchemaTable();
    }
  }, [session]);

  // Helper function to make authenticated requests
  const makeAuthenticatedRequest = async (url: string, options: RequestInit = {}) => {
    if (!session?.user?.email) {
      console.error('No session available', { session, status });
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

  const handleGetSchemaTable = async () => {
    setIsLoadingTable(true);

    try {
      const response = await makeAuthenticatedRequest(`${process.env.NEXT_PUBLIC_BACKEND_URL}/projects/schema`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Handle both old format (array) and new format (object with records)
      let records = Array.isArray(data) ? data : data.records || data;
      let debugInfo = Array.isArray(data) ? null : {
        count: data.count,
        totalRecords: data.totalRecords,
        pageInfo: data.pageInfo,
        debug: data.debug
      };
      
      setSchemaTableData(records);
      
      // Log debugging information
      if (debugInfo) {
        console.log('Schema API Debug Info:', debugInfo);
        if (debugInfo.totalRecords && debugInfo.totalRecords > debugInfo.count) {
          console.warn(`Only ${debugInfo.count} of ${debugInfo.totalRecords} records loaded`);
        }
      }
    } catch (error) {
      console.error('Failed to get schema table:', error);
      toast.error(`Failed to get schema table: ${error}`);
    } finally {
      setIsLoadingTable(false);
    }
  };

  const handleNocoDBSync = async () => {
    setIsSyncing(true);

    try {
      const response = await makeAuthenticatedRequest(`${process.env.NEXT_PUBLIC_BACKEND_URL}/nocodb-sync`, {
        method: 'POST',
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Project Layout Tables</h1>
            <p className="mt-2 text-muted-foreground">Update the tables here and in the backend <a href="https://nocodb.edbmotte.com/dashboard/#/nc/pjqgy4ri85jks06/mmqclkrvx9lbtpc" target="_blank" rel="noopener noreferrer">here</a>.</p>
          </div>
          <Button
            onClick={handleNocoDBSync}
            disabled={isSyncing}
            className="ml-4"
          >
            {isSyncing ? 'Syncing...' : 'Start Sync'}
          </Button>
        </div>

        {isLoadingTable ? (
          <div className="bg-card shadow-sm rounded-lg p-6 border border-border">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-muted-foreground">Loading schema table data...</p>
            </div>
          </div>
        ) : schemaTableData && Array.isArray(schemaTableData) && schemaTableData.length > 0 ? (
          <div className="space-y-8">
            {(() => {
              // Group records by the "Table" field
              const groupedData: { [key: string]: any[] } = {};
              schemaTableData.forEach((record: any) => {
                const tableName = record.Table || 'Unknown';
                if (!groupedData[tableName]) {
                  groupedData[tableName] = [];
                }
                groupedData[tableName].push(record);
              });

              // Get the table names and sort them (Projects first, then alphabetical)
              const tableNames = Object.keys(groupedData).sort((a, b) => {
                if (a === 'Projects') return -1;
                if (b === 'Projects') return 1;
                return a.localeCompare(b);
              });

              console.log('Sorted table names:', tableNames);

              return tableNames.map((tableName) => (
                <div key={tableName} className="bg-card shadow-sm rounded-lg p-6 border border-border">
                  <h2 className="text-xl font-semibold text-foreground mb-4">Table: {tableName} ({groupedData[tableName].length} fields)</h2>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-border">
                      <thead className="bg-muted">
                        <tr>
                          {(() => {
                            // Define preferred column order for better readability
                            const preferredOrder = ['Field Name', 'Type', 'Description', 'Field Order', 'Field ID', 'Category', 'Subcategory', 'Options'];
                            const availableKeys = Object.keys(groupedData[tableName][0])
                              .filter(key => key !== 'Table') // Don't show the Table field in the table
                              .filter(key => !['id', 'created_at', 'updated_at', 'created_by', 'updated_by', 'nc_order', 'meta', 'category_order', 'subcategory_order'].includes(key)); // Hide unwanted columns but keep Options
                            
                            // Sort keys by preferred order, then alphabetically for any remaining
                            const sortedKeys = [
                              ...preferredOrder.filter(key => availableKeys.includes(key)),
                              ...availableKeys.filter(key => !preferredOrder.includes(key)).sort()
                            ];
                            
                            return sortedKeys.map((key) => (
                              <th key={key} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                {key}
                              </th>
                            ));
                          })()}
                        </tr>
                      </thead>
                      <tbody className="bg-card divide-y divide-border">
                        {groupedData[tableName].map((record, index) => (
                          <tr key={index} className="hover:bg-muted/50">
                            {(() => {
                              // Use same column ordering as header
                              const preferredOrder = ['Field Name', 'Type', 'Description', 'Field Order', 'Field ID', 'Category', 'Subcategory', 'Options'];
                              const availableKeys = Object.keys(record)
                                .filter(key => key !== 'Table') // Don't show the Table field in the table
                                .filter(key => !['id', 'created_at', 'updated_at', 'created_by', 'updated_by', 'nc_order', 'meta', 'category_order', 'subcategory_order'].includes(key)); // Hide unwanted columns but keep Options
                              
                              // Sort keys by preferred order, then alphabetically for any remaining
                              const sortedKeys = [
                                ...preferredOrder.filter(key => availableKeys.includes(key)),
                                ...availableKeys.filter(key => !preferredOrder.includes(key)).sort()
                              ];
                              
                              return sortedKeys.map((key) => (
                                <td key={key} className="px-4 py-3 text-sm text-foreground">
                                  {key === 'Options' && record[key] ? (
                                    // Special formatting for Options field - make it more readable
                                    <div className="max-w-xs">
                                      <div className="text-xs text-muted-foreground mb-1">Options:</div>
                                      <div className="text-sm break-words">{String(record[key])}</div>
                                    </div>
                                  ) : (
                                    typeof record[key] === 'object' ? JSON.stringify(record[key]) : 
                                    record[key] !== null && record[key] !== undefined ? String(record[key]) : ''
                                  )}
                                </td>
                              ));
                            })()}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-4 text-sm text-muted-foreground">
                    {groupedData[tableName].length} records
                  </div>
                </div>
              ));
            })()}

            {/* Select Fields Tables */}
            {(() => {
              // Filter for fields with any Options data (not just SingleSelect/MultiSelect)
              const selectFields = schemaTableData.filter((record: any) =>
                record.Options && record.Options.trim() !== ''
              );

              console.log('Available field types:', [...new Set(schemaTableData.map((r: any) => r.Type))]);
              console.log('Fields with Options:', selectFields.map((f: any) => ({ name: f['Field Name'], type: f.Type, options: f.Options })));

              if (selectFields.length === 0) {
                return (
                  <div className="bg-card shadow-sm rounded-lg p-6 border border-border">
                    <h2 className="text-xl font-semibold text-foreground mb-4">Dropdown Fields</h2>
                    <div className="text-center">
                      <p className="text-muted-foreground mb-2">No dropdown fields found in current schema.</p>
                      <p className="text-sm text-muted-foreground">
                        Available field types: {[...new Set(schemaTableData.map((r: any) => r.Type))].join(', ')}
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Looking for fields with Type: SingleSelect or MultiSelect
                      </p>
                    </div>
                  </div>
                );
              }

              const renderFieldTable = (field: any) => {
                const options = field.Options || '';
                
                // Handle different option formats
                let optionItems = [];
                
                if (options.includes(' | ')) {
                  // Format: "Option1 (Color: #color) (Order: 1) | Option2 (Color: #color) (Order: 2)"
                  optionItems = options.split(' | ').map((opt: string, index: number) => {
                    const nameMatch = opt.match(/^([^(\s]+)/);
                    const colorMatch = opt.match(/Color: (#[\w]+)/);
                    const orderMatch = opt.match(/Order: (\d+)/);

                    const name = nameMatch ? nameMatch[1] : opt;
                    const color = colorMatch ? colorMatch[1] : '#cccccc';
                    const order = orderMatch ? parseInt(orderMatch[1]) : index + 1;

                    return { name, color, order, count: 0 };
                  }).sort((a: any, b: any) => a.order - b.order);
                } else {
                  // Simple format or single option
                  optionItems = [{
                    name: options,
                    color: '#cccccc',
                    order: 1,
                    count: 0
                  }];
                }

                return (
                  <div key={field.Field_ID} className="bg-card shadow-sm rounded-lg p-6 border border-border">
                    <h2 className="text-xl font-semibold text-foreground mb-4">
                      {field.Field_Name} ({field.Type})
                    </h2>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-border">
                        <thead className="bg-muted">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                              Order
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                              Option (Count)
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-card divide-y divide-border">
                          {optionItems.map((option: any, index: number) => (
                            <tr key={index} className="hover:bg-muted/50">
                              <td className="px-4 py-3 text-sm text-foreground font-medium">
                                {option.order}
                              </td>
                              <td className="px-4 py-3 text-sm text-foreground">
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-4 h-4 rounded-sm flex-shrink-0"
                                    style={{ backgroundColor: option.color }}
                                  ></div>
                                  <span>{option.name} ({option.count})</span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              };

              return selectFields.map(renderFieldTable);
            })()}
          </div>
        ) : (
          <div className="bg-card shadow-sm rounded-lg p-6 border border-border">
            <div className="text-center">
              <p className="text-muted-foreground">No schema table data available</p>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}