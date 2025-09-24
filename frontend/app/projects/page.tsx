"use client";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { PlotDisplay } from './PlotDisplay';
import { WithScale42Access } from '@/components/WithScale42Access';

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
  return (
    // <WithScale42Access>
      <ProjectsPageContent />
    // </WithScale42Access>
  );
}

function ProjectsPageContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [allProjects, setAllProjects] = useState<ProjectData[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<ProjectData[]>([]);
  const [projectPartners, setProjectPartners] = useState<string[]>([]);
  const [selectedPartner, setSelectedPartner] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedPlotIds, setSelectedPlotIds] = useState<string[]>([]);  // Changed from selectedProjectIds
  const [plotsData, setPlotsData] = useState<PlotsResponse | null>(null);
  const [plotsLoading, setPlotsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [schemaData, setSchemaData] = useState<any[]>([]);
  const [schemaLoading, setSchemaLoading] = useState(false);
  
  // Sidebar state for filters
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  const [error, setError] = useState<string | null>(null);

  // Shared collapse state for all plots
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [collapsedSubcategories, setCollapsedSubcategories] = useState<Set<string>>(new Set());

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
    console.log('Loading from cookies:', savedSelections);
    if (savedSelections) {
      try {
        const parsed = JSON.parse(savedSelections);
        if (Array.isArray(parsed)) {
          console.log('Setting selectedPlotIds from cookies:', parsed);
          setSelectedPlotIds(parsed);
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
      console.log('Saved plot selections to cookies:', selectedPlotIds);
    }
  }, [selectedPlotIds]);

  // Load collapse state from cookies on mount
  useEffect(() => {
    const savedCategories = getCookie('collapsed-categories');
    const savedSubcategories = getCookie('collapsed-subcategories');
    
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
  }, []);

  // Save collapse state to cookies whenever it changes
  useEffect(() => {
    setCookie('collapsed-categories', JSON.stringify([...collapsedCategories]));
  }, [collapsedCategories]);

  useEffect(() => {
    setCookie('collapsed-subcategories', JSON.stringify([...collapsedSubcategories]));
  }, [collapsedSubcategories]);

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
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/projects/project-partners`
      );
      if (response.ok) {
        const data: ProjectPartnersResponse = await response.json();
        setProjectPartners(data.unique_project_partners || []);
      }
    } catch (err) {
      console.error('Error fetching project partners:', err);
    }
  };

  // Fetch all projects
  const fetchAllProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await makeAuthenticatedRequest(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/projects/projects`
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
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/projects/schema`
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
  const fetchPlotsData = async () => {
    if (selectedPlotIds.length === 0) {
      setPlotsData(null);
      return;
    }

    try {
      setPlotsLoading(true);
      console.log('Fetching plots data with IDs:', selectedPlotIds);
      
      // Convert S### format to numeric format for API (S013 -> 013, S001 -> 001)
      const formattedPlotIds = selectedPlotIds.map(siteId => formatPlotIdForAPI(siteId)).filter(id => id);
      const plotIdsParam = formattedPlotIds.join(',');
      
      console.log('Converted plot IDs for API:', formattedPlotIds, 'param:', plotIdsParam);
      
      const response = await makeAuthenticatedRequest(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/projects/plots?plot_ids=${encodeURIComponent(plotIdsParam)}`
      );
      
      if (response.ok) {
        const data = await response.json();
        console.log('Received consolidated plots data:', data);
        
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

  // Handle plot selection (store full S### format)
  const handlePlotSelection = (siteId: string, isSelected: boolean) => {
    setSelectedPlotIds(prev => {
      if (isSelected) {
        return [...prev, siteId]; // Store full site ID like "S013"
      } else {
        return prev.filter(id => id !== siteId);
      }
    });
  };

  // Clear plot selection
  const clearPlotSelection = () => {
    setSelectedPlotIds([]);
    setPlotsData(null);
    // Clear from cookies too
    setCookie('selectedPlotIds', '[]');
  };

  // Refresh plots data - useful for manual refresh
  const refreshPlotsData = async () => {
    if (selectedPlotIds.length > 0) {
      console.log('Manually refreshing plots data for IDs:', selectedPlotIds);
      await fetchPlotsData();
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

    // Filter by search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(project => {
        const searchableFields = [
          project["Project Name"] || "",
          project.Country || "",
          project["Primary Project Partner"] || ""
        ];
        return searchableFields.some(field => 
          field.toLowerCase().includes(searchLower)
        );
      });
    }

    setFilteredProjects(filtered);
  };

  // Handle partner filter change
  const handlePartnerFilter = (partner: string) => {
    setSelectedPartner(partner);
  };

  // Clear all filters
  const clearFilters = () => {
    setSelectedPartner("");
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
            console.log('Found saved plot IDs in cookies, restoring:', parsed);
            setSelectedPlotIds(parsed);
            // The useEffect for selectedPlotIds will handle the actual API call
          }
        } catch (error) {
          console.error('Failed to parse saved plot selections from cookies during init:', error);
        }
      }
    }
  }, [session]);

  // Filter projects when filters change
  useEffect(() => {
    if (allProjects.length > 0) {
      filterProjects();
    }
  }, [selectedPartner, searchTerm, allProjects]);

  // Fetch plots data when selected plot IDs change
  useEffect(() => {
    console.log('selectedPlotIds changed:', selectedPlotIds);
    if (selectedPlotIds.length > 0) {
      console.log('Calling fetchPlotsData with:', selectedPlotIds);
      fetchPlotsData();
    } else {
      console.log('No plots selected, clearing plotsData');
      setPlotsData(null);
    }
  }, [selectedPlotIds]);

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
                          const parentProject = plotsData.projects.length > 0 ? {
                            _db_id: plotsData.projects[0].id,
                            values: plotsData.projects[0].basic_data
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
          <div className="absolute right-0 top-0 h-full w-96 bg-background border-l border-border shadow-xl overflow-y-auto">
            {/* Sidebar Header */}
            <div className="sticky top-0 bg-background border-b border-border p-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Filters & Plot Selection</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(false)}
                className="h-8 w-8 p-0"
              >
                ✕
              </Button>
            </div>

            {/* Sidebar Content */}
            <div className="p-4 space-y-6">
              {/* Filtering Controls */}
              <div>
                <h3 className="text-md font-medium text-foreground mb-4">Filters</h3>
                <div className="space-y-4">
                  {/* Total Projects Display */}
                  <div className="text-sm text-muted-foreground">
                    {allProjects.length > 0 && (
                      <>Total: {allProjects.length} projects</>
                    )}
                  </div>

                  {/* Partner Dropdown */}
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

                  {/* Search Input */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Search Projects
                    </label>
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search by name, country, partner..."
                      className="w-full p-2 border border-border rounded-md bg-background text-foreground"
                    />
                  </div>

                  {/* Clear Filters */}
                  <Button
                    onClick={clearFilters}
                    variant="outline"
                    className="w-full"
                  >
                    Clear Filters
                  </Button>
                </div>
              </div>

              {/* Plot Selection Section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-md font-medium text-foreground">Plot Selection</h3>
                  {selectedPlotIds.length > 0 && (
                    <Button onClick={clearPlotSelection} variant="outline" size="sm">
                      Clear ({selectedPlotIds.length})
                    </Button>
                  )}
                </div>

                <div className="text-sm text-muted-foreground mb-4">
                  {!loading && filteredProjects.length > 0 && (
                    <>
                      Showing {filteredProjects.length} of {allProjects.length} projects
                      {selectedPartner && ` • Partner: ${selectedPartner}`}
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
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {filteredProjects.map((project: ProjectData) => (
                      <div 
                        key={project.Id}
                        className="bg-muted/30 rounded-lg border border-border p-3"
                      >
                        {/* Project Header */}
                        <div className="mb-2">
                          <div className="flex items-center gap-2 flex-wrap text-sm">
                            {/* Project ID */}
                            {project.P_PlotID && project.P_PlotID.length > 0 && (() => {
                              const projectIds = [...new Set(project.P_PlotID.map(plot => plot.project_id).filter(Boolean))];
                              return projectIds.length > 0 && (
                                <span className="inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full border border-green-200 dark:bg-green-900 dark:text-green-200">
                                  {projectIds[0]}
                                </span>
                              );
                            })()}
                            
                            {/* Country Badge */}
                            {project.Country && (
                              <span className="inline-block bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full border border-purple-200 dark:bg-purple-900 dark:text-purple-200">
                                {project.Country}
                              </span>
                            )}
                          </div>
                          
                          <div className="font-medium text-foreground text-sm mt-1">
                            {project['Project Name']}
                          </div>
                        </div>
                        
                        {/* Plots */}
                        {project.P_PlotID && project.P_PlotID.length > 0 && (
                          <div className="space-y-2">
                            {project.P_PlotID.map((plot, index) => (
                              <div 
                                key={index}
                                className="bg-background/60 rounded-md p-2 border border-border/30"
                              >
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={selectedPlotIds.includes(plot.site_id)}
                                    onChange={(e) => handlePlotSelection(plot.site_id, e.target.checked)}
                                    className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-primary"
                                  />
                                  <span className="text-xs font-mono bg-blue-100 text-blue-800 px-2 py-1 rounded dark:bg-blue-900 dark:text-blue-200">
                                    {plot.site_id}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {plot.plot_name}
                                  </span>
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

    </DashboardLayout>
  );
}