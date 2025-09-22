"use client";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';

interface SiteData {
  Id?: number;
  Plot_Name?: string;
  Site_Address?: string;
  Country?: string;
  Coordinates?: string;
  Description?: string;
  SiteID?: string; // This contains S### - Site Name format
  Projects?: number[];
  linked_project?: ProjectData | null;
  project_name?: string;
  project_id?: string;
  project_partner?: string;
  error?: string;
  record_id?: string;
  // Parsed components from P_SiteID format
  parsed_project_id?: string;
  parsed_project_name?: string;
  parsed_site_id?: string;
  parsed_site_name?: string;
}

interface ProjectData {
  id?: number;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;
  nc_order?: string;
  Project_Name?: string;
  Project_Sites?: string;
  Country?: string;
  Project_Description?: string;
  Priority?: string;
  Primary_Project_Partner?: string;
  Location?: string;
  Status?: string;
  Priority_Pipeline_Project?: string;
  Power_Availability__Min_?: string;
  Power_Availability__Max_?: string;
  Next_Project_Steps?: string;
  Land_Plots_Identified?: string;
  Plots_Secured?: string;
  Power_Conflict?: string;
  FDI_or_Customer_Restrictions?: string;
  Substation_Data?: string;
  Gas_Availability?: string;
  Power_Questions?: string;
  PPA_Considerations?: string;
  Regional_Tax_Information?: string;
  Local_Sentiment_Analysis?: string;
  Non_ESG_leverage_areas?: string;
  Dashboard_inclusion?: string;
  Labour_Considerations?: string;
  End_User_Scenario_Planning?: string;
  Stakeholder_Presentations?: string;
  Project_Budget__to_FID_?: string;
  FEL_Stage_gate?: string;
  DSO___TSO_synergies?: string;
  Local_Population?: string;
  Project_Lead?: string;
  Agent?: string;
  Key_Project_Contacts?: string;
  Project_Team_Document?: string;
  Project_Document?: string;
  CheckBox_TEST?: number;
  MultiSelect_TEST?: string;
  Date_Test?: string;
  Currency___TEST?: string;
  __Test?: string;
  Rating_Test?: string;
  Roolup_No_Test?: string;
  user_test?: string;
  user_test_1?: string;
  date_time?: string;
  Project_Thumbnail?: string;
  json?: string;
  testmu?: string;
  ph?: string;
  field?: string;
  field_1?: string;
  Project_AI_Summary?: string;
}

interface SitesResponse {
  data: SiteData[];
  total_plots: number;
  filters_applied: {
    project_partner?: string;
    search?: string;
    project_ids?: string[];
  };
  source: string;
}

interface SchemaField {
  Field_ID: string;
  Field_Name: string;
  Field_Description?: string;
  Field_Type: string;
  Field_Order?: number;
  Table_Name: string;
  category_order?: number;
  subcategory_order?: number;
}

export default function SitesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isSyncing, setIsSyncing] = useState(false);
  const [sites, setSites] = useState<SiteData[]>([]);
  const [allSites, setAllSites] = useState<SiteData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [partners, setPartners] = useState<string[]>([]);
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [selectedPartner, setSelectedPartner] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedSites, setSelectedSites] = useState<string[]>([]);
  const [schema, setSchema] = useState<SchemaField[]>([]);
  const [landPlotsSchema, setLandPlotsSchema] = useState<SchemaField[]>([]);

  // Helper function to parse SiteID (format: S### - Site Name)
  const parseSiteID = (siteID?: string) => {
    if (!siteID) return { id: '', name: '' };
    
    const parts = siteID.split(' - ');
    if (parts.length >= 2) {
      return {
        id: parts[0].trim(), // S###
        name: parts.slice(1).join(' - ').trim() // Everything after first dash
      };
    }
    
    return { id: siteID, name: '' };
  };

  // Fetch schema for field ordering and metadata
  const fetchSchema = async () => {
    try {
      const response = await makeAuthenticatedRequest(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/schema`
      );
      if (response.ok) {
        const schemaData: SchemaField[] = await response.json();
        setSchema(schemaData);
        
        // Filter for Land Plots, Sites table fields
        const landPlotsFields = schemaData.filter(field => 
          field.Table_Name === 'Land Plots, Sites'
        );
        setLandPlotsSchema(landPlotsFields);
      }
    } catch (err) {
      console.error('Error fetching schema:', err);
    }
  };

  // Get field metadata by field name
  const getFieldMetadata = (fieldName: string) => {
    return landPlotsSchema.find(field => field.Field_Name === fieldName) || {
      Field_ID: '',
      Field_Name: fieldName,
      Field_Description: '',
      Field_Type: 'Unknown',
      Field_Order: 999,
      Table_Name: 'Land Plots, Sites'
    };
  };

  // Get ordered fields for display
  const getOrderedSiteFields = (site: SiteData) => {
    const siteKeys = Object.keys(site);
    const fieldsWithMetadata = siteKeys.map(key => ({
      key,
      value: site[key as keyof SiteData],
      metadata: getFieldMetadata(key)
    }));

    // Sort by Field_Order, then by field name
    return fieldsWithMetadata.sort((a, b) => {
      const orderA = a.metadata.Field_Order || 999;
      const orderB = b.metadata.Field_Order || 999;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return a.key.localeCompare(b.key);
    });
  };
  const getSiteDisplayInfo = (site: SiteData) => {
    const parsed = parseSiteID(site.SiteID);
    const siteName = parsed.name || site.Plot_Name || 'Unnamed Site';
    const siteId = parsed.id || site.Id?.toString() || '';
    
    return {
      id: siteId,
      name: siteName,
      fullId: site.SiteID || `${site.Id}`,
      displayName: parsed.id ? `${parsed.id} - ${siteName}` : siteName
    };
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

  // Fetch partners for dropdown
  const fetchPartners = async () => {
    try {
      const response = await makeAuthenticatedRequest(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/projects-partners`
      );
      if (response.ok) {
        const data = await response.json();
        setPartners(data.partners || []);
      }
    } catch (err) {
      console.error('Error fetching partners:', err);
    }
  };

  // Fetch projects for selection
  const fetchProjects = async (partner?: string, search?: string) => {
    try {
      const params = new URLSearchParams();
      if (partner && partner !== "all") params.append("partner", partner);
      if (search) params.append("search", search);
      
      // Fetch full projects data with Sites count
      const response = await makeAuthenticatedRequest(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/projects?${params}`
      );
      if (response.ok) {
        const data = await response.json();
        // Projects now returned as direct array
        setProjects(Array.isArray(data) ? data : data.data || []);
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
    }
  };

  // Fetch all sites initially
  const fetchAllSites = async () => {
    try {
      // First try to get sites from projects data with P_SiteID
      const projectsResponse = await makeAuthenticatedRequest(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/projects`
      );
      
      if (projectsResponse.ok) {
        const response = await projectsResponse.json();
        const projectsData: ProjectData[] = Array.isArray(response) ? response : response.data || []; // Handle both formats
        const sitesFromProjects = extractSitesFromProjects(projectsData);
        
        if (sitesFromProjects.length > 0) {
          setAllSites(sitesFromProjects);
          return sitesFromProjects;
        }
      }
      
      // Fallback to original plots endpoint
      const response = await makeAuthenticatedRequest(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/plots`
      );
      if (response.ok) {
        const data: SitesResponse = await response.json();
        setAllSites(data.data || []);
        return data.data || [];
      }
      return [];
    } catch (err) {
      console.error('Error fetching all sites:', err);
      return [];
    }
  };

  // Function to extract sites from project data using Project_Sites count
  const extractSitesFromProjects = (projectsData: ProjectData[]): SiteData[] => {
    const sitesMap = new Map<string, SiteData>();
    
    projectsData.forEach((project) => {
      const projectId = project.id?.toString() || '';
      const projectName = project.Project_Name || '';
      const projectLead = project.Project_Lead || '';
      const partner = project.Primary_Project_Partner || '';
      const projectSites = parseInt(project.Project_Sites || '0', 10);
      const landPlotsIdentified = parseInt(project.Land_Plots_Identified || '0', 10);
      const plotsSecured = parseInt(project.Plots_Secured || '0', 10);
      
      // Create plot entries based on Project_Sites count or Land_Plots_Identified
      const plotCount = Math.max(projectSites, landPlotsIdentified, 1); // At least 1 plot per project
      
      for (let i = 1; i <= plotCount; i++) {
        const plotId = `P${projectId.padStart(3, '0')}-${i.toString().padStart(3, '0')}`;
        const plotName = plotCount > 1 ? `${projectName} - Plot ${i}` : projectName;
        
        const siteData: SiteData = {
          Id: parseInt(`${projectId}${i.toString().padStart(3, '0')}`),
          SiteID: plotId,
          Plot_Name: plotName,
          project_id: projectId,
          project_name: projectName,
          project_partner: partner,
          Country: project.Country || 'Unknown',
          Site_Address: project.Location || '',
          Description: project.Project_Description || `Plot ${i} in ${projectName}`,
          // Store parsed components for display
          parsed_project_id: `P${projectId.padStart(3, '0')}`,
          parsed_project_name: projectName,
          parsed_site_id: `Plot-${i}`,
          parsed_site_name: plotName,
          // Additional project info
          linked_project: project
        };
        
        sitesMap.set(plotId, siteData);
      }
    });
    
    return Array.from(sitesMap.values());
  };

  // Filter displayed sites based on selections and filters
  const filterSites = () => {
    let filtered = [...allSites];

    // Filter by partner
    if (selectedPartner && selectedPartner !== "all") {
      filtered = filtered.filter(site => site.project_partner === selectedPartner);
    }

    // Filter by search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(site => {
        const searchableFields = [
          site.Plot_Name || "",
          site.Site_Address || "",
          site.Country || "",
          site.project_name || "",
          site.project_id || ""
        ];
        return searchableFields.some(field => 
          field.toLowerCase().includes(searchLower)
        );
      });
    }

    // Filter by selected sites - use parsed site IDs (S001, S042, etc.)
    if (selectedSites.length > 0) {
      filtered = filtered.filter(site => {
        const siteId = site.parsed_site_id || "";
        return selectedSites.includes(siteId);
      });
    }

    setSites(filtered);
  };

  // Original fetch sites function (now used for refresh)
  const fetchSites = async () => {
    try {
      setLoading(true);
      setError(null);
      await fetchAllSites();
    } catch (err) {
      console.error('Error fetching sites:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch sites');
      setSites([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) {
      fetchPartners();
      fetchProjects();
      fetchSchema();
      fetchSites();
    }
  }, [session]);

  // Filter sites when any filter changes
  useEffect(() => {
    if (allSites.length > 0) {
      filterSites();
    }
  }, [selectedPartner, searchTerm, selectedSites, allSites]);

  // Fetch projects when partner changes
  useEffect(() => {
    if (session) {
      fetchProjects(selectedPartner, searchTerm);
    }
  }, [selectedPartner]);

  const handleNocoDBSync = async () => {
    setIsSyncing(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/nocodb-sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      
      if (data.status === 'success') {
        toast.success(`NocoDB sync completed successfully! ${data.rows_updated || 0} updated, ${data.rows_inserted || 0} inserted, ${data.rows_deleted || 0} deleted.`);
        // Refresh sites data after sync
        fetchSites();
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
            <h1 className="text-3xl font-bold text-foreground">Sites Management</h1>
            <p className="mt-2 text-muted-foreground">Manage and monitor project sites with advanced filtering</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={fetchSites}
              disabled={loading}
              variant="outline"
            >
              {loading ? 'Loading...' : 'Refresh Sites'}
            </Button>
            <Button
              onClick={handleNocoDBSync}
              disabled={isSyncing}
              className="ml-4"
            >
              {isSyncing ? 'Syncing...' : 'Run NocoDB Sync'}
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
                onChange={(e) => setSelectedPartner(e.target.value)}
                className="w-full p-2 border border-border rounded-md bg-background text-foreground"
              >
                <option value="all">All Partners</option>
                {partners.map((partner) => (
                  <option key={partner} value={partner}>
                    {partner}
                  </option>
                ))}
              </select>
            </div>

            {/* Search Input */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Search Sites/Projects
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, address, project..."
                className="w-full p-2 border border-border rounded-md bg-background text-foreground"
              />
            </div>

            {/* Clear Filters */}
            <div className="flex items-end">
              <Button
                onClick={() => {
                  setSelectedPartner("all");
                  setSearchTerm("");
                  setSelectedSites([]);
                }}
                variant="outline"
                className="w-full"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </div>

        {/* Plot Selection */}
        <div className="bg-card shadow-sm rounded-lg p-6 border border-border">
          <h2 className="text-lg font-medium text-foreground mb-4">
            Plot Selection ({allSites.length} plots available)
          </h2>
          
          {allSites.length > 0 ? (
            <div className="space-y-2">
              <div className="flex gap-2 mb-4 pb-4 border-b border-border">
                <Button
                  onClick={() => setSelectedSites(allSites.map(s => s.parsed_site_id || "").filter(Boolean))}
                  variant="outline"
                  size="sm"
                >
                  Select All Plots
                </Button>
                <Button
                  onClick={() => setSelectedSites([])}
                  variant="outline"
                  size="sm"
                >
                  Clear Selection
                </Button>
                <div className="text-sm text-muted-foreground self-center ml-4 font-medium">
                  {selectedSites.length} of {allSites.length} plots selected
                </div>
              </div>
              
              <div className="max-h-80 overflow-y-auto space-y-1">
                {allSites
                  .sort((a, b) => {
                    const aInfo = getSiteDisplayInfo(a);
                    const bInfo = getSiteDisplayInfo(b);
                    return aInfo.id.localeCompare(bInfo.id);
                  })
                  .map((site, index) => {
                    const siteInfo = getSiteDisplayInfo(site);
                    // Use parsed data for display format: (Site ID) Site Name - [Project ID] Project Name [Country]
                    const displaySiteId = site.parsed_site_id || siteInfo.id;
                    const displaySiteName = site.parsed_site_name || siteInfo.name;
                    const displayProjectId = site.parsed_project_id || site.project_id;
                    const displayProjectName = site.parsed_project_name || site.project_name;
                    const displayCountry = site.Country || 'Unknown';
                    
                    const isSelected = selectedSites.includes(displaySiteId);
                    
                    return (
                      <div 
                        key={site.Id || index} 
                        className={`p-4 rounded-lg border cursor-pointer transition-all hover:shadow-sm ${
                          isSelected 
                            ? 'bg-primary/10 border-primary/50 shadow-sm ring-2 ring-primary/20' 
                            : 'hover:bg-muted/50 border-border hover:border-primary/30'
                        }`}
                        onClick={() => {
                          const siteId = displaySiteId; // Use the actual site ID (S001, S042, etc.)
                          const isCurrentlySelected = selectedSites.includes(siteId);
                          if (isCurrentlySelected) {
                            setSelectedSites(selectedSites.filter(id => id !== siteId));
                          } else {
                            setSelectedSites([...selectedSites, siteId]);
                          }
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              {/* Site ID Badge */}
                              {displaySiteId && (
                                <span className="inline-flex items-center px-2 py-1 rounded-md text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                  {displaySiteId}
                                </span>
                              )}
                              
                              {/* Site Name */}
                              <div className="font-medium text-foreground">
                                {displaySiteName}
                              </div>
                              
                              {/* Project Info */}
                              {displayProjectId && (
                                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                  <span>-</span>
                                  <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                    {displayProjectId}
                                  </span>
                                  {displayProjectName && (
                                    <span className="font-medium">{displayProjectName}</span>
                                  )}
                                </div>
                              )}
                              
                              {/* Country */}
                              {displayCountry && displayCountry !== 'Unknown' && (
                                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                  <span className="inline-flex items-center px-2 py-1 rounded-md text-xs bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                                    {displayCountry}
                                  </span>
                                </div>
                              )}
                            </div>
                            
                            {/* Partner Info */}
                            {site.project_partner && site.project_partner !== 'N/A' && (
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <span className="text-xs font-medium">Partner:</span>
                                <span className="px-2 py-0.5 rounded text-xs bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                                  {site.project_partner}
                                </span>
                              </div>
                            )}
                          </div>
                          
                          {/* Selection Indicator */}
                          <div className={`ml-4 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                            isSelected 
                              ? 'bg-primary border-primary text-primary-foreground' 
                              : 'border-muted-foreground/30'
                          }`}>
                            {isSelected && (
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>No sites available</p>
            </div>
          )}
        </div>

        {/* Sites Display Section */}
        <div className="bg-card shadow-sm rounded-lg p-6 border border-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-foreground">Sites Results</h2>
            <div className="text-sm text-muted-foreground">
              {!loading && sites.length > 0 && (
                <>
                  Showing {sites.length} sites
                  {selectedPartner !== "all" && ` • Partner: ${selectedPartner}`}
                  {searchTerm && ` • Search: "${searchTerm}"`}
                  {selectedSites.length > 0 && ` • ${selectedSites.length} sites selected`}
                </>
              )}
            </div>
          </div>
          
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-2 text-muted-foreground">Fetching sites...</span>
            </div>
          )}

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-4">
              <h3 className="text-destructive font-medium mb-2">Error Loading Sites</h3>
              <p className="text-destructive/80 text-sm">{error}</p>
              <Button 
                onClick={fetchSites} 
                variant="outline" 
                size="sm" 
                className="mt-2"
              >
                Try Again
              </Button>
            </div>
          )}

          {!loading && !error && sites.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p>No sites found for current filters</p>
              <Button 
                onClick={() => {
                  setSelectedPartner("all");
                  setSearchTerm("");
                  setSelectedSites([]);
                }}
                variant="outline"
                size="sm"
                className="mt-2"
              >
                Clear All Filters
              </Button>
            </div>
          )}

          {!loading && sites.length > 0 && (
            <div className="space-y-6">
              {sites.map((site, index) => {
                const siteInfo = getSiteDisplayInfo(site);
                const orderedFields = getOrderedSiteFields(site);
                
                return (
                  <div 
                    key={site.Id || index}
                    className="bg-muted/50 rounded-lg border border-border hover:shadow-md transition-all"
                  >
                    {site.error ? (
                      <div className="p-4 text-destructive">
                        <h3 className="font-medium mb-1">Error loading site</h3>
                        <p className="text-sm">{site.error}</p>
                        {site.record_id && <p className="text-xs mt-1">ID: {site.record_id}</p>}
                      </div>
                    ) : (
                      <div>
                        {/* Site Header */}
                        <div className="p-4 border-b border-border bg-card/50">
                          <div className="flex items-center gap-3">
                            {siteInfo.id && (
                              <span className="inline-flex items-center px-3 py-1 rounded-md text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                {siteInfo.id}
                              </span>
                            )}
                            <h3 className="text-lg font-semibold text-foreground">
                              {siteInfo.name}
                            </h3>
                            {site.project_partner && (
                              <span className="ml-auto px-2 py-1 rounded text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                {site.project_partner}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {/* All Fields with Metadata */}
                        <div className="p-4">
                          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                            {orderedFields.map(({ key, value, metadata }) => {
                              // Skip empty/null values and internal fields
                              if (value === null || value === undefined || value === '' || 
                                  key === 'error' || key === 'record_id') {
                                return null;
                              }

                              let displayValue = value;
                              
                              // Format different data types
                              if (Array.isArray(value)) {
                                displayValue = value.length > 0 ? value.join(', ') : 'None';
                              } else if (typeof value === 'object') {
                                displayValue = JSON.stringify(value);
                              } else if (typeof value === 'boolean') {
                                displayValue = value ? 'Yes' : 'No';
                              } else {
                                displayValue = String(value);
                              }

                              // Skip if still empty after formatting
                              if (!displayValue || displayValue === 'None') {
                                return null;
                              }

                              return (
                                <div 
                                  key={key}
                                  className="bg-background/50 rounded-lg p-3 border border-border/50"
                                >
                                  <div className="space-y-2">
                                    {/* Field Name and ID */}
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="font-medium text-foreground text-sm">
                                        {metadata.Field_Name || key}
                                      </div>
                                      {metadata.Field_ID && (
                                        <span className="text-xs font-mono text-muted-foreground bg-muted px-1 rounded">
                                          {metadata.Field_ID}
                                        </span>
                                      )}
                                    </div>
                                    
                                    {/* Field Description */}
                                    {metadata.Field_Description && (
                                      <div className="text-xs text-muted-foreground italic">
                                        {metadata.Field_Description}
                                      </div>
                                    )}
                                    
                                    {/* Field Type and Value */}
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                                          {metadata.Field_Type}
                                        </span>
                                        {metadata.Field_Order && (
                                          <span className="text-xs text-muted-foreground">
                                            #{metadata.Field_Order}
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-sm text-foreground break-words">
                                        {displayValue.length > 100 ? (
                                          <details className="cursor-pointer">
                                            <summary className="text-primary hover:underline">
                                              {displayValue.substring(0, 100)}...
                                            </summary>
                                            <div className="mt-2 p-2 bg-muted rounded text-xs">
                                              {displayValue}
                                            </div>
                                          </details>
                                        ) : (
                                          displayValue
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-card shadow-sm rounded-lg p-6 border border-border">
          <h2 className="text-lg font-medium text-foreground mb-4">NocoDB Schema Sync</h2>
          <p className="text-muted-foreground mb-4">
            Synchronize NocoDB table schemas and metadata with the backend database.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}