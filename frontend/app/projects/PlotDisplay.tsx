import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useSession } from 'next-auth/react';

interface SchemaField {
  "Field Name": string;
  "Field ID": string;
  "Type": string;
  "Category": string;
  "Subcategory": string;
  "Field Order": number;
  "Table": string;
  "category_order": number;
  "subcategory_order": number;
}

// Comments interfaces
interface Comment {
  id: string;
  comment: string;
  created_by_email: string;
  created_by_name?: string;
  created_at?: string;
  table_name: string;
  record_id: string;
}

interface CommentsResponse {
  success: boolean;
  comments: {
    list: Comment[];
  };
  table_name: string;
  record_id: string;
  source: string;
}

// Audit interfaces
interface AuditRecord {
  id: string;
  record_id: string;
  table_name: string;
  action: string;
  old_values?: any;
  new_values?: any;
  user_id?: string;
  user_email?: string;
  user_name?: string;  // Add user name field
  timestamp: string;
  field_changed?: string;
  details?: any;  // Add details field from NocoDB audit API
}

interface AuditResponse {
  table: string;
  record_id: string;
  audit_trail: AuditRecord[];
  total_count: number;
}

// Helper functions for cookie management
const getCookieValue = (name: string): string | null => {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
};

const setCookieValue = (name: string, value: string, days: number = 30): void => {
  if (typeof document === 'undefined') return;
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
};

interface PlotDisplayProps {
  plot: {
    id: number;
    basic_data?: { [key: string]: any };
  };
  parentProject?: {
    _db_id: number;
    values?: { [key: string]: any };
  };
  schema: SchemaField[];
  fieldHeights?: { [fieldId: string]: number };
  // Shared collapse state props
  collapsedCategories: Set<string>;
  collapsedSubcategories: Set<string>;
  onToggleCategory: (category: string) => void;
  onToggleSubcategory: (key: string) => void;
  collapsedActivityTimelines: Set<number>;
  onToggleActivityTimeline: (plotId: number) => void;
  // Data refresh callback
  onDataUpdate?: () => void;
}

// SingleLineTextField Component
interface SingleLineTextFieldProps {
  field: SchemaField;
  fieldValue: any;
  calculatedHeight: number;
  isProjectField: boolean;
  recordId: number;
  tableName: string;
  onDataUpdate?: () => void;
}

const SingleLineTextField: React.FC<SingleLineTextFieldProps> = ({
  field,
  fieldValue,
  calculatedHeight,
  isProjectField,
  recordId,
  tableName,
  onDataUpdate
}) => {
  const { data: session } = useSession();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(fieldValue || '');
  const [isSaving, setIsSaving] = useState(false);
  const [displayValue, setDisplayValue] = useState(fieldValue);

  // Sync displayValue with fieldValue prop changes
  useEffect(() => {
    setDisplayValue(fieldValue);
    setEditValue(fieldValue || '');
  }, [fieldValue]);

  const handleSave = async () => {
    if (isSaving) return;
    
    setIsSaving(true);
    try {
      // Create auth header like other components
      if (!session?.user?.email) {
        throw new Error("No session available");
      }
      
      const userInfo = {
        email: session.user.email,
        name: session.user.name || session.user.email,
        image: session.user.image || ""
      };
      const authHeader = `Bearer ${btoa(JSON.stringify(userInfo))}`;

      // Determine the correct table ID based on table name
      const tableId = tableName === "Projects" ? "mftsk8hkw23m8q1" : "mmqclkrvx9lbtpc";
      
      const response = await fetch('/api/proxy/nocodb/update-row', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
        },
        body: JSON.stringify({
          table_id: tableId,
          row_id: recordId.toString(),
          field_data: {
            [field["Field ID"]]: editValue
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('API Error:', response.status, errorData);
        throw new Error(`Failed to update field: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Field updated successfully:', result);
      
      // Update local display value immediately for better UX
      setDisplayValue(editValue);
      setIsEditing(false);
      toast.success(`${field["Field Name"]} updated!`);
      
      // Trigger data refresh to sync with backend
      if (onDataUpdate) {
        onDataUpdate();
      }
      
    } catch (error) {
      console.error('Error updating field:', error);
      toast.error(`Failed to update ${field["Field Name"]}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Reset to original value on error
      setEditValue(displayValue || '');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(displayValue || '');
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  return (
    <div 
      className="relative p-3 border border-border/20 rounded-lg bg-card"
      style={{ minHeight: `${calculatedHeight}px` }}
      data-field-id={field["Field ID"]}
      data-field-type={field.Type}
    >
      {/* Field name - top right */}
      <div className="absolute top-2 left-2 text-xs text-muted-foreground font-medium">
        {field["Field Name"]}
      </div>
      
      {/* Field value - bottom right, clickable and editable */}
      <div className="absolute bottom-2 right-2 min-w-[100px] text-right">
        {isEditing ? (
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleSave}
              className="text-sm border border-gray-600 rounded px-2 py-1 min-w-[80px] text-right bg-gray-800 text-white focus:border-gray-500 focus:outline-none"
              autoFocus
              disabled={isSaving}
            />
            {isSaving && <span className="text-xs text-muted-foreground">...</span>}
          </div>
        ) : (
          <div 
            onClick={() => setIsEditing(true)}
            className={`text-sm cursor-pointer hover:bg-accent/50 rounded px-2 py-1 transition-colors whitespace-pre-wrap break-words ${
              isProjectField ? 'text-green-700' : 'text-blue-700'
            }`}
          >
            {displayValue !== null && displayValue !== undefined && String(displayValue).trim() !== '' ? (
              <span className="font-medium whitespace-pre-wrap break-words">
                {String(displayValue)}
              </span>
            ) : (
              <span className="text-muted-foreground italic">Click to edit</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// LongTextField Component with Rich Text Editor Popup
interface LongTextFieldProps {
  field: SchemaField;
  fieldValue: any;
  calculatedHeight: number;
  isProjectField: boolean;
  recordId: number;
  tableName: string;
  onDataUpdate?: () => void;
}

const LongTextField: React.FC<LongTextFieldProps> = ({
  field,
  fieldValue,
  calculatedHeight,
  isProjectField,
  recordId,
  tableName,
  onDataUpdate
}) => {
  const { data: session } = useSession();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editValue, setEditValue] = useState(fieldValue || '');
  const [isSaving, setIsSaving] = useState(false);
  const [displayValue, setDisplayValue] = useState(fieldValue);

  // Sync displayValue with fieldValue prop changes
  useEffect(() => {
    setDisplayValue(fieldValue);
    setEditValue(fieldValue || '');
  }, [fieldValue]);

  const handleSave = async () => {
    if (isSaving) return;
    
    setIsSaving(true);
    
    // Show loading toast
    const loadingToast = toast.loading('Saving changes...');
    
    try {
      // Create auth header like other components
      if (!session?.user?.email) {
        throw new Error("No session available");
      }
      
      const userInfo = {
        email: session.user.email,
        name: session.user.name || session.user.email,
        image: session.user.image || ""
      };
      const authHeader = `Bearer ${btoa(JSON.stringify(userInfo))}`;

      // Determine the correct table ID based on table name
      const tableId = tableName === "Projects" ? "mftsk8hkw23m8q1" : "mmqclkrvx9lbtpc";
      
      const response = await fetch('/api/proxy/nocodb/update-row', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
        },
        body: JSON.stringify({
          table_id: tableId,
          row_id: recordId.toString(),
          field_data: {
            [field["Field ID"]]: editValue
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('API Error:', response.status, errorData);
        throw new Error(`Failed to update field: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Field updated successfully:', result);
      
      // Update local display value immediately for better UX
      setDisplayValue(editValue);
      // Close modal and show success toast
      setIsModalOpen(false);
      toast.dismiss(loadingToast);
      toast.success(`${field["Field Name"]} updated successfully!`);
      
      // Trigger data refresh to sync with backend
      if (onDataUpdate) {
        onDataUpdate();
      }
      
    } catch (error) {
      console.error('Error updating field:', error);
      toast.dismiss(loadingToast);
      toast.error(`Failed to update ${field["Field Name"]}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Reset to original value on error
      setEditValue(displayValue || '');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(displayValue || '');
    setIsModalOpen(false);
  };

  // Strip HTML tags for preview display
  const stripHtml = (html: string) => {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '').substring(0, 100);
  };

  return (
    <>
      <div 
        className="relative p-3 border border-border/20 rounded-lg bg-card cursor-pointer hover:bg-accent/20 transition-colors overflow-auto whitespace-pre-wrap break-words"
        style={{ 
          minHeight: `${calculatedHeight}px`,
          wordBreak: 'break-word'
        }}
        data-field-id={field["Field ID"]}
        data-field-type={field.Type}
        onClick={() => setIsModalOpen(true)}
      >
        {/* Field name - top */}
        <div className="text-sm font-medium text-foreground mb-2 break-words">
          {field["Field Name"]}
        </div>
        
        {/* Rich text preview - below field name */}
        <div className="text-xs text-muted-foreground">
          {displayValue ? (
            <div className="prose prose-sm max-w-none prose-invert">
              <div
                className="whitespace-pre-wrap break-words break-all hyphens-auto leading-relaxed overflow-auto max-h-64 pr-1"
                style={{
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}
                dangerouslySetInnerHTML={{ __html: displayValue }}
              />
            </div>
          ) : (
            <span className="italic">Click to add content...</span>
          )}
        </div>
      </div>

      {/* Rich Text Editor Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-900 dark:bg-gray-800 border border-gray-700 dark:border-gray-600 rounded-lg shadow-2xl max-w-4xl w-full mx-4 max-h-[80vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700 dark:border-gray-600 bg-gray-800 dark:bg-gray-700 rounded-t-lg">
              <h3 className="text-lg font-semibold text-white">
                Edit {field["Field Name"]}
              </h3>
              <button
                onClick={handleCancel}
                className="text-gray-400 hover:text-white transition-colors p-1 rounded hover:bg-gray-700"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 p-4 overflow-hidden bg-gray-900 dark:bg-gray-800">
              <textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="w-full h-full min-h-[400px] p-3 bg-gray-800 dark:bg-gray-700 border border-gray-600 dark:border-gray-500 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
                placeholder="Enter rich text content (HTML supported)..."
                disabled={isSaving}
              />
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-700 dark:border-gray-600 bg-gray-800 dark:bg-gray-700 rounded-b-lg">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-sm border border-gray-600 text-gray-300 rounded-md hover:bg-gray-700 hover:text-white transition-colors"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className={`px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors ${
                  isSaving ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// Generic Field Component for other field types
interface GenericFieldProps {
  field: any;
  fieldValue: any;
  calculatedHeight: number;
  isProjectField: boolean;
  recordId: number;
  tableName: string;
  onDataUpdate?: () => void;
}

const GenericField: React.FC<GenericFieldProps> = ({
  field,
  fieldValue,
  calculatedHeight,
  isProjectField,
  recordId,
  tableName,
  onDataUpdate
}) => {
  const { data: session } = useSession();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editValue, setEditValue] = useState(fieldValue || '');
  const [isSaving, setIsSaving] = useState(false);
  const [displayValue, setDisplayValue] = useState(fieldValue);

  // Sync displayValue with fieldValue prop changes
  useEffect(() => {
    setDisplayValue(fieldValue);
    setEditValue(fieldValue || '');
  }, [fieldValue]);

  const handleSave = async () => {
    if (isSaving) return;
    
    setIsSaving(true);
    
    // Show loading toast
    const loadingToast = toast.loading('Saving changes...');
    
    try {
      // Create auth header like other components
      if (!session?.user?.email) {
        throw new Error("No session available");
      }
      
      const userInfo = {
        email: session.user.email,
        name: session.user.name || session.user.email,
        image: session.user.image || ""
      };
      const authHeader = `Bearer ${btoa(JSON.stringify(userInfo))}`;

      // Determine the correct table ID based on table name
      const tableId = tableName === "Projects" ? "mftsk8hkw23m8q1" : "mmqclkrvx9lbtpc";
      
      const response = await fetch('/api/proxy/nocodb/update-row', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
        },
        body: JSON.stringify({
          table_id: tableId,
          row_id: recordId.toString(),
          field_data: {
            [field["Field ID"]]: editValue
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('API Error:', response.status, errorData);
        throw new Error(`Failed to update field: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Field updated successfully:', result);
      
      // Update local display value immediately for better UX
      setDisplayValue(editValue);
      // Close modal and show success toast
      setIsModalOpen(false);
      toast.dismiss(loadingToast);
      toast.success(`${field["Field Name"]} updated successfully!`);
      
      // Trigger data refresh to sync with backend
      if (onDataUpdate) {
        onDataUpdate();
      }
      
    } catch (error) {
      console.error('Error updating field:', error);
      toast.dismiss(loadingToast);
      toast.error(`Failed to update ${field["Field Name"]}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Reset to original value on error
      setEditValue(displayValue || '');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(displayValue || '');
    setIsModalOpen(false);
  };

  // Determine input type based on field type
  const getInputType = (fieldType: string) => {
    switch (fieldType.toLowerCase()) {
      case 'number':
      case 'decimal':
      case 'currency':
        return 'number';
      case 'email':
        return 'email';
      case 'url':
        return 'url';
      case 'date':
        return 'date';
      case 'datetime':
        return 'datetime-local';
      case 'time':
        return 'time';
      case 'phone':
      case 'phone_number':
        return 'tel';
      default:
        return 'text';
    }
  };

  // Format display value
  const formatDisplayValue = (value: any, fieldType: string) => {
    if (!value) return 'Click to add content...';
    
    switch (fieldType.toLowerCase()) {
      case 'currency':
        return `$${Number(value).toLocaleString()}`;
      case 'number':
      case 'decimal':
        return Number(value).toLocaleString();
      case 'date':
        return new Date(value).toLocaleDateString();
      case 'datetime':
        return new Date(value).toLocaleString();
      case 'boolean':
        return value ? 'Yes' : 'No';
      default:
        return String(value);
    }
  };

  return (
    <>
      <div 
        className="relative p-3 border border-border/20 rounded-lg bg-card cursor-pointer hover:bg-accent/20 transition-colors overflow-auto"
        style={{ 
          minHeight: `${calculatedHeight}px`
        }}
        data-field-id={field["Field ID"]}
        data-field-type={field.Type}
        onClick={() => setIsModalOpen(true)}
      >
        {/* Field name - top */}
        <div className="text-sm font-medium text-foreground mb-2 break-words">
          {field["Field Name"]}
        </div>
        
        {/* Field value - below field name */}
        <div className="text-xs text-muted-foreground">
          {formatDisplayValue(displayValue, field.Type)}
        </div>
      </div>

      {/* Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-900 dark:bg-gray-800 border border-gray-700 dark:border-gray-600 rounded-lg shadow-2xl max-w-md w-full mx-4 max-h-[60vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700 dark:border-gray-600 bg-gray-800 dark:bg-gray-700 rounded-t-lg">
              <h3 className="text-lg font-semibold text-white">
                Edit {field["Field Name"]}
              </h3>
              <button
                onClick={handleCancel}
                className="text-gray-400 hover:text-white transition-colors p-1 rounded hover:bg-gray-700"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 p-4 overflow-hidden bg-gray-900 dark:bg-gray-800">
              {field.Type.toLowerCase() === 'boolean' ? (
                <select
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value === 'true')}
                  className="w-full p-3 bg-gray-800 dark:bg-gray-700 border border-gray-600 dark:border-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                  disabled={isSaving}
                >
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              ) : (
                <input
                  type={getInputType(field.Type)}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-full p-3 bg-gray-800 dark:bg-gray-700 border border-gray-600 dark:border-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
                  placeholder={`Enter ${field["Field Name"].toLowerCase()}...`}
                  disabled={isSaving}
                />
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-700 dark:border-gray-600 bg-gray-800 dark:bg-gray-700 rounded-b-lg">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-sm border border-gray-600 text-gray-300 rounded-md hover:bg-gray-700 hover:text-white transition-colors"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className={`px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors ${
                  isSaving ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// SingleSelect Field Component
interface SingleSelectFieldProps {
  field: any;
  fieldValue: any;
  calculatedHeight: number;
  isProjectField: boolean;
  recordId: number;
  tableName: string;
  onDataUpdate?: () => void;
}

const SingleSelectField: React.FC<SingleSelectFieldProps> = ({
  field,
  fieldValue,
  calculatedHeight,
  isProjectField,
  recordId,
  tableName,
  onDataUpdate
}) => {
  const { data: session } = useSession();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editValue, setEditValue] = useState(fieldValue || '');
  const [isSaving, setIsSaving] = useState(false);
  const [displayValue, setDisplayValue] = useState(fieldValue);

  // Sync displayValue with fieldValue prop changes
  useEffect(() => {
    setDisplayValue(fieldValue);
    setEditValue(fieldValue || '');
  }, [fieldValue]);
  const [options, setOptions] = useState<string[]>([]);

  // Parse options from field Options string
  useEffect(() => {
    const optionsString = field.Options || '';
    if (optionsString) {
      // Parse "Option 1 | Option 2 | Option 3" format
      const parsedOptions = optionsString.split(' | ').map((opt: string) => opt.trim()).filter((opt: string) => opt);
      setOptions(parsedOptions);
    }
  }, [field.Options]);

  const handleSave = async () => {
    if (isSaving) return;
    
    // Validate that the selected value is in the allowed options
    if (editValue && !options.includes(editValue)) {
      toast.error(`Invalid option "${editValue}". Please select from available choices: ${options.join(', ')}`);
      return;
    }
    
    setIsSaving(true);
    const loadingToast = toast.loading('Saving changes...');
    
    try {
      if (!session?.user?.email) {
        throw new Error("No session available");
      }
      
      const userInfo = {
        email: session.user.email,
        name: session.user.name || session.user.email,
        image: session.user.image || ""
      };
      const authHeader = `Bearer ${btoa(JSON.stringify(userInfo))}`;

      const tableId = tableName === "Projects" ? "mftsk8hkw23m8q1" : "mmqclkrvx9lbtpc";
      
      const response = await fetch('/api/proxy/nocodb/update-row', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
        },
        body: JSON.stringify({
          table_id: tableId,
          row_id: recordId.toString(),
          field_data: {
            [field["Field ID"]]: editValue
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('API Error:', response.status, errorData);
        throw new Error(`Failed to update field: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('API Response:', result);
      
      // Verify the update after a short delay
      setTimeout(async () => {
        try {
          const verifyResponse = await fetch(`/api/proxy/nocodb/verify-update?table_id=${tableId}&row_id=${recordId}&field_id=${field["Field ID"]}`, {
            headers: { 'Authorization': authHeader },
          });
          
          if (verifyResponse.ok) {
            const verifyData = await verifyResponse.json();
            const actualValue = verifyData.value;
            
            if (actualValue === editValue) {
              // Update local display value immediately for better UX
              setDisplayValue(editValue);
              toast.success(`${field["Field Name"]} updated successfully!`);
              
              // Trigger data refresh to sync with backend
              if (onDataUpdate) {
                onDataUpdate();
              }
            } else {
              toast.error(`Failed to update ${field["Field Name"]}: Value not accepted by database`);
              // Reset to original value on error
              setEditValue(displayValue || '');
            }
          } else {
            toast.error(`${field["Field Name"]} update status unclear. Please refresh to verify changes.`);
          }
        } catch (verifyError) {
          console.error('Verification error:', verifyError);
          toast.error(`${field["Field Name"]} update sent, but verification failed. Please refresh to check.`);
        }
      }, 500);
      
      setIsModalOpen(false);
      toast.dismiss(loadingToast);
      
    } catch (error) {
      console.error('Error updating field:', error);
      toast.dismiss(loadingToast);
      toast.error(`Failed to update ${field["Field Name"]}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(displayValue || '');
    setIsModalOpen(false);
  };

  return (
    <>
      <div 
        className="relative p-3 border border-border/20 rounded-lg bg-card cursor-pointer hover:bg-accent/20 transition-colors"
        style={{ minHeight: `${calculatedHeight}px` }}
        data-field-id={field["Field ID"]}
        data-field-type={field.Type}
        onClick={() => setIsModalOpen(true)}
      >
        <div className="text-sm font-medium text-foreground mb-2 break-words">
          {field["Field Name"]}
        </div>
        <div className="text-xs text-muted-foreground">
          {displayValue || 'Click to select option...'}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-900 dark:bg-gray-800 border border-gray-700 dark:border-gray-600 rounded-lg shadow-2xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between p-4 border-b border-gray-700 dark:border-gray-600 bg-gray-800 dark:bg-gray-700 rounded-t-lg">
              <h3 className="text-lg font-semibold text-white">
                Edit {field["Field Name"]}
              </h3>
              <button
                onClick={handleCancel}
                className="text-gray-400 hover:text-white transition-colors p-1 rounded hover:bg-gray-700"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <div className="p-4 bg-gray-900 dark:bg-gray-800">
              {options.length > 0 ? (
                <select
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-full p-3 bg-gray-800 dark:bg-gray-700 border border-gray-600 dark:border-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                  disabled={isSaving}
                >
                  <option value="">-- Select Option --</option>
                  {options.map((option, index) => (
                    <option key={index} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-full p-3 bg-gray-800 dark:bg-gray-700 border border-gray-600 dark:border-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
                  placeholder="Enter value (no options defined)..."
                  disabled={isSaving}
                />
              )}
              {options.length > 0 && (
                <div className="mt-2 text-xs text-gray-400">
                  Available options: {options.join(', ')}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-700 dark:border-gray-600 bg-gray-800 dark:bg-gray-700 rounded-b-lg">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-sm border border-gray-600 text-gray-300 rounded-md hover:bg-gray-700 hover:text-white transition-colors"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className={`px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors ${
                  isSaving ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// MultiSelect Field Component
interface MultiSelectFieldProps {
  field: any;
  fieldValue: any;
  calculatedHeight: number;
  isProjectField: boolean;
  recordId: number;
  tableName: string;
  onDataUpdate?: () => void;
}

const MultiSelectField: React.FC<MultiSelectFieldProps> = ({
  field,
  fieldValue,
  calculatedHeight,
  isProjectField,
  recordId,
  tableName,
  onDataUpdate
}) => {
  const { data: session } = useSession();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editValue, setEditValue] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [options, setOptions] = useState<string[]>([]);
  const [displayValue, setDisplayValue] = useState<string[]>(fieldValue || []);

  // Sync displayValue with fieldValue prop changes
  useEffect(() => {
    const parsedValue = Array.isArray(fieldValue) ? fieldValue : (fieldValue ? fieldValue.split(',').map((item: string) => item.trim()) : []);
    setDisplayValue(parsedValue);
    setEditValue(parsedValue);
  }, [fieldValue]);

  useEffect(() => {
    // Parse options from field Options string
    const optionsString = field.Options || '';
    if (optionsString) {
      const parsedOptions = optionsString.split(' | ').map((opt: string) => opt.trim()).filter((opt: string) => opt);
      setOptions(parsedOptions);
    }
  }, [field.Options]);

  const handleOptionToggle = (option: string) => {
    setEditValue(prev => {
      if (prev.includes(option)) {
        return prev.filter(v => v !== option);
      } else {
        return [...prev, option];
      }
    });
  };

  const handleSave = async () => {
    if (isSaving) return;
    
    // Validate that all selected values are in the allowed options
    const invalidOptions = editValue.filter(val => !options.includes(val));
    if (invalidOptions.length > 0) {
      toast.error(`Invalid options: "${invalidOptions.join(', ')}". Please select from available choices: ${options.join(', ')}`);
      return;
    }
    
    setIsSaving(true);
    const loadingToast = toast.loading('Saving changes...');
    
    try {
      if (!session?.user?.email) {
        throw new Error("No session available");
      }
      
      const userInfo = {
        email: session.user.email,
        name: session.user.name || session.user.email,
        image: session.user.image || ""
      };
      const authHeader = `Bearer ${btoa(JSON.stringify(userInfo))}`;

      const tableId = tableName === "Projects" ? "mftsk8hkw23m8q1" : "mmqclkrvx9lbtpc";
      
      const response = await fetch('/api/proxy/nocodb/update-row', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
        },
        body: JSON.stringify({
          table_id: tableId,
          row_id: recordId.toString(),
          field_data: {
            [field["Field ID"]]: editValue
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('API Error:', response.status, errorData);
        throw new Error(`Failed to update field: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('API Response:', result);
      
      // Verify the update after a short delay
      setTimeout(async () => {
        try {
          const verifyResponse = await fetch(`/api/proxy/nocodb/verify-update?table_id=${tableId}&row_id=${recordId}&field_id=${field["Field ID"]}`, {
            headers: { 'Authorization': authHeader },
          });
          
          if (verifyResponse.ok) {
            const verifyData = await verifyResponse.json();
            const actualValue = verifyData.value;
            
            // Compare arrays
            const actualArray = Array.isArray(actualValue) ? actualValue : (actualValue ? [actualValue] : []);
            const expectedArray = editValue;
            
            if (JSON.stringify(actualArray.sort()) === JSON.stringify(expectedArray.sort())) {
              // Update local display value immediately for better UX
              setDisplayValue(editValue);
              toast.success(`${field["Field Name"]} updated successfully!`);
              
              // Trigger data refresh to sync with backend
              if (onDataUpdate) {
                onDataUpdate();
              }
            } else {
              toast.error(`Failed to update ${field["Field Name"]}: Values not accepted by database`);
              // Reset to original value on error
              setEditValue(displayValue);
            }
          } else {
            toast.error(`${field["Field Name"]} update status unclear. Please refresh to verify changes.`);
          }
        } catch (verifyError) {
          console.error('Verification error:', verifyError);
          toast.error(`${field["Field Name"]} update sent, but verification failed. Please refresh to check.`);
        }
      }, 500);
      
      setIsModalOpen(false);
      toast.dismiss(loadingToast);
      
    } catch (error) {
      console.error('Error updating field:', error);
      toast.dismiss(loadingToast);
      toast.error(`Failed to update ${field["Field Name"]}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset to original display value
    setEditValue(displayValue);
    setIsModalOpen(false);
  };

  const formatDisplayValue = (value: any) => {
    if (Array.isArray(value)) {
      return value.length > 0 ? value.join(', ') : 'Click to select options...';
    } else if (typeof value === 'string' && value) {
      return value;
    } else {
      return 'Click to select options...';
    }
  };

  return (
    <>
      <div 
        className="relative p-3 border border-border/20 rounded-lg bg-card cursor-pointer hover:bg-accent/20 transition-colors"
        style={{ minHeight: `${calculatedHeight}px` }}
        data-field-id={field["Field ID"]}
        data-field-type={field.Type}
        onClick={() => setIsModalOpen(true)}
      >
        <div className="text-sm font-medium text-foreground mb-2 break-words">
          {field["Field Name"]}
        </div>
        <div className="text-xs text-muted-foreground">
          {formatDisplayValue(displayValue)}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-900 dark:bg-gray-800 border border-gray-700 dark:border-gray-600 rounded-lg shadow-2xl max-w-md w-full mx-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-700 dark:border-gray-600 bg-gray-800 dark:bg-gray-700 rounded-t-lg">
              <h3 className="text-lg font-semibold text-white">
                Edit {field["Field Name"]}
              </h3>
              <button
                onClick={handleCancel}
                className="text-gray-400 hover:text-white transition-colors p-1 rounded hover:bg-gray-700"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <div className="flex-1 p-4 bg-gray-900 dark:bg-gray-800 overflow-y-auto">
              {options.length > 0 ? (
                <div className="space-y-2">
                  {options.map((option, index) => (
                    <label
                      key={index}
                      className="flex items-center space-x-3 p-2 rounded-md hover:bg-gray-700 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={editValue.includes(option)}
                        onChange={() => handleOptionToggle(option)}
                        className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
                        disabled={isSaving}
                      />
                      <span className="text-white text-sm">{option}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <input
                  type="text"
                  value={editValue.join(', ')}
                  onChange={(e) => setEditValue(e.target.value.split(',').map(v => v.trim()).filter(v => v))}
                  className="w-full p-3 bg-gray-800 dark:bg-gray-700 border border-gray-600 dark:border-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
                  placeholder="Enter comma-separated values (no options defined)..."
                  disabled={isSaving}
                />
              )}
              {options.length > 0 && (
                <div className="mt-3 p-2 bg-gray-800 rounded text-xs text-gray-400">
                  Selected: {editValue.length > 0 ? editValue.join(', ') : 'None'}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-700 dark:border-gray-600 bg-gray-800 dark:bg-gray-700 rounded-b-lg">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-sm border border-gray-600 text-gray-300 rounded-md hover:bg-gray-700 hover:text-white transition-colors"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className={`px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors ${
                  isSaving ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// Collapsible Category Header Component
interface CategoryHeaderProps {
  category: string;
  isCollapsed: boolean;
  onToggle: () => void;
  categoryOrder: number;
}

const CategoryHeader: React.FC<CategoryHeaderProps> = ({ category, isCollapsed, onToggle, categoryOrder }) => (
  <div 
    className="flex items-center justify-between p-2 bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-lg cursor-pointer hover:bg-primary/15 transition-colors mb-2"
    onClick={onToggle}
  >
    <div className="flex items-center gap-2">
      <span className="text-xs bg-primary/20 text-primary-foreground px-2 py-1 rounded-full font-medium">
        {categoryOrder}
      </span>
      <h3 className="font-semibold text-foreground text-sm">
        {category}
      </h3>
    </div>
    <div className="flex items-center gap-1">
      <span className="text-xs text-muted-foreground">
        {isCollapsed ? 'Expand' : 'Collapse'}
      </span>
      <div className={`transform transition-transform ${isCollapsed ? 'rotate-0' : 'rotate-90'}`}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M6 4l4 4-4 4V4z"/>
        </svg>
      </div>
    </div>
  </div>
);

// Collapsible Subcategory Header Component  
interface SubcategoryHeaderProps {
  subcategory: string;
  category: string;
  isCollapsed: boolean;
  onToggle: () => void;
  subcategoryOrder: number;
}

const SubcategoryHeader: React.FC<SubcategoryHeaderProps> = ({ 
  subcategory, 
  category, 
  isCollapsed, 
  onToggle, 
  subcategoryOrder 
}) => (
  <div 
    className="flex items-center justify-between p-2 bg-secondary/50 border border-secondary/30 rounded-md cursor-pointer hover:bg-secondary/70 transition-colors mb-1 ml-4"
    onClick={onToggle}
  >
    <div className="flex items-center gap-2">
      <h4 className="font-medium text-foreground text-xs">
        {subcategory}
      </h4>
    </div>
    <div className="flex items-center gap-1">
      <span className="text-xs text-muted-foreground">
        {isCollapsed ? '+' : '−'}
      </span>
    </div>
  </div>
);

// Timeline item types
type TimelineItem = 
  | { type: 'comment'; data: Comment }
  | { type: 'audit'; data: AuditRecord };

export const PlotDisplay: React.FC<PlotDisplayProps> = ({ 
  plot, 
  parentProject, 
  schema, 
  fieldHeights = {},
  collapsedCategories,
  collapsedSubcategories,
  onToggleCategory,
  onToggleSubcategory,
  collapsedActivityTimelines,
  onToggleActivityTimeline,
  onDataUpdate
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { data: session } = useSession();
  
  // Comments state
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [showAddCommentModal, setShowAddCommentModal] = useState(false);

  // Audit state
  const [auditRecords, setAuditRecords] = useState<AuditRecord[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [addingComment, setAddingComment] = useState(false);

  // Combined timeline state
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  // Helper function to make authenticated requests
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

  // Helper function to format date as dd/mm/yyyy
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Fetch comments for both project and plot
  const fetchComments = async () => {
    if (!session) return;
    
    setCommentsLoading(true);
    try {
      const allComments: Comment[] = [];

      // Fetch project comments if parent project exists
      if (parentProject) {
        try {
          const response = await makeAuthenticatedRequest(
            `${process.env.NEXT_PUBLIC_BACKEND_URL}/nocodb/projects/${parentProject._db_id}/comments`
          );
          if (response.ok) {
            const data: CommentsResponse = await response.json();
            if (data.comments?.list) {
              allComments.push(...data.comments.list.map(comment => ({
                ...comment,
                table_name: 'projects'
              })));
            }
          }
        } catch (error) {
          console.error('Error fetching project comments:', error);
        }
      }

      // Fetch plot comments
      try {
        const response = await makeAuthenticatedRequest(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/nocodb/plots/${plot.id}/comments`
        );
        if (response.ok) {
          const data: CommentsResponse = await response.json();
          if (data.comments?.list) {
            allComments.push(...data.comments.list.map(comment => ({
              ...comment,
              table_name: 'plots'
            })));
          }
        }
      } catch (error) {
        console.error('Error fetching plot comments:', error);
      }

      // Sort comments by date (newest first)
      allComments.sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA;
      });

      setComments(allComments);
    } catch (error) {
      console.error('Error fetching comments:', error);
      toast.error('Failed to load comments');
    } finally {
      setCommentsLoading(false);
    }
  };

  // Fetch audit records for both project and plot
  const fetchAudit = async () => {
    try {
      setAuditLoading(true);
      const allAuditRecords: AuditRecord[] = [];

      // Fetch project audit if parent project exists
      if (parentProject) {
        try {
          const response = await makeAuthenticatedRequest(
            `${process.env.NEXT_PUBLIC_BACKEND_URL}/audit/projects/${parentProject._db_id}`
          );
          if (response.ok) {
            const data: AuditResponse = await response.json();
            if (data.audit_trail) {
              allAuditRecords.push(...data.audit_trail.map(record => ({
                ...record,
                table_name: 'projects'
              })));
            }
          }
        } catch (error) {
          console.error('Error fetching project audit:', error);
        }
      }

      // Fetch plot audit
      try {
        const response = await makeAuthenticatedRequest(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/audit/plots/${plot.id}`
        );
        if (response.ok) {
          const data: AuditResponse = await response.json();
          if (data.audit_trail) {
            allAuditRecords.push(...data.audit_trail.map(record => ({
              ...record,
              table_name: 'plots'
            })));
          }
        }
      } catch (error) {
        console.error('Error fetching plot audit:', error);
      }

      // Sort audit records by timestamp (newest first)
      allAuditRecords.sort((a, b) => {
        const dateA = new Date(a.timestamp).getTime();
        const dateB = new Date(b.timestamp).getTime();
        return dateB - dateA;
      });

      setAuditRecords(allAuditRecords);
    } catch (error) {
      console.error('Error fetching audit records:', error);
      toast.error('Failed to load audit records');
    } finally {
      setAuditLoading(false);
    }
  };
  const addComment = async (tableName: 'projects' | 'plots', recordId: number) => {
    if (!newCommentText.trim() || addingComment) return;

    setAddingComment(true);
    try {
      const response = await makeAuthenticatedRequest(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/nocodb/${tableName}/${recordId}/comments`,
        {
          method: 'POST',
          body: JSON.stringify({ comment: newCommentText.trim() })
        }
      );

      if (response.ok) {
        setNewCommentText('');
        setShowAddCommentModal(false);
        toast.success('Comment added successfully');
        // Refresh comments
        await fetchComments();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to add comment');
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error('Failed to add comment');
    } finally {
      setAddingComment(false);
    }
  };

  // Combine comments and audit records into timeline
  const updateTimeline = () => {
    // Filter audit records to only include those with valid changes
    const validAuditRecords = auditRecords.filter(audit => {
      if (!audit.details) return false;
      
      try {
        const details = typeof audit.details === 'string' 
          ? JSON.parse(audit.details) 
          : audit.details;
        const changedData = details.data || {};
        const oldData = details.old_data || {};
        
        // Check if this audit record has any valid changes
        const validEntries = Object.entries(changedData).filter(([field, value]) => {
          if (value === null || value === undefined || String(value).trim() === '') {
            return false;
          }
          const oldValue = oldData[field];
          
          // If there's no old value, this is a new field being set - include it
          if (oldValue === null || oldValue === undefined || String(oldValue).trim() === '') {
            return true; // Show initial field settings (new values)
          }
          
          // If there's an old value, only show if it's different
          const newValueStr = String(value).trim();
          const oldValueStr = String(oldValue).trim();
          return oldValueStr !== newValueStr; // Only show actual changes
        });
        
        return validEntries.length > 0;
      } catch (error) {
        return false; // Exclude audit records with parsing errors
      }
    });

    const combinedItems: TimelineItem[] = [
      ...comments.map(comment => ({ type: 'comment' as const, data: comment })),
      ...validAuditRecords.map(audit => ({ type: 'audit' as const, data: audit }))
    ];

    // Sort by timestamp (newest first)
    combinedItems.sort((a, b) => {
      const dateA = a.type === 'comment' 
        ? (a.data.created_at ? new Date(a.data.created_at).getTime() : 0)
        : new Date(a.data.timestamp).getTime();
      const dateB = b.type === 'comment' 
        ? (b.data.created_at ? new Date(b.data.created_at).getTime() : 0)
        : new Date(b.data.timestamp).getTime();
      return dateB - dateA;
    });

    setTimelineItems(combinedItems);
  };

  // Load comments and audit records when component mounts
  useEffect(() => {
    const loadTimelineData = async () => {
      setTimelineLoading(true);
      await Promise.all([fetchComments(), fetchAudit()]);
      setTimelineLoading(false);
    };
    
    loadTimelineData();
  }, [plot.id, parentProject?._db_id, session]);

  // Update timeline when comments or audit records change
  useEffect(() => {
    updateTimeline();
  }, [comments, auditRecords]);

  // Combine and sort all fields by category order - both plot and project fields together
  const plotFields = schema.filter(field => field.Table === "Land Plots, Sites");
  const projectFields = schema.filter(field => field.Table === "Projects");
  
  // Add source info and combine all fields
  const allFieldsWithSource = [
    ...plotFields.map(field => ({ ...field, source: 'plot' as const })),
    ...projectFields.map(field => ({ ...field, source: 'project' as const }))
  ].sort((a, b) => {
    // Sort by category_order, then subcategory_order, then Field Order (same as API)
    const categoryOrderA = a.category_order || 9999;
    const categoryOrderB = b.category_order || 9999;
    if (categoryOrderA !== categoryOrderB) {
      return categoryOrderA - categoryOrderB;
    }
    
    const subcategoryOrderA = a.subcategory_order || 9999;
    const subcategoryOrderB = b.subcategory_order || 9999;
    if (subcategoryOrderA !== subcategoryOrderB) {
      return subcategoryOrderA - subcategoryOrderB;
    }
    
    const fieldOrderA = a["Field Order"] || 9999;
    const fieldOrderB = b["Field Order"] || 9999;
    return fieldOrderA - fieldOrderB;
  });

  // Group fields by category and subcategory
  const groupedFields = allFieldsWithSource.reduce((acc, field) => {
    const category = field.Category || 'Uncategorized';
    const subcategory = field.Subcategory || 'General';
    
    if (!acc[category]) {
      acc[category] = {};
    }
    if (!acc[category][subcategory]) {
      acc[category][subcategory] = [];
    }
    acc[category][subcategory].push(field);
    
    return acc;
  }, {} as Record<string, Record<string, typeof allFieldsWithSource>>);

  // Synchronize field heights after initial render
  useLayoutEffect(() => {
    if (!containerRef.current) return;

    const synchronizeFieldHeights = () => {
      // Get all field divs across all PlotDisplay components on the page
      const allFieldDivs = document.querySelectorAll('[data-field-id]');
      const fieldHeightMap: { [fieldId: string]: number } = {};

      // First pass: measure all current heights by field ID
      allFieldDivs.forEach((div) => {
        const fieldId = div.getAttribute('data-field-id');
        if (fieldId) {
          const currentHeight = (div as HTMLElement).offsetHeight;
          fieldHeightMap[fieldId] = Math.max(fieldHeightMap[fieldId] || 0, currentHeight);
        }
      });

      // Second pass: apply the maximum height to all divs with the same field ID
      allFieldDivs.forEach((div) => {
        const fieldId = div.getAttribute('data-field-id');
        if (fieldId && fieldHeightMap[fieldId]) {
          (div as HTMLElement).style.minHeight = `${fieldHeightMap[fieldId]}px`;
        }
      });
    };

    // Small delay to ensure all components have rendered
    const timeoutId = setTimeout(synchronizeFieldHeights, 100);
    
    // Also run on window resize
    window.addEventListener('resize', synchronizeFieldHeights);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', synchronizeFieldHeights);
    };
  }, [allFieldsWithSource.length, plot.id]); // Re-run when fields or plot changes

  return (
    <div ref={containerRef} className="bg-muted/30 rounded-lg p-4 border border-border/50 min-w-96 max-w-[600px] flex-shrink-0">
      {/* Plot Header */}
      <div className="mb-3 border-b border-border/20 pb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-900 dark:text-blue-200">
            S{String(plot.id).padStart(3, '0')}
            {plot.basic_data?.["cjn6mu5x6gythrx"] && (
              <span className="ml-2 font-semibold">
                {plot.basic_data["cjn6mu5x6gythrx"]}
              </span>
            )}
          </span>
          {parentProject && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200 dark:bg-green-900 dark:text-green-200">
              P{String(parentProject._db_id).padStart(3, '0')}
              {parentProject.values?.["c5udjaiacvutwek"] && (
                <span className="ml-2 font-semibold">
                  {parentProject.values["c5udjaiacvutwek"]}
                </span>
              )}
            </span>
          )}
        </div>
      </div>

      {/* Combined Timeline Section */}
      <div className="mb-4 p-3 bg-muted/20 rounded-lg border border-border/20">
        <div 
          className="flex items-center justify-between p-2 bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-lg cursor-pointer hover:bg-primary/15 transition-colors mb-2"
          onClick={() => onToggleActivityTimeline(plot.id)}
        >
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h4 className="text-sm font-medium text-foreground">
              Activity Timeline ({timelineItems.length})
            </h4>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowAddCommentModal(true);
              }}
              className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded hover:bg-primary/90 transition-colors"
            >
              + Add Comment
            </button>
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">
                {collapsedActivityTimelines.has(plot.id) ? 'Expand' : 'Collapse'}
              </span>
              <div className={`transform transition-transform ${collapsedActivityTimelines.has(plot.id) ? 'rotate-0' : 'rotate-90'}`}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M6 4l4 4-4 4V4z"/>
                </svg>
              </div>
            </div>
          </div>
        </div>

        {!collapsedActivityTimelines.has(plot.id) && (
          <>
            {timelineLoading ? (
              <div className="flex items-center justify-center py-4 h-[300px]">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                <span className="ml-2 text-xs text-muted-foreground">Loading activity...</span>
              </div>
            ) : timelineItems.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground h-[300px] flex items-center justify-center">
                <p className="text-xs">No activity found</p>
              </div>
            ) : (
              <div className="space-y-2 h-[300px] overflow-y-auto">
                {timelineItems.map((item) => (
              <div key={`${item.type}-${item.data.id}`} className="bg-background/60 rounded p-1 border border-border/10">
                <div className="flex items-start gap-2">

                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {/* Activity type icon */}
                      <div className={`p-1 rounded ${
                        item.type === 'comment'
                          ? 'bg-blue-100 dark:bg-blue-900/30'
                          : 'bg-green-100 dark:bg-green-900/30'
                      }`}>
                        {item.type === 'comment' ? (
                          <svg className="w-3 h-3 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                        ) : (
                          <svg className="w-3 h-3 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                          </svg>
                        )}
                      </div>

                      <span className="text-xs font-medium text-foreground">
                        {item.type === 'comment'
                          ? (item.data as Comment).created_by_name || (item.data as Comment).created_by_email
                          : (item.data as AuditRecord).user_name || (item.data as AuditRecord).user_email || 'System'
                        }
                      </span>

                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                        item.type === 'comment'
                          ? ((item.data as Comment).table_name === 'projects'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200')
                          : ((item.data as AuditRecord).table_name === 'projects'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200')
                      }`}>
                        {item.type === 'comment'
                          ? ((item.data as Comment).table_name === 'projects' ? 'Project' : 'Plot')
                          : ((item.data as AuditRecord).table_name === 'projects' ? 'Project' : 'Plot')
                        }
                      </span>

                      <span className="text-xs text-muted-foreground ml-auto">
                        {item.type === 'comment'
                          ? formatDate((item.data as Comment).created_at)
                          : formatDate((item.data as AuditRecord).timestamp)
                        }
                      </span>
                    </div>

                    {/* Content based on type */}
                    {item.type === 'comment' ? (
                      <p className="text-xs text-foreground leading-relaxed ml-1">
                        {(item.data as Comment).comment}
                      </p>
                    ) : (
                      <div className="ml-1">
                        {/* Show changed field values for audit */}
                        {(item.data as AuditRecord).details && (() => {
                          try {
                            const details = typeof (item.data as AuditRecord).details === 'string' 
                              ? JSON.parse((item.data as AuditRecord).details!) 
                              : (item.data as AuditRecord).details;
                            const changedData = details.data || {};
                            const oldData = details.old_data || {};
                            
                            // Filter entries to only show meaningful changes and new values
                            const validEntries = Object.entries(changedData).filter(([field, value]) => {
                              if (value === null || value === undefined || String(value).trim() === '') {
                                return false;
                              }
                              const oldValue = oldData[field];
                              
                              // If there's no old value, this is a new field being set - include it
                              if (oldValue === null || oldValue === undefined || String(oldValue).trim() === '') {
                                return true; // Show initial field settings (new values)
                              }
                              
                              // If there's an old value, only show if it's different
                              const newValueStr = String(value).trim();
                              const oldValueStr = String(oldValue).trim();
                              return oldValueStr !== newValueStr; // Only show actual changes
                            });
                            
                            const entries = validEntries.slice(0, 3);
                            
                            return (
                              <div className="space-y-1">
                                {entries.map(([field, value]) => {
                                  const newValueStr = String(value);
                                  const oldValue = oldData[field];
                                  const isTruncated = typeof value === 'string' && value.length > 250;
                                  const displayValue = isTruncated 
                                    ? `${value.substring(0, 250)}...`
                                    : newValueStr;
                                  
                                  return (
                                    <div key={field} className="text-xs">
                                      <span className="font-medium text-muted-foreground">{field}:</span>
                                      <span className="ml-1 text-green-700 dark:text-green-300">
                                        {displayValue}
                                      </span>
                                      {!isTruncated && oldValue !== undefined && oldValue !== null && String(oldValue) !== newValueStr && (
                                        <span className="ml-1 text-red-600 dark:text-red-400">
                                          (was: {String(oldValue)})
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                                {validEntries.length > 3 && (
                                  <div className="text-xs text-muted-foreground">
                                    ... and {validEntries.length - 3} more fields
                                  </div>
                                )}
                              </div>
                            );
                          } catch (error) {
                            return null; // Hide audit entries with parsing errors
                          }
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Grouped Fields with Collapsible Categories and Subcategories */}
      <div className="bg-background/50 rounded-md p-3 border border-border/30">
        {Object.entries(groupedFields)
          .sort(([, fieldsA], [, fieldsB]) => {
            // Sort categories by their category_order
            const firstFieldA = Object.values(fieldsA)[0]?.[0];
            const firstFieldB = Object.values(fieldsB)[0]?.[0];
            return (firstFieldA?.category_order || 9999) - (firstFieldB?.category_order || 9999);
          })
          .map(([category, subcategories]) => {
            const isCategoryCollapsed = collapsedCategories.has(category);
            const firstField = Object.values(subcategories)[0]?.[0];
            const categoryOrder = firstField?.category_order || 0;

            return (
              <div key={category} className="mb-4 last:mb-0">
                <CategoryHeader
                  category={category}
                  isCollapsed={isCategoryCollapsed}
                  onToggle={() => onToggleCategory(category)}
                  categoryOrder={categoryOrder}
                />
                
                {!isCategoryCollapsed && (
                  <div className="ml-2">
                    {Object.entries(subcategories)
                      .sort(([, fieldsA], [, fieldsB]) => {
                        // Sort subcategories by their subcategory_order
                        return (fieldsA[0]?.subcategory_order || 9999) - (fieldsB[0]?.subcategory_order || 9999);
                      })
                      .map(([subcategory, fields]) => {
                        const subcategoryKey = `${category}:${subcategory}`;
                        const isSubcategoryCollapsed = collapsedSubcategories.has(subcategoryKey);
                        const subcategoryOrder = fields[0]?.subcategory_order || 0;

                        return (
                          <div key={subcategoryKey} className="mb-3 last:mb-0">
                            <SubcategoryHeader
                              subcategory={subcategory}
                              category={category}
                              isCollapsed={isSubcategoryCollapsed}
                              onToggle={() => onToggleSubcategory(subcategoryKey)}
                              subcategoryOrder={subcategoryOrder}
                            />
                            
                            {!isSubcategoryCollapsed && (
                              <div className="space-y-1 ml-6">
                                {fields.map((field, idx) => {
                                  const fieldId = field["Field ID"];
                                  const isProjectField = field.source === 'project';
                                  
                                  // Get field value based on source
                                  const fieldValue = isProjectField 
                                    ? parentProject?.values?.[fieldId]
                                    : plot.basic_data?.[fieldId];
                                  
                                  // Get calculated height
                                  const calculatedHeight = fieldHeights[isProjectField ? `project-${fieldId}` : fieldId] || 60;
                                  
                                  // Skip project fields if no parent project
                                  if (isProjectField && !parentProject) {
                                    return null;
                                  }

                                  // Render based on field type
                                  if (field.Type === "SingleLineText") {
                                    return (
                                      <SingleLineTextField
                                        key={`${field.source}-${idx}`}
                                        field={field}
                                        fieldValue={fieldValue}
                                        calculatedHeight={calculatedHeight}
                                        isProjectField={isProjectField}
                                        recordId={isProjectField ? (parentProject?._db_id || 0) : plot.id}
                                        tableName={isProjectField ? "Projects" : "LandPlots"}
                                        onDataUpdate={onDataUpdate}
                                      />
                                    );
                                  }

                                  if (field.Type === "LongText") {
                                    return (
                                      <LongTextField
                                        key={`${field.source}-${idx}`}
                                        field={field}
                                        fieldValue={fieldValue}
                                        calculatedHeight={calculatedHeight}
                                        isProjectField={isProjectField}
                                        recordId={isProjectField ? (parentProject?._db_id || 0) : plot.id}
                                        tableName={isProjectField ? "Projects" : "LandPlots"}
                                        onDataUpdate={onDataUpdate}
                                      />
                                    );
                                  }

                                  if (field.Type === "SingleSelect") {
                                    return (
                                      <SingleSelectField
                                        key={`${field.source}-${idx}`}
                                        field={field}
                                        fieldValue={fieldValue}
                                        calculatedHeight={calculatedHeight}
                                        isProjectField={isProjectField}
                                        recordId={isProjectField ? (parentProject?._db_id || 0) : plot.id}
                                        tableName={isProjectField ? "Projects" : "LandPlots"}
                                        onDataUpdate={onDataUpdate}
                                      />
                                    );
                                  }

                                  if (field.Type === "MultiSelect") {
                                    return (
                                      <MultiSelectField
                                        key={`${field.source}-${idx}`}
                                        field={field}
                                        fieldValue={fieldValue}
                                        calculatedHeight={calculatedHeight}
                                        isProjectField={isProjectField}
                                        recordId={isProjectField ? (parentProject?._db_id || 0) : plot.id}
                                        tableName={isProjectField ? "Projects" : "LandPlots"}
                                        onDataUpdate={onDataUpdate}
                                      />
                                    );
                                  }

                                  // Static fields that are not editable
                                  const staticFieldTypes = [
                                    "CreatedBy", "CreatedTime", "Formula", "ID",
                                    "LastModifiedBy", "LastModifiedTime", "LinkToAnotherRecord",
                                    "Lookup", "Order", "Rollup", "User"
                                  ];

                                  if (staticFieldTypes.includes(field.Type)) {
                                    return (
                                      <div
                                        key={`${field.source}-${idx}`}
                                        className="relative p-3 border border-red-300/50 rounded-lg bg-red-50/30 cursor-not-allowed"
                                        style={{
                                          minHeight: `${calculatedHeight}px`
                                        }}
                                        data-field-id={field["Field ID"]}
                                        data-field-type={field.Type}
                                      >
                                        {/* Field name - top */}
                                        <div className="text-sm font-medium text-red-800 mb-2 break-words">
                                          {field["Field Name"]}
                                        </div>

                                        {/* Field info and value */}
                                        <div className="text-xs text-red-600 space-y-1">
                                          <div className="font-mono">
                                            ID: {field["Field ID"]} • Type: {field.Type}
                                          </div>
                                          <div className="text-red-700">
                                            {fieldValue !== null && fieldValue !== undefined ? (
                                              Array.isArray(fieldValue)
                                                ? fieldValue.join(', ')
                                                : String(fieldValue)
                                            ) : (
                                              <span className="italic">N/A</span>
                                            )}
                                          </div>
                                          {isProjectField && (
                                            <span className="text-green-600 font-medium">(Project)</span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  }

                                  // Generic field component for other field types
                                  return (
                                    <GenericField
                                      key={`${field.source}-${idx}`}
                                      field={field}
                                      fieldValue={fieldValue}
                                      calculatedHeight={calculatedHeight}
                                      isProjectField={isProjectField}
                                      recordId={isProjectField ? (parentProject?._db_id || 0) : plot.id}
                                      tableName={isProjectField ? "Projects" : "LandPlots"}
                                      onDataUpdate={onDataUpdate}
                                    />
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {/* Add Comment Modal */}
      {showAddCommentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowAddCommentModal(false)}
          />
          
          {/* Modal */}
          <div className="relative bg-background rounded-lg shadow-xl border border-border p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Add Comment</h3>
              <button
                onClick={() => setShowAddCommentModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Comment for:
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => addComment('plots', plot.id)}
                    disabled={addingComment}
                    className="flex-1 bg-blue-100 text-blue-800 px-3 py-2 rounded text-sm hover:bg-blue-200 disabled:opacity-50"
                  >
                    Plot {String(plot.id).padStart(3, '0')}
                  </button>
                  {parentProject && (
                    <button
                      onClick={() => addComment('projects', parentProject._db_id)}
                      disabled={addingComment}
                      className="flex-1 bg-green-100 text-green-800 px-3 py-2 rounded text-sm hover:bg-green-200 disabled:opacity-50"
                    >
                      Project {String(parentProject._db_id).padStart(3, '0')}
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Comment:
                </label>
                <textarea
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  placeholder="Enter your comment..."
                  className="w-full p-3 border border-border rounded-md bg-background text-foreground resize-none"
                  rows={4}
                  disabled={addingComment}
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowAddCommentModal(false)}
                  className="flex-1 px-4 py-2 text-sm border border-border rounded hover:bg-muted"
                  disabled={addingComment}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    // Default to plot comment if no specific selection
                    if (parentProject) {
                      // Show options in modal
                    } else {
                      addComment('plots', plot.id);
                    }
                  }}
                  disabled={!newCommentText.trim() || addingComment}
                  className="flex-1 bg-primary text-primary-foreground px-4 py-2 rounded text-sm hover:bg-primary/90 disabled:opacity-50"
                >
                  {addingComment ? 'Adding...' : 'Add Comment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};