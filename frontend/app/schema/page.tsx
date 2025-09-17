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
  const [schemaInfo, setSchemaInfo] = useState<any>(null);
  const [schemaTableData, setSchemaTableData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingTable, setIsLoadingTable] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (status !== "loading" && !session) {
      router.push('/');
    }
  }, [session, status, router]);

  const handleGetSchemaInfo = async () => {
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:8000/nocodb-schema-info', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      setSchemaInfo(data);
      toast.success('Schema information retrieved successfully!');
    } catch (error) {
      toast.error(`Failed to get schema info: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

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
      toast.success('Schema table data retrieved successfully!');
    } catch (error) {
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
            <h1 className="text-3xl font-bold text-foreground">Schema</h1>
            <p className="mt-2 text-muted-foreground">View and manage database schema information</p>
          </div>
          <Button
            onClick={handleNocoDBSync}
            disabled={isSyncing}
            className="ml-4"
          >
            {isSyncing ? 'Syncing...' : 'Run NocoDB Sync'}
          </Button>
        </div>

        <div className="bg-card shadow-sm rounded-lg p-6 border border-border">
          <h2 className="text-lg font-medium text-foreground mb-4">Schema Overview</h2>
          <p className="text-muted-foreground mb-4">
            View detailed information about the NocoDB database schema, including tables, columns, and relationships.
          </p>

          <Button
            onClick={handleGetSchemaInfo}
            disabled={isLoading}
          >
            {isLoading ? 'Loading...' : 'Get Schema Info'}
          </Button>

          {schemaInfo && (
            <div className="mt-4 p-4 rounded-md border border-border bg-card">
              <h3 className="font-medium mb-2 text-foreground">Schema Information:</h3>
              <div className="space-y-2 text-sm">
                <pre className="mt-2 p-2 bg-muted rounded text-xs whitespace-pre-wrap overflow-x-auto border">
                  {JSON.stringify(schemaInfo, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>

        <div className="bg-card shadow-sm rounded-lg p-6 border border-border">
          <h2 className="text-lg font-medium text-foreground mb-4">Schema Table Data</h2>
          <p className="text-muted-foreground mb-4">
            View the complete schema table data from NocoDB, separated into tables based on the "Table" field.
          </p>

          <Button
            onClick={handleGetSchemaTable}
            disabled={isLoadingTable}
          >
            {isLoadingTable ? 'Loading...' : 'Get Schema Table Data'}
          </Button>

          {schemaTableData && schemaTableData.records && (
            <div className="mt-6 space-y-8">
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
                  <div key={tableName} className="border border-border rounded-lg p-4">
                    <h3 className="font-medium mb-4 text-foreground">Table: {tableName}</h3>
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
                    <div className="mt-2 text-sm text-muted-foreground">
                      {groupedData[tableName].length} records
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}
        </div>

        <div className="bg-card shadow-sm rounded-lg p-6 border border-border">
          <h2 className="text-lg font-medium text-foreground mb-4">Schema Management</h2>
          <p className="text-muted-foreground mb-4">
            Additional schema management tools will be available here.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}