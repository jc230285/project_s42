import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

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
}

// SingleLineTextField Component
interface SingleLineTextFieldProps {
  field: SchemaField;
  fieldValue: any;
  calculatedHeight: number;
  isProjectField: boolean;
  recordId: number;
  tableName: string;
}

const SingleLineTextField: React.FC<SingleLineTextFieldProps> = ({
  field,
  fieldValue,
  calculatedHeight,
  isProjectField,
  recordId,
  tableName
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(fieldValue || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (isSaving) return;
    
    setIsSaving(true);
    try {
      // Determine the correct table ID based on table name
      const tableId = tableName === "Projects" ? "mftsk8hkw23m8q1" : "mmqclkrvx9lbtpc";
      
      const response = await fetch('/api/proxy/nocodb/update-row', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
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
        throw new Error('Failed to update field');
      }

      // Show success toast (you might want to add a toast library)
      console.log('Field updated successfully');
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating field:', error);
      // Show error toast
      alert('Failed to update field');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(fieldValue || '');
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
              className="text-sm border border-border rounded px-2 py-1 min-w-[80px] text-right"
              autoFocus
              disabled={isSaving}
            />
            {isSaving && <span className="text-xs text-muted-foreground">...</span>}
          </div>
        ) : (
          <div 
            onClick={() => setIsEditing(true)}
            className={`text-sm cursor-pointer hover:bg-accent/50 rounded px-2 py-1 transition-colors ${
              isProjectField ? 'text-green-700' : 'text-blue-700'
            }`}
          >
            {fieldValue !== null && fieldValue !== undefined && String(fieldValue).trim() !== '' ? (
              <span className="font-medium">
                {String(fieldValue)}
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
}

const LongTextField: React.FC<LongTextFieldProps> = ({
  field,
  fieldValue,
  calculatedHeight,
  isProjectField,
  recordId,
  tableName
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editValue, setEditValue] = useState(fieldValue || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (isSaving) return;
    
    setIsSaving(true);
    try {
      // Determine the correct table ID based on table name
      const tableId = tableName === "Projects" ? "mftsk8hkw23m8q1" : "mmqclkrvx9lbtpc";
      
      const response = await fetch('/api/proxy/nocodb/update-row', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
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
        throw new Error('Failed to update field');
      }

      console.log('Field updated successfully');
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error updating field:', error);
      alert('Failed to update field');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(fieldValue || '');
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
        className="relative p-3 border border-border/20 rounded-lg bg-card cursor-pointer hover:bg-accent/20 transition-colors overflow-hidden"
        style={{ minHeight: `${calculatedHeight}px` }}
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
          {fieldValue ? (
            <div className="prose prose-sm max-w-none prose-invert break-words">
              <div 
                className="break-words whitespace-pre-wrap overflow-hidden" 
                dangerouslySetInnerHTML={{ __html: fieldValue }} 
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
      <span className="text-xs bg-secondary/60 text-secondary-foreground px-1.5 py-0.5 rounded font-medium">
        {subcategoryOrder}
      </span>
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

export const PlotDisplay: React.FC<PlotDisplayProps> = ({ plot, parentProject, schema, fieldHeights = {} }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // State for collapsed categories and subcategories
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [collapsedSubcategories, setCollapsedSubcategories] = useState<Set<string>>(new Set());

  // Load collapsed state from cookies on mount
  useEffect(() => {
    const savedCategories = getCookieValue('collapsed-categories');
    const savedSubcategories = getCookieValue('collapsed-subcategories');
    
    if (savedCategories) {
      try {
        const parsed = JSON.parse(savedCategories);
        setCollapsedCategories(new Set(parsed));
      } catch (e) {
        console.warn('Failed to parse collapsed categories from cookie');
      }
    }
    
    if (savedSubcategories) {
      try {
        const parsed = JSON.parse(savedSubcategories);
        setCollapsedSubcategories(new Set(parsed));
      } catch (e) {
        console.warn('Failed to parse collapsed subcategories from cookie');
      }
    }
  }, []);

  // Save collapsed state to cookies whenever it changes
  useEffect(() => {
    setCookieValue('collapsed-categories', JSON.stringify([...collapsedCategories]));
  }, [collapsedCategories]);

  useEffect(() => {
    setCookieValue('collapsed-subcategories', JSON.stringify([...collapsedSubcategories]));
  }, [collapsedSubcategories]);

  // Toggle functions
  const toggleCategory = (category: string) => {
    setCollapsedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  const toggleSubcategory = (subcategoryKey: string) => {
    setCollapsedSubcategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(subcategoryKey)) {
        newSet.delete(subcategoryKey);
      } else {
        newSet.add(subcategoryKey);
      }
      return newSet;
    });
  };

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
    <div ref={containerRef} className="bg-muted/30 rounded-lg p-4 border border-border/50 min-w-96 flex-shrink-0">
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
                  onToggle={() => toggleCategory(category)}
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
                              onToggle={() => toggleSubcategory(subcategoryKey)}
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
                                      />
                                    );
                                  }

                                  // Fallback for other field types
                                  return (
                                    <div 
                                      key={`${field.source}-${idx}`} 
                                      className="flex justify-between items-center gap-4 py-2 border-b border-border/10" 
                                      style={{ minHeight: `${calculatedHeight}px` }}
                                      data-field-id={field["Field ID"]}
                                      data-field-type={field.Type}
                                    >
                                      {/* Left side: Field info */}
                                      <div className="flex-1 flex flex-col justify-center">
                                        <div className="font-medium text-sm text-foreground leading-tight">
                                          {field["Field Name"]} ({field["Field ID"]})
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-1">
                                          {field.Category} {field.Subcategory && `• ${field.Subcategory}`} • {field.Type}
                                          {isProjectField && (
                                            <span className="ml-2 text-green-600 font-medium">(Project)</span>
                                          )}
                                        </div>
                                      </div>
                                      
                                      {/* Right side: Value */}
                                      <div className="flex-shrink-0 text-right max-w-xs flex items-center justify-end">
                                        <div className={`text-sm font-medium px-3 py-1 rounded border min-h-[32px] flex items-center ${
                                          isProjectField 
                                            ? 'bg-green-50/50 text-green-900' 
                                            : 'bg-blue-50/50 text-blue-900'
                                        }`}>
                                          {fieldValue !== null && fieldValue !== undefined ? (
                                            Array.isArray(fieldValue) 
                                              ? fieldValue.join(', ')
                                              : String(fieldValue)
                                          ) : (
                                            <span className="text-muted-foreground italic">N/A</span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
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
    </div>
  );
};