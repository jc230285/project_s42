"use client";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { makeAuthenticatedRequest } from '@/lib/auth';

export default function SchemaPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [schemaTableData, setSchemaTableData] = useState<any>(null);
  const [isLoadingTable, setIsLoadingTable] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (status !== "loading" && !session) {
      router.push('/');
    }
  }, [session, status, router]);

  useEffect(() => {
    // Auto-load schema table data when component mounts
    handleGetSchemaTable();
  }, []);

  const handleGetSchemaTable = async () => {
    setIsLoadingTable(true);

    try {
      const response = await makeAuthenticatedRequest('http://localhost:8000/schema', {
        method: 'GET',
      });

      const data = await response.json();
      setSchemaTableData(data);
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
      const response = await makeAuthenticatedRequest('http://localhost:8000/nocodb-sync', {
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
                  <h2 className="text-xl font-semibold text-foreground mb-4">Table: {tableName}</h2>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-border">
                      <thead className="bg-muted">
                        <tr>
                          {groupedData[tableName].length > 0 && 
                            Object.keys(groupedData[tableName][0])
                              .filter(key => key !== 'Table') // Don't show the Table field in the table
                              .filter(key => !['id', 'created_at', 'updated_at', 'created_by', 'updated_by', 'nc_order', 'meta', 'Options', 'category_order', 'subcategory_order'].includes(key)) // Hide unwanted columns
                              .map((key) => (
                              <th key={key} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                {key}
                              </th>
                            ))
                          }
                        </tr>
                      </thead>
                      <tbody className="bg-card divide-y divide-border">
                        {groupedData[tableName].map((record, index) => (
                          <tr key={index} className="hover:bg-muted/50">
                            {Object.keys(record)
                              .filter(key => key !== 'Table') // Don't show the Table field in the table
                              .filter(key => !['id', 'created_at', 'updated_at', 'created_by', 'updated_by', 'nc_order', 'meta', 'Options', 'category_order', 'subcategory_order'].includes(key)) // Hide unwanted columns
                              .map((key) => (
                              <td key={key} className="px-4 py-3 text-sm text-foreground">
                                {typeof record[key] === 'object' ? JSON.stringify(record[key]) : 
                                 record[key] !== null && record[key] !== undefined ? String(record[key]) : ''}
                              </td>
                            ))}
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
              // Filter for SingleSelect and MultiSelect fields
              const selectFields = schemaTableData.filter((record: any) =>
                record.Type === 'SingleSelect' || record.Type === 'MultiSelect'
              );

              const renderFieldTable = (field: any) => {
                const options = field.Options || '';
                const optionItems = options.split(' | ').map((opt: string, index: number) => {
                  const nameMatch = opt.match(/^([^(\s]+)/);
                  const colorMatch = opt.match(/Color: (#[\w]+)/);
                  const orderMatch = opt.match(/Order: (\d+)/);

                  const name = nameMatch ? nameMatch[1] : opt;
                  const color = colorMatch ? colorMatch[1] : '#cccccc';
                  const order = orderMatch ? parseInt(orderMatch[1]) : index + 1;

                  // Count how many records use this option
                  const count = schemaTableData.filter((record: any) => {
                    const fieldValue = record[field.Field_Name];
                    if (fieldValue && typeof fieldValue === 'object' && fieldValue.constructor === Set) {
                      // For Set values like {'General'}
                      return Array.from(fieldValue).includes(name);
                    } else if (typeof fieldValue === 'string' && fieldValue.includes(name)) {
                      // For string values
                      return true;
                    }
                    return false;
                  }).length;

                  return { name, color, order, count };
                }).sort((a: any, b: any) => a.order - b.order);

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