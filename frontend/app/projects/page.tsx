"use client";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { PlotDisplay } from './PlotDisplay';
import { WithPageAccess } from '@/components/WithPageAccess';
import { getUserGroups } from '@/lib/auth-utils';
import toast from 'react-hot-toast';

// Debug mode from environment
const DEBUG_MODE = process.env.NEXT_PUBLIC_DEBUG_MODE === 'true';
const debugLog = (...args: any[]) => {
  if (DEBUG_MODE) {
    debugLog(...args);
  }
};

debugLog('📄 projects/page.tsx: File loaded');

// Track plot selections with timestamps for order preservation
interface PlotSelection {
  id: string;
  selectedAt: number;
}

interface PlotData {
  raw: string;
  project_id: string;
  project_name: string;
  site_id: string;
  plot_name: string;
  formatted: string;
}

interface ProjectData {
  Id?: number;
  "Project Name"?: string;
  Country?: string;
  P_PlotID?: PlotData[];
  "Power Availability (Min)"?: string;
  "Power Availability (Max)"?: string;
  "Primary Project Partner"?: string;
  "Project Priority"?: number; // Updated field name
  "Status"?: string; // Updated field name
  "Agent"?: string; // Updated field name
}

interface ProjectsResponse {
  projects: ProjectData[];
  count: number;
  total_available: number;
  applied_filter?: string;
  source: string;
  fields: string[];
}

interface ProjectPartnersResponse {
  unique_project_partners: string[];
  count: number;
  source: string;
}

interface PlotField {
  field_name: string;
  field_type: string;
  value: any;
  category: string;
  subcategory: string;
  order: number;
  mapped: boolean;
  present: boolean;
  missing: boolean;
}

interface ProcessedProject {
  id: number;
  project_name: string;
  fields: PlotField[];
  basic_data?: any; // Raw project data from backend
}

interface ProcessedPlot {
  id: number;
  plot_id: string;
  parent_project_id?: number; // link to parent project id from backend
  fields: PlotField[];
  basic_data?: any; // Raw plot data from backend
}

interface DebugInfo {
  data_source_priority: string;
  total_schema_records: number;
  schema_field_names: string[];
  sample_plot_fields: string[];
  sample_project_fields: string[];
  total_schema_fields: number;
  schema_fields_by_table: {
    plots: string[];
    projects: string[];
  };
  missing_fields_analysis: {
    plot_fields_in_data: number;
    project_fields_in_data: number;
    schema_mapped_fields: number;
  };
}

interface PlotsResponse {
  plots: ProcessedPlot[];  // Plots first (primary data)
  projects: ProcessedProject[];  // Linked projects second
  selected_plot_ids: string[];  // Changed from selected_project_ids
  plots_count: number;
  projects_count: number;
  total_plots_available: number;
  total_projects_available: number;
  schema_fields_mapped: number;
  source: string;
  debug?: DebugInfo;
}

export default function ProjectsPage() {
  debugLog('📄 ProjectsPage: Component rendering');
  return (
    <WithPageAccess pagePath="/projects">
      <ProjectsPageContent />
    </WithPageAccess>
  );
}

function ProjectsPageContent() {
  debugLog('📄 ProjectsPageContent: Component rendering');
  const { data: session, status } = useSession();
  const router = useRouter();
  const [allProjects, setAllProjects] = useState<ProjectData[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<ProjectData[]>([]);
  const [projectPartners, setProjectPartners] = useState<string[]>([]);
  const [selectedPartner, setSelectedPartner] = useState<string>('');
  const [agents, setAgents] = useState<string[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedPlotIds, setSelectedPlotIds] = useState<string[]>([]);  // Changed from selectedProjectIds
  const [plotSelections, setPlotSelections] = useState<PlotSelection[]>([]); // Track selection order
  const [plotsData, setPlotsData] = useState<PlotsResponse | null>(null);
  const [plotsLoading, setPlotsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [schemaData, setSchemaData] = useState<any[]>([]);
  const [schemaLoading, setSchemaLoading] = useState(false);
  
  // Debounce timer for batch loading
  const loadDebounceTimer = useRef<NodeJS.Timeout | null>(null);
  const pendingPlotIds = useRef<Set<string>>(new Set());
  
  // State for user groups (will be fetched if not in session)
  const [userGroupsState, setUserGroupsState] = useState<string[]>([]);
  const [groupsLoaded, setGroupsLoaded] = useState(false);
  
  // Fetch user groups if not in session
  useEffect(() => {
    const fetchUserGroups = async () => {
      if (!session?.user?.email) {
        setGroupsLoaded(true);
        return;
      }
      
      // Check if groups are already in session
      const sessionGroups = getUserGroups(session);
      if (sessionGroups.length > 0) {
        debugLog('Groups found in session:', sessionGroups);
        setUserGroupsState(sessionGroups);
        setGroupsLoaded(true);
        return;
      }
      
      // If no groups in session, fetch from backend
      debugLog('No groups in session, fetching from backend...');
      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_BASE_URL || 'https://s42api.edbmotte.com';
        const response = await fetch(`${backendUrl}/auth/user-groups/${encodeURIComponent(session.user.email)}`);
        
        if (response.ok) {
          const userData = await response.json();
          debugLog('Fetched user groups from backend:', userData);
          const groups = userData.groups ? userData.groups.map((g: any) => g.name) : [];
          setUserGroupsState(groups);
          debugLog('Set user groups state:', groups);
        } else {
          console.error('Failed to fetch user groups:', response.status);
          setUserGroupsState([]);
        }
      } catch (error) {
        console.error('Error fetching user groups:', error);
        setUserGroupsState([]);
      } finally {
        setGroupsLoaded(true);
      }
    };
    
    fetchUserGroups();
  }, [session]);
  
  // Debug: Log plotsData structure when it changes
  useEffect(() => {
    if (plotsData) {
      debugLog('📊 plotsData structure:', plotsData);
      debugLog('📊 plotsData.plots:', plotsData.plots);
      debugLog('📊 plotsData.plots length:', plotsData.plots?.length);
      debugLog('📊 plotsData keys:', Object.keys(plotsData));
      debugLog('📊 Full plotsData JSON:', JSON.stringify(plotsData, null, 2));
    }
  }, [plotsData]);
  
  // Get user groups for role-based filtering - use state if available, fallback to session
  const userGroups = userGroupsState.length > 0 ? userGroupsState : (session ? getUserGroups(session) : []);
  const isAgentPeter = userGroups.some(group => group.toLowerCase() === 'agent peter');
  const isAgentfrost = userGroups.some(group => group.toLowerCase() === 'frost');
  const isAgentGiG = userGroups.some(group => group.toLowerCase() === 'gig');
  
  // Sidebar state for filters - automatically open when no sites are selected
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Effect to automatically open sidebar when no plots are selected
  useEffect(() => {
    if (selectedPlotIds.length === 0) {
      setSidebarOpen(true);
    }
  }, [selectedPlotIds]);
  
  const [error, setError] = useState<string | null>(null);

  // Shared collapse state for all plots
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [collapsedSubcategories, setCollapsedSubcategories] = useState<Set<string>>(new Set());
  const [collapsedActivityTimelines, setCollapsedActivityTimelines] = useState<Set<number>>(new Set());

  // Cookie utilities
  const setCookie = (name: string, value: string, days: number = 30) => {
    const expires = new Date();
    expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
  };

  const getCookie = (name: string): string | null => {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for(let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
  };

  // Load selected plot IDs from cookies on component mount
  useEffect(() => {
    const savedSelections = getCookie('selectedPlotIds');
    debugLog('Loading from cookies:', savedSelections);
    if (savedSelections) {
      try {
        const parsed = JSON.parse(savedSelections);
        if (Array.isArray(parsed)) {
          debugLog('Setting selectedPlotIds from cookies:', parsed);
          setSelectedPlotIds(parsed);
          
          // Restore selection order with timestamps (older selections get earlier timestamps)
          const baseTime = Date.now() - (parsed.length * 1000); // Space selections 1 second apart
          const selections: PlotSelection[] = parsed.map((id, index) => ({
            id,
            selectedAt: baseTime + (index * 1000)
          }));
          setPlotSelections(selections);
        }
      } catch (error) {
        console.error('Failed to parse saved plot selections from cookies:', error);
      }
    }
  }, []);
  
  // Save selected plot IDs to cookies whenever they change
  useEffect(() => {
    if (selectedPlotIds.length > 0) {
      setCookie('selectedPlotIds', JSON.stringify(selectedPlotIds));
      debugLog('Saved plot selections to cookies:', selectedPlotIds);
    }
  }, [selectedPlotIds]);

  // Load collapse state from cookies on mount
  useEffect(() => {
    const savedCategories = getCookie('collapsed-categories');
    const savedSubcategories = getCookie('collapsed-subcategories');
    const savedActivityTimelines = getCookie('collapsed-activity-timelines');
    
    if (savedCategories) {
      try {
        const parsed = JSON.parse(savedCategories);
        if (Array.isArray(parsed)) {
          setCollapsedCategories(new Set(parsed));
        }
      } catch (error) {
        console.warn('Failed to parse collapsed categories from cookie');
      }
    }
    
    if (savedSubcategories) {
      try {
        const parsed = JSON.parse(savedSubcategories);
        if (Array.isArray(parsed)) {
          setCollapsedSubcategories(new Set(parsed));
        }
      } catch (error) {
        console.warn('Failed to parse collapsed subcategories from cookie');
      }
    }

    if (savedActivityTimelines) {
      try {
        const parsed = JSON.parse(savedActivityTimelines);
        if (Array.isArray(parsed)) {
          setCollapsedActivityTimelines(new Set(parsed));
        }
      } catch (error) {
        console.warn('Failed to parse collapsed activity timelines from cookie');
      }
    }
  }, []);

  // Save collapse state to cookies whenever it changes
  useEffect(() => {
    setCookie('collapsed-categories', JSON.stringify([...collapsedCategories]));
  }, [collapsedCategories]);

  useEffect(() => {
    setCookie('collapsed-subcategories', JSON.stringify([...collapsedSubcategories]));
  }, [collapsedSubcategories]);

  useEffect(() => {
    setCookie('collapsed-activity-timelines', JSON.stringify([...collapsedActivityTimelines]));
  }, [collapsedActivityTimelines]);

  // Toggle functions for shared collapse state
  const handleToggleCategory = (category: string) => {
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

  const handleToggleSubcategory = (subcategoryKey: string) => {
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

  const handleToggleActivityTimeline = (plotId: number) => {
    setCollapsedActivityTimelines(prev => {
      const newSet = new Set(prev);
      if (newSet.has(plotId)) {
        // If this plot is collapsed, expand all plots (clear the set)
        return new Set();
      } else {
        // If this plot is expanded, collapse all plots (add all plot IDs)
        const allPlotIds = plotsData?.plots?.map((plot: any) => plot.id) || [];
        return new Set(allPlotIds);
      }
    });
  };

  useEffect(() => {
    if (status !== "loading" && !session) {
      router.push('/');
    }
  }, [session, status, router]);

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

  // Fetch project partners for dropdown
  const fetchProjectPartners = async () => {
    try {
      const response = await makeAuthenticatedRequest(
        `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/projects/project-partners`
      );
      if (response.ok) {
        const data: ProjectPartnersResponse = await response.json();
        setProjectPartners(data.unique_project_partners || []);
      }
    } catch (err) {
      console.error('Error fetching project partners:', err);
    }
  };

  // Fetch agents for dropdown
  const fetchAgents = () => {
    try {
      debugLog('Fetching agents from', allProjects.length, 'projects');
      
      // Extract unique agents from all projects
      const allAgents = allProjects.map(project => project.Agent);
      debugLog('All agent values:', allAgents);
      
      const uniqueAgents = Array.from(
        new Set(
          allProjects
            .map(project => project.Agent)
            .filter((agent): agent is string => agent !== undefined && agent !== null && agent.trim() !== '')
        )
      ).sort();
      
      debugLog('Unique agents found:', uniqueAgents);
      setAgents(uniqueAgents);
    } catch (err) {
      console.error('Error extracting agents:', err);
    }
  };

  // Fetch all projects
  const fetchAllProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await makeAuthenticatedRequest(
        `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/projects/projects`
      );
      
      if (response.ok) {
        const data: ProjectsResponse = await response.json();
        const projectsList = data.projects || [];
        setAllProjects(projectsList);
        setFilteredProjects(projectsList);
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch projects');
      setFilteredProjects([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch schema data
  const fetchSchemaData = async () => {
    try {
      setSchemaLoading(true);
      const response = await makeAuthenticatedRequest(
        `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/projects/schema`
      );
      
      if (response.ok) {
        const data = await response.json();
        setSchemaData(data.records || []);
      } else {
        console.error('Error fetching schema data:', response.status);
      }
    } catch (err) {
      console.error('Error fetching schema data:', err);
    } finally {
      setSchemaLoading(false);
    }
  };

  // Fetch plots data based on selected plot IDs - using consolidated backend endpoint
  // Ordered by selection time for better UX
  const fetchPlotsData = async () => {
    if (selectedPlotIds.length === 0) {
      setPlotsData(null);
      return;
    }

    try {
      setPlotsLoading(true);
      debugLog('Fetching plots data with IDs:', selectedPlotIds);
      
      // Get ordered plot IDs based on selection timestamps
      const orderedPlotIds = plotSelections
        .sort((a, b) => a.selectedAt - b.selectedAt)
        .map(sel => sel.id);
      
      // Convert S### format to numeric format for API (S013 -> 013, S001 -> 001)
      const formattedPlotIds = orderedPlotIds.map(siteId => formatPlotIdForAPI(siteId)).filter(id => id);
      const plotIdsParam = formattedPlotIds.join(',');
      
      debugLog('Ordered plot IDs for API:', formattedPlotIds, 'param:', plotIdsParam);
      
      const response = await makeAuthenticatedRequest(
        `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/projects/plots?plot_ids=${encodeURIComponent(plotIdsParam)}&preserve_order=true`
      );
      
      if (response.ok) {
        const data = await response.json();
        debugLog('Received consolidated plots data:', data);
        debugLog('📊 RAW data.data.projects:', data.data?.projects);
        debugLog('📊 First project structure:', data.data?.projects?.[0]);
        debugLog('📊 First project.plots:', data.data?.projects?.[0]?.plots);
        
        // Set schema data from the response
        if (data.schema) {
          setSchemaData(data.schema);
        }
        
        // Transform the new data structure to match expected format
        const transformedData: PlotsResponse = {
          plots: [], // Will be populated from projects.plots
          projects: [], // Will be populated from data.projects
          selected_plot_ids: selectedPlotIds,
          plots_count: 0,
          projects_count: data.data?.projects?.length || 0,
          total_plots_available: 0,
          total_projects_available: 0,
          schema_fields_mapped: data.schema?.length || 0,
          source: 'consolidated-endpoint'
        };
        
        // Process projects and extract plots
        if (data.data?.projects) {
          data.data.projects.forEach((project: any) => {
            // Add project to transformed data
            transformedData.projects.push({
              id: project._db_id,
              project_name: project.values?.c5udjaiacvutwek || `Project ${project._db_id}`,
              fields: [], // Will be populated if needed
              basic_data: project.values
            });
            
            // Add plots from this project
            if (project.plots && Array.isArray(project.plots)) {
              project.plots.forEach((plot: any) => {
                transformedData.plots.push({
                  id: plot._db_id,
                  plot_id: `S${String(plot._db_id).padStart(3, '0')}`,
                  parent_project_id: project._db_id,
                  fields: [], // Will be populated if needed
                  basic_data: plot.values
                });
              });
            }
          });
        }
        
        transformedData.plots_count = transformedData.plots.length;
        transformedData.total_plots_available = transformedData.plots.length;
        
        setPlotsData(transformedData);
      } else {
        console.error('Error fetching plots data:', response.status);
        const errorText = await response.text();
        console.error('Error response:', errorText);
        setPlotsData(null);
      }
      
    } catch (err) {
      console.error('Error fetching plots data:', err);
      setPlotsData(null);
    } finally {
      setPlotsLoading(false);
    }
  };

  // Helper function to extract numeric ID from site_id (S013 -> 13)
  const extractNumericId = (siteId: string): string => {
    if (!siteId) return '';
    const match = siteId.match(/S(\d+)/);
    return match ? match[1] : '';
  };

  // Helper function to format numeric ID for API (S013 -> "13", S001 -> "1")
  const formatPlotIdForAPI = (siteId: string): string => {
    const numericId = extractNumericId(siteId);
    if (!numericId) return '';
    return parseInt(numericId, 10).toString(); // Convert to number then back to string to remove leading zeros
  };

  // Handle plot selection (store full S### format with timestamp for ordering)
  const handlePlotSelection = (siteId: string, isSelected: boolean) => {
    const now = Date.now();
    
    setSelectedPlotIds(prev => {
      if (isSelected) {
        return [...prev, siteId]; // Store full site ID like "S013"
      } else {
        return prev.filter(id => id !== siteId);
      }
    });
    
    setPlotSelections(prev => {
      if (isSelected) {
        // Add new selection with current timestamp
        return [...prev, { id: siteId, selectedAt: now }];
      } else {
        // Remove from selections
        return prev.filter(sel => sel.id !== siteId);
      }
    });
    
    // Debounce the actual data fetch to batch rapid selections
    if (loadDebounceTimer.current) {
      clearTimeout(loadDebounceTimer.current);
    }
    
    if (isSelected) {
      pendingPlotIds.current.add(siteId);
    } else {
      pendingPlotIds.current.delete(siteId);
    }
    
    // Wait 300ms for more selections before fetching
    loadDebounceTimer.current = setTimeout(() => {
      debugLog('Debounce timer fired, fetching plots');
      pendingPlotIds.current.clear();
      // The useEffect will trigger fetchPlotsData when selectedPlotIds changes
    }, 300);
  };

  // Clear plot selection
  const clearPlotSelection = () => {
    setSelectedPlotIds([]);
    setPlotSelections([]);
    setPlotsData(null);
    pendingPlotIds.current.clear();
    if (loadDebounceTimer.current) {
      clearTimeout(loadDebounceTimer.current);
    }
    // Clear from cookies too
    setCookie('selectedPlotIds', '[]');
  };

  // Refresh plots data - useful for manual refresh
  const refreshPlotsData = async () => {
    if (selectedPlotIds.length > 0) {
      debugLog('Manually refreshing plots data for IDs:', selectedPlotIds);
      await fetchPlotsData();
    }
  };

  // Handle status update for project
  const handleStatusUpdate = async (projectId: number, newStatus: string) => {
    if (!session?.user?.email) {
      toast.error('No session available');
      return;
    }

    try {
      const userInfo = {
        email: session.user.email,
        name: session.user.name || session.user.email,
        image: session.user.image || ""
      };
      const authHeader = `Bearer ${btoa(JSON.stringify(userInfo))}`;

      const response = await fetch('/api/proxy/nocodb/update-row', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify({
          table_id: 'mftsk8hkw23m8q1', // Projects table ID
          row_id: projectId,
          field_data: {
            'c5l916pwjdtz3tk': newStatus // Status field ID
          }
        })
      });

      if (response.ok) {
        toast.success(`Status updated to: ${newStatus}`);
        // Refresh the projects list to show the updated status
        await fetchAllProjects();
      } else {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        toast.error(errorData.detail || `Failed to update status (${response.status})`);
        console.error('Error details:', response.status, errorData);
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status. Check console for details.');
    }
  };

  // Filter projects based on selected partner and search term
  const filterProjects = () => {
    let filtered = [...allProjects];

    // Filter by partner
    if (selectedPartner) {
      filtered = filtered.filter(project => 
        project["Primary Project Partner"] === selectedPartner
      );
    }

    // Filter by agent
    if (selectedAgent) {
      filtered = filtered.filter(project => 
        project.Agent === selectedAgent
      );
    }

    // Filter by search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(project => {
        const searchableFields = [
          project["Project Name"] || "",
          project.Country || "",
          project["Primary Project Partner"] || "",
          project.Agent || ""
        ];
        return searchableFields.some(field => 
          field.toLowerCase().includes(searchLower)
        );
      });
    }

    // Sort by Project Priority - higher priority first
    filtered.sort((a, b) => {
      const priorityA = a["Project Priority"] || 0;
      const priorityB = b["Project Priority"] || 0;
      return priorityB - priorityA; // Descending order (higher priority first)
    });

    setFilteredProjects(filtered);
  };

  // Handle partner filter change
  const handlePartnerFilter = (partner: string) => {
    setSelectedPartner(partner);
    
    // Clear selected plots that don't belong to projects matching the filters
    if (selectedPlotIds.length > 0) {
      let filteredProjects = allProjects;
      
      // Apply partner filter
      if (partner) {
        filteredProjects = filteredProjects.filter(project => 
          project["Primary Project Partner"] === partner
        );
      }
      
      // Apply existing agent filter
      if (selectedAgent) {
        filteredProjects = filteredProjects.filter(project => 
          project.Agent === selectedAgent
        );
      }
      
      // Get valid plot IDs from filtered projects
      const validPlotIds = filteredProjects
        .flatMap(project => project.P_PlotID || [])
        .map(plot => plot.site_id);
      
      setSelectedPlotIds(prev => 
        prev.filter(plotId => validPlotIds.includes(plotId))
      );
    }
  };

  // Handle agent filter change
  const handleAgentFilter = (agent: string) => {
    setSelectedAgent(agent);
    
    // Clear selected plots that don't belong to projects matching the filters
    if (selectedPlotIds.length > 0) {
      let filteredProjects = allProjects;
      
      // Apply existing partner filter
      if (selectedPartner) {
        filteredProjects = filteredProjects.filter(project => 
          project["Primary Project Partner"] === selectedPartner
        );
      }
      
      // Apply agent filter
      if (agent) {
        filteredProjects = filteredProjects.filter(project => 
          project.Agent === agent
        );
      }
      
      // Get valid plot IDs from filtered projects
      const validPlotIds = filteredProjects
        .flatMap(project => project.P_PlotID || [])
        .map(plot => plot.site_id);
      
      setSelectedPlotIds(prev => 
        prev.filter(plotId => validPlotIds.includes(plotId))
      );
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setSelectedPartner("");
    setSelectedAgent("");
    setSearchTerm("");
  };

  // Initialize data on component mount
  useEffect(() => {
    if (session) {
      fetchProjectPartners();
      fetchAllProjects();
      fetchSchemaData();
      
      // Check if there are saved plot IDs in cookies and restore them
      const savedPlotIds = getCookie('selectedPlotIds');
      if (savedPlotIds) {
        try {
          const parsed = JSON.parse(savedPlotIds);
          if (Array.isArray(parsed) && parsed.length > 0) {
            debugLog('Found saved plot IDs in cookies, restoring:', parsed);
            setSelectedPlotIds(parsed);
            // The useEffect for selectedPlotIds will handle the actual API call
          }
        } catch (error) {
          console.error('Failed to parse saved plot selections from cookies during init:', error);
        }
      }
    }
  }, [session]);

  // Apply group-based filtering for Agent Peter users
  useEffect(() => {
    if (isAgentPeter && allProjects.length > 0) {
      debugLog('🔐 Agent Peter detected: Auto-applying filters');
      // Lock to "Peter Sladey - NMG Estonia" agent filter
      setSelectedAgent('Peter Sladey - NMG Estonia');
      // Partner filter stays empty (All Partners)
      setSelectedPartner('');
    }
  }, [isAgentPeter, allProjects.length]);

  // Apply group-based filtering for Frost users
  useEffect(() => {
    if (isAgentfrost && allProjects.length > 0) {
      debugLog('🔐 Frost user detected: Auto-applying filters');
      // Lock to "Bifrost" partner filter
      setSelectedPartner('Bifrost');
      // Agent filter stays empty (All Agents)
      setSelectedAgent('');
    }
  }, [isAgentfrost, allProjects.length]);

  // Apply group-based filtering for GiG users
  useEffect(() => {
    if (isAgentGiG && allProjects.length > 0) {
      debugLog('🔐 GiG user detected: Auto-applying filters');
      // Lock to "GIGA-42" partner filter
      setSelectedPartner('GIGA-42');
      // Agent filter stays empty (All Agents)
      setSelectedAgent('');
    }
  }, [isAgentGiG, allProjects.length]);

  // Filter projects when filters change
  useEffect(() => {
    if (allProjects.length > 0) {
      fetchAgents(); // Extract agents when projects are loaded
      filterProjects();
    }
  }, [selectedPartner, selectedAgent, searchTerm, allProjects]);

  // Fetch plots data when selected plot IDs change
  useEffect(() => {
    debugLog('selectedPlotIds changed:', selectedPlotIds);
    if (selectedPlotIds.length > 0 && session) {
      debugLog('Calling fetchPlotsData with:', selectedPlotIds);
      fetchPlotsData();
    } else {
      debugLog('No plots selected or no session, clearing plotsData');
      setPlotsData(null);
    }
  }, [selectedPlotIds, session]);

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
            <h1 className="text-3xl font-bold text-foreground">Projects Management</h1>
              <p className="mt-2 text-muted-foreground">Manage and monitor your renewable energy projects with advanced filtering</p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setSidebarOpen(true)}
                variant="outline"
                className="flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                </svg>
                Filters & Plot Selection
              </Button>
              <Button
                onClick={fetchAllProjects}
                disabled={loading}
                variant="outline"
              >
                {loading ? 'Loading...' : 'Refresh Projects'}
              </Button>
            </div>
          </div>


        {/* Filtering Controls moved to slide-in sidebar */}

        {/* Plots Results Section */}
        {selectedPlotIds.length > 0 && (
          <div className="bg-card shadow-sm rounded-lg p-6 border border-border">
            {plotsLoading && (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <span className="ml-2 text-muted-foreground">Loading detailed plots data...</span>
              </div>
            )}

            {!plotsLoading && plotsData && (
              <div className="space-y-6">
                {/* Plots Data with Schema Layout */}
                {plotsData.plots.length > 0 && (
                  <div>
                    <div className="flex gap-4 overflow-x-auto pb-4">
                      {(() => {
                        // Pre-calculate field heights for alignment across plots
                        const fieldHeights: { [fieldId: string]: number } = {};
                        
                        // Calculate content length for each field across all plots
                        plotsData.plots.forEach((plot) => {
                          const plotSchema = (schemaData || []).filter(field => field.Table === "Land Plots, Sites");
                          plotSchema.forEach((field) => {
                            const fieldId = field["Field ID"];
                            const fieldValue = plot.basic_data?.[fieldId];
                            const contentLength = fieldValue !== null && fieldValue !== undefined ? 
                              (Array.isArray(fieldValue) ? fieldValue.join(', ').length : String(fieldValue).length) : 
                              3; // "N/A" length
                            
                            // Estimate height based on content length (rough approximation)
                            const estimatedHeight = Math.max(60, Math.min(120, 60 + Math.floor(contentLength / 50) * 20));
                            fieldHeights[fieldId] = Math.max(fieldHeights[fieldId] || 60, estimatedHeight);
                          });
                        });

                        // Also calculate for project fields if available
                        if (plotsData.projects.length > 0) {
                          const projectSchema = (schemaData || []).filter(field => field.Table === "Projects");
                          const parentProject = plotsData.projects[0];
                          projectSchema.forEach((field) => {
                            const fieldId = field["Field ID"];
                            const fieldValue = parentProject.basic_data?.[fieldId];
                            const contentLength = fieldValue !== null && fieldValue !== undefined ? 
                              (Array.isArray(fieldValue) ? fieldValue.join(', ').length : String(fieldValue).length) : 
                              3;
                            
                            const estimatedHeight = Math.max(60, Math.min(120, 60 + Math.floor(contentLength / 50) * 20));
                            fieldHeights[`project-${fieldId}`] = Math.max(fieldHeights[`project-${fieldId}`] || 60, estimatedHeight);
                          });
                        }

                        return plotsData.plots.map((plot) => {
                          // Resolve the correct parent project per plot using stored parent_project_id
                          const matchingProject = plotsData.projects.find(p => p.id === (plot as any).parent_project_id);
                          const parentProject = matchingProject ? {
                            _db_id: matchingProject.id,
                            values: matchingProject.basic_data
                          } : undefined;

                          return (
                            <PlotDisplay
                              key={plot.id}
                              plot={plot}
                              parentProject={parentProject}
                              schema={schemaData || []}
                              fieldHeights={fieldHeights}
                              collapsedCategories={collapsedCategories}
                              collapsedSubcategories={collapsedSubcategories}
                              onToggleCategory={handleToggleCategory}
                              onToggleSubcategory={handleToggleSubcategory}
                              collapsedActivityTimelines={collapsedActivityTimelines}
                              onToggleActivityTimeline={handleToggleActivityTimeline}
                              onDataUpdate={refreshPlotsData}
                            />
                          );
                        });
                      })()}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!plotsLoading && !plotsData && (
              <div className="text-center py-8 text-muted-foreground">
                <p>No data available for selected plots</p>
              </div>
            )}
          </div>
        )}
      </div>
      {/* Slide-in Sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
          
          {/* Sidebar */}
          <div className="absolute right-0 top-0 h-full w-96 md:w-1/2 md:min-w-96 bg-background border-l border-border shadow-xl overflow-y-auto custom-scrollbar">


            {/* Sidebar Content */}
            <div className="p-4 h-full flex flex-col">
              {/* Filtering Controls */}
              <div className="space-y-4 mb-6">
                {/* Partner Dropdown - Hidden for Agent Peter, Frost, and GiG */}
                {!isAgentPeter && !isAgentfrost && !isAgentGiG && (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Project Partner
                    </label>
                    <select
                      value={selectedPartner}
                      onChange={(e) => handlePartnerFilter(e.target.value)}
                      className="w-full p-2 border border-border rounded-md bg-background text-foreground"
                    >
                      <option value="">All Partners</option>
                      {projectPartners.map((partner) => (
                        <option key={partner} value={partner}>
                          {partner}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Agent Dropdown - Hidden for Agent Peter, Frost, and GiG */}
                {!isAgentPeter && !isAgentfrost && !isAgentGiG && (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Agent
                    </label>
                    <select
                      value={selectedAgent}
                      onChange={(e) => handleAgentFilter(e.target.value)}
                      className="w-full p-2 border border-border rounded-md bg-background text-foreground"
                    >
                      <option value="">All Agents</option>
                      {agents.map((agent) => (
                        <option key={agent} value={agent}>
                          {agent}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Show active filters for Agent Peter users */}
                {isAgentPeter && (
                  <div className="bg-accent/50 border border-border rounded-md p-3">
                    <p className="text-sm font-medium text-foreground mb-2">Active Filters:</p>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <p>• Agent: <span className="text-foreground">Peter Sladey - NMG Estonia</span></p>
                    </div>
                  </div>
                )}

                {/* Show active filters for Frost users */}
                {isAgentfrost && (
                  <div className="bg-accent/50 border border-border rounded-md p-3">
                    <p className="text-sm font-medium text-foreground mb-2">Active Filters:</p>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <p>• Partner: <span className="text-foreground">Bifrost</span></p>
                    </div>
                  </div>
                )}

                {/* Show active filters for GiG users */}
                {isAgentGiG && (
                  <div className="bg-accent/50 border border-border rounded-md p-3">
                    <p className="text-sm font-medium text-foreground mb-2">Active Filters:</p>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <p>• Partner: <span className="text-foreground">GIGA-42</span></p>
                    </div>
                  </div>
                )}

                {/* Search Input */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Search Projects
                  </label>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by name, country, partner, agent..."
                    className="w-full p-2 border border-border rounded-md bg-background text-foreground"
                  />
                </div>

                {/* Clear Filters - Only show search clear for Agent Peter, Frost, and GiG */}
                {!isAgentPeter && !isAgentfrost && !isAgentGiG && (
                  <Button
                    onClick={clearFilters}
                    variant="outline"
                    className="w-full"
                  >
                    Clear Filters
                  </Button>
                )}
                {(isAgentPeter || isAgentfrost || isAgentGiG) && searchTerm && (
                  <Button
                    onClick={() => setSearchTerm('')}
                    variant="outline"
                    className="w-full"
                  >
                    Clear Search
                  </Button>
                )}
              </div>

              {/* Plot Selection Section */}
              <div className="flex flex-col flex-1 min-h-0">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-md font-medium text-foreground">Plot Selection</h3>
                  {selectedPlotIds.length > 0 && (
                    <Button onClick={clearPlotSelection} variant="outline" size="sm">
                      Clear Plot Selection ({selectedPlotIds.length})
                    </Button>
                  )}
                </div>

                <div className="text-sm text-muted-foreground mb-4">
                  {!loading && filteredProjects.length > 0 && (
                    <>
                      Showing {filteredProjects.length} projects
                      {selectedPartner && ` • Partner: ${selectedPartner}`}
                      {selectedAgent && ` • Agent: ${selectedAgent}`}
                      {searchTerm && ` • Search: "${searchTerm}"`}
                    </>
                  )}
                </div>

                {loading && (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                    <span className="ml-2 text-muted-foreground text-sm">Loading...</span>
                  </div>
                )}

                {error && (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 mb-4">
                    <h4 className="text-destructive font-medium mb-1 text-sm">Error Loading Projects</h4>
                    <p className="text-destructive/80 text-xs">{error}</p>
                    <Button 
                      onClick={fetchAllProjects} 
                      variant="outline" 
                      size="sm" 
                      className="mt-2"
                    >
                      Try Again
                    </Button>
                  </div>
                )}

                {!loading && !error && filteredProjects.length === 0 && (
                  <div className="text-center py-6 text-muted-foreground">
                    <p className="text-sm">No projects found</p>
                    <Button 
                      onClick={clearFilters}
                      variant="outline"
                      size="sm"
                      className="mt-2"
                    >
                      Clear All Filters
                    </Button>
                  </div>
                )}

                {/* Projects List for Selection */}
                {!loading && filteredProjects.length > 0 && (
                  <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar">
                    {filteredProjects.map((project: ProjectData) => (
                      <div 
                        key={project.Id}
                        className="bg-muted/30 rounded-lg border border-border p-1"
                      >

                            
                        
                        {/* Plots - Now Clickable */}
                        {project.P_PlotID && project.P_PlotID.length > 0 && (
                          <div className="space-y-2">
                            {project.P_PlotID.map((plot, index) => (
                              <div 
                                key={index}
                                onClick={() => handlePlotSelection(plot.site_id, !selectedPlotIds.includes(plot.site_id))}
                                className={`rounded-md p-1 border cursor-pointer transition-all duration-200 ${
                                  selectedPlotIds.includes(plot.site_id)
                                    ? 'bg-primary/10 border-primary/50 shadow-md'
                                    : 'bg-background/60 border-border/30 hover:bg-background/80 hover:border-border/60'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  {/* Selection Indicator */}
                                  <div className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                                    selectedPlotIds.includes(plot.site_id)
                                      ? 'bg-primary border-primary'
                                      : 'border-muted-foreground'
                                  }`}>
                                    {selectedPlotIds.includes(plot.site_id) && (
                                      <div className="w-full h-full rounded-full bg-white scale-50"></div>
                                    )}
                                  </div>
                                  
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                      <span className="text-sm font-mono bg-blue-100 text-blue-800 px-2 py-1 rounded dark:bg-blue-900 dark:text-blue-200">
                                        {plot.site_id}
                                      </span>
                                      <span className="text-sm text-foreground font-medium">
                                        {plot.plot_name}
                                      </span>
                                      {/* Project ID and Project Name in same bubble */}
                                      {project.P_PlotID && project.P_PlotID.length > 0 && (() => {
                                        const projectIds = [...new Set(project.P_PlotID.map(plot => plot.project_id).filter(Boolean))];
                                        return projectIds.length > 0 && (
                                          <span className="inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full border border-green-200 dark:bg-green-900 dark:text-green-200">
                                            {projectIds[0]} - {project['Project Name']}
                                          </span>
                                        );
                                      })()}
                                      {/* Project details inline at the end */}
                                      {/* Power availability bubble */}
                                      {(project["Power Availability (Min)"] || project["Power Availability (Max)"]) && (
                                        <span className="inline-block bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full border border-orange-200 dark:bg-orange-900 dark:text-orange-200">
                                          {project["Power Availability (Min)"] && project["Power Availability (Max)"] 
                                            ? `${project["Power Availability (Min)"]}-${project["Power Availability (Max)"]} MW`
                                            : project["Power Availability (Min)"] 
                                              ? `${project["Power Availability (Min)"]} MW`
                                              : `${project["Power Availability (Max)"]} MW`
                                          }
                                        </span>
                                      )}
                                      {/* Country Badge */}
                                      {project.Country && (
                                        <span className="inline-block bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full border border-purple-200 dark:bg-purple-900 dark:text-purple-200">
                                          {project.Country}
                                        </span>
                                      )}
                                      {/* Status dropdown - only on first plot */}
                                      {index === 0 && project["Status"] && project.Id && (
                                        <div className="ml-auto">
                                          <select
                                            value={project["Status"]}
                                            onChange={(e) => {
                                              e.stopPropagation();
                                              handleStatusUpdate(project.Id!, e.target.value);
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                            className="text-xs px-2 py-1 rounded border border-border bg-background text-foreground hover:bg-accent/20 transition-colors cursor-pointer"
                                          >
                                            <option value="Underway">Underway</option>
                                            <option value="Closed">Closed</option>
                                            <option value="On Hold">On Hold</option>
                                            <option value="Completed">Completed</option>
                                            <option value="Cancelled">Cancelled</option>
                                          </select>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Scrollbar Styles */}
      <style jsx global>{`
        .custom-scrollbar {
          scrollbar-width: thick;
          scrollbar-color: hsl(var(--muted-foreground)) hsl(var(--muted));
        }
        
        .custom-scrollbar::-webkit-scrollbar {
          width: 16px;
          height: 16px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-track {
          background: hsl(var(--muted));
          border-radius: 8px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: hsl(var(--muted-foreground));
          border-radius: 8px;
          border: 2px solid hsl(var(--muted));
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: hsl(var(--foreground));
        }
        
        .custom-scrollbar::-webkit-scrollbar-corner {
          background: hsl(var(--muted));
        }
      `}</style>

    </DashboardLayout>
  );
}
