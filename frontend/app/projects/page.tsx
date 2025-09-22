"use client";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';

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
  
  // Load selected plot IDs from localStorage on component mount
  useEffect(() => {
    const savedSelections = localStorage.getItem('selectedPlotIds');  // Changed key
    console.log('Loading from localStorage:', savedSelections);
    if (savedSelections) {
      try {
        const parsed = JSON.parse(savedSelections);
        if (Array.isArray(parsed)) {
          console.log('Setting selectedPlotIds from localStorage:', parsed);
          setSelectedPlotIds(parsed);
        }
      } catch (error) {
        console.error('Failed to parse saved plot selections:', error);
      }
    }
  }, []);
  
  // Save selected plot IDs to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('selectedPlotIds', JSON.stringify(selectedPlotIds));  // Changed key
  }, [selectedPlotIds]);
  const [error, setError] = useState<string | null>(null);

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

  // Fetch plots data based on selected plot IDs - using backend endpoint
  const fetchPlotsData = async () => {
    if (selectedPlotIds.length === 0) {
      setPlotsData(null);
      return;
    }

    try {
      setPlotsLoading(true);
      console.log('Fetching plots data with IDs:', selectedPlotIds);
      
      // Call backend endpoint with selected plot IDs
      const plotIdsParam = selectedPlotIds.join(',');
      const response = await makeAuthenticatedRequest(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/projects/plots?plot_ids=${encodeURIComponent(plotIdsParam)}`
      );
      
      if (response.ok) {
        const data: PlotsResponse = await response.json();
        console.log('Received plots data:', data);
        setPlotsData(data);
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

  // Handle plot selection (now selecting individual plots by numeric Site ID)
  const handlePlotSelection = (plotId: string, isSelected: boolean) => {
    setSelectedPlotIds(prev => {
      if (isSelected) {
        return [...prev, plotId];
      } else {
        return prev.filter(id => id !== plotId);
      }
    });
  };

  // Clear plot selection
  const clearPlotSelection = () => {
    setSelectedPlotIds([]);
    setPlotsData(null);
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
              onClick={fetchAllProjects}
              disabled={loading}
              variant="outline"
            >
              {loading ? 'Loading...' : 'Refresh Projects'}
            </Button>
          </div>
        </div>

        {/* Filtering Controls */}
        <div className="bg-card shadow-sm rounded-lg p-6 border border-border">
          <h2 className="text-lg font-medium text-foreground mb-4">Filters</h2>
          
          <div className="grid gap-4 md:grid-cols-3">
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
            <div className="flex items-end">
              <Button
                onClick={clearFilters}
                variant="outline"
                className="w-full"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </div>

        {/* Projects Display Section */}
        <div className="bg-card shadow-sm rounded-lg p-6 border border-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-foreground">Plots Selection</h2>
            <div className="flex items-center gap-4">
              {selectedPlotIds.length > 0 && (
                <Button onClick={clearPlotSelection} variant="outline" size="sm">
                  Clear Selection ({selectedPlotIds.length})
                </Button>
              )}
              <div className="text-sm text-muted-foreground">
                {!loading && filteredProjects.length > 0 && (
                  <>
                    Showing {filteredProjects.length} of {allProjects.length} projects
                    {selectedPartner && ` • Partner: ${selectedPartner}`}
                    {searchTerm && ` • Search: "${searchTerm}"`}
                  </>
                )}
              </div>
            </div>
          </div>
          
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-2 text-muted-foreground">Fetching projects...</span>
            </div>
          )}

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-1 mb-4">
              <h3 className="text-destructive font-medium mb-2">Error Loading Projects</h3>
              <p className="text-destructive/80 text-sm">{error}</p>
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
            <div className="text-center py-8 text-muted-foreground">
              <p>No projects found for current filters</p>
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

          {!loading && filteredProjects.length > 0 && (
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {filteredProjects.map((project: ProjectData) => (
                <div 
                  key={project.Id}
                  className="bg-muted/50 rounded-lg border border-border hover:shadow-md transition-all p-1"
                >
                  {/* Project Header */}
                  <div className="border-b border-border/50">
                    <div className="flex items-center gap-4 flex-wrap">

                      
                      {/* Project ID */}
                      {project.P_PlotID && project.P_PlotID.length > 0 && (() => {
                        const projectIds = [...new Set(project.P_PlotID.map(plot => plot.project_id).filter(Boolean))];
                        return projectIds.length > 0 && (
                          <span className="inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full border border-green-200 dark:bg-green-900 dark:text-green-200">
                            {projectIds[0]}
                          </span>
                        );
                      })()}
                      
                      {/* Project Name */}
                      <div className="font-medium text-foreground text-base">
                        {project['Project Name']}
                      </div>
                      
                      {/* Country Badge */}
                      {project.Country && (
                        <span className="inline-block bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full border border-purple-200 dark:bg-purple-900 dark:text-purple-200">
                          {project.Country}
                        </span>
                      )}
                      
                      {/* Power Availability */}
                      {(project['Power Availability (Min)'] || project['Power Availability (Max)']) && (
                        <div className="text-sm text-muted-foreground">
                          <span className="font-medium">Power:</span> {project['Power Availability (Min)']} - {project['Power Availability (Max)']} MW
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Plots Section */}
                  {project.P_PlotID && project.P_PlotID.length > 0 && (
                    <div>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {project.P_PlotID.map((plot, index) => (
                          <div 
                            key={index}
                            className="bg-background/60 rounded-md p-2 border border-border/30"
                          >
                            <div className="flex items-center gap-2 flex-wrap">
                              {/* Site ID Bubble */}
                              {(() => {
                                const numericId = extractNumericId(plot.site_id);
                                return (
                                  <input
                                    type="checkbox"
                                    checked={selectedPlotIds.includes(numericId)}
                                    onChange={(e) => handlePlotSelection(numericId, e.target.checked)}
                                    className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-primary"
                                  />
                                );
                              })()}
                              {plot.site_id && (
                                <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full border border-blue-200 dark:bg-blue-900 dark:text-blue-200">
                                  {plot.site_id}
                                </span>
                              )}
                              
                              {/* Plot Name */}
                              <span className="text-xs text-foreground font-medium">
                                {plot.plot_name}
                              </span>
                            </div>
                            
                            {/* Project Name (if different from main project) */}
                            {plot.project_name && plot.project_name !== project['Project Name'] && (
                              <div className="text-xs text-muted-foreground mt-1">
                                {plot.project_name}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Plots Results Section */}
        {selectedPlotIds.length > 0 && (
          <div className="bg-card shadow-sm rounded-lg p-6 border border-border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-foreground">Plot Results</h2>
              <div className="text-sm text-muted-foreground">
                {plotsData && (
                  <>
                    {plotsData.plots_count} plots, {plotsData.projects_count} linked projects
                    {plotsData.schema_fields_mapped > 0 && ` • ${plotsData.schema_fields_mapped} schema fields mapped`}
                  </>
                )}
              </div>
            </div>

            {plotsLoading && (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <span className="ml-2 text-muted-foreground">Loading detailed plots data...</span>
              </div>
            )}

            {!plotsLoading && plotsData && (
              <div className="space-y-6">
                {/* Debug Information */}
                {plotsData.debug && (
                  <div className="bg-muted/20 rounded-lg p-3 border border-border/30">
                    <h4 className="text-sm font-medium text-foreground mb-2">Debug Info - {plotsData.debug.data_source_priority}</h4>
                    <div className="grid gap-1 text-xs text-muted-foreground">
                      <div>Schema fields mapped: {plotsData.schema_fields_mapped}</div>
                      <div>Total schema records: {plotsData.debug.total_schema_records}</div>
                      <div>Total schema fields: {plotsData.debug.total_schema_fields}</div>
                      <div>Plot fields in data: {plotsData.debug.missing_fields_analysis?.plot_fields_in_data || 0}</div>
                      <div>Project fields in data: {plotsData.debug.missing_fields_analysis?.project_fields_in_data || 0}</div>
                      <div>Schema plots fields: {plotsData.debug.schema_fields_by_table?.plots?.length || 0}</div>
                      <div>Schema projects fields: {plotsData.debug.schema_fields_by_table?.projects?.length || 0}</div>
                    </div>
                  </div>
                )}

                {/* Plots Data with Schema Layout */}
                {plotsData.plots.length > 0 && (
                  <div>
                    <h3 className="text-md font-medium text-foreground mb-3">Land Plots Data</h3>
                    <div className="space-y-4">
                      {plotsData.plots.map((plot) => (
                        <div key={plot.id} className="bg-muted/30 rounded-lg p-4 border border-border/50">
                          {/* Plot Header */}
                          <div className="font-medium text-lg text-foreground mb-3 border-b border-border/20 pb-2">
                            Plot: {plot.plot_id || plot.id}
                          </div>
                          
                          {/* Schema Fields with Inline Data Values */}
                          <div className="bg-background/50 rounded-md p-3 border border-border/30">
                            <h4 className="text-sm font-medium text-foreground mb-2">Schema Fields with Data Values</h4>
                            
                            {/* Debug: Show available field names */}
                            <div className="mb-4 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                              <div className="font-medium text-yellow-800 mb-1">Debug Info:</div>
                              <div className="text-yellow-700">
                                <div>Plot fields available: {plot.basic_data ? Object.keys(plot.basic_data).join(', ') : 'None'}</div>
                                <div>Project fields available: {plotsData.projects.length > 0 && plotsData.projects[0].basic_data ? Object.keys(plotsData.projects[0].basic_data).join(', ') : 'None'}</div>
                                <div>Schema field count: {schemaData.length}</div>
                                <div>First 5 schema fields: {schemaData.slice(0, 5).map(f => f["Field Name"]).join(', ')}</div>
                              </div>
                            </div>

                            <div className="space-y-2 max-h-96 overflow-y-auto">
                              {(() => {
                                // Get all field names that actually exist in this plot's data
                                const plotFieldNames = plot.basic_data ? Object.keys(plot.basic_data) : [];
                                const projectData = plotsData.projects.length > 0 && plotsData.projects[0].basic_data 
                                  ? plotsData.projects[0].basic_data 
                                  : {};
                                const projectFieldNames = Object.keys(projectData);
                                
                                const allPresentFieldNames = [...plotFieldNames, ...projectFieldNames];
                                
                                // Helper function to find matching value in plot or project data
                                const findMatchingValue = (fieldName: string) => {
                                  console.log(`Looking for field: "${fieldName}"`);
                                  
                                  // Try exact match first in plot data
                                  if (plot.basic_data && plot.basic_data[fieldName] !== undefined) {
                                    console.log(`  Found exact match in plot data: ${plot.basic_data[fieldName]}`);
                                    return plot.basic_data[fieldName];
                                  }
                                  
                                  // Try exact match in project data
                                  if (projectData[fieldName] !== undefined) {
                                    console.log(`  Found exact match in project data: ${projectData[fieldName]}`);
                                    return projectData[fieldName];
                                  }
                                  
                                  // Try case-insensitive match in plot data
                                  if (plot.basic_data) {
                                    const plotKey = Object.keys(plot.basic_data).find(key => 
                                      key.toLowerCase() === fieldName.toLowerCase()
                                    );
                                    if (plotKey) {
                                      console.log(`  Found case-insensitive match in plot data: ${plotKey} = ${plot.basic_data[plotKey]}`);
                                      return plot.basic_data[plotKey];
                                    }
                                  }
                                  
                                  // Try case-insensitive match in project data
                                  const projectKey = Object.keys(projectData).find(key => 
                                    key.toLowerCase() === fieldName.toLowerCase()
                                  );
                                  if (projectKey) {
                                    console.log(`  Found case-insensitive match in project data: ${projectKey} = ${projectData[projectKey]}`);
                                    return projectData[projectKey];
                                  }
                                  
                                  // Try partial match in plot data (more flexible)
                                  if (plot.basic_data) {
                                    const plotKey = Object.keys(plot.basic_data).find(key => {
                                      const keyLower = key.toLowerCase().replace(/[^a-z0-9]/g, '');
                                      const fieldLower = fieldName.toLowerCase().replace(/[^a-z0-9]/g, '');
                                      return keyLower.includes(fieldLower) || fieldLower.includes(keyLower) ||
                                             keyLower === fieldLower;
                                    });
                                    if (plotKey) {
                                      console.log(`  Found flexible match in plot data: ${plotKey} = ${plot.basic_data[plotKey]}`);
                                      return plot.basic_data[plotKey];
                                    }
                                  }
                                  
                                  // Try partial match in project data (more flexible)
                                  const projectKeyPartial = Object.keys(projectData).find(key => {
                                    const keyLower = key.toLowerCase().replace(/[^a-z0-9]/g, '');
                                    const fieldLower = fieldName.toLowerCase().replace(/[^a-z0-9]/g, '');
                                    return keyLower.includes(fieldLower) || fieldLower.includes(keyLower) ||
                                           keyLower === fieldLower;
                                  });
                                  if (projectKeyPartial) {
                                    console.log(`  Found flexible match in project data: ${projectKeyPartial} = ${projectData[projectKeyPartial]}`);
                                    return projectData[projectKeyPartial];
                                  }
                                  
                                  // Special mappings for common field name variations
                                  const fieldMappings: { [key: string]: string[] } = {
                                    'id': ['Id', 'ID', 'id'],
                                    'plotid': ['Plot ID', 'PlotID', 'Plot_ID', 'plot_id'],
                                    'projectname': ['Project Name', 'Project_Name', 'project_name'],
                                    'country': ['Country', 'COUNTRY', 'country'],
                                    'site': ['Site', 'site', 'Site ID', 'site_id'],
                                    'plot': ['Plot', 'plot', 'Plot Name', 'plot_name'],
                                    'power': ['Power', 'power', 'Power Availability', 'power_availability'],
                                    'partner': ['Partner', 'partner', 'Primary Project Partner', 'project_partner']
                                  };
                                  
                                  const normalizedFieldName = fieldName.toLowerCase().replace(/[^a-z0-9]/g, '');
                                  const possibleKeys = fieldMappings[normalizedFieldName] || [];
                                  
                                  for (const possibleKey of possibleKeys) {
                                    if (plot.basic_data && plot.basic_data[possibleKey] !== undefined) {
                                      console.log(`  Found via mapping in plot data: ${possibleKey} = ${plot.basic_data[possibleKey]}`);
                                      return plot.basic_data[possibleKey];
                                    }
                                    if (projectData[possibleKey] !== undefined) {
                                      console.log(`  Found via mapping in project data: ${possibleKey} = ${projectData[possibleKey]}`);
                                      return projectData[possibleKey];
                                    }
                                  }
                                  
                                  console.log(`  No match found for: "${fieldName}"`);
                                  return null;
                                };
                                
                                // Filter schema to only show fields that exist in the actual data
                                return schemaData
                                  .filter(field => 
                                    allPresentFieldNames.some(dataField => 
                                      dataField.toLowerCase() === field["Field Name"]?.toLowerCase() ||
                                      dataField.toLowerCase().includes(field["Field Name"]?.toLowerCase()) ||
                                      field["Field Name"]?.toLowerCase().includes(dataField.toLowerCase())
                                    )
                                  )
                                  .map((field, idx) => {
                                    const fieldValue = findMatchingValue(field["Field Name"]);
                                    return (
                                      <div key={idx} className={`${field.Type} ${field["Field Name"]} text-xs border-b border-border/10 pb-1`}>
                                        <div className="flex justify-between items-start gap-2">
                                          <div className="flex-1">
                                            <div className="font-medium text-foreground">
                                              {field["Field Name"]}
                                            </div>
                                            <div className="text-muted-foreground">
                                              Type: {field.Type} | ID: {field["Field ID"]}
                                            </div>
                                            {field.Table && (
                                              <div className="text-blue-500 text-xs">
                                                Table: {field.Table} {field.Category && `| ${field.Category}`} {field.Subcategory && `| ${field.Subcategory}`}
                                              </div>
                                            )}
                                          </div>
                                          <div className="flex-shrink-0 text-right max-w-xs">
                                            <div className="font-medium text-green-700 bg-green-50 px-2 py-1 rounded text-xs">
                                              {fieldValue !== null ? (
                                                Array.isArray(fieldValue) 
                                                  ? fieldValue.join(', ')
                                                  : String(fieldValue)
                                              ) : 'N/A'}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  });
                              })()}
                              
                              {/* Show unmapped fields with their values */}
                              {(() => {
                                const plotFieldNames = plot.basic_data ? Object.keys(plot.basic_data) : [];
                                const projectData = plotsData.projects.length > 0 && plotsData.projects[0].basic_data 
                                  ? plotsData.projects[0].basic_data 
                                  : {};
                                const projectFieldNames = Object.keys(projectData);
                                
                                const allPresentFieldNames = [...plotFieldNames, ...projectFieldNames];
                                
                                const unmappedFields = allPresentFieldNames.filter(dataField =>
                                  !schemaData.some(field => 
                                    dataField.toLowerCase() === field["Field Name"]?.toLowerCase() ||
                                    dataField.toLowerCase().includes(field["Field Name"]?.toLowerCase()) ||
                                    field["Field Name"]?.toLowerCase().includes(dataField.toLowerCase())
                                  )
                                );
                                
                                return unmappedFields.length > 0 && (
                                  <div className="mt-3 pt-3 border-t border-border/20">
                                    <div className="text-xs font-medium text-orange-600 mb-2">Unmapped Fields:</div>
                                    {unmappedFields.map((fieldName, idx) => {
                                      const fieldValue = (plot.basic_data && plot.basic_data[fieldName]) || projectData[fieldName] || 'N/A';
                                      return (
                                        <div key={idx} className="text-xs border-b border-border/10 pb-1">
                                          <div className="flex justify-between items-start gap-2">
                                            <div className="flex-1">
                                              <div className="font-medium text-orange-500">
                                                {fieldName}
                                              </div>
                                              <div className="text-muted-foreground">
                                                Type: Unknown | Not in schema
                                              </div>
                                            </div>
                                            <div className="flex-shrink-0 text-right max-w-xs">
                                              <div className="font-medium text-orange-700 bg-orange-50 px-2 py-1 rounded text-xs">
                                                {Array.isArray(fieldValue) 
                                                  ? fieldValue.join(', ')
                                                  : String(fieldValue)
                                                }
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                      ))}
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
    </DashboardLayout>
  );
}