'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Home, 
  ExternalLink,
  ChevronRight,
  Globe,
  Workflow,
  Database,
  HardDrive,
  Users,
  Settings,
  Map,
  Building,
  CreditCard,
  Zap,
  FolderOpen,
  Shield,
  Wrench
} from 'lucide-react';
import { useSession } from 'next-auth/react';

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
}

interface GroupedPages {
  [category: string]: Page[];
}

// Icon mapping
const iconMap: { [key: string]: any } = {
  'Home': Home,
  'Globe': Globe,
  'Workflow': Workflow,
  'Database': Database,
  'HardDrive': HardDrive,
  'Users': Users,
  'Settings': Settings,
  'Map': Map,
  'Building': Building,
  'CreditCard': CreditCard,
  'Zap': Zap,
  'FolderOpen': FolderOpen,
  'Shield': Shield,
  'Tool': Wrench,
  'ExternalLink': ExternalLink
};

export function DynamicMenu({ 
  isSidebarOpen, 
  onNavigate 
}: { 
  isSidebarOpen: boolean; 
  onNavigate?: (path: string) => void; 
}) {
  const { data: session, status } = useSession();
  const [userPages, setUserPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);

  // Load pages based on authentication status
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.email) {
      // If authenticated, fetch user-specific pages (includes all accessible pages)
      fetchUserPages();
    } else if (status === 'unauthenticated') {
      // If not authenticated, fetch public pages only
      fetchPublicPages();
    }
    // Don't do anything while status is 'loading'
  }, [session, status]);

  const cleanAndNormalizePages = (pages: Page[]): Page[] => {
    // Category normalization mapping - removed forced mappings since users can now edit categories
    const categoryMapping: { [key: string]: string } = {
      // Add any category aliases here if needed
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

  const fetchPublicPages = async () => {
    try {
      // Fetch pages accessible to Public group (no auth needed)
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/pages/user-mysql/public@anonymous`, {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const pages = await response.json();
        const cleanedPages = cleanAndNormalizePages(pages);
        setUserPages(cleanedPages);
      }
    } catch (error) {
      console.error('Error fetching public pages:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserPages = async () => {
    try {
      if (!session?.user?.email) return;

      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/pages/user-mysql/${encodeURIComponent(session.user.email)}`, {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${btoa(JSON.stringify({ email: session.user.email, authenticated: true }))}`
        }
      });

      if (response.ok) {
        const pages = await response.json();
        console.log('🔍 DynamicMenu: Fetched user pages:', pages.length, pages.map((p: Page) => `${p.name} (${p.category})`));
        console.log('🔍 DynamicMenu: Full page data:', JSON.stringify(pages, null, 2));
        
        // Clean and normalize the data
        const cleanedPages = cleanAndNormalizePages(pages);
        console.log('🔍 DynamicMenu: After cleaning and normalizing:', cleanedPages.length, cleanedPages.map((p: Page) => `${p.name} (${p.category})`));
        console.log('🔍 DynamicMenu: Cleaned page paths:', cleanedPages.map((p: Page) => `${p.name} -> ${p.path}`));
        setUserPages(cleanedPages);
      } else {
        console.warn('Could not load user pages, keeping public pages');
      }
    } catch (error) {
      console.error('Error fetching user pages:', error);
    } finally {
      setLoading(false);
    }
  };

  const groupPagesByCategory = (pages: Page[]): GroupedPages => {
    const grouped = pages.reduce((groups, page) => {
      const category = page.category || 'Other';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(page);
      return groups;
    }, {} as GroupedPages);
    
    console.log('🔍 DynamicMenu: Grouped pages by category:', Object.keys(grouped).map(cat => `${cat}: ${grouped[cat].length} pages`));
    return grouped;
  };

  const handlePageClick = (page: Page) => {
    if (page.is_external && page.url) {
      window.open(page.url, '_blank', 'noopener,noreferrer');
    } else if (onNavigate) {
      onNavigate(page.path);
    }
  };

  if (loading) {
    return (
      <div className="p-4">
        {isSidebarOpen ? (
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="h-4 bg-muted rounded w-2/3"></div>
          </div>
        ) : (
          <div className="animate-pulse">
            <div className="h-8 w-8 bg-muted rounded"></div>
          </div>
        )}
      </div>
    );
  }

  const groupedPages = groupPagesByCategory(userPages);

  // Category ordering - put predefined categories first, then any others alphabetically
  const categoryOrder = ['Navigation', 'Projects', 'Hoyanger', 'Financial', 'Tools', 'Management', 'Debug', 'Development', 'Settings', 'External'];
  const predefinedCategories = categoryOrder.filter(cat => groupedPages[cat]);
  const otherCategories = Object.keys(groupedPages)
    .filter(cat => !categoryOrder.includes(cat))
    .sort();
  const orderedCategories = [...predefinedCategories, ...otherCategories];

  return (
    <div className="space-y-6">
      {orderedCategories.map((category) => (
        <div key={category} className="space-y-1">
          {/* Category Header */}
          {isSidebarOpen && (
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-2">
              {category}
            </h3>
          )}
          
          {/* Category Items */}
          <div className="space-y-1">
            {groupedPages[category].map((page) => {
              const IconComponent = iconMap[page.icon] || Globe;
              
              if (page.is_external && page.url) {
                return (
                  <button
                    key={page.Id || page.id}
                    onClick={() => handlePageClick(page)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-accent hover:text-accent-foreground group ${
                      !isSidebarOpen ? 'justify-center' : ''
                    }`}
                    title={!isSidebarOpen ? page.name : undefined}
                  >
                    <IconComponent className="h-5 w-5 flex-shrink-0" />
                    {isSidebarOpen && (
                      <>
                        <span className="flex-1 text-left">{page.name}</span>
                        <ExternalLink className="h-3 w-3 opacity-50 group-hover:opacity-100" />
                      </>
                    )}
                  </button>
                );
              } else {
                return (
                  <Link
                    key={page.Id || page.id}
                    href={page.path}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-accent hover:text-accent-foreground ${
                      !isSidebarOpen ? 'justify-center' : ''
                    }`}
                    title={!isSidebarOpen ? page.name : undefined}
                  >
                    <IconComponent className="h-5 w-5 flex-shrink-0" />
                    {isSidebarOpen && (
                      <span className="flex-1">{page.name}</span>
                    )}
                  </Link>
                );
              }
            })}
          </div>
        </div>
      ))}
      
      {/* Fallback message if no pages */}
      {userPages.length === 0 && (
        <div className="p-4 text-center text-muted-foreground">
          {isSidebarOpen ? (
            <div>
              <p className="text-sm">No accessible pages found.</p>
              <p className="text-xs mt-1">Contact admin to assign groups.</p>
            </div>
          ) : (
            <div className="h-8 w-8 bg-muted rounded flex items-center justify-center">
              <Settings className="h-4 w-4" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Hook for easy integration
export function useUserPages() {
  const { data: session } = useSession();
  const [userPages, setUserPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session?.user?.email) {
      fetchUserPages();
    } else {
      setLoading(false);
    }
  }, [session]);

  const fetchUserPages = async () => {
    try {
      if (!session?.user?.email) return;

      const response = await fetch('/api/proxy/nocodb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: `/pages/user/${encodeURIComponent(session.user.email)}`,
          method: 'GET'
        })
      });

      if (response.ok) {
        const pages = await response.json();
        setUserPages(pages);
      }
    } catch (error) {
      console.error('Error fetching user pages:', error);
    } finally {
      setLoading(false);
    }
  };

  return { userPages, loading, refetch: fetchUserPages };
}