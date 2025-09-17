"use client";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';

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
      const response = await fetch('http://localhost:8000/nocodb-schema-table', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
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
      const response = await fetch('http://localhost:8000/nocodb-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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
            <h1 className="text-3xl font-bold text-foreground">Schema Tables</h1>
            <p className="mt-2 text-muted-foreground">Complete schema table data from NocoDB, separated by table type</p>
          </div>
          <Button
            onClick={handleNocoDBSync}
            disabled={isSyncing}
            className="ml-4"
          >
            {isSyncing ? 'Syncing...' : 'Run NocoDB Sync'}
          </Button>
        </div>

        {isLoadingTable ? (
          <div className="bg-card shadow-sm rounded-lg p-6 border border-border">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-muted-foreground">Loading schema table data...</p>
            </div>
          </div>
        ) : schemaTableData && schemaTableData.records ? (
          <div className="space-y-8">
            {(() => {
              // Group records by the "Table" field
              const groupedData: { [key: string]: any[] } = {};
              schemaTableData.records.forEach((record: any) => {
                const tableName = record.Table || 'Unknown';
                if (!groupedData[tableName]) {
                  groupedData[tableName] = [];
                }
                groupedData[tableName].push(record);
              });

              // Get the table names and sort them
              const tableNames = Object.keys(groupedData).sort();

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
                              .map((key) => (
                              <td key={key} className="px-4 py-3 text-sm text-foreground">
                                {typeof record[key] === 'object' ? JSON.stringify(record[key]) : String(record[key] || '')}
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