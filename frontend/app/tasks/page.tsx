"use client";
import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import DashboardLayout from '@/components/DashboardLayout';
import { hasUserGroup } from '@/lib/auth-utils';
import toast from 'react-hot-toast';
import { ExternalLink, X, Edit, Trash2, Save, Settings, Eye, EyeOff, GripVertical } from 'lucide-react';

interface TaskRecord {
  [key: string]: any;
}

interface ColumnSettings {
  visibleColumns: string[];
  columnOrder: string[];
}

const COLUMN_SETTINGS_COOKIE = 'tasks_column_settings';

function TasksPage() {
  const { data: session, status } = useSession();
  const [tableData, setTableData] = useState<TaskRecord[]>([]);
  const [filteredData, setFilteredData] = useState<TaskRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Users state
  const [availableUsers, setAvailableUsers] = useState<Array<{id: string; email: string; display_name: string | null; nocobdid: string | null}>>([]);
  
  // User selection modal state
  const [userSelectModalOpen, setUserSelectModalOpen] = useState(false);
  const [userSelectField, setUserSelectField] = useState<{record: TaskRecord; fieldName: string} | null>(null);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]); // For multi-select Assignees
  
  // Status selection modal state
  const [statusSelectModalOpen, setStatusSelectModalOpen] = useState(false);
  const [statusSelectField, setStatusSelectField] = useState<{record: TaskRecord; fieldName: string} | null>(null);
  
  // Tags selection modal state
  const [tagsModalOpen, setTagsModalOpen] = useState(false);
  const [tagsField, setTagsField] = useState<{record: TaskRecord; fieldName: string} | null>(null);
  const [selectedTags, setSelectedTags] = useState<Array<{id: string; name: string; type: string; color: string}>>([]);
  const [tagSearchTerm, setTagSearchTerm] = useState('');
  const [companies, setCompanies] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [customTags, setCustomTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [newCategoryInput, setNewCategoryInput] = useState('');
  
  // Groups selection modal state
  const [groupsModalOpen, setGroupsModalOpen] = useState(false);
  const [groupsField, setGroupsField] = useState<{record: TaskRecord; fieldName: string} | null>(null);
  const [availableGroups, setAvailableGroups] = useState<Array<{id: string; name: string}>>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [groupSearchTerm, setGroupSearchTerm] = useState('');
  
  // Tab state
  // Tab state with cookie persistence
  const [activeTab, setActiveTab] = useState<'my-tasks' | 'watching' | 'all'>(() => {
    if (typeof document !== 'undefined') {
      const saved = document.cookie.split('; ').find(row => row.startsWith('tasks_active_tab='));
      return (saved?.split('=')[1] as 'my-tasks' | 'watching' | 'all') || 'my-tasks';
    }
    return 'my-tasks';
  });
  
  // Modal states
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<TaskRecord | null>(null);
  const [editedRecord, setEditedRecord] = useState<TaskRecord | null>(null);
  
  // Inline editing state
  const [editingCell, setEditingCell] = useState<{recordId: any, fieldName: string} | null>(null);
  const [inlineEditValue, setInlineEditValue] = useState<any>('');
  
  // Column customization state
  const [columnSettingsOpen, setColumnSettingsOpen] = useState(false);
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  
  // Row reordering state
  const [draggedRow, setDraggedRow] = useState<TaskRecord | null>(null);
  const [dragOverRow, setDragOverRow] = useState<TaskRecord | null>(null);
  
  // Sorting state with cookie persistence
  const [sortBy, setSortBy] = useState<'sort-order' | 'due-date'>(() => {
    if (typeof document !== 'undefined') {
      const saved = document.cookie.split('; ').find(row => row.startsWith('tasks_sort_by='));
      return (saved?.split('=')[1] as 'sort-order' | 'due-date') || 'sort-order';
    }
    return 'sort-order';
  });

  // Tag filter states
  const [filterCompany, setFilterCompany] = useState<string>('');
  const [filterProject, setFilterProject] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterCustomTag, setFilterCustomTag] = useState<string>('');

  // Status filter state - array of selected statuses
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(['Closed', 'On-Going', 'Waiting on External', 'Complete']);

  // Create task state
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  // Check if user has Scale42 access
  const hasScale42Access = hasUserGroup(session, 'Scale42');

  // Cookie management functions
  const saveColumnSettings = (settings: ColumnSettings) => {
    document.cookie = `${COLUMN_SETTINGS_COOKIE}=${JSON.stringify(settings)}; path=/; max-age=31536000`; // 1 year
    toast.success('Column settings saved');
  };

  const loadColumnSettings = (): ColumnSettings | null => {
    const cookies = document.cookie.split(';');
    const settingsCookie = cookies.find(c => c.trim().startsWith(`${COLUMN_SETTINGS_COOKIE}=`));
    if (settingsCookie) {
      try {
        const value = settingsCookie.split('=')[1];
        return JSON.parse(decodeURIComponent(value));
      } catch (e) {
        console.error('Error parsing column settings:', e);
        return null;
      }
    }
    return null;
  };

  const resetColumnSettings = () => {
    document.cookie = `${COLUMN_SETTINGS_COOKIE}=; path=/; max-age=0`;
    if (tableData.length > 0) {
      const defaultColumns = getDefaultColumns(tableData[0]);
      setVisibleColumns(defaultColumns);
      setColumnOrder(defaultColumns);
    }
    toast.success('Column settings reset to default');
  };

  const getDefaultColumns = (record: TaskRecord) => {
    const allKeys = Object.keys(record);
    const excludeFields = ['Id', 'id', 'CreatedAt', 'created_at', 'UpdatedAt', 'updated_at'];
    const filteredKeys = allKeys.filter(key => !excludeFields.includes(key));
    
    // Move WorkOrderNo to the front if it exists
    const workOrderIndex = filteredKeys.findIndex(key => key === 'WorkOrderNo');
    if (workOrderIndex > 0) {
      const workOrderNo = filteredKeys.splice(workOrderIndex, 1)[0];
      filteredKeys.unshift(workOrderNo);
    }
    
    return filteredKeys;
  };

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
    console.log('🔍 Tasks Page - hasScale42Access:', hasScale42Access, 'status:', status);
    if (hasScale42Access && status === "authenticated") {
      console.log('✅ Fetching tasks data and users...');
      fetchTableData();
      fetchUsers();
      fetchCompaniesAndProjects();
      fetchGroups();
    } else if (status === "authenticated" && !hasScale42Access) {
      console.log('⛔ User does not have Scale42 access');
      setError('You do not have permission to view tasks');
    }
  }, [hasScale42Access, status]);

  // Apply tab filter whenever tableData, activeTab, or sortBy changes
  useEffect(() => {
    applyTabFilter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableData, activeTab, session, sortBy, filterCompany, filterProject, filterCategory, filterCustomTag, selectedStatuses]);

  // Save activeTab to cookie
  useEffect(() => {
    document.cookie = `tasks_active_tab=${activeTab}; path=/; max-age=31536000`; // 1 year
  }, [activeTab]);

  // Save sortBy to cookie
  useEffect(() => {
    document.cookie = `tasks_sort_by=${sortBy}; path=/; max-age=31536000`; // 1 year
  }, [sortBy]);

  // Apply tab-based filtering
  const applyTabFilter = () => {
    if (!session?.user?.email) {
      setFilteredData(tableData);
      return;
    }

    const userEmail = session.user.email.toLowerCase();
    console.log('🔍 Filtering with user email:', userEmail);
    let filtered = [...tableData];

    // Helper function to check if user email is in Lead array
    const isUserLead = (lead: any): boolean => {
      if (!lead) return false;
      
      // Handle array of objects with email property
      if (Array.isArray(lead)) {
        const result = lead.some(l => l?.email?.toLowerCase() === userEmail);
        console.log('  Lead array check:', lead.map(l => l?.email), '→', result);
        return result;
      }
      
      // Handle string
      if (typeof lead === 'string') {
        const result = lead.toLowerCase() === userEmail;
        console.log('  Lead string check:', lead, '→', result);
        return result;
      }
      
      // Handle single object with email property
      if (lead?.email) {
        const result = lead.email.toLowerCase() === userEmail;
        console.log('  Lead object check:', lead.email, '→', result);
        return result;
      }
      
      return false;
    };

    // Helper function to check if user email is in Assignees array
    const isUserAssignee = (assignees: any): boolean => {
      if (!assignees) return false;
      
      // Handle array of objects with email property
      if (Array.isArray(assignees)) {
        return assignees.some(a => a?.email?.toLowerCase() === userEmail);
      }
      
      // Handle string (comma-separated emails or single email)
      if (typeof assignees === 'string') {
        return assignees.toLowerCase().includes(userEmail);
      }
      
      // Handle single object with email property
      if (assignees?.email) {
        return assignees.email.toLowerCase() === userEmail;
      }
      
      return false;
    };

    switch (activeTab) {
      case 'my-tasks':
        // Filter where logged-in email matches Lead
        filtered = filtered.filter(record => isUserLead(record.Lead));
        break;

      case 'watching':
        // Filter where logged-in email matches Lead or Assignees
        filtered = filtered.filter(record => {
          return isUserLead(record.Lead) || isUserAssignee(record.Assignees);
        });
        break;

      case 'all':
      default:
        // No filtering, show all
        break;
    }

    // Apply tag filters
    if (filterCompany || filterProject || filterCategory || filterCustomTag) {
      filtered = filtered.filter(record => {
        const tagsValue = record.Tags;
        if (!tagsValue) return false;
        
        try {
          const tags = typeof tagsValue === 'string' ? JSON.parse(tagsValue) : tagsValue;
          if (!Array.isArray(tags)) return false;
          
          let matchesFilters = true;
          
          if (filterCompany) {
            matchesFilters = matchesFilters && tags.some((tag: any) => 
              tag.type === 'company' && tag.id === filterCompany
            );
          }
          
          if (filterProject) {
            matchesFilters = matchesFilters && tags.some((tag: any) => 
              tag.type === 'project' && tag.id === filterProject
            );
          }
          
          if (filterCategory) {
            matchesFilters = matchesFilters && tags.some((tag: any) => 
              tag.type === 'category' && tag.id === filterCategory
            );
          }
          
          if (filterCustomTag) {
            matchesFilters = matchesFilters && tags.some((tag: any) => 
              tag.type === 'custom' && tag.id === filterCustomTag
            );
          }
          
          return matchesFilters;
        } catch (e) {
          return false;
        }
      });
    }

    // Apply status filter
    if (selectedStatuses.length > 0 && selectedStatuses.length < 4) {
      // Only filter if not all statuses are selected
      filtered = filtered.filter(record => {
        const status = record.Status;
        return selectedStatuses.includes(status);
      });
    }

    // Apply sorting based on selected sort option
    filtered.sort((a, b) => {
      if (sortBy === 'sort-order') {
        // Sort by Sort Order field (ascending - lower numbers first)
        const sortOrderA = a['Sort Order'] ?? a.SortOrder ?? a.sortOrder;
        const sortOrderB = b['Sort Order'] ?? b.SortOrder ?? b.sortOrder;
        
        if (sortOrderA !== undefined && sortOrderB !== undefined) {
          const orderA = Number(sortOrderA);
          const orderB = Number(sortOrderB);
          if (!isNaN(orderA) && !isNaN(orderB)) {
            return orderA - orderB;
          }
        }
        
        // Fallback to date
        const dateFieldA = a.CreatedAt || a['Created Date'] || a.createdAt;
        const dateFieldB = b.CreatedAt || b['Created Date'] || b.createdAt;
        
        if (dateFieldA && dateFieldB) {
          return new Date(dateFieldB).getTime() - new Date(dateFieldA).getTime();
        }
        return 0;
      } else if (sortBy === 'due-date') {
        // Sort by Due Date: null values first, then oldest dates first
        const dueDateA = a['Required End'] ?? a.RequiredEnd ?? a['Due Date'] ?? a.DueDate;
        const dueDateB = b['Required End'] ?? b.RequiredEnd ?? b['Due Date'] ?? b.DueDate;
        
        // Both null - maintain order
        if (!dueDateA && !dueDateB) return 0;
        
        // A is null, B has value - A comes first
        if (!dueDateA) return -1;
        
        // B is null, A has value - B comes first
        if (!dueDateB) return 1;
        
        // Both have values - sort oldest first (ascending)
        return new Date(dueDateA).getTime() - new Date(dueDateB).getTime();
      }
      
      return 0;
    });

    setFilteredData(filtered);
  };

  const fetchTableData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await makeAuthenticatedRequest(
        `/api/proxy/nocodb/table/m00xhbj3bkktc13`
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || `Failed to fetch tasks data (${response.status})`);
      }

      const data = await response.json();
      console.log('📊 Tasks Data:', data);
      
      let records = data.records || data.list || [];
      
      console.log('📊 Tasks count:', records.length);
      console.log('📊 First task Lead field:', records[0]?.Lead);
      console.log('📊 First task full record:', records[0]);
      
      setTableData(records);
      setFilteredData(records);
      toast.success(`Tasks data loaded successfully (${records.length} tasks)`);
      
      // Initialize column settings
      if (records.length > 0) {
        const defaultColumns = getDefaultColumns(records[0]);
        setAvailableColumns(defaultColumns);
        
        // Load saved settings or use defaults
        const savedSettings = loadColumnSettings();
        if (savedSettings && savedSettings.columnOrder.length > 0) {
          // Validate saved columns still exist
          const validColumns = savedSettings.columnOrder.filter(col => defaultColumns.includes(col));
          const validVisible = savedSettings.visibleColumns.filter(col => defaultColumns.includes(col));
          
          if (validColumns.length > 0) {
            setColumnOrder(validColumns);
            setVisibleColumns(validVisible);
          } else {
            setColumnOrder(defaultColumns);
            setVisibleColumns(defaultColumns);
          }
        } else {
          setColumnOrder(defaultColumns);
          setVisibleColumns(defaultColumns);
        }
      }
    } catch (error) {
      console.error('❌ Error fetching tasks data:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load tasks data';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      console.log('👥 Fetching NocoDB users...');
      const response = await makeAuthenticatedRequest(
        `/api/proxy/nocodb/users`
      );

      if (!response.ok) {
        console.error('Failed to fetch users:', response.status);
        return;
      }

      const data = await response.json();
      console.log('👥 Users Data:', data);
      
      // Extract users from the response
      let users = data.users || data.list || data;
      
      if (Array.isArray(users)) {
        // Map to the format we need - NocoDB users table has 'name' not 'display_name'
        const formattedUsers = users.map(user => ({
          id: user.id,
          email: user.email,
          display_name: user.name || user.display_name || user.email || null,
          nocobdid: user.nocobdid || null
        }));
        
        setAvailableUsers(formattedUsers);
        console.log('✅ Loaded', formattedUsers.length, 'users');
      } else {
        console.error('Users data is not an array:', users);
      }
    } catch (error) {
      console.error('❌ Error fetching users:', error);
      // Don't show error to user, just log it
    }
  };

  const fetchCompaniesAndProjects = async () => {
    try {
      console.log('🏢 Fetching companies and projects...');
      const BACKEND_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_BASE_URL || 'http://localhost:8000';
      
      // Fetch companies
      const companiesResponse = await makeAuthenticatedRequest(
        `${BACKEND_BASE_URL}/management-accounts`
      );

      if (!companiesResponse.ok) {
        console.error('Failed to fetch companies:', companiesResponse.status);
      } else {
        const companiesData = await companiesResponse.json();
        console.log('🏢 Management Accounts Data:', companiesData);
        
        // Extract companies
        if (companiesData.companies && Array.isArray(companiesData.companies)) {
          setCompanies(companiesData.companies);
          console.log('✅ Loaded', companiesData.companies.length, 'companies');
        }
      }
      
      // Fetch projects
      const projectsResponse = await makeAuthenticatedRequest(
        `${BACKEND_BASE_URL}/projects/projects`
      );

      if (!projectsResponse.ok) {
        console.error('Failed to fetch projects:', projectsResponse.status);
      } else {
        const projectsData = await projectsResponse.json();
        console.log('📊 Projects Data:', projectsData);
        
        // Extract projects
        if (projectsData.projects && Array.isArray(projectsData.projects)) {
          const formattedProjects = projectsData.projects.map((p: any) => ({
            id: p.Id,
            name: p['Project Name']
          }));
          setProjects(formattedProjects);
          console.log('✅ Loaded', formattedProjects.length, 'projects');
        }
      }
      
    } catch (error) {
      console.error('❌ Error fetching companies and projects:', error);
      toast.error('Failed to load companies and projects data');
    }
  };

  const fetchGroups = async () => {
    try {
      console.log('👥 Fetching user groups...');
      const BACKEND_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_BASE_URL || 'http://localhost:8000';
      
      const response = await makeAuthenticatedRequest(
        `${BACKEND_BASE_URL}/groups`
      );

      if (!response.ok) {
        console.error('Failed to fetch groups:', response.status);
        return;
      }

      const groupsData = await response.json();
      console.log('👥 Groups Data:', groupsData);
      
      if (Array.isArray(groupsData)) {
        const formattedGroups = groupsData.map((g: any) => ({
          id: String(g.id),
          name: g.name
        }));
        setAvailableGroups(formattedGroups);
        console.log('✅ Loaded', formattedGroups.length, 'groups');
      } else {
        console.error('Groups data is not an array:', groupsData);
      }
    } catch (error) {
      console.error('❌ Error fetching groups:', error);
      // Don't show error to user, just log it
    }
  };

  // Format date as dd/mm/yyyy
  const formatDate = (dateString: any) => {
    if (!dateString) return '-';
    
    try {
      const date = new Date(dateString);
      
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
  const truncateText = (text: string, maxLength: number = 50) => {
    if (!text) return '-';
    const str = String(text);
    return str.length > maxLength ? str.substring(0, maxLength) + '...' : str;
  };

  // Handle row click to open edit modal
  const handleRowClick = (record: TaskRecord) => {
    setSelectedRecord(record);
    setEditedRecord({ ...record });
    setEditModalOpen(true);
  };

  // Handle delete click
  const handleDeleteClick = (record: TaskRecord, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click
    setSelectedRecord(record);
    setDeleteModalOpen(true);
  };

  // Handle delete confirmation
  const handleDeleteConfirm = async () => {
    if (!selectedRecord) {
      toast.error('No record selected');
      return;
    }

    const recordId = selectedRecord.id || selectedRecord.Id;
    if (!recordId) {
      toast.error('Record ID not found');
      console.error('Record missing id:', selectedRecord);
      return;
    }

    try {
      console.log('🗑️ Deleting task with ID:', recordId);
      
      const response = await makeAuthenticatedRequest(
        `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/nocodb/delete-row`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            table_id: 'm00xhbj3bkktc13',
            row_id: String(recordId)
          }),
        }
      );

      console.log('📡 Delete response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || `Failed to delete task (${response.status})`);
      }

      toast.success('Task deleted successfully');
      setDeleteModalOpen(false);
      setSelectedRecord(null);
      
      // Refresh the table data
      fetchTableData();
    } catch (error) {
      console.error('❌ Error deleting task:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete task';
      toast.error(errorMessage);
    }
  };

  // Handle save edit
  const handleSaveEdit = async () => {
    if (!editedRecord || !selectedRecord) {
      toast.error('No record selected');
      return;
    }

    const recordId = editedRecord.id || editedRecord.Id || selectedRecord.id || selectedRecord.Id;
    if (!recordId) {
      toast.error('Record ID not found');
      console.error('Record missing id:', editedRecord, selectedRecord);
      return;
    }

    try {
      console.log('💾 Saving task:', recordId);
      console.log('📝 Updated data:', editedRecord);

      const tableId = 'm00xhbj3bkktc13';

      // Prepare the field data (exclude metadata fields)
      const fieldData: any = {};
      Object.keys(editedRecord).forEach(key => {
        // Skip system fields that shouldn't be updated
        if (!['id', 'Id', 'created_at', 'CreatedAt', 'updated_at', 'UpdatedAt'].includes(key)) {
          fieldData[key] = editedRecord[key];
        }
      });

      console.log('📤 Sending update request...');
      console.log('Table ID:', tableId);
      console.log('Record ID:', recordId);
      console.log('Field data:', fieldData);

      const response = await makeAuthenticatedRequest(
        `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/nocodb/update-row?table_id=${tableId}&record_id=${recordId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(fieldData),
        }
      );

      console.log('📡 Update response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        console.error('❌ Update error:', errorData);
        throw new Error(errorData.detail || `Failed to update task (${response.status})`);
      }

      const result = await response.json();
      console.log('✅ Update result:', result);

      toast.success('Task updated successfully');
      setEditModalOpen(false);
      setSelectedRecord(null);
      setEditedRecord(null);
      
      // Refresh the table data
      fetchTableData();
    } catch (error) {
      console.error('❌ Error saving task:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save task';
      toast.error(errorMessage);
    }
  };

  // Handle inline edit save
  const handleInlineEditSave = async (record: TaskRecord, fieldName: string, value: any) => {
    const recordId = record.id || record.Id;
    if (!recordId) {
      toast.error('Record ID not found');
      console.error('Record missing id:', record);
      return;
    }

    try {
      const tableId = 'm00xhbj3bkktc13';
      const fieldData: any = { [fieldName]: value };

      const response = await makeAuthenticatedRequest(
        `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/nocodb/update-row?table_id=${tableId}&record_id=${recordId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(fieldData),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || `Failed to update field (${response.status})`);
      }

      toast.success('Field updated successfully');
      setEditingCell(null);
      setInlineEditValue('');
      
      // Refresh the table data
      fetchTableData();
    } catch (error) {
      console.error('❌ Error updating field:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update field';
      toast.error(errorMessage);
    }
  };

  // Start inline editing
  const startInlineEdit = (record: TaskRecord, fieldName: string, currentValue: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const recordId = record.id || record.Id;
    setEditingCell({ recordId, fieldName });
    setInlineEditValue(currentValue || '');
  };

  // Cancel inline editing
  const cancelInlineEdit = () => {
    setEditingCell(null);
    setInlineEditValue('');
  };

  // Get ordered column keys with WorkOrderNo first and excluding system fields
  const getOrderedColumns = (record: TaskRecord) => {
    // If we have custom column order, use that filtered by visible columns
    if (columnOrder.length > 0 && visibleColumns.length > 0) {
      return columnOrder.filter(col => visibleColumns.includes(col));
    }
    
    // Otherwise use default ordering
    return getDefaultColumns(record);
  };

  // Column drag and drop handlers
  const handleDragStart = (column: string) => {
    setDraggedColumn(column);
  };

  const handleDragOver = (e: React.DragEvent, targetColumn: string) => {
    e.preventDefault();
    if (!draggedColumn || draggedColumn === targetColumn) return;
    
    const newOrder = [...columnOrder];
    const draggedIdx = newOrder.indexOf(draggedColumn);
    const targetIdx = newOrder.indexOf(targetColumn);
    
    newOrder.splice(draggedIdx, 1);
    newOrder.splice(targetIdx, 0, draggedColumn);
    
    setColumnOrder(newOrder);
  };

  const handleDragEnd = () => {
    setDraggedColumn(null);
    // Save settings when drag ends
    saveColumnSettings({ visibleColumns, columnOrder });
  };

  // Toggle column visibility
  const toggleColumnVisibility = (column: string) => {
    const newVisible = visibleColumns.includes(column)
      ? visibleColumns.filter(c => c !== column)
      : [...visibleColumns, column];
    
    setVisibleColumns(newVisible);
    saveColumnSettings({ visibleColumns: newVisible, columnOrder });
  };

  // Check if a field is editable
  const isFieldEditable = (fieldName: string): boolean => {
    const readOnlyFields = [
      'WorkOrderNo', 
      'id', 
      'Id',
      'created_at', 
      'CreatedAt',
      'updated_at', 
      'UpdatedAt',
      'Projects', // Linked record object
      'Tasks', // Linked record object
      'Contacts', // Linked record count/object
      'Dependencies', // Linked record count
      'Attachments' // File field
    ];
    
    return !readOnlyFields.includes(fieldName);
  };

  // Check if field is a user select field
  const isUserSelectField = (fieldName: string): boolean => {
    return fieldName === 'Lead' || fieldName === 'Assignees';
  };

  // Check if field is a status select field
  const isStatusField = (fieldName: string): boolean => {
    return fieldName === 'Status';
  };

  // Check if field is a groups multi-select field
  const isGroupsField = (fieldName: string): boolean => {
    return fieldName === 'group';
  };

  // Get status badge color
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'Closed':
        return 'bg-gray-100 text-gray-800 border-gray-300';
      case 'On-Going':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'Waiting on External':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'Complete':
        return 'bg-green-100 text-green-800 border-green-300';
      default:
        return 'bg-gray-100 text-gray-600 border-gray-300';
    }
  };

  // Format user display
  const formatUserDisplay = (user: any): string => {
    if (!user) return '-';
    if (Array.isArray(user)) {
      if (user.length === 0) return '-';
      return user.map(u => u.display_name || u.email).join(', ');
    }
    if (user.display_name) return user.display_name;
    if (user.email) return user.email;
    return '-';
  };

  // Get user initials for avatar
  const getUserInitials = (user: any): string => {
    if (!user) return '?';
    
    const name = user.display_name || user.name || user.email || '';
    console.log('🔤 getUserInitials:', { user, name, display_name: user.display_name, userName: user.name });
    const parts = name.split(/[\s@]+/).filter(Boolean);
    
    if (parts.length >= 2) {
      // First and last initial
      const initials = (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      console.log('🔤 Initials (2+ parts):', initials, 'from parts:', parts);
      return initials;
    } else if (parts.length === 1 && parts[0].length >= 2) {
      // First two characters
      const initials = parts[0].substring(0, 2).toUpperCase();
      console.log('🔤 Initials (1 part):', initials);
      return initials;
    }
    console.log('🔤 Initials: returning ?');
    return '?';
  };

  // Generate consistent color for user based on their ID or email
  const getUserColor = (user: any): string => {
    const userEmail = user?.email || '';
    const loggedInEmail = session?.user?.email || '';
    
    // Blue for logged-in user
    if (userEmail === loggedInEmail) {
      return 'bg-blue-600';
    }
    
    // Yellow for scale-42.com users
    if (userEmail.endsWith('@scale-42.com')) {
      return 'bg-amber-600';
    }
    
    // Muted gray for everyone else
    return 'bg-slate-500';
  };

  // Render user avatar component
  const renderUserAvatar = (user: any, size: 'sm' | 'md' = 'md') => {
    const sizeClasses = size === 'sm' ? 'w-6 h-6 text-xs' : 'w-8 h-8 text-sm';
    const initials = getUserInitials(user);
    const colorClass = getUserColor(user);
    const name = user?.display_name || user?.name || user?.email || 'Unknown';
    
    return (
      <div
        className={`${sizeClasses} ${colorClass} rounded-full flex items-center justify-center text-white font-semibold`}
        title={name}
      >
        {initials}
      </div>
    );
  };

  // Render user avatars for array of users
  const renderUserAvatars = (users: any, size: 'sm' | 'md' = 'md') => {
    if (!users) return <span className="text-muted-foreground">-</span>;
    
    const userArray = Array.isArray(users) ? users : [users];
    if (userArray.length === 0) return <span className="text-muted-foreground">-</span>;
    
    // Map user objects to full user data from availableUsers
    const fullUsers = userArray.map((userItem: any) => {
      // If the user object has an email, look up the full user info
      if (userItem?.email) {
        const fullUser = availableUsers.find(u => u.email === userItem.email);
        return fullUser || userItem; // Fall back to original if not found
      }
      return userItem;
    });
    
    return (
      <div className="flex items-center gap-1">
        {fullUsers.map((user, idx) => (
          <div key={user?.id || user?.email || idx}>
            {renderUserAvatar(user, size)}
          </div>
        ))}
      </div>
    );
  };

  // Get user info from nocobdid for display
  const getUserFromNocobdid = (nocobdid: string | null) => {
    if (!nocobdid) {
      console.log('🔍 getUserFromNocobdid: nocobdid is null/empty');
      return null;
    }
    const user = availableUsers.find(u => u.nocobdid === nocobdid);
    console.log('🔍 getUserFromNocobdid:', { nocobdid, foundUser: user, availableUsersCount: availableUsers.length });
    return user || null;
  };

  // Render Lead field (single user by nocobdid)
  const renderLeadField = (leadValue: any) => {
    console.log('🎨 renderLeadField called with leadValue:', leadValue);
    
    // Lead can be:
    // 1. A nocobdid string: "us2m224nuxb3vy8g"
    // 2. An array of user objects: [{email: "james@scale-42.com", ...}]
    // 3. A single user object: {email: "james@scale-42.com", ...}
    
    let user = null;
    
    if (!leadValue) {
      return <span className="text-muted-foreground">-</span>;
    }
    
    // If it's an array, get the first element
    if (Array.isArray(leadValue)) {
      if (leadValue.length === 0) {
        return <span className="text-muted-foreground">-</span>;
      }
      const leadItem = leadValue[0];
      
      // Check if it's a user object with email
      if (leadItem.email) {
        // Look up the full user info from availableUsers by email
        user = availableUsers.find(u => u.email === leadItem.email);
        console.log('🎨 Found user by email:', { email: leadItem.email, user });
      } else if (typeof leadItem === 'string') {
        // It's a nocobdid string
        user = getUserFromNocobdid(leadItem);
      }
    } else if (typeof leadValue === 'string') {
      // It's a nocobdid string
      user = getUserFromNocobdid(leadValue);
    } else if (leadValue.email) {
      // It's a single user object
      user = availableUsers.find(u => u.email === leadValue.email);
    }
    
    if (!user) {
      console.log('🎨 renderLeadField: No user found, returning -');
      return <span className="text-muted-foreground">-</span>;
    }
    
    return renderUserAvatar(user, 'sm');
  };

  // Render group badges
  const renderGroupBadges = (groupValue: any) => {
    if (!groupValue) {
      return <span className="text-muted-foreground">-</span>;
    }
    
    // Groups are stored as an array of objects with id property
    let groups: any[] = [];
    
    if (Array.isArray(groupValue)) {
      groups = groupValue;
    } else if (typeof groupValue === 'object' && groupValue.id) {
      groups = [groupValue];
    }
    
    if (groups.length === 0) {
      return <span className="text-muted-foreground">-</span>;
    }
    
    return (
      <>
        {groups.map((groupItem: any, idx: number) => {
          // Look up the group name from availableGroups
          const group = availableGroups.find(g => String(g.id) === String(groupItem.id));
          const groupName = group?.name || groupItem.name || `Group ${groupItem.id}`;
          
          return (
            <span 
              key={idx}
              className="px-2 py-1 rounded-full text-xs font-medium border bg-purple-100 text-purple-800 border-purple-300"
              title={groupName}
            >
              {groupName}
            </span>
          );
        })}
      </>
    );
  };

  // Get row background color based on user's relationship to task
  const getRowBackgroundColor = (record: TaskRecord): string => {
    const userEmail = session?.user?.email;
    if (!userEmail) return '';

    // Check if user is the lead
    const leadValue = record.Lead;
    let isLead = false;
    
    if (leadValue) {
      // Lead can be:
      // 1. A nocobdid string
      // 2. An array of user objects
      // 3. A single user object
      
      if (Array.isArray(leadValue)) {
        // Check if any user in the array matches the logged-in user
        isLead = leadValue.some((leadItem: any) => {
          if (leadItem?.email) {
            return leadItem.email.toLowerCase() === userEmail.toLowerCase();
          }
          // If it's a nocobdid string in array
          if (typeof leadItem === 'string') {
            const user = getUserFromNocobdid(leadItem);
            return user?.email?.toLowerCase() === userEmail.toLowerCase();
          }
          return false;
        });
      } else if (typeof leadValue === 'string') {
        // It's a nocobdid string
        const leadUser = getUserFromNocobdid(leadValue);
        isLead = leadUser?.email?.toLowerCase() === userEmail.toLowerCase();
      } else if (leadValue.email) {
        // It's a single user object
        isLead = leadValue.email.toLowerCase() === userEmail.toLowerCase();
      }
    }

    // Check if user is in assignees (watchers)
    const assignees = record.Assignees;
    let isWatcher = false;
    if (Array.isArray(assignees)) {
      isWatcher = assignees.some((assignee: any) => assignee?.email?.toLowerCase() === userEmail.toLowerCase());
    } else if (assignees && typeof assignees === 'object') {
      isWatcher = (assignees as any).email?.toLowerCase() === userEmail.toLowerCase();
    }

    // Return appropriate background color (Blue takes priority over Yellow)
    if (isLead) return 'rgba(59, 130, 246, 0.08)'; // Subtle blue tint if user is lead
    if (isWatcher) return 'rgba(234, 179, 8, 0.08)'; // Subtle yellow tint if user is watcher/assignee
    return 'rgba(239, 68, 68, 0.05)'; // Very subtle red tint if neither lead nor watcher
  };

  // Row drag and drop handlers
  const handleRowDragStart = (e: React.DragEvent, record: TaskRecord) => {
    console.log('🚀 Drag start:', record.id || record.Id);
    setDraggedRow(record);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleRowDragOver = (e: React.DragEvent, record: TaskRecord) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    // Only update state if we're hovering over a different row
    const currentDragOverId = dragOverRow?.id || dragOverRow?.Id;
    const newDragOverId = record.id || record.Id;
    
    if (currentDragOverId !== newDragOverId) {
      console.log('📍 Drag over:', newDragOverId);
      setDragOverRow(record);
    }
  };

  const handleRowDragLeave = (e: React.DragEvent) => {
    // Only clear if we're actually leaving the row (not entering a child element)
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
      console.log('👋 Drag leave');
      setDragOverRow(null);
    }
  };

  const handleRowDrop = async (e: React.DragEvent, targetRecord: TaskRecord) => {
    e.preventDefault();
    
    const draggedId = draggedRow?.id || draggedRow?.Id;
    const targetId = targetRecord.id || targetRecord.Id;
    
    if (!draggedRow || draggedId === targetId) {
      setDraggedRow(null);
      setDragOverRow(null);
      return;
    }

    try {
      // Get current order of filtered data
      const newOrder = [...filteredData];
      const draggedIdx = newOrder.findIndex(r => (r.id || r.Id) === draggedId);
      const targetIdx = newOrder.findIndex(r => (r.id || r.Id) === targetId);

      if (draggedIdx === -1 || targetIdx === -1) {
        throw new Error('Could not find records in list');
      }

      // Reorder the array
      newOrder.splice(draggedIdx, 1);
      newOrder.splice(targetIdx, 0, draggedRow);

      // Update the UI immediately for better UX
      setFilteredData(newOrder);

      // Calculate new Sort Order value for the moved row only
      // Use fractional values to insert between existing rows without updating all
      const recordId = draggedRow.id || draggedRow.Id;
      let newSortOrder: number;

      if (targetIdx === 0) {
        // Moving to first position - go well below the next item
        const nextSortOrder = newOrder[1]?.['Sort Order'] ?? newOrder[1]?.SortOrder ?? 100000;
        newSortOrder = Number(nextSortOrder) / 2; // Half of next value ensures room
      } else if (targetIdx === newOrder.length - 1) {
        // Moving to last position - go above the previous item
        const prevSortOrder = newOrder[targetIdx - 1]?.['Sort Order'] ?? newOrder[targetIdx - 1]?.SortOrder ?? 0;
        newSortOrder = Number(prevSortOrder) + 100; // Add buffer for more inserts
      } else {
        // Moving between two items - use average (allows infinite fractional splits)
        const prevSortOrder = newOrder[targetIdx - 1]?.['Sort Order'] ?? newOrder[targetIdx - 1]?.SortOrder ?? 0;
        const nextSortOrder = newOrder[targetIdx + 1]?.['Sort Order'] ?? newOrder[targetIdx + 1]?.SortOrder ?? 100000;
        newSortOrder = (Number(prevSortOrder) + Number(nextSortOrder)) / 2;
      }

      console.log('📍 Moving row to position', targetIdx, 'with Sort Order:', newSortOrder);

      // Update only the moved row - single API call
      // Backend expects table_id and record_id as query params, data in body as row_data
      const response = await makeAuthenticatedRequest(
        `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/nocodb/update-row?table_id=m00xhbj3bkktc13&record_id=${recordId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 'Sort Order': newSortOrder }),
        }
      );

      console.log('📡 API Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        console.error('❌ API Error:', errorData);
        throw new Error(errorData.detail || `Failed to update row order (${response.status})`);
      }

      const result = await response.json();
      console.log('✅ API Success:', result);

      toast.success('Task order updated');

      // Update tableData to match filteredData for consistency
      setTableData(prevData => {
        return prevData.map(record => {
          const recId = record.id || record.Id;
          if (recId === recordId) {
            return { ...record, 'Sort Order': newSortOrder };
          }
          return record;
        });
      });
    } catch (error) {
      console.error('❌ Error reordering rows:', error);
      toast.error('Failed to update row order');
      // Only refresh on error to restore correct order
      fetchTableData();
    } finally {
      setDraggedRow(null);
      setDragOverRow(null);
    }
  };

  const handleRowDragEnd = () => {
    setDraggedRow(null);
    setDragOverRow(null);
  };

  // Handle field change in edit modal
  const handleFieldChange = (fieldName: string, value: any) => {
    if (!editedRecord) return;
    setEditedRecord({
      ...editedRecord,
      [fieldName]: value
    });
  };

  // Open user selection modal
  const openUserSelectModal = (record: TaskRecord, fieldName: string) => {
    setUserSelectField({ record, fieldName });
    setUserSearchTerm('');
    
    // For Assignees field, initialize with current assignees
    if (fieldName === 'Assignees') {
      const currentAssignees = record.Assignees;
      if (Array.isArray(currentAssignees)) {
        // Extract NocoDB user IDs (like "usp69zff3def06ys")
        const assigneeIds = currentAssignees.map((a: any) => a.id).filter(Boolean);
        console.log('🔍 Initializing Assignees modal with IDs:', assigneeIds);
        setSelectedUserIds(assigneeIds);
      } else {
        setSelectedUserIds([]);
      }
    } else {
      setSelectedUserIds([]);
    }
    
    setUserSelectModalOpen(true);
  };

  // Handle user selection from modal
  const handleUserSelect = async (user: any) => {
    if (!userSelectField) return;

    const { record, fieldName } = userSelectField;
    const recordId = record.id || record.Id;

    // Handle Assignees (multi-select)
    if (fieldName === 'Assignees') {
      // Toggle user in selected list using nocobdid (NocoDB user ID)
      const nocobdid = user.nocobdid;
      if (!nocobdid) {
        console.error('❌ User has no nocobdid:', user);
        toast.error('Cannot add user without NocoDB ID');
        return;
      }
      
      const isSelected = selectedUserIds.includes(nocobdid);
      
      if (isSelected) {
        console.log('🔻 Removing user from selection:', nocobdid);
        setSelectedUserIds(selectedUserIds.filter(id => id !== nocobdid));
      } else {
        console.log('🔹 Adding user to selection:', nocobdid);
        setSelectedUserIds([...selectedUserIds, nocobdid]);
      }
      
      // Don't close modal or save yet for multi-select
      return;
    }

    // Handle Lead (single select)
    // If we're in the edit modal, just update the editedRecord state
    if (editModalOpen && editedRecord) {
      setEditedRecord({
        ...editedRecord,
        [fieldName]: user.nocobdid
      });
      setUserSelectModalOpen(false);
      setUserSelectField(null);
      toast.success(`${fieldName} updated in form`);
      return;
    }

    // Otherwise, save directly to database
    try {
      console.log(`💾 Saving ${fieldName} for record ${recordId} with nocobdid:`, user.nocobdid);
      
      // Save the nocobdid value to NocoDB
      const response = await makeAuthenticatedRequest(
        `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/nocodb/update-row?table_id=m00xhbj3bkktc13&record_id=${recordId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            [fieldName]: user.nocobdid
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        toast.error(errorData.detail || `Failed to update ${fieldName}`);
        return;
      }

      toast.success(`${fieldName} updated successfully`);
      
      // Update local state to reflect the change
      setTableData(prevData =>
        prevData.map(r => {
          const recId = r.id || r.Id;
          if (recId === recordId) {
            return { ...r, [fieldName]: user.nocobdid };
          }
          return r;
        })
      );

      // Close modal
      setUserSelectModalOpen(false);
      setUserSelectField(null);

    } catch (error) {
      console.error(`❌ Error updating ${fieldName}:`, error);
      toast.error(`Failed to update ${fieldName}`);
    }
  };

  // Save Assignees (multi-select)
  const saveAssignees = async () => {
    if (!userSelectField) return;

    const { record, fieldName } = userSelectField;
    const recordId = record.id || record.Id;

    // If we're in the edit modal, just update the editedRecord state
    if (editModalOpen && editedRecord) {
      const assigneesValue = selectedUserIds.map(id => ({ id }));
      setEditedRecord({
        ...editedRecord,
        [fieldName]: assigneesValue
      });
      setUserSelectModalOpen(false);
      setUserSelectField(null);
      setSelectedUserIds([]);
      toast.success(`${fieldName} updated in form`);
      return;
    }

    // Otherwise, save directly to database
    try {
      console.log(`💾 Saving ${fieldName} for record ${recordId} with IDs:`, selectedUserIds);
      
      // Convert user IDs to NocoDB format (array of objects with id)
      const assigneesValue = selectedUserIds.map(id => ({ id }));
      
      const response = await makeAuthenticatedRequest(
        `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/nocodb/update-row?table_id=m00xhbj3bkktc13&record_id=${recordId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            [fieldName]: assigneesValue
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        toast.error(errorData.detail || `Failed to update ${fieldName}`);
        return;
      }

      toast.success(`${fieldName} updated successfully`);
      
      // Refresh table data
      await fetchTableData();

      // Close modal
      setUserSelectModalOpen(false);
      setUserSelectField(null);
      setSelectedUserIds([]);

    } catch (error) {
      console.error(`❌ Error updating ${fieldName}:`, error);
      toast.error(`Failed to update ${fieldName}`);
    }
  };

  // Status options
  const STATUS_OPTIONS = ['Closed', 'On-Going', 'Waiting on External', 'Complete'];

  // Open status selection modal
  const openStatusSelectModal = (record: TaskRecord, fieldName: string) => {
    setStatusSelectField({ record, fieldName });
    setStatusSelectModalOpen(true);
  };

  // Handle status selection
  const handleStatusSelect = async (status: string) => {
    if (!statusSelectField) return;

    const { record, fieldName } = statusSelectField;
    const recordId = record.id || record.Id;

    // If we're in the edit modal, just update the editedRecord state
    if (editModalOpen && editedRecord) {
      setEditedRecord({
        ...editedRecord,
        [fieldName]: status
      });
      setStatusSelectModalOpen(false);
      setStatusSelectField(null);
      toast.success(`${fieldName} updated in form`);
      return;
    }

    // Otherwise, save directly to database
    try {
      console.log(`💾 Saving ${fieldName} for record ${recordId} with value:`, status);
      
      const response = await makeAuthenticatedRequest(
        `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/nocodb/update-row?table_id=m00xhbj3bkktc13&record_id=${recordId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            [fieldName]: status
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        toast.error(errorData.detail || `Failed to update ${fieldName}`);
        return;
      }

      toast.success(`${fieldName} updated successfully`);
      
      // Refresh table data
      await fetchTableData();

      // Close modal
      setStatusSelectModalOpen(false);
      setStatusSelectField(null);

    } catch (error) {
      console.error(`❌ Error updating ${fieldName}:`, error);
      toast.error(`Failed to update ${fieldName}`);
    }
  };

  // Get filtered users based on search term
  const getFilteredUsers = () => {
    if (!userSearchTerm.trim()) return availableUsers;
    
    const term = userSearchTerm.toLowerCase();
    return availableUsers.filter(user => 
      (user.display_name?.toLowerCase().includes(term)) ||
      (user.email?.toLowerCase().includes(term))
    );
  };

  // Tags functions
  const isTagsField = (fieldName: string): boolean => {
    return fieldName === 'Tags';
  };

  const parseTags = (tagsJson: string): Array<{id: string; name: string; type: string; color: string}> => {
    if (!tagsJson) return [];
    try {
      const parsed = JSON.parse(tagsJson);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  };

  const openTagsModal = (record: TaskRecord, fieldName: string) => {
    const currentTags = parseTags(record[fieldName]);
    setSelectedTags(currentTags);
    setTagsField({ record, fieldName });
    setTagsModalOpen(true);
    setTagSearchTerm('');
  };

  const toggleTag = (tag: {id: string; name: string; type: string; color: string}) => {
    const isSelected = selectedTags.some(t => t.id === tag.id);
    if (isSelected) {
      setSelectedTags(selectedTags.filter(t => t.id !== tag.id));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const addCustomTag = () => {
    if (!newTagInput.trim()) return;
    
    const newTag = {
      id: `custom-${newTagInput.trim()}`,
      name: newTagInput.trim(),
      type: 'custom',
      color: 'green'
    };
    
    toggleTag(newTag);
    setNewTagInput('');
  };

  const addCategoryTag = () => {
    if (!newCategoryInput.trim()) return;
    
    const newTag = {
      id: `category-${newCategoryInput.trim()}`,
      name: newCategoryInput.trim(),
      type: 'category',
      color: 'yellow'
    };
    
    toggleTag(newTag);
    setNewCategoryInput('');
  };

  const saveTags = async () => {
    if (!tagsField) return;

    const { record, fieldName } = tagsField;
    const recordId = record.id || record.Id;

    // If we're in the edit modal, just update the editedRecord state
    if (editModalOpen && editedRecord) {
      const tagsJson = JSON.stringify(selectedTags);
      setEditedRecord({
        ...editedRecord,
        [fieldName]: tagsJson
      });
      setTagsModalOpen(false);
      setTagsField(null);
      setSelectedTags([]);
      toast.success('Tags updated in form');
      return;
    }

    // Otherwise, save directly to database
    try {
      const tagsJson = JSON.stringify(selectedTags);
      console.log(`💾 Saving tags for record ${recordId}:`, tagsJson);
      
      const response = await makeAuthenticatedRequest(
        `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/nocodb/update-row?table_id=m00xhbj3bkktc13&record_id=${recordId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            [fieldName]: tagsJson
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        toast.error(errorData.detail || `Failed to update tags`);
        return;
      }

      toast.success('Tags updated successfully');
      
      // Refresh table data
      await fetchTableData();

      // Close modal
      setTagsModalOpen(false);
      setTagsField(null);
      setSelectedTags([]);

    } catch (error) {
      console.error('❌ Error updating tags:', error);
      toast.error('Failed to update tags');
    }
  };

  // Groups modal functions
  const openGroupsModal = (record: TaskRecord, fieldName: string) => {
    const currentGroups = record[fieldName];
    
    // Extract group IDs from current value
    let groupIds: string[] = [];
    if (Array.isArray(currentGroups)) {
      groupIds = currentGroups.map((g: any) => String(g.id)).filter(Boolean);
    } else if (currentGroups && typeof currentGroups === 'object' && currentGroups.id) {
      groupIds = [String(currentGroups.id)];
    }
    
    setSelectedGroupIds(groupIds);
    setGroupsField({ record, fieldName });
    setGroupsModalOpen(true);
    setGroupSearchTerm('');
  };

  const toggleGroup = (groupId: string) => {
    const isSelected = selectedGroupIds.includes(groupId);
    if (isSelected) {
      setSelectedGroupIds(selectedGroupIds.filter(id => id !== groupId));
    } else {
      setSelectedGroupIds([...selectedGroupIds, groupId]);
    }
  };

  const saveGroups = async () => {
    if (!groupsField) return;

    const { record, fieldName } = groupsField;
    const recordId = record.id || record.Id;

    // If we're in the edit modal, just update the editedRecord state
    if (editModalOpen && editedRecord) {
      const groupsValue = selectedGroupIds.map(id => ({ id }));
      setEditedRecord({
        ...editedRecord,
        [fieldName]: groupsValue
      });
      setGroupsModalOpen(false);
      setGroupsField(null);
      setSelectedGroupIds([]);
      toast.success('Groups updated in form');
      return;
    }

    // Otherwise, save directly to database
    try {
      // Convert group IDs to NocoDB format (array of objects with id)
      const groupsValue = selectedGroupIds.map(id => ({ id }));
      console.log(`💾 Saving groups for record ${recordId}:`, groupsValue);
      
      const response = await makeAuthenticatedRequest(
        `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/nocodb/update-row?table_id=m00xhbj3bkktc13&record_id=${recordId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            [fieldName]: groupsValue
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        toast.error(errorData.detail || `Failed to update groups`);
        return;
      }

      toast.success('Groups updated successfully');
      
      // Refresh table data
      await fetchTableData();

      // Close modal
      setGroupsModalOpen(false);
      setGroupsField(null);
      setSelectedGroupIds([]);

    } catch (error) {
      console.error('❌ Error updating groups:', error);
      toast.error('Failed to update groups');
    }
  };

  // Extract unique categories and custom tags from existing tasks
  const getUniqueCategoriesAndCustomTags = () => {
    const categoriesSet = new Set<string>();
    const customTagsSet = new Set<string>();
    
    tableData.forEach((record: TaskRecord) => {
      const tagsValue = record.Tags;
      if (tagsValue) {
        try {
          const tags = typeof tagsValue === 'string' ? JSON.parse(tagsValue) : tagsValue;
          if (Array.isArray(tags)) {
            tags.forEach((tag: any) => {
              if (tag.type === 'category') {
                categoriesSet.add(tag.name);
              } else if (tag.type === 'custom') {
                customTagsSet.add(tag.name);
              }
            });
          }
        } catch (e) {
          // Invalid JSON, skip
        }
      }
    });
    
    return {
      categories: Array.from(categoriesSet).sort(),
      customTags: Array.from(customTagsSet).sort()
    };
  };

  const getFilteredTagOptions = () => {
    const term = tagSearchTerm.toLowerCase();
    const allOptions: Array<{id: string; name: string; type: string; color: string}> = [];
    
    // Companies (red)
    companies.forEach(company => {
      if (!term || company.full_name?.toLowerCase().includes(term)) {
        allOptions.push({
          id: `company-${company.id}`,
          name: company.full_name || 'Unknown Company',
          type: 'company',
          color: 'red'
        });
      }
    });
    
    // Projects (blue)
    projects.forEach(project => {
      if (!term || project.name?.toLowerCase().includes(term)) {
        allOptions.push({
          id: `project-${project.id}`,
          name: project.name || 'Unknown Project',
          type: 'project',
          color: 'blue'
        });
      }
    });
    
    // Categories (yellow) - only show tags in use
    const { categories: existingCategories } = getUniqueCategoriesAndCustomTags();
    existingCategories.forEach(cat => {
      if (!term || cat.toLowerCase().includes(term)) {
        allOptions.push({
          id: `category-${cat}`,
          name: cat,
          type: 'category',
          color: 'yellow'
        });
      }
    });
    
    // Custom tags (green) - only show tags in use
    const { customTags: existingCustomTags } = getUniqueCategoriesAndCustomTags();
    existingCustomTags.forEach(tag => {
      if (!term || tag.toLowerCase().includes(term)) {
        allOptions.push({
          id: `custom-${tag}`,
          name: tag,
          type: 'custom',
          color: 'green'
        });
      }
    });
    
    return allOptions;
  };

  const getTagColorClass = (color: string): string => {
    switch (color) {
      case 'red':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'blue':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'yellow':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'green':
        return 'bg-green-100 text-green-800 border-green-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  // Create a new task
  const handleCreateTask = async () => {
    if (!newTaskTitle.trim()) {
      toast.error('Please enter a task title');
      return;
    }

    try {
      console.log('📝 Creating new task...');
      
      // Get logged in user's nocobdid
      const loggedInUser = availableUsers.find(u => u.email === session?.user?.email);
      const leadNocobdid = loggedInUser?.nocobdid || null;
      
      console.log('👤 Logged in user:', session?.user?.email);
      console.log('🔍 Found user:', loggedInUser);
      console.log('🆔 Lead nocobdid:', leadNocobdid);

      // Get today's date in YYYY-MM-DD format
      const today = new Date().toISOString().split('T')[0];

      const newTaskData = {
        'Task Name': newTaskTitle.trim(),
        'Start datetime': today,
        'End datetime': today,
        Lead: leadNocobdid,
        'Sort Order': 100000, // Default sort order
      };
      
      console.log('📋 New task data:', newTaskData);

      const response = await makeAuthenticatedRequest(
        `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/nocodb/create-row?table_id=m00xhbj3bkktc13`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newTaskData)
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        toast.error(errorData.detail || 'Failed to create task');
        console.error('❌ Create task error:', errorData);
        return;
      }

      const result = await response.json();
      console.log('✅ Task created:', result);
      const createdTaskId = result.id || result.Id;
      
      // Reset create task state
      setNewTaskTitle('');
      setIsCreatingTask(false);

      // Refresh table data and wait for it to complete
      await fetchTableData();
      
      toast.success('Task created successfully');
      
      // Wait a bit for React state to update, then find and open the task
      if (createdTaskId) {
        setTimeout(() => {
          // Access the latest tableData via a ref or state callback
          setTableData(currentData => {
            const createdTask = currentData.find(record => {
              const recordId = record.id || record.Id;
              return String(recordId) === String(createdTaskId);
            });
            
            if (createdTask) {
              console.log('📂 Opening newly created task in edit modal:', createdTask);
              handleRowClick(createdTask);
            } else {
              console.warn('⚠️ Could not find newly created task with ID:', createdTaskId);
            }
            
            return currentData; // Don't modify the data
          });
        }, 300);
      }

    } catch (error) {
      console.error('❌ Error creating task:', error);
      toast.error('Failed to create task. Check console for details.');
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Sort and Filter Section */}
        <div className="space-y-3">
          {/* Row 1: Sort and Status - Stacks vertically on mobile */}
          <div className="flex flex-col lg:flex-row gap-3 lg:gap-6">
            {/* Sort Buttons */}
            <div className="flex gap-2 items-center flex-wrap">
              <span className="text-sm text-muted-foreground font-medium shrink-0">Sort:</span>
              <button
                onClick={() => setSortBy('sort-order')}
                className={`px-3 py-1.5 text-sm font-medium rounded transition-all ${
                  sortBy === 'sort-order'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                Order
              </button>
              <button
                onClick={() => setSortBy('due-date')}
                className={`px-3 py-1.5 text-sm font-medium rounded transition-all ${
                  sortBy === 'due-date'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                Due Date
              </button>
            </div>

            {/* Status Filter */}
            <div className="flex gap-2 items-center flex-wrap">
              <span className="text-sm text-muted-foreground font-medium shrink-0">Status:</span>
              {STATUS_OPTIONS.map((status) => {
                const isSelected = selectedStatuses.includes(status);
                return (
                  <button
                    key={status}
                    onClick={() => {
                      if (isSelected) {
                        if (selectedStatuses.length > 1) {
                          setSelectedStatuses(selectedStatuses.filter(s => s !== status));
                        }
                      } else {
                        setSelectedStatuses([...selectedStatuses, status]);
                      }
                    }}
                    className={`px-3 py-1.5 text-sm font-medium rounded transition-all ${
                      isSelected
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                    title={status}
                  >
                    {status === 'On-Going' ? 'On-Going' : 
                     status === 'Waiting on External' ? 'Waiting' : 
                     status === 'Complete' ? 'Complete' : 'Closed'}
                  </button>
                );
              })}
              {selectedStatuses.length !== STATUS_OPTIONS.length && (
                <button
                  onClick={() => setSelectedStatuses([...STATUS_OPTIONS])}
                  className="text-sm text-muted-foreground hover:text-foreground"
                  title="Select All Statuses"
                >
                  All
                </button>
              )}
            </div>
          </div>

          {/* Row 2: Tag Filters - Grid layout on mobile, flex on desktop */}
          <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
            <span className="text-sm text-muted-foreground font-medium shrink-0">Filters:</span>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex gap-3 flex-1">
              <select
                value={filterCompany}
                onChange={(e) => setFilterCompany(e.target.value)}
                className="px-3 py-1.5 text-sm border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-full lg:min-w-[140px] lg:w-auto"
              >
                <option value="">All Companies</option>
                {companies.map(company => (
                  <option key={company.id} value={`company-${company.id}`}>
                    {company.full_name || 'Unknown Company'}
                  </option>
                ))}
              </select>

              <select
                value={filterProject}
                onChange={(e) => setFilterProject(e.target.value)}
                className="px-3 py-1.5 text-sm border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-full lg:min-w-[140px] lg:w-auto"
              >
                <option value="">All Projects</option>
                {projects.map(project => (
                  <option key={project.id} value={`project-${project.id}`}>
                    {project.name || 'Unknown Project'}
                  </option>
                ))}
              </select>

              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-3 py-1.5 text-sm border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-full lg:min-w-[140px] lg:w-auto"
              >
                <option value="">All Categories</option>
                {(() => {
                  const { categories } = getUniqueCategoriesAndCustomTags();
                  return categories.map(cat => (
                    <option key={cat} value={`category-${cat}`}>
                      {cat}
                    </option>
                  ));
                })()}
              </select>

              <select
                value={filterCustomTag}
                onChange={(e) => setFilterCustomTag(e.target.value)}
                className="px-3 py-1.5 text-sm border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-full lg:min-w-[140px] lg:w-auto"
              >
                <option value="">All Tags</option>
                {(() => {
                  const { customTags } = getUniqueCategoriesAndCustomTags();
                  return customTags.map(tag => (
                    <option key={tag} value={`custom-${tag}`}>
                      {tag}
                    </option>
                  ));
                })()}
              </select>
            </div>

            {(filterCompany || filterProject || filterCategory || filterCustomTag) && (
              <button
                onClick={() => {
                  setFilterCompany('');
                  setFilterProject('');
                  setFilterCategory('');
                  setFilterCustomTag('');
                }}
                className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors self-start lg:self-auto"
                title="Clear all tag filters"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Create Task Button */}
        <div className="flex justify-end">
          {isCreatingTask ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateTask();
                  } else if (e.key === 'Escape') {
                    setIsCreatingTask(false);
                    setNewTaskTitle('');
                  }
                }}
                placeholder="Enter task title..."
                  className="px-3 py-2 border border-primary rounded text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary min-w-[300px]"
                  autoFocus
                />
                <button
                  onClick={handleCreateTask}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm font-medium"
                  title="Create Task"
                >
                  <Save className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setIsCreatingTask(false);
                    setNewTaskTitle('');
                  }}
                  className="px-4 py-2 bg-muted text-foreground rounded hover:bg-muted/80 transition-colors text-sm font-medium"
                  title="Cancel"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsCreatingTask(true)}
                className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors text-sm font-medium"
              >
                + Create Task
              </button>
            )}
          </div>

        {/* Tab Filters */}
        <div className="flex gap-2 border-b border-border items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('my-tasks')}
              className={`px-6 py-3 font-medium text-sm transition-all border-b-2 ${
                activeTab === 'my-tasks'
                  ? 'border-primary text-primary bg-primary/5'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              My Tasks
              {activeTab === 'my-tasks' && (
                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-primary text-primary-foreground">
                  {filteredData.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('watching')}
              className={`px-6 py-3 font-medium text-sm transition-all border-b-2 ${
                activeTab === 'watching'
                  ? 'border-primary text-primary bg-primary/5'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              Watching
              {activeTab === 'watching' && (
                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-primary text-primary-foreground">
                  {filteredData.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('all')}
              className={`px-6 py-3 font-medium text-sm transition-all border-b-2 ${
                activeTab === 'all'
                  ? 'border-primary text-primary bg-primary/5'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              All Tasks
              {activeTab === 'all' && (
                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-primary text-primary-foreground">
                  {filteredData.length}
                </span>
              )}
            </button>
          </div>
          
          {/* Customize Columns Button */}
          <button
            onClick={() => setColumnSettingsOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-muted hover:bg-muted/80 text-foreground rounded transition-colors mr-2"
            title="Customize Columns"
          >
            <Settings className="w-4 h-4" />
            Customize Columns
          </button>
        </div>

        {/* Tasks Table */}
        <div className="bg-card rounded-lg border border-border">
          {loading ? (
            <div className="p-6 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-muted-foreground">Loading tasks data...</p>
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
              <p className="text-muted-foreground">No tasks available</p>
            </div>
          ) : (
            <>
              {/* Desktop Table - Hidden on mobile */}
              <div className="hidden lg:block relative overflow-x-auto" style={{ maxHeight: '600px' }}>
                <table className="w-full divide-y divide-border">
                  <thead className="bg-muted sticky top-0 z-10">
                    <tr>
                      {/* Drag handle column - Only show when sorting by order */}
                      {sortBy === 'sort-order' && (
                        <th className="px-2 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap w-8">
                          
                        </th>
                      )}
                      {/* Dynamically render headers based on first record with custom ordering */}
                      {tableData.length > 0 && getOrderedColumns(tableData[0]).map((key) => {
                        return (
                          <th 
                            key={key} 
                            className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap"
                          >
                            {key}
                          </th>
                        );
                      })}
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-card divide-y divide-border">
                    {filteredData.map((record, index) => {
                      const recordId = record.id || record.Id;
                      const isDragging = (draggedRow?.id || draggedRow?.Id) === recordId;
                      const isDragOver = (dragOverRow?.id || dragOverRow?.Id) === recordId;
                      const rowBgColor = getRowBackgroundColor(record);
                      
                      return (
                        <React.Fragment key={recordId || index}>
                          <tr 
                            className={`transition-all duration-150 ${
                              isDragging ? 'opacity-50' : ''
                            } ${
                              isDragOver && !isDragging ? 'border-t-4 border-t-primary shadow-lg' : ''
                            } hover:brightness-110`}
                            style={{ backgroundColor: rowBgColor }}
                            onDragOver={sortBy === 'sort-order' ? (e) => handleRowDragOver(e, record) : undefined}
                            onDragLeave={sortBy === 'sort-order' ? (e) => handleRowDragLeave(e) : undefined}
                            onDrop={sortBy === 'sort-order' ? (e) => handleRowDrop(e, record) : undefined}
                          >
                          {/* Drag handle - Only show when sorting by order */}
                          {sortBy === 'sort-order' && (
                            <td 
                              className="px-2 py-3 text-center cursor-grab active:cursor-grabbing"
                              draggable={true}
                              onDragStart={(e) => handleRowDragStart(e, record)}
                              onDragEnd={handleRowDragEnd}
                              style={{ 
                                userSelect: 'none',
                                WebkitUserDrag: 'element'
                              } as React.CSSProperties}
                            >
                              <GripVertical className="w-4 h-4 text-muted-foreground" style={{ pointerEvents: 'none' }} />
                            </td>
                          )}
                          
                          {getOrderedColumns(record).map((key) => {
                          const value = record[key];
                          const recordId = record.id || record.Id;
                          const isEditing = editingCell?.recordId === recordId && editingCell?.fieldName === key;
                          const isDateField = key.toLowerCase().includes('date') || key.toLowerCase().includes('time');
                          const isEditable = isFieldEditable(key);
                          const isUserSelect = isUserSelectField(key);
                          const isStatus = isStatusField(key);
                          const isTags = isTagsField(key);
                          const isGroups = isGroupsField(key);
                          const isLeadField = key === 'Lead';
                          
                          return (
                            <td 
                              key={key} 
                              className={`px-4 py-3 text-sm text-foreground whitespace-nowrap ${
                                isEditable ? 'cursor-pointer' : 'text-muted-foreground'
                              }`}
                              onClick={(e) => {
                                if (isGroups && isEditable) {
                                  // Open modal for Groups field
                                  openGroupsModal(record, key);
                                } else if (isTags && isEditable) {
                                  // Open modal for Tags field
                                  openTagsModal(record, key);
                                } else if (isStatus && isEditable) {
                                  // Open modal for Status field
                                  openStatusSelectModal(record, key);
                                } else if (isUserSelect && isEditable) {
                                  // Open modal for Lead and Assignees fields
                                  openUserSelectModal(record, key);
                                } else if (!isEditing && isEditable) {
                                  startInlineEdit(record, key, value, e);
                                }
                              }}
                            >
                              {isEditing && !isUserSelect && !isStatus && !isTags && !isGroups ? (
                                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                  {isDateField ? (
                                    <input
                                      type="date"
                                      value={inlineEditValue ? new Date(inlineEditValue).toISOString().split('T')[0] : ''}
                                      onChange={(e) => setInlineEditValue(e.target.value)}
                                      className="px-2 py-1 border border-primary rounded text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                      autoFocus
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          handleInlineEditSave(record, key, inlineEditValue);
                                        } else if (e.key === 'Escape') {
                                          cancelInlineEdit();
                                        }
                                      }}
                                    />
                                  ) : (
                                    <input
                                      type="text"
                                      value={inlineEditValue}
                                      onChange={(e) => setInlineEditValue(e.target.value)}
                                      className="px-2 py-1 border border-primary rounded text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary min-w-[150px]"
                                      autoFocus
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          handleInlineEditSave(record, key, inlineEditValue);
                                        } else if (e.key === 'Escape') {
                                          cancelInlineEdit();
                                        }
                                      }}
                                    />
                                  )}
                                  <button
                                    onClick={() => handleInlineEditSave(record, key, inlineEditValue)}
                                    className="p-1 text-green-600 hover:bg-green-100 rounded transition-colors"
                                    title="Save"
                                  >
                                    <Save className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={cancelInlineEdit}
                                    className="p-1 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                                    title="Cancel"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              ) : (
                                <span className={`px-2 py-1 rounded inline-block transition-colors ${
                                  isEditable ? 'cursor-pointer hover:bg-muted/40' : 'cursor-default'
                                }`}>
                                  {isGroups
                                    ? (
                                      <div className="flex flex-wrap gap-1">
                                        {renderGroupBadges(value)}
                                      </div>
                                    )
                                    : isTags
                                    ? (
                                      <div className="flex flex-wrap gap-1">
                                        {parseTags(String(value || '')).map((tag, idx) => (
                                          <span 
                                            key={idx}
                                            className={`px-2 py-1 rounded-full text-xs font-medium border ${getTagColorClass(tag.color)}`}
                                          >
                                            {tag.name}
                                          </span>
                                        ))}
                                        {parseTags(String(value || '')).length === 0 && <span className="text-muted-foreground">-</span>}
                                      </div>
                                    )
                                    : isStatus
                                    ? (
                                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(String(value || ''))}`}>
                                        {value || '-'}
                                      </span>
                                    )
                                    : isLeadField
                                    ? renderLeadField(value)
                                    : isUserSelect
                                    ? renderUserAvatars(value, 'sm')
                                    : isDateField
                                    ? formatDate(value)
                                    : truncateText(String(value || '-'))}
                                </span>
                              )}
                            </td>
                          );
                        })}
                        
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
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View - Visible only on mobile */}
              <div className="lg:hidden overflow-y-auto" style={{ maxHeight: '600px' }}>
                <div className="p-4 space-y-3">
                  {filteredData.map((record, index) => {
                    const recordId = record.id || record.Id;
                    const rowBgColor = getRowBackgroundColor(record);
                    const status = record.Status || record.status;
                    const title = record['Task Name'] || record.taskName || record.Title || record.title || 'Untitled Task';
                    const description = record['Task Description'] || record.taskDescription || record.Description || record.description;
                    const lead = record.Lead || record.lead;
                    const assignees = record.Assignees || record.assignees;
                    const tags = parseTags(String(record.Tags || record.tags || ''));
                    const dueDate = record['Due Date'] || record.dueDate;
                    const priority = record.Priority || record.priority;

                    return (
                      <div 
                        key={recordId || index}
                        className="border border-border rounded-lg p-4 shadow-sm transition-all hover:shadow-md cursor-pointer"
                        style={{ backgroundColor: rowBgColor }}
                        onClick={() => handleRowClick(record)}
                      >
                        {/* Header: Title and Actions */}
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-foreground text-base truncate">
                              {title}
                            </h3>
                            {status && (
                              <span 
                                className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(String(status))}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openStatusSelectModal(record, 'Status');
                                }}
                              >
                                {status}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteClick(record, e);
                              }}
                              className="p-2 text-red-600 hover:bg-red-100 rounded transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Description */}
                        {description && (
                          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                            {String(description)}
                          </p>
                        )}

                        {/* Tags */}
                        {tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-3">
                            {tags.map((tag, idx) => (
                              <span 
                                key={idx}
                                className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getTagColorClass(tag.color)}`}
                              >
                                {tag.name}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Meta Info Grid */}
                        <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                          {priority && (
                            <div>
                              <span className="text-muted-foreground">Priority:</span>
                              <span className="ml-1 font-medium text-foreground">{priority}</span>
                            </div>
                          )}
                          {dueDate && (
                            <div>
                              <span className="text-muted-foreground">Due:</span>
                              <span className="ml-1 font-medium text-foreground">{formatDate(dueDate)}</span>
                            </div>
                          )}
                        </div>

                        {/* People */}
                        <div className="flex items-center gap-4 pt-3 border-t border-border">
                          {lead && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">Lead:</span>
                              {renderUserAvatars(lead, 'sm')}
                            </div>
                          )}
                          {assignees && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">Assigned:</span>
                              {renderUserAvatars(assignees, 'sm')}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Record count */}
              <div className="px-6 py-4 border-t border-border">
                <div className="text-sm text-muted-foreground">
                  Showing {filteredData.length} task{filteredData.length !== 1 ? 's' : ''}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Edit Modal */}
        {editModalOpen && editedRecord && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-card rounded-lg border border-border w-[90vw] max-h-[90vh] flex flex-col">
              {/* Header */}
              <div className="px-6 py-4 border-b border-border flex justify-between items-center shrink-0">
                <h3 className="text-lg font-semibold text-foreground">Edit Task</h3>
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.keys(editedRecord).map((key) => {
                    // Skip certain system fields
                    if (['Id', 'id', 'CreatedAt', 'UpdatedAt', 'created_at', 'updated_at'].includes(key)) return null;
                    
                    // Check field type
                    const isDateField = key.toLowerCase().includes('date') || key.toLowerCase().includes('time');
                    const isStatus = isStatusField(key);
                    const isUserSelect = isUserSelectField(key);
                    const isTags = isTagsField(key);
                    const isGroups = isGroupsField(key);
                    const isReadOnly = !isFieldEditable(key);
                    
                    const dateValue = isDateField && editedRecord[key] 
                      ? new Date(editedRecord[key]).toISOString().split('T')[0] 
                      : '';
                    
                    return (
                      <div key={key} className={key === 'Task Description' ? 'md:col-span-2' : ''}>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">
                          {key}
                        </label>
                        
                        {/* Read-only fields */}
                        {isReadOnly ? (
                          <input
                            type="text"
                            value={editedRecord[key] || ''}
                            readOnly
                            className="w-full px-3 py-2 border border-border rounded bg-muted text-muted-foreground cursor-not-allowed"
                          />
                        ) : /* Status field - clickable button */
                        isStatus ? (
                          <button
                            onClick={() => {
                              if (selectedRecord) {
                                openStatusSelectModal(selectedRecord, key);
                              }
                            }}
                            className={`w-full px-3 py-2 border border-border rounded bg-background text-left hover:bg-muted transition-colors flex items-center justify-between ${getStatusColor(String(editedRecord[key] || ''))}`}
                          >
                            <span>{editedRecord[key] || 'Select Status'}</span>
                            <span className="text-xs text-muted-foreground">Click to change</span>
                          </button>
                        ) : /* User select fields (Lead, Assignees) */
                        isUserSelect ? (
                          <button
                            onClick={() => {
                              if (selectedRecord) {
                                openUserSelectModal(selectedRecord, key);
                              }
                            }}
                            className="w-full px-3 py-2 border border-border rounded bg-background text-left hover:bg-muted transition-colors flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2">
                              {renderUserAvatars(editedRecord[key], 'sm')}
                            </div>
                            <span className="text-xs text-muted-foreground">Click to change</span>
                          </button>
                        ) : /* Tags field */
                        isTags ? (
                          <button
                            onClick={() => {
                              if (selectedRecord) {
                                openTagsModal(selectedRecord, key);
                              }
                            }}
                            className="w-full px-3 py-2 border border-border rounded bg-background text-left hover:bg-muted transition-colors"
                          >
                            <div className="flex flex-wrap gap-1">
                              {parseTags(String(editedRecord[key] || '')).map((tag, idx) => (
                                <span 
                                  key={idx}
                                  className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getTagColorClass(tag.color)}`}
                                >
                                  {tag.name}
                                </span>
                              ))}
                              {parseTags(String(editedRecord[key] || '')).length === 0 && (
                                <span className="text-muted-foreground text-sm">Click to add tags</span>
                              )}
                            </div>
                          </button>
                        ) : /* Groups field */
                        isGroups ? (
                          <button
                            onClick={() => {
                              if (selectedRecord) {
                                openGroupsModal(selectedRecord, key);
                              }
                            }}
                            className="w-full px-3 py-2 border border-border rounded bg-background text-left hover:bg-muted transition-colors"
                          >
                            <div className="flex flex-wrap gap-1">
                              {renderGroupBadges(editedRecord[key])}
                            </div>
                          </button>
                        ) : /* Date fields */
                        isDateField ? (
                          <input
                            type="date"
                            value={dateValue}
                            onChange={(e) => handleFieldChange(key, e.target.value)}
                            className="w-full px-3 py-2 border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                        ) : /* Task Description - textarea */
                        key === 'Task Description' ? (
                          <textarea
                            value={editedRecord[key] || ''}
                            onChange={(e) => handleFieldChange(key, e.target.value)}
                            rows={4}
                            className="w-full px-3 py-2 border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-y"
                          />
                        ) : /* Regular text fields */
                        (
                          <input
                            type="text"
                            value={editedRecord[key] || ''}
                            onChange={(e) => handleFieldChange(key, e.target.value)}
                            className="w-full px-3 py-2 border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                        )}
                      </div>
                    );
                  })}
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
                  Are you sure you want to delete this task?
                </p>
                <div className="bg-muted p-3 rounded text-sm max-h-60 overflow-y-auto">
                  {Object.keys(selectedRecord).map((key) => {
                    if (['Id', 'CreatedAt', 'UpdatedAt'].includes(key)) return null;
                    return (
                      <div key={key}>
                        <span className="font-semibold">{key}:</span> {truncateText(String(selectedRecord[key] || 'N/A'), 40)}
                      </div>
                    );
                  })}
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

        {/* Column Settings Modal */}
        {columnSettingsOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-card rounded-lg border border-border max-w-2xl w-full max-h-[80vh] flex flex-col">
              <div className="px-6 py-4 border-b border-border flex justify-between items-center shrink-0">
                <h3 className="text-lg font-semibold text-foreground">Customize Columns</h3>
                <button
                  onClick={() => setColumnSettingsOpen(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto flex-1">
                <p className="text-sm text-muted-foreground mb-4">
                  Drag columns to reorder them. Click the eye icon to show/hide columns.
                </p>
                
                <div className="space-y-2">
                  {columnOrder.map((column) => (
                    <div
                      key={column}
                      draggable
                      onDragStart={() => handleDragStart(column)}
                      onDragOver={(e) => handleDragOver(e, column)}
                      onDragEnd={handleDragEnd}
                      className={`flex items-center gap-3 p-3 bg-muted rounded cursor-move hover:bg-muted/80 transition-colors ${
                        draggedColumn === column ? 'opacity-50' : ''
                      }`}
                    >
                      <GripVertical className="w-5 h-5 text-muted-foreground" />
                      <span className="flex-1 font-medium text-foreground">{column}</span>
                      <button
                        onClick={() => toggleColumnVisibility(column)}
                        className={`p-1.5 rounded transition-colors ${
                          visibleColumns.includes(column)
                            ? 'text-primary hover:bg-primary/10'
                            : 'text-muted-foreground hover:bg-muted'
                        }`}
                        title={visibleColumns.includes(column) ? 'Hide column' : 'Show column'}
                      >
                        {visibleColumns.includes(column) ? (
                          <Eye className="w-5 h-5" />
                        ) : (
                          <EyeOff className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="px-6 py-4 border-t border-border flex justify-between items-center shrink-0">
                <button
                  onClick={resetColumnSettings}
                  className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Reset to Default
                </button>
                <button
                  onClick={() => setColumnSettingsOpen(false)}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* User Selection Modal */}
        {userSelectModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card rounded-lg shadow-xl w-full max-w-md border border-border flex flex-col max-h-[80vh]">
              {/* Header */}
              <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
                <h3 className="text-lg font-semibold text-foreground">
                  Select {userSelectField?.fieldName}
                </h3>
                <button
                  onClick={() => {
                    setUserSelectModalOpen(false);
                    setUserSelectField(null);
                    setUserSearchTerm('');
                  }}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Search */}
              <div className="px-6 py-4 border-b border-border shrink-0">
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  autoFocus
                />
              </div>

              {/* User List */}
              <div className="overflow-y-auto flex-1 p-2">
                <div className="space-y-1">
                  {getFilteredUsers().map((user) => {
                    // Check if user is selected using nocobdid (NocoDB user ID)
                    const isSelected = selectedUserIds.includes(user.nocobdid || '');
                    const isMultiSelect = userSelectField?.fieldName === 'Assignees';
                    
                    return (
                      <button
                        key={user.id}
                        onClick={() => handleUserSelect(user)}
                        className={`w-full flex items-center gap-3 p-3 rounded hover:bg-muted/50 transition-colors text-left group ${
                          isSelected && isMultiSelect ? 'bg-primary/10 border border-primary' : ''
                        }`}
                      >
                        {/* Checkbox for multi-select */}
                        {isMultiSelect && (
                          <div className={`w-4 h-4 border-2 rounded flex items-center justify-center shrink-0 ${
                            isSelected ? 'bg-primary border-primary' : 'border-muted-foreground'
                          }`}>
                            {isSelected && (
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                        )}
                        
                        {/* Avatar */}
                        {renderUserAvatar(user, 'md')}
                        
                        {/* User Info */}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-foreground group-hover:text-primary transition-colors">
                            {user.display_name || user.email}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {user.email}
                          </div>
                          {user.nocobdid && (
                            <div className="text-xs text-muted-foreground/70 font-mono">
                              ID: {user.nocobdid}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                  
                  {getFilteredUsers().length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No users found
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-border flex justify-end gap-2 shrink-0">
                {userSelectField?.fieldName === 'Assignees' ? (
                  <>
                    <button
                      onClick={() => {
                        setUserSelectModalOpen(false);
                        setUserSelectField(null);
                        setUserSearchTerm('');
                        setSelectedUserIds([]);
                      }}
                      className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveAssignees}
                      className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
                    >
                      Save ({selectedUserIds.length} selected)
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      setUserSelectModalOpen(false);
                      setUserSelectField(null);
                      setUserSearchTerm('');
                    }}
                    className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Status Select Modal */}
        {statusSelectModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card rounded-lg shadow-xl w-full max-w-md border border-border flex flex-col">
              {/* Header */}
              <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                <h3 className="text-lg font-semibold text-foreground">
                  Select Status
                </h3>
                <button
                  onClick={() => {
                    setStatusSelectModalOpen(false);
                    setStatusSelectField(null);
                  }}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Status Options */}
              <div className="p-4">
                <div className="space-y-2">
                  {STATUS_OPTIONS.map((status) => (
                    <button
                      key={status}
                      onClick={() => handleStatusSelect(status)}
                      className="w-full flex items-center justify-between p-4 rounded-lg hover:bg-muted/50 transition-colors text-left group border border-border hover:border-primary"
                    >
                      <span className={`px-4 py-2 rounded-full text-sm font-medium border ${getStatusColor(status)}`}>
                        {status}
                      </span>
                      {statusSelectField?.record[statusSelectField.fieldName] === status && (
                        <span className="text-primary">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-border flex justify-end">
                <button
                  onClick={() => {
                    setStatusSelectModalOpen(false);
                    setStatusSelectField(null);
                  }}
                  className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tags Modal */}
        {tagsModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card rounded-lg shadow-xl w-full max-w-6xl border border-border flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                <h3 className="text-lg font-semibold text-foreground">
                  Select Tags
                </h3>
                <button
                  onClick={() => {
                    setTagsModalOpen(false);
                    setTagsField(null);
                    setSelectedTags([]);
                    setTagSearchTerm('');
                  }}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Search Box */}
              <div className="px-6 py-4 border-b border-border">
                <input
                  type="text"
                  placeholder="Search tags..."
                  value={tagSearchTerm}
                  onChange={(e) => setTagSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Selected Tags */}
              {selectedTags.length > 0 && (
                <div className="px-6 py-3 border-b border-border bg-muted/30">
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="text-sm font-medium text-muted-foreground">Selected:</span>
                    {selectedTags.map((tag) => (
                      <span 
                        key={tag.id}
                        className={`px-3 py-1 rounded-full text-xs font-medium border ${getTagColorClass(tag.color)} flex items-center gap-1`}
                      >
                        {tag.name}
                        <button
                          onClick={() => toggleTag(tag)}
                          className="hover:bg-black/10 rounded-full p-0.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Tags Grid */}
              <div className="flex-1 overflow-auto p-6">
                <div className="grid grid-cols-4 gap-4">
                  {/* Companies Column */}
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-red-500"></span>
                      Companies
                    </h4>
                    <div className="space-y-1">
                      {companies
                        .filter(c => !tagSearchTerm || c.full_name?.toLowerCase().includes(tagSearchTerm.toLowerCase()))
                        .map(company => {
                          const tag = { id: `company-${company.id}`, name: company.full_name || 'Unknown', type: 'company', color: 'red' };
                          const isSelected = selectedTags.some(t => t.id === tag.id);
                          return (
                            <button
                              key={company.id}
                              onClick={() => toggleTag(tag)}
                              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors border ${
                                isSelected 
                                  ? 'bg-red-100 text-red-800 border-red-300 font-medium' 
                                  : 'bg-background hover:bg-muted border-border'
                              }`}
                            >
                              {company.full_name || 'Unknown Company'}
                            </button>
                          );
                        })}
                    </div>
                  </div>

                  {/* Projects Column */}
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                      Projects
                    </h4>
                    <div className="space-y-1">
                      {projects
                        .filter(p => !tagSearchTerm || p.name?.toLowerCase().includes(tagSearchTerm.toLowerCase()))
                        .map(project => {
                          const tag = { id: `project-${project.id}`, name: project.name || 'Unknown', type: 'project', color: 'blue' };
                          const isSelected = selectedTags.some(t => t.id === tag.id);
                          return (
                            <button
                              key={project.id}
                              onClick={() => toggleTag(tag)}
                              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors border ${
                                isSelected 
                                  ? 'bg-blue-100 text-blue-800 border-blue-300 font-medium' 
                                  : 'bg-background hover:bg-muted border-border'
                              }`}
                            >
                              {project.name || 'Unknown Project'}
                            </button>
                          );
                        })}
                      {projects.length === 0 && (
                        <p className="text-sm text-muted-foreground italic">No projects available</p>
                      )}
                    </div>
                  </div>

                  {/* Categories Column */}
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                      Categories
                    </h4>
                    <div className="space-y-2">
                      {/* Add category input */}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Add new category..."
                          value={newCategoryInput}
                          onChange={(e) => setNewCategoryInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addCategoryTag();
                            }
                          }}
                          className="flex-1 px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <button
                          onClick={addCategoryTag}
                          className="px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm"
                        >
                          +
                        </button>
                      </div>

                      {/* Existing categories list */}
                      <div className="space-y-1">
                        {(() => {
                          const { categories } = getUniqueCategoriesAndCustomTags();
                          return categories
                            .filter(cat => !tagSearchTerm || cat.toLowerCase().includes(tagSearchTerm.toLowerCase()))
                            .map(category => {
                              const tag = { id: `category-${category}`, name: category, type: 'category', color: 'yellow' };
                              const isSelected = selectedTags.some(t => t.id === tag.id);
                              return (
                                <button
                                  key={category}
                                  onClick={() => toggleTag(tag)}
                                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors border ${
                                    isSelected 
                                      ? 'bg-yellow-100 text-yellow-800 border-yellow-300 font-medium' 
                                      : 'bg-background hover:bg-muted border-border'
                                  }`}
                                >
                                  {category}
                                </button>
                              );
                            });
                        })()}
                        {(() => {
                          const { categories } = getUniqueCategoriesAndCustomTags();
                          return categories.length === 0 ? (
                            <p className="text-sm text-muted-foreground italic">No categories yet</p>
                          ) : null;
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Other Tags Column */}
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-green-500"></span>
                      Other Tags
                    </h4>
                    <div className="space-y-2">
                      {/* Add custom tag input */}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Add new tag..."
                          value={newTagInput}
                          onChange={(e) => setNewTagInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addCustomTag();
                            }
                          }}
                          className="flex-1 px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <button
                          onClick={addCustomTag}
                          className="px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm"
                        >
                          +
                        </button>
                      </div>
                      
                      {/* Custom tags list */}
                      <div className="space-y-1">
                        {(() => {
                          const { customTags } = getUniqueCategoriesAndCustomTags();
                          return customTags
                            .filter(tag => !tagSearchTerm || tag.toLowerCase().includes(tagSearchTerm.toLowerCase()))
                            .map(customTag => {
                              const tag = { id: `custom-${customTag}`, name: customTag, type: 'custom', color: 'green' };
                              const isSelected = selectedTags.some(t => t.id === tag.id);
                              return (
                                <button
                                  key={customTag}
                                  onClick={() => toggleTag(tag)}
                                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors border ${
                                    isSelected 
                                      ? 'bg-green-100 text-green-800 border-green-300 font-medium' 
                                      : 'bg-background hover:bg-muted border-border'
                                  }`}
                                >
                                  {customTag}
                                </button>
                              );
                            });
                        })()}
                        {(() => {
                          const { customTags } = getUniqueCategoriesAndCustomTags();
                          return customTags.length === 0 ? (
                            <p className="text-sm text-muted-foreground italic">No custom tags yet</p>
                          ) : null;
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-border flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  {selectedTags.length} tag{selectedTags.length !== 1 ? 's' : ''} selected
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setTagsModalOpen(false);
                      setTagsField(null);
                      setSelectedTags([]);
                      setTagSearchTerm('');
                    }}
                    className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveTags}
                    className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
                  >
                    Save Tags
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Groups Modal */}
        {groupsModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card rounded-lg shadow-xl w-full max-w-md border border-border flex flex-col max-h-[80vh]">
              {/* Header */}
              <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                <h3 className="text-lg font-semibold text-foreground">
                  Select Groups
                </h3>
                <button
                  onClick={() => {
                    setGroupsModalOpen(false);
                    setGroupsField(null);
                    setSelectedGroupIds([]);
                    setGroupSearchTerm('');
                  }}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Search Box */}
              <div className="px-6 py-4 border-b border-border">
                <input
                  type="text"
                  placeholder="Search groups..."
                  value={groupSearchTerm}
                  onChange={(e) => setGroupSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  autoFocus
                />
              </div>

              {/* Selected Groups */}
              {selectedGroupIds.length > 0 && (
                <div className="px-6 py-3 border-b border-border bg-muted/30">
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="text-sm font-medium text-muted-foreground">Selected:</span>
                    {selectedGroupIds.map((groupId) => {
                      const group = availableGroups.find(g => g.id === groupId);
                      if (!group) return null;
                      return (
                        <span 
                          key={groupId}
                          className="px-3 py-1 rounded-full text-xs font-medium border bg-purple-100 text-purple-800 border-purple-300 flex items-center gap-1"
                        >
                          {group.name}
                          <button
                            onClick={() => toggleGroup(groupId)}
                            className="hover:bg-black/10 rounded-full p-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Groups List */}
              <div className="flex-1 overflow-auto p-4">
                <div className="space-y-2">
                  {availableGroups
                    .filter(group => !groupSearchTerm || group.name.toLowerCase().includes(groupSearchTerm.toLowerCase()))
                    .map(group => {
                      const isSelected = selectedGroupIds.includes(group.id);
                      return (
                        <button
                          key={group.id}
                          onClick={() => toggleGroup(group.id)}
                          className={`w-full text-left px-4 py-3 rounded-lg transition-colors border flex items-center gap-3 ${
                            isSelected 
                              ? 'bg-purple-100 text-purple-800 border-purple-300 font-medium' 
                              : 'bg-background hover:bg-muted border-border'
                          }`}
                        >
                          {/* Checkbox */}
                          <div className={`w-5 h-5 border-2 rounded flex items-center justify-center shrink-0 ${
                            isSelected ? 'bg-purple-600 border-purple-600' : 'border-muted-foreground'
                          }`}>
                            {isSelected && (
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          
                          <span className="flex-1">{group.name}</span>
                        </button>
                      );
                    })}
                  
                  {availableGroups.filter(group => !groupSearchTerm || group.name.toLowerCase().includes(groupSearchTerm.toLowerCase())).length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No groups found
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-border flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  {selectedGroupIds.length} group{selectedGroupIds.length !== 1 ? 's' : ''} selected
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setGroupsModalOpen(false);
                      setGroupsField(null);
                      setSelectedGroupIds([]);
                      setGroupSearchTerm('');
                    }}
                    className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveGroups}
                    className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
                  >
                    Save Groups
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

export default TasksPage;
