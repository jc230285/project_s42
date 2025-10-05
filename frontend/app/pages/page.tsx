'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import toast from 'react-hot-toast';
import { 
  Plus, 
  Edit, 
  Trash2, 
  ExternalLink,
  Shield,
  Settings,
  Users,
  Save,
  X,
  GripVertical,
  Home,
  Globe,
  Workflow,
  Database,
  HardDrive,
  Map as MapIcon,
  Building,
  CreditCard,
  Zap,
  FolderOpen,
  Wrench,
  LucideIcon
} from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { useSession } from 'next-auth/react';
import { WithScale42Access } from '@/components/WithScale42Access';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

interface Page {
  Id?: number;
  id?: number;
  name: string;
  path: string;
  icon: string;
  category: string;
  is_external: boolean;
  url?: string;
  description?: string;
  display_order?: number;
  group_ids: number[];
  allowed_groups: string[];
  permissions?: string; // Added to handle MySQL format: "Scale42:admin; Public:read"
}

interface Group {
  Id?: number;
  id?: number;
  name: string;
  description: string;
}

export default function PageManagement() {
  const { data: session } = useSession();
  const [pages, setPages] = useState<Page[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPage, setEditingPage] = useState<Page | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState<Page | null>(null);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [categories, setCategories] = useState<{name: string, count: number}[]>([]);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');

  const cleanAndNormalizePages = (pages: Page[]): Page[] => {
    // Category normalization mapping
    const categoryMapping: { [key: string]: string } = {
      'Debug': 'Management',      // Move Debug category pages to Management
      'Hoyanger': 'Projects',     // Move Hoyanger category pages to Projects
    };
    
    // Deduplicate pages by ID and normalize categories
    const deduplicatedPages = pages.reduce((acc: Page[], page: Page) => {
      const pageId = page.id || page.Id;
      const existingPage = acc.find(p => (p.id || p.Id) === pageId);
      
      if (!existingPage) {
        // Normalize the category
        const normalizedCategory = categoryMapping[page.category] || page.category;
        acc.push({ ...page, category: normalizedCategory });
      }
      return acc;
    }, []);
    
    return deduplicatedPages;
  };

  // Helper function to get icon component from icon name
  const getIconComponent = (iconName: string) => {
    const iconMap: { [key: string]: LucideIcon } = {
      'Home': Home,
      'Globe': Globe,
      'Workflow': Workflow,
      'Database': Database,
      'HardDrive': HardDrive,
      'Users': Users,
      'Settings': Settings,
      'Map': MapIcon,
      'Building': Building,
      'CreditCard': CreditCard,
      'Zap': Zap,
      'FolderOpen': FolderOpen,
      'Shield': Shield,
      'Wrench': Wrench
    };
    
    const IconComponent = iconMap[iconName] || Globe; // Default to Globe if icon not found
    return <IconComponent className="h-4 w-4" />;
  };

  const [newPage, setNewPage] = useState({
    name: '',
    path: '',
    icon: 'Globe',
    category: 'Tools',
    is_external: false,
    url: '',
    description: ''
  });

  const iconOptions = [
    'Home', 'Globe', 'Workflow', 'Database', 'HardDrive', 'Users', 'Settings',
    'Map', 'Building', 'CreditCard', 'Zap', 'FolderOpen', 'Shield', 'Tool'
  ];

  const categoryOptions = [
    'Navigation', 'Tools', 'Projects', 'Management', 'Settings', 'External'
  ];

  useEffect(() => {
    // Fetch groups first, then pages
    const fetchData = async () => {
      console.log('Starting data fetch...');
      console.log('Session:', session);
      console.log('Backend URL:', process.env.NEXT_PUBLIC_BACKEND_BASE_URL);
      await fetchGroups();
      await fetchPages();
    };
    
    // Always fetch data, don't wait for session
    fetchData();
  }, []);

  const fetchPages = async () => {
    try {
      console.log('Fetching pages...');
      console.log('Backend URL:', process.env.NEXT_PUBLIC_BACKEND_BASE_URL);
      
      // Create auth token with hardcoded email for testing
      const authToken = `Bearer ${btoa(JSON.stringify({ email: "james@scale-42.com", authenticated: true }))}`;
      
      // Use the correct MySQL endpoint for pages
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/pages-mysql`, {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': authToken
        }
      });

      console.log('Pages response status:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('Raw pages data:', data.length);
        console.log('Sample page:', data[0]);
        
        // Process the data to include group_ids and allowed_groups for frontend compatibility
        const processedPages = data.map((page: any) => {
          const permissions = page.permissions || '';
          const allowedGroups: string[] = [];
          const groupIds: number[] = [];
          
          if (permissions) {
            // Parse "Scale42:admin; Public:read" format
            const permissionPairs = permissions.split('; ');
            permissionPairs.forEach((pair: string) => {
              const [groupName] = pair.split(':');
              if (groupName && groupName.trim()) {
                allowedGroups.push(groupName.trim());
                // Find the group ID by name
                const group = groups.find(g => g.name === groupName.trim());
                if (group) {
                  groupIds.push(group.Id || group.id || 0);
                }
              }
            });
          }
          
          return {
            ...page,
            group_ids: groupIds,
            allowed_groups: allowedGroups
          };
        });
        
        console.log('Raw pages from API:', processedPages.length);
        
        // Clean and normalize pages data
        const cleanedPages = cleanAndNormalizePages(processedPages);
        console.log('After cleaning and normalizing:', cleanedPages.length);
        
        // Sort pages to match navigation menu order exactly
        const categoryOrder = ['Navigation', 'Projects', 'Tools', 'Management', 'Financial', 'Development', 'Settings', 'External', 'Debug', 'Hoyanger'];
        
        // Define specific order within each category to match navigation
        const pageOrderWithinCategory: { [key: string]: string[] } = {
          'Navigation': ['Dashboard'],
          'Projects': ['Projects', 'Map', 'Schema', 'Hoyanger'],
          'Tools': ['Drive', 'N8N', 'NocoDb', 'Notion'],
          'Management': ['Users', 'Page Management', 'Debug'],
          'Financial': ['Accounts'],
          'Development': ['Debug', 'Test Page'],
          'Debug': ['Debug', 'Test Page'], // Handle legacy Debug category
          'Hoyanger': ['Hoyanger'] // Handle legacy Hoyanger category
        };
        
        const sortedPages = cleanedPages.sort((a: Page, b: Page) => {
          // First check if both pages have display_order (drag-and-drop order)
          const aDisplayOrder = a.display_order;
          const bDisplayOrder = b.display_order;
          
          if (aDisplayOrder !== undefined && bDisplayOrder !== undefined) {
            return aDisplayOrder - bDisplayOrder;
          }
          
          // Fall back to category-based sorting for pages without display_order
          // First sort by category order
          const aCategoryIndex = categoryOrder.indexOf(a.category || 'Other');
          const bCategoryIndex = categoryOrder.indexOf(b.category || 'Other');
          
          // If category not in predefined order, put at end
          const aIndex = aCategoryIndex === -1 ? categoryOrder.length : aCategoryIndex;
          const bIndex = bCategoryIndex === -1 ? categoryOrder.length : bCategoryIndex;
          
          if (aIndex !== bIndex) {
            return aIndex - bIndex;
          }
          
          // Within same category, sort by predefined order
          const category = a.category || 'Other';
          const categoryPages = pageOrderWithinCategory[category];
          
          if (categoryPages) {
            const aPageIndex = categoryPages.indexOf(a.name || '');
            const bPageIndex = categoryPages.indexOf(b.name || '');
            
            // If both pages are in predefined order, use that order
            if (aPageIndex !== -1 && bPageIndex !== -1) {
              return aPageIndex - bPageIndex;
            }
            // If only one is in predefined order, put it first
            if (aPageIndex !== -1) return -1;
            if (bPageIndex !== -1) return 1;
          }
          
          // Fall back to alphabetical sorting within category
          return (a.name || '').localeCompare(b.name || '');
        });
        
        setPages(sortedPages);
      } else {
        console.error('Failed to fetch pages:', response.status);
        const errorText = await response.text();
        console.error('Error details:', errorText);
      }
    } catch (error) {
      console.error('Error fetching pages:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchGroups = async () => {
    try {
      console.log('Fetching groups...');
      console.log('Backend URL:', process.env.NEXT_PUBLIC_BACKEND_BASE_URL);
      
      // Create auth token with hardcoded email for testing
      const authToken = `Bearer ${btoa(JSON.stringify({ email: "james@scale-42.com", authenticated: true }))}`;
      
      // Use the correct backend endpoint for groups
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/groups`, {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': authToken
        }
      });

      console.log('Groups response status:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('Groups fetched:', data.length);
        setGroups(data);
      } else {
        console.error('Failed to fetch groups:', response.status);
        const errorText = await response.text();
        console.error('Groups error details:', errorText);
      }
    } catch (error) {
      console.error('Error fetching groups:', error);
    }
  };

  const extractCategories = () => {
  const categoryMap: Map<string, number> = new Map();
    pages.forEach(page => {
      const cat = page.category || 'Uncategorized';
      categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1);
    });
    
    const categoriesArray = Array.from(categoryMap.entries()).map(([name, count]) => ({
      name,
      count
    }));
    
    // Load saved order from localStorage
    const savedOrder = localStorage.getItem('categoryOrder');
    if (savedOrder) {
      try {
        const orderArray = JSON.parse(savedOrder);
        // Sort categories based on saved order, put unknown categories at the end
        categoriesArray.sort((a, b) => {
          const aIndex = orderArray.indexOf(a.name);
          const bIndex = orderArray.indexOf(b.name);
          
          // If both are in the saved order, use that order
          if (aIndex !== -1 && bIndex !== -1) {
            return aIndex - bIndex;
          }
          // If only one is in the saved order, put it first
          if (aIndex !== -1) return -1;
          if (bIndex !== -1) return 1;
          // If neither is in saved order, sort alphabetically
          return a.name.localeCompare(b.name);
        });
      } catch (error) {
        console.error('Error parsing saved category order:', error);
        // Fall back to alphabetical sorting
        categoriesArray.sort((a, b) => a.name.localeCompare(b.name));
      }
    } else {
      // No saved order, sort alphabetically
      categoriesArray.sort((a, b) => a.name.localeCompare(b.name));
    }
    
    setCategories(categoriesArray);
  };

  const handleRenameCategory = async (oldName: string, newName: string) => {
    if (!newName || newName === oldName) return;
    
    try {
      // Update all pages with this category
      const pagesToUpdate = pages.filter(p => p.category === oldName);
      
      for (const page of pagesToUpdate) {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/pages/${page.id || page.Id}`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${btoa(JSON.stringify({ email: session?.user?.email, authenticated: true }))}`
          },
          body: JSON.stringify({
            category: newName
          })
        });

        if (!response.ok) {
          console.error(`Failed to update page ${page.name}`);
        }
      }
      
      setEditingCategory(null);
      setNewCategoryName('');
      fetchPages();
    } catch (error) {
      console.error('Error renaming category:', error);
    }
  };

  const handleDeleteCategory = async (categoryName: string) => {
    const pagesInCategory = pages.filter(p => p.category === categoryName);
    
    if (pagesInCategory.length > 0) {
      if (!confirm(`This category is used by ${pagesInCategory.length} page(s). Deleting will set them to 'Uncategorized'. Continue?`)) {
        return;
      }
    }
    
    try {
      // Set all pages in this category to 'Uncategorized'
      for (const page of pagesInCategory) {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/pages/${page.id || page.Id}`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${btoa(JSON.stringify({ email: session?.user?.email, authenticated: true }))}`
          },
          body: JSON.stringify({
            category: 'Uncategorized'
          })
        });

        if (!response.ok) {
          console.error(`Failed to update page ${page.name}`);
        }
      }
      
      fetchPages();
    } catch (error) {
      console.error('Error deleting category:', error);
    }
  };

  const handleDragEndCategory = async (result: any) => {
    if (!result.destination) return;
    
    const items = Array.from(categories);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    // Update local state immediately for smooth UX
    setCategories(items);
    
    // Save to backend - we'll need to update all pages with new category order
    // For now, we'll store the order in localStorage as a simple solution
    const categoryOrder = items.map(cat => cat.name);
    localStorage.setItem('categoryOrder', JSON.stringify(categoryOrder));
    
    // TODO: Add backend endpoint for category ordering if needed
    // For now, this provides immediate visual feedback
  };

  const handleDragEnd = async (result: any) => {
    if (!result.destination) return;
    
    const items = Array.from(pages);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    // Update local state immediately for smooth UX
    setPages(items);
    
    // Save the new order to backend
    try {
      const updates = items.map((page, index) => ({
        page_id: page.id || page.Id || 0,
        display_order: index
      }));

      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/pages/reorder`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${btoa(JSON.stringify({ email: session?.user?.email, authenticated: true }))}`
        },
        body: JSON.stringify({ updates })
      });

      if (!response.ok) {
        console.error('Failed to save page order:', await response.text());
        // Revert the local state if backend fails
        fetchPages();
      } else {
        console.log('✅ Page order saved successfully');
      }
    } catch (error) {
      console.error('Error saving page order:', error);
      // Revert the local state if there's an error
      fetchPages();
    }
  };

  // Update categories when pages change
  useEffect(() => {
    if (pages.length > 0) {
      extractCategories();
    }
  }, [pages]);

  const handleCreatePage = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/add-single-page`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${btoa(JSON.stringify({ email: session?.user?.email, authenticated: true }))}`
        },
        body: JSON.stringify({
          name: newPage.name,
          path: newPage.path,
          icon: newPage.icon,
          category: newPage.category,
          is_external: newPage.is_external,
          url: newPage.url,
          description: newPage.description
        })
      });

      if (response.ok) {
        setShowCreateForm(false);
        setNewPage({
          name: '',
          path: '',
          icon: 'Globe',
          category: 'Tools',
          is_external: false,
          url: '',
          description: ''
        });
        fetchPages();
      } else {
        console.error('Failed to create page:', response.status);
      }
    } catch (error) {
      console.error('Error creating page:', error);
    }
  };

  const handleDeletePage = async (pageId: number) => {
    if (!confirm('Are you sure you want to delete this page?')) return;

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/pages/${pageId}`, {
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${btoa(JSON.stringify({ email: session?.user?.email, authenticated: true }))}`
        }
      });

      if (response.ok) {
        fetchPages();
      } else {
        console.error('Failed to delete page:', response.status);
      }
    } catch (error) {
      console.error('Error deleting page:', error);
    }
  };

  const handleEditPage = async () => {
    if (!editingPage) return;
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/pages/${editingPage.id || editingPage.Id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${btoa(JSON.stringify({ email: session?.user?.email, authenticated: true }))}`
        },
        body: JSON.stringify({
          name: editingPage.name,
          path: editingPage.path,
          icon: editingPage.icon,
          category: editingPage.category,
          is_external: editingPage.is_external,
          url: editingPage.url,
          description: editingPage.description
        })
      });

      if (response.ok) {
        setEditingPage(null);
        fetchPages();
      } else {
        console.error('Failed to update page:', response.status);
      }
    } catch (error) {
      console.error('Error updating page:', error);
    }
  };

  const handleUpdatePermissions = async (pageId: number, groupIds: number[]) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/pages/${pageId}/permissions`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${btoa(JSON.stringify({ email: session?.user?.email, authenticated: true }))}`
        },
        body: JSON.stringify({ page_id: pageId, group_ids: groupIds })
      });

      if (response.ok) {
        console.log('Permissions updated successfully, refreshing pages...');
        // Close modal first for immediate feedback
        setShowPermissionsModal(null);
        // Wait a moment for database to commit
        await new Promise(resolve => setTimeout(resolve, 300));
        // Refresh pages to show updated permissions
        await fetchPages();
        toast.success('Permissions updated successfully!');
      } else {
        console.error('Failed to update permissions:', response.status);
        const errorText = await response.text();
        console.error('Error details:', errorText);
        toast.error(`Failed to update permissions: ${response.status}`);
      }
    } catch (error) {
      console.error('Error updating permissions:', error);
      toast.error('Error updating permissions. Check console for details.');
    }
  };

  const initializeDefaultPages = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/setup-original-pages`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${btoa(JSON.stringify({ email: session?.user?.email, authenticated: true }))}`
        }
      });

      if (response.ok) {
        fetchPages();
        toast.success('Default pages initialized successfully!');
      } else {
        const errorData = await response.text();
        console.error('Failed to initialize pages:', errorData);
        toast.error('Failed to initialize default pages. Check console for details.');
      }
    } catch (error) {
      console.error('Error initializing pages:', error);
      toast.error('Error initializing default pages.');
    }
  };

  if (loading) {
    return (
      <WithScale42Access>
        <DashboardLayout>
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-muted-foreground">Loading pages...</p>
            </div>
          </div>
        </DashboardLayout>
      </WithScale42Access>
    );
  }

  return (
    <WithScale42Access>
      <DashboardLayout>
        <div className="container mx-auto p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Page Management</h1>
              <p className="text-muted-foreground">Manage pages and their access permissions</p>
            </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setShowCreateForm(true)}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Page
            </Button>
          </div>
        </div>

        {/* Create Page Form */}
        {showCreateForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-card p-6 rounded-lg w-96 max-w-[90vw]">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Create New Page</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCreateForm(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Name</label>
                  <input
                    type="text"
                    value={newPage.name}
                    onChange={(e) => setNewPage({...newPage, name: e.target.value})}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background"
                    placeholder="Page name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Path</label>
                  <input
                    type="text"
                    value={newPage.path}
                    onChange={(e) => setNewPage({...newPage, path: e.target.value})}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background"
                    placeholder="/tools/example"
                  />
                </div>

                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-sm font-medium mb-1">Icon</label>
                    <select
                      value={newPage.icon}
                      onChange={(e) => setNewPage({...newPage, icon: e.target.value})}
                      className="w-full px-3 py-2 border border-border rounded-md bg-background"
                    >
                      {iconOptions.map(icon => (
                        <option key={icon} value={icon}>{icon}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex-1">
                    <label className="block text-sm font-medium mb-1">Category</label>
                    <input
                      type="text"
                      list="category-options"
                      value={newPage.category}
                      onChange={(e) => setNewPage({...newPage, category: e.target.value})}
                      className="w-full px-3 py-2 border border-border rounded-md bg-background"
                      placeholder="Select or type new category"
                    />
                    <datalist id="category-options">
                      {categoryOptions.map(category => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                      {categories.filter(cat => !categoryOptions.includes(cat.name)).map(cat => (
                        <option key={cat.name} value={cat.name}>{cat.name}</option>
                      ))}
                    </datalist>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_external"
                    checked={newPage.is_external}
                    onChange={(e) => setNewPage({...newPage, is_external: e.target.checked})}
                    className="rounded"
                  />
                  <label htmlFor="is_external" className="text-sm">External Link</label>
                </div>

                {newPage.is_external && (
                  <div>
                    <label className="block text-sm font-medium mb-1">URL</label>
                    <input
                      type="url"
                      value={newPage.url}
                      onChange={(e) => setNewPage({...newPage, url: e.target.value})}
                      className="w-full px-3 py-2 border border-border rounded-md bg-background"
                      placeholder="https://example.com"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <textarea
                    value={newPage.description}
                    onChange={(e) => setNewPage({...newPage, description: e.target.value})}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background"
                    rows={2}
                    placeholder="Optional description"
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setShowCreateForm(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleCreatePage}>
                    <Save className="h-4 w-4 mr-2" />
                    Create Page
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Page Form */}
        {editingPage && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-card p-6 rounded-lg w-96 max-w-[90vw]">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Edit Page</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingPage(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Name</label>
                  <input
                    type="text"
                    value={editingPage.name}
                    onChange={(e) => setEditingPage({...editingPage, name: e.target.value})}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background"
                    placeholder="Page name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Path</label>
                  <input
                    type="text"
                    value={editingPage.path}
                    onChange={(e) => setEditingPage({...editingPage, path: e.target.value})}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background"
                    placeholder="/tools/example"
                  />
                </div>

                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-sm font-medium mb-1">Icon</label>
                    <select
                      value={editingPage.icon}
                      onChange={(e) => setEditingPage({...editingPage, icon: e.target.value})}
                      className="w-full px-3 py-2 border border-border rounded-md bg-background"
                    >
                      {iconOptions.map(icon => (
                        <option key={icon} value={icon}>{icon}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex-1">
                    <label className="block text-sm font-medium mb-1">Category</label>
                    <input
                      type="text"
                      list="edit-category-options"
                      value={editingPage.category}
                      onChange={(e) => setEditingPage({...editingPage, category: e.target.value})}
                      className="w-full px-3 py-2 border border-border rounded-md bg-background"
                      placeholder="Select or type new category"
                    />
                    <datalist id="edit-category-options">
                      {categoryOptions.map(category => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                      {categories.filter(cat => !categoryOptions.includes(cat.name)).map(cat => (
                        <option key={cat.name} value={cat.name}>{cat.name}</option>
                      ))}
                    </datalist>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="edit_is_external"
                    checked={editingPage.is_external || false}
                    onChange={(e) => setEditingPage({...editingPage, is_external: e.target.checked})}
                    className="rounded"
                  />
                  <label htmlFor="edit_is_external" className="text-sm">External Link</label>
                </div>

                {editingPage.is_external && (
                  <div>
                    <label className="block text-sm font-medium mb-1">URL</label>
                    <input
                      type="url"
                      value={editingPage.url || ''}
                      onChange={(e) => setEditingPage({...editingPage, url: e.target.value})}
                      className="w-full px-3 py-2 border border-border rounded-md bg-background"
                      placeholder="https://example.com"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <textarea
                    value={editingPage.description || ''}
                    onChange={(e) => setEditingPage({...editingPage, description: e.target.value})}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background"
                    rows={2}
                    placeholder="Optional description"
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setEditingPage(null)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleEditPage}>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Permissions Modal */}
        {showPermissionsModal && (
          <PermissionsModal
            page={showPermissionsModal}
            groups={groups}
            onSave={(groupIds) => handleUpdatePermissions(showPermissionsModal.Id || showPermissionsModal.id || 0, groupIds)}
            onClose={() => setShowPermissionsModal(null)}
          />
        )}

        {/* Category Manager Modal */}
        {showCategoryManager && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-card p-6 rounded-lg w-[600px] max-w-[90vw] max-h-[80vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Manage Categories</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowCategoryManager(false);
                    setEditingCategory(null);
                    setNewCategoryName('');
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-4">
                <div className="text-sm text-muted-foreground mb-4">
                  Categories help organize your pages in the navigation menu. You can rename or delete categories below.
                </div>

                <DragDropContext onDragEnd={handleDragEndCategory}>
                  <div className="space-y-2">
                    <Droppable droppableId="categories">
                      {(provided) => (
                        <div {...provided.droppableProps} ref={provided.innerRef}>
                          {categories.map((category, index) => (
                            <Draggable 
                              key={category.name} 
                              draggableId={category.name} 
                              index={index}
                            >
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  className={`flex items-center justify-between p-3 border border-border rounded-lg ${snapshot.isDragging ? 'bg-accent shadow-lg' : ''}`}
                                >
                                  <div {...provided.dragHandleProps} className="mr-3">
                                    <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab active:cursor-grabbing" />
                                  </div>
                                  {editingCategory === category.name ? (
                                    <div className="flex-1 flex gap-2">
                                      <input
                                        type="text"
                                        value={newCategoryName}
                                        onChange={(e) => setNewCategoryName(e.target.value)}
                                        className="flex-1 px-3 py-2 border border-border rounded-md bg-background"
                                        placeholder="New category name"
                                        autoFocus
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            handleRenameCategory(category.name, newCategoryName);
                                          } else if (e.key === 'Escape') {
                                            setEditingCategory(null);
                                            setNewCategoryName('');
                                          }
                                        }}
                                      />
                                      <Button
                                        size="sm"
                                        onClick={() => handleRenameCategory(category.name, newCategoryName)}
                                      >
                                        <Save className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          setEditingCategory(null);
                                          setNewCategoryName('');
                                        }}
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <>
                                      <div className="flex-1">
                                        <div className="font-medium">{category.name}</div>
                                        <div className="text-sm text-muted-foreground">
                                          {category.count} page{category.count !== 1 ? 's' : ''}
                                        </div>
                                      </div>
                                      <div className="flex gap-1">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            setEditingCategory(category.name);
                                            setNewCategoryName(category.name);
                                          }}
                                          title="Rename Category"
                                        >
                                          <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleDeleteCategory(category.name)}
                                          title="Delete Category"
                                          className="text-destructive hover:text-destructive"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </div>
                </DragDropContext>

                {categories.length === 0 && (
                  <div className="text-center p-8 text-muted-foreground">
                    No categories found. Categories are created automatically when you assign them to pages.
                  </div>
                )}

                <div className="pt-4 border-t border-border">
                  <div className="text-sm text-muted-foreground">
                    💡 <strong>Tip:</strong> To create a new category, simply type it in when creating or editing a page.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Pages Table */}
        <div className="bg-card rounded-lg border border-border">
          <div className="p-4 border-b border-border">
            <h2 className="text-lg font-semibold">Configured Pages</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-4 font-medium w-12">ICON</th>
                  <th className="text-left p-4 font-medium">Name</th>
                  <th className="text-left p-4 font-medium">Path</th>
                  <th className="text-left p-4 font-medium">Category</th>
                  <th className="text-left p-4 font-medium">Type</th>
                  <th className="text-left p-4 font-medium">Access Groups</th>
                  <th className="text-left p-4 font-medium">Actions</th>
                </tr>
              </thead>
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="pages-table">
                  {(provided) => (
                    <tbody {...provided.droppableProps} ref={provided.innerRef}>
                      {pages.map((page, index) => (
                        <Draggable 
                          key={`page-${page.Id || page.id}`} 
                          draggableId={`page-${page.Id || page.id}`} 
                          index={index}
                        >
                          {(provided, snapshot) => (
                            <tr 
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              key={page.Id || page.id} 
                              className={`border-b border-border ${snapshot.isDragging ? 'bg-accent shadow-lg' : ''}`}
                            >
                              <td className="p-4">
                                <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing">
                                  <GripVertical className="h-5 w-5 text-muted-foreground" />
                                </div>
                              </td>
                              <td className="p-4">
                                <div className="flex items-center gap-2">
                                  {getIconComponent(page.icon)}
                                  <span className="font-medium">{page.name}</span>
                                </div>
                              </td>
                              <td className="p-4 font-mono text-sm">{page.path}</td>
                              <td className="p-4">
                                <span className="px-2 py-1 bg-primary/10 text-primary rounded-full text-xs">
                                  {page.category}
                                </span>
                              </td>
                              <td className="p-4">
                                {page.is_external ? (
                                  <span className="flex items-center gap-1 text-blue-600">
                                    <ExternalLink className="h-3 w-3" />
                                    External
                                  </span>
                                ) : (
                                  <span className="text-green-600">Internal</span>
                                )}
                              </td>
                              <td className="p-4">
                                <div className="flex flex-wrap gap-1">
                                  {page.permissions ? (
                                    page.permissions.split('; ').map((permission: string, index: number) => {
                                      const [groupName, level] = permission.split(':');
                                      return (
                                        <span key={index} 
                                          className="px-2 py-1 bg-secondary text-secondary-foreground rounded text-xs">
                                          {groupName}
                                        </span>
                                      );
                                    })
                                  ) : (
                                    <span className="text-muted-foreground text-xs">No access</span>
                                  )}
                                </div>
                              </td>
                              <td className="p-4">
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setEditingPage(page);
                                    }}
                                    title="Edit Page"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setShowPermissionsModal(page)}
                                    title="Manage Permissions"
                                  >
                                    <Users className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeletePage(page.Id || page.id || 0)}
                                    title="Delete Page"
                                    className="text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </tbody>
                  )}
                </Droppable>
              </DragDropContext>
            </table>
          </div>

          {pages.length === 0 && (
            <div className="text-center p-8 text-muted-foreground">
              No pages configured. Click "Initialize Defaults" to create basic pages.
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
    </WithScale42Access>
  );
}

// Permissions Modal Component
function PermissionsModal({ 
  page, 
  groups, 
  onSave, 
  onClose 
}: { 
  page: Page; 
  groups: Group[]; 
  onSave: (groupIds: number[]) => void; 
  onClose: () => void; 
}) {
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>(page.group_ids || []);

  const toggleGroup = (groupId: number) => {
    setSelectedGroupIds(prev => 
      prev.includes(groupId) 
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-card p-6 rounded-lg w-96 max-w-[90vw]">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Manage Permissions</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="mb-4">
          <p className="text-sm text-muted-foreground">
            Select which groups can access <strong>{page.name}</strong>
          </p>
        </div>

        <div className="space-y-2 mb-6 max-h-64 overflow-y-auto">
          {groups.map(group => (
            <label key={group.Id || group.id} className="flex items-center gap-2 p-2 hover:bg-muted/50 rounded cursor-pointer">
              <input
                type="checkbox"
                checked={selectedGroupIds.includes(group.Id || group.id || 0)}
                onChange={() => toggleGroup(group.Id || group.id || 0)}
                className="rounded"
              />
              <div>
                <div className="font-medium">{group.name}</div>
                <div className="text-xs text-muted-foreground">{group.description}</div>
              </div>
            </label>
          ))}
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onSave(selectedGroupIds)}>
            <Save className="h-4 w-4 mr-2" />
            Save Permissions
          </Button>
        </div>
      </div>
    </div>
  );
}