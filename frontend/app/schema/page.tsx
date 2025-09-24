'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import DashboardLayout from '@/components/DashboardLayout'
import { Button } from '@/components/ui/button'
import { WithScale42Access } from '@/components/WithScale42Access'

interface EditingField {
  recordId: string
  fieldName: string
  value: string
}

export default function SchemaPage() {
  return (
    // <WithScale42Access>
      <SchemaPageContent />
    // </WithScale42Access>
  );
}

function SchemaPageContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [schemaTableData, setSchemaTableData] = useState<any>(null)
  const [fieldOptions, setFieldOptions] = useState<any>({})
  const [isLoadingTable, setIsLoadingTable] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [editingField, setEditingField] = useState<EditingField | null>(null)
  const [editValue, setEditValue] = useState('')
  const [showDescriptionModal, setShowDescriptionModal] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<any>(null)

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

  // Helper function to map field IDs to field names
  const getFieldNameFromId = (fieldId: string) => {
    const fieldMap: { [key: string]: string } = {
      'cqafayslz10gqib': 'Description',
      'ckh6xzj3uvl09i5': 'Field Order',
      'c3xywkmub993x24': 'Category',
      'ceznmyuazlgngiw': 'Subcategory',
      // Add more field mappings as needed
    };
    return fieldMap[fieldId] || 'unknown_field';
  };

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

  // Function to update NocoDB field
  const updateNocoDBField = async (recordId: string, fieldId: string, value: any) => {
    try {
      const updateData = {
        table_id: 'm72851bbm1z0qul', // Schema table ID - the only table we're updating on this page
        row_id: String(recordId), // Ensure row_id is always a string
        field_data: {
          [fieldId]: value
        }
      };

      const response = await makeAuthenticatedRequest(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/nocodb/update-row`,
        {
          method: 'PUT',
          body: JSON.stringify(updateData)
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      console.log('🔍 Update API Response:', {
        success: result.success,
        data: result.data,
        recordId,
        fieldId,
        fieldName: getFieldNameFromId(fieldId),
        value,
        fullResult: result
      });
      
      if (result.success) {
        toast.success(`${getFieldNameFromId(fieldId)} updated successfully!`);
        
        console.log('🔄 Updating local state:', {
          recordId,
          fieldName: getFieldNameFromId(fieldId),
          newValue: value,
          recordIdType: typeof recordId,
          schemaDataLength: schemaTableData?.length
        });
        
        // Update local state immediately for real-time feedback
        setSchemaTableData((prevData: any[]) => {
          const updatedData = prevData.map((record: any) => {
            const recordMatches = String(record.id) === String(recordId);
            console.log('🔍 Record comparison:', {
              recordId: record.id,
              recordIdType: typeof record.id,
              targetRecordId: recordId,
              targetRecordIdType: typeof recordId,
              matches: recordMatches
            });
            
            if (recordMatches) {
              const updatedRecord = { ...record, [getFieldNameFromId(fieldId)]: value };
              console.log('✅ Updating record:', {
                original: record,
                updated: updatedRecord,
                fieldChanged: getFieldNameFromId(fieldId)
              });
              return updatedRecord;
            }
            return record;
          });
          
          console.log('� State update completed');
          return updatedData;
        });
        
        return true;
      } else {
        console.error('❌ Update failed:', result);
        throw new Error(result.message || 'Update failed');
      }
    } catch (error) {
      console.error('Error updating field:', error);
      toast.error(`Failed to update field: ${error}`);
      return false;
    }
  };

  // Handle field editing
  const handleFieldEdit = (recordId: string, fieldName: string, currentValue: string) => {
    setEditingField({ recordId, fieldName, value: currentValue });
    setEditValue(currentValue);
  };

  // Handle save edit
  const handleSaveEdit = async () => {
    if (!editingField) return;

    console.log('💾 Starting save edit:', {
      editingField,
      editValue,
      currentTime: new Date().toISOString()
    });

    const fieldIdMapping: { [key: string]: string } = {
      'Description': 'cqafayslz10gqib',
      'Field Order': 'ckh6xzj3uvl09i5', 
      'Category': 'c3xywkmub993x24',
      'Subcategory': 'ceznmyuazlgngiw'
    };

    const fieldId = fieldIdMapping[editingField.fieldName];
    if (!fieldId) {
      console.error('❌ Unknown field type:', editingField.fieldName);
      toast.error('Unknown field type');
      return;
    }

    console.log('🔧 Field mapping:', {
      fieldName: editingField.fieldName,
      fieldId,
      editValue,
      recordId: editingField.recordId
    });

    // Convert to number for Field Order
    const value = editingField.fieldName === 'Field Order' ? parseInt(editValue) || 0 : editValue;

    console.log('📤 Sending update request with value:', value);

    const success = await updateNocoDBField(editingField.recordId, fieldId, value);
    if (success) {
      console.log('✅ Edit completed successfully, clearing edit mode:', {
        recordId: editingField.recordId,
        fieldName: editingField.fieldName,
        newValue: value
      });
      setEditingField(null);
      setEditValue('');
      console.log('🔄 Edit mode cleared');
    } else {
      console.log('❌ Edit failed');
    }
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    setEditingField(null);
    setEditValue('');
  };

  // Handle description modal
  const handleDescriptionEdit = (record: any) => {
    setSelectedRecord(record);
    setEditValue(record.Description || '');
    setShowDescriptionModal(true);
  };

  // Handle save description
  const handleSaveDescription = async () => {
    if (!selectedRecord) return;

    const success = await updateNocoDBField(selectedRecord.id, 'cqafayslz10gqib', editValue);
    if (success) {
      // Update local state immediately
      setSchemaTableData((prevData: any[]) => 
        prevData.map((record: any) => 
          record.id === selectedRecord.id 
            ? { ...record, Description: editValue }
            : record
        )
      );
      
      setShowDescriptionModal(false);
      setSelectedRecord(null);
      setEditValue('');
    }
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
      let records = Array.isArray(data) ? data : data.list || data.records || data;
      let debugInfo = Array.isArray(data) ? null : {
        count: data.count,
        totalRecords: data.totalRecords,
        pageInfo: data.pageInfo,
        debug: data.debug
      };
      
      // Store field options for dropdowns
      if (data.fieldOptions) {
        setFieldOptions(data.fieldOptions);
        console.log('Field Options Available:', data.fieldOptions);
      }
      
      setSchemaTableData(records);
      
      // Debug: Log the first record to understand the data structure
      if (records && records.length > 0) {
        console.log('📋 Schema data structure:', {
          totalRecords: records.length,
          firstRecord: records[0],
          recordKeys: Object.keys(records[0]),
          idField: records[0].id,
          IdField: records[0].Id,
          idType: typeof records[0].id,
          IdType: typeof records[0].Id
        });
      }
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
                            const preferredOrder = ['Field Name', 'Type', 'Description', 'Field Order', 'Category', 'Subcategory', 'Options'];
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
                          <tr key={`${tableName}-${record.id}-${index}`} className="hover:bg-muted/50">
                            {(() => {
                              // Use same column ordering as header
                              const preferredOrder = ['Field Name', 'Type', 'Description', 'Field Order', 'Category', 'Subcategory', 'Options'];
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
                                  {key === 'Description' ? (
                                    <div className="flex items-center gap-2">
                                      <span className="truncate max-w-xs" title={record[key] || ''}>
                                        {record[key] || 'Click to edit'}
                                      </span>
                                      <button
                                        onClick={() => handleDescriptionEdit(record)}
                                        className="text-primary hover:text-primary/80 text-xs px-2 py-1 rounded border border-border hover:border-primary/50 transition-colors bg-muted/50 hover:bg-muted"
                                      >
                                        Edit
                                      </button>
                                    </div>
                                  ) : key === 'Field Order' ? (
                                    editingField?.recordId === record.id && editingField?.fieldName === key ? (
                                      <input
                                        type="number"
                                        value={editValue}
                                        onChange={(e) => setEditValue(e.target.value)}
                                        onBlur={handleSaveEdit}
                                        onKeyPress={(e) => {
                                          if (e.key === 'Enter') {
                                            handleSaveEdit();
                                          } else if (e.key === 'Escape') {
                                            handleCancelEdit();
                                          }
                                        }}
                                        className="w-16 px-2 py-1 border border-border rounded text-sm bg-background text-foreground focus:ring-2 focus:ring-ring"
                                        autoFocus
                                      />
                                    ) : (
                                      <div
                                        onClick={() => handleFieldEdit(record.id, key, String(record[key] || ''))}
                                        className="cursor-pointer hover:bg-muted/50 px-2 py-1 rounded transition-colors"
                                      >
                                        {record[key] || 'Click to edit'}
                                      </div>
                                    )
                                  ) : key === 'Category' || key === 'Subcategory' ? (
                                    editingField?.recordId === record.id && editingField?.fieldName === key ? (
                                      <select
                                        value={editValue}
                                        onChange={async (e) => {
                                          console.log('🔽 Dropdown changed:', {
                                            field: key,
                                            recordId: record.id,
                                            oldValue: editValue,
                                            newValue: e.target.value,
                                            timestamp: new Date().toISOString()
                                          });
                                          
                                          const newValue = e.target.value;
                                          setEditValue(newValue);
                                          console.log('📝 Edit value updated to:', newValue);
                                          
                                          // Save immediately on change
                                          if (newValue && newValue.trim() !== '') {
                                            console.log('💾 Immediate save triggered for dropdown:', key);
                                            const success = await updateNocoDBField(record.id, 
                                              key === 'Category' ? 'c3xywkmub993x24' : 'ceznmyuazlgngiw', 
                                              newValue);
                                            if (success) {
                                              // Clear edit mode after successful save
                                              setEditingField(null);
                                              setEditValue('');
                                              console.log('✅ Immediate save completed, edit mode cleared');
                                            }
                                          }
                                        }}
                                        onBlur={() => {
                                          console.log('👁️ Dropdown blur event - clearing edit mode if not already cleared');
                                          // Just clear edit mode on blur since save happens on change
                                          setEditingField(null);
                                          setEditValue('');
                                        }}
                                        className="px-2 py-1 border border-border rounded text-sm bg-card text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                                        autoFocus
                                      >
                                        <option value="">Select {key}</option>
                                        {key === 'Category' ? (
                                          fieldOptions.Category?.map((option: any, index: number) => (
                                            <option key={`category-${option.value}-${index}`} value={option.value}>
                                              {option.label}
                                            </option>
                                          ))
                                        ) : (
                                          fieldOptions.Subcategory?.map((option: any, index: number) => (
                                            <option key={`subcategory-${option.value}-${index}`} value={option.value}>
                                              {option.label}
                                            </option>
                                          ))
                                        )}
                                      </select>
                                    ) : (
                                      <div
                                        onClick={() => handleFieldEdit(record.id, key, String(record[key] || ''))}
                                        className="cursor-pointer hover:bg-muted/50 px-2 py-1 rounded transition-colors"
                                      >
                                        {record[key] || 'Click to select'}
                                      </div>
                                    )
                                  ) : key === 'Options' && record[key] ? (
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

      {/* Description Edit Modal */}
      {showDescriptionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-6 w-96 max-w-full">
            <h3 className="text-lg font-semibold mb-4 text-foreground">Edit Description</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2 text-foreground">
                Field: {selectedRecord?.['Field Name'] || 'Unknown'}
              </label>
              <textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Enter description..."
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowDescriptionModal(false);
                  setSelectedRecord(null);
                  setEditValue('');
                }}
                className="px-4 py-2 text-muted-foreground border border-border rounded hover:bg-accent hover:text-accent-foreground"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveDescription}
                className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}