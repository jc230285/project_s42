"use client";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Loader } from "@googlemaps/js-api-loader";
import DashboardLayout from '@/components/DashboardLayout';
import { WithScale42Access } from '@/components/WithScale42Access';

declare global {
  interface Window {
    google: any;
  }
}

interface Project {
  id: number;
  name: string;
  status: string;
  site_count: number;
  [key: string]: any;
}

interface Site {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  project_id?: number;
  project_name?: string;
  project_status?: string;
  geojson?: string;
  Primary_Project_Partner?: string;
  Project_Name?: string;
  Country?: string;
  Site_Address?: string;
  landsize?: number;
  [key: string]: any;
}

interface MapStats {
  total_projects: number;
  total_plots: number;
  sites_with_coords: number;
  sites_with_geojson: number;
}

interface MapData {
  sites: Site[];
}

interface PartnersData {
  partners: string[];
}

// Custom hook for managing Google Maps outside React lifecycle
const useGoogleMaps = (sites: Site[], googleMapsLoaded: boolean, layerToggles: any) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const isInitializedRef = useRef(false);

  useEffect(() => {
    // Prevent multiple initializations
    if (!googleMapsLoaded || !window.google?.maps || !mapContainerRef.current || isInitializedRef.current) return;

    const initializeMap = async () => {
      try {
        console.log('Initializing Google Maps...');

        // Double-check Google Maps availability
        if (!window.google || !window.google.maps) {
          console.error('Google Maps API not available');
          return;
        }

        // Clear any existing content
        if (mapContainerRef.current) {
          mapContainerRef.current.innerHTML = '';
        }

        // Calculate bounds from sites and use fitBounds
        let center: google.maps.LatLngLiteral = { lat: 67.6397, lng: 15.9792 };
        let zoom = 8;
        let boundsToFit: google.maps.LatLngBounds | null = null;

        if (sites.length > 0) {
          const validSites = sites.filter(site => site.latitude && site.longitude);
          if (validSites.length > 0) {
            const bounds = new window.google.maps.LatLngBounds();
            validSites.forEach(site => {
              bounds.extend({ lat: site.latitude, lng: site.longitude });
            });
            center = bounds.getCenter().toJSON();
            boundsToFit = bounds;
            // Use a higher zoom for single sites, lower for multiple
            zoom = validSites.length === 1 ? 15 : 4;
          }
        }

        console.log('Creating map with center:', center);

        // Create map instance with safer property access
        const mapOptions: google.maps.MapOptions = {
          center,
          zoom,
          mapId: 's42-map',
          gestureHandling: 'greedy',
          mapTypeControl: true,
          mapTypeControlOptions: {
            style: window.google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
            position: window.google.maps.ControlPosition.TOP_CENTER,
          },
          fullscreenControl: true,
          streetViewControl: true,
        };

        const map = new window.google.maps.Map(mapContainerRef.current!, mapOptions);
        mapInstanceRef.current = map;
        isInitializedRef.current = true;

        // Fit bounds to show all sites if we have bounds
        if (boundsToFit && sites.length > 1) {
          map.fitBounds(boundsToFit, 50);
        }

        console.log('Map created successfully');

        // Add markers with labels and enhanced info windows
        const newMarkers: google.maps.Marker[] = [];
        sites.forEach(site => {
          if (!site.latitude || !site.longitude) return;

          try {
            // Create the main marker
            const marker = new window.google.maps.Marker({
              position: { lat: site.latitude, lng: site.longitude },
              map,
              title: site.Plot_Name || site.name || 'Site',
              icon: {
                path: window.google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: '#3b82f6',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2,
              },
            });

            // Create a label marker for the Plot_Name positioned above the main marker (only if labels are enabled)
            let labelMarker = null;
            if (layerToggles?.labels) {
              labelMarker = new window.google.maps.Marker({
                position: { lat: site.latitude + 0.001, lng: site.longitude }, // Offset slightly north
                map,
                icon: {
                  path: 'M 0,0 z',
                  fillOpacity: 0,
                  strokeOpacity: 0,
                  scale: 0
                },
                label: {
                  text: site.Plot_Name ? (site.Plot_Name.length > 25 ? site.Plot_Name.substring(0, 22) + '...' : site.Plot_Name) : (site.name || 'Site'),
                  color: '#1f2937',
                  fontSize: '11px',
                  fontWeight: 'bold'
                },
                clickable: false
              });
            }

            // Enhanced click listener with comprehensive data
            try {
              marker.addListener('click', () => {
                try {
                  const infoWindow = new window.google.maps.InfoWindow({
                    content: `
                      <div style="min-width: 350px; max-width: 400px; font-family: Arial, sans-serif;">
                        <div style="border-bottom: 2px solid #3b82f6; padding-bottom: 8px; margin-bottom: 12px;">
                          <h3 style="margin: 0; color: #1f2937; font-size: 16px;">${site.Plot_Name || site.name || 'Site'}</h3>
                          <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 12px;">${site.Project_Code || 'N/A'}</p>
                        </div>
                        
                        <div style="margin-bottom: 12px;">
                          <strong style="color: #374151;">Project:</strong> ${site.Project_Name || 'N/A'}<br>
                          <strong style="color: #374151;">Partner:</strong> ${site.Primary_Project_Partner || 'N/A'}<br>
                          <strong style="color: #374151;">Country:</strong> ${site.Country || 'N/A'}
                        </div>
                        
                        <div style="margin-bottom: 12px;">
                          <strong style="color: #374151;">Address:</strong><br>
                          <span style="color: #6b7280; font-size: 13px;">${site.Site_Address || 'Address not specified'}</span>
                        </div>
                        
                        <div style="background-color: #f9fafb; padding: 8px; border-radius: 4px; margin-bottom: 8px;">
                          <strong style="color: #374151;">Coordinates:</strong><br>
                          <span style="font-family: monospace; font-size: 12px; color: #6b7280;">
                            ${site.latitude.toFixed(6)}, ${site.longitude.toFixed(6)}
                          </span>
                        </div>
                        
                        ${site.geojson ? `
                          <div style="margin: 12px 0; padding: 8px; background-color: #ecfdf5; border-radius: 4px; border-left: 3px solid #10b981;">
                            <div style="display: flex; align-items: center; margin-bottom: 4px;">
                              <span style="color: #047857; font-size: 12px; font-weight: 600;">📍 Polygon Area Available</span>
                            </div>
                            <div style="color: #065f46; font-size: 11px;">
                              Polygon boundary data available for this site
                            </div>
                          </div>
                        ` : ''}
                        
                        <div style="margin-top: 12px; text-align: right;">
                          <small style="color: #9ca3af;">Site ID: ${site.LandPlotID || 'N/A'}</small>
                        </div>
                      </div>
                    `,
                  });
                  infoWindow.open({ anchor: marker, map });
                } catch (infoWindowError) {
                  console.warn('Error opening info window:', infoWindowError);
                }
              });
            } catch (listenerError) {
              console.warn('Error adding marker listener:', listenerError);
            }

            newMarkers.push(marker);
            if (labelMarker) {
              newMarkers.push(labelMarker);
            }
          } catch (markerError) {
            console.error('Error creating marker for site:', site.name, markerError);
          }
        });

        markersRef.current = newMarkers;
        console.log('Added', newMarkers.length, 'markers');

        // Add a small delay before considering the map fully ready
        setTimeout(() => {
          console.log('Map initialization completed successfully');
        }, 500);

      } catch (error) {
        console.error('Error initializing map:', error);
        isInitializedRef.current = false;
      }
    };

    // Small delay to ensure Google Maps is fully loaded
    const timeoutId = setTimeout(() => {
      initializeMap();
    }, 100);

    // Cleanup function
    return () => {
      clearTimeout(timeoutId);
      if (mapInstanceRef.current) {
        console.log('Cleaning up map instance');
        // Clean up markers
        markersRef.current.forEach(marker => {
          try {
            window.google.maps.event.clearInstanceListeners(marker);
            marker.setMap(null);
          } catch (e) {
            console.warn('Error cleaning up marker:', e);
          }
        });
        markersRef.current = [];

        // Clear map instance
        mapInstanceRef.current = null;
        isInitializedRef.current = false;
      }
    };
  }, [sites, googleMapsLoaded, layerToggles]);

  return { mapContainerRef, fitAllSites: () => {
    if (mapInstanceRef.current && sites.length > 0) {
      const validSites = sites.filter(site => site.latitude && site.longitude);
      if (validSites.length > 0) {
        const bounds = new window.google.maps.LatLngBounds();
        validSites.forEach(site => {
          bounds.extend({ lat: site.latitude, lng: site.longitude });
        });
        mapInstanceRef.current.fitBounds(bounds, 50);
      }
    }
  } };
};

export default function MapPage() {
  return (
    // <WithScale42Access>
      <MapPageContent />
    // </WithScale42Access>
  );
}

function MapPageContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [mapStats, setMapStats] = useState<MapStats | null>(null);
  const [partners, setPartners] = useState<string[]>([]);
  const [selectedPartner, setSelectedPartner] = useState<string>("all");
  const [menuCollapsed, setMenuCollapsed] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [layerToggles, setLayerToggles] = useState({
    sites: true,
    projects: true,
    labels: true,
    satellite: false,
  });
  const [googleMapsLoaded, setGoogleMapsLoaded] = useState(false);

  // Use the isolated Google Maps hook
  const { mapContainerRef, fitAllSites } = useGoogleMaps(mapData?.sites || [], googleMapsLoaded, layerToggles);

  useEffect(() => {
    console.log('Session status:', status);
    console.log('Session data:', session);
    if (status !== "loading" && !session) {
      console.log('No session, redirecting to home');
      router.push('/');
    }
  }, [session, status, router]);

  useEffect(() => {
    if (session) {
      console.log('Session found, loading map data');
      loadMapData();
    } else {
      console.log('No session, skipping map data load');
    }
  }, [session, selectedPartner]);

  // Load Google Maps API using the official loader
  useEffect(() => {
    const loadGoogleMaps = async () => {
      // Prevent multiple loading attempts
      if (googleMapsLoaded || window.google?.maps) {
        console.log('Google Maps already loaded');
        setGoogleMapsLoaded(true);
        return;
      }

      try {
        const loader = new Loader({
          apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
          version: "weekly",
          libraries: []
        });

        await loader.load();
        console.log('Google Maps API loaded successfully via official loader');
        setGoogleMapsLoaded(true);
      } catch (error) {
        console.error('Error loading Google Maps API:', error);
        setError('Failed to load Google Maps API. Please check your API key and internet connection.');
      }
    };

    if (typeof window !== 'undefined') {
      loadGoogleMaps();
    }
  }, [googleMapsLoaded]);

  const loadMapData = async () => {
    try {
      console.log('Starting to load map data...');
      setLoading(true);
      setError(null);

      // Create authentication headers - backend expects base64 encoded JSON
      const userInfo = {
        email: session?.user?.email || 'authenticated@user.com',
        name: session?.user?.name || 'Authenticated User',
        authenticated: true
      };
      const token = btoa(JSON.stringify(userInfo));
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      console.log('Fetching partners...');
      // Load partners first
      const partnersResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/projects-partners`, { headers });
      console.log('Partners response:', partnersResponse.status, partnersResponse.ok);
      if (partnersResponse.ok) {
        const partnersData: PartnersData = await partnersResponse.json();
        console.log('Partners data:', partnersData);
        setPartners(partnersData.partners);
      } else {
        console.error('Partners API failed:', partnersResponse.status, await partnersResponse.text());
      }

      console.log('Fetching map data and stats...');
      // Load map data and stats in parallel
      const [dataResponse, statsResponse] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/map-data?partner=${selectedPartner}`, { headers }),
        fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/map-stats`, { headers })
      ]);

      console.log('Data response:', dataResponse.status, dataResponse.ok);
      console.log('Stats response:', statsResponse.status, statsResponse.ok);

      if (!dataResponse.ok || !statsResponse.ok) {
        throw new Error(`API calls failed: data=${dataResponse.status}, stats=${statsResponse.status}`);
      }

      const data = await dataResponse.json();
      const stats = await statsResponse.json();

      console.log('Map data loaded:', data);
      console.log('Stats loaded:', stats);

      setMapData(data);
      setMapStats(stats);

      // Don't initialize map here - let the useEffect handle it when container is ready
      console.log('Map data loaded, waiting for container to be ready...');
    } catch (err) {
      console.error('Error loading map data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load map data');
    } finally {
      setLoading(false);
    }
  };

  const toggleLayer = (layer: keyof typeof layerToggles) => {
    setLayerToggles(prev => ({ ...prev, [layer]: !prev[layer] }));
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading map...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  if (error) {
    return (
      <div className="h-screen w-screen bg-background flex items-center justify-center">
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 max-w-md">
          <h2 className="text-lg font-medium text-destructive mb-2">Error Loading Map</h2>
          <p className="text-muted-foreground">{error}</p>
          <button
            onClick={loadMapData}
            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout initialSidebarCollapsed={true}>
      <style jsx global>{`
        .map-label {
          background-color: rgba(255, 255, 255, 0.9) !important;
          border: 1px solid #d1d5db !important;
          border-radius: 4px !important;
          padding: 2px 6px !important;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1) !important;
        }
      `}</style>
      <div className="h-screen w-full relative overflow-hidden">
        {/* Google Maps Container - Isolated from React */}
        <div
          ref={mapContainerRef}
          className="w-full h-full"
          style={{
            backgroundColor: '#f0f0f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {!googleMapsLoaded && (
            <div className="text-center text-gray-600">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <div>Loading Map...</div>
            </div>
          )}
        </div>

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <div className="text-lg font-medium mb-2">Loading Map Data...</div>
            <div className="text-sm text-muted-foreground">Fetching sites and statistics</div>
          </div>
        </div>
      )}

      {/* Menu Toggle Button */}
      <button
        onClick={() => setMenuCollapsed(!menuCollapsed)}
        className="absolute top-4 left-4 z-20 bg-background/95 backdrop-blur-sm border border-border rounded-lg p-2 shadow-lg hover:bg-muted/50 transition-colors"
        title={menuCollapsed ? "Show Controls" : "Hide Controls"}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={menuCollapsed ? "M4 6h16M4 12h16M4 18h16" : "M6 18L18 6M6 6l12 12"} />
        </svg>
      </button>

      {/* Control Panel */}
      <div className={`${menuCollapsed ? "hidden" : ""} absolute top-4 left-16 bg-background/95 backdrop-blur-sm border border-border rounded-lg p-4 shadow-lg max-w-sm`}>
        <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Map Layers
        </h3>

        {/* Partner Filter */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-foreground mb-2">
            Filter by Partner
          </label>
          <select
            value={selectedPartner}
            onChange={(e) => setSelectedPartner(e.target.value)}
            className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">All Partners</option>
            {partners.map((partner) => (
              <option key={partner} value={partner}>
                {partner}
              </option>
            ))}
          </select>
        </div>

        {/* Map Control Buttons */}
        <div className="mb-4">
          <button
            onClick={fitAllSites}
            className="w-full px-3 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm font-medium"
          >
            📍 Fit All Sites
          </button>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 p-2 rounded">
            <input
              type="checkbox"
              checked={layerToggles.sites}
              onChange={() => toggleLayer('sites')}
              className="rounded border-border"
            />
            <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
            </svg>
            <span className="text-sm">Site Markers</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 p-2 rounded">
            <input
              type="checkbox"
              checked={layerToggles.projects}
              onChange={() => toggleLayer('projects')}
              className="rounded border-border"
            />
            <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" clipRule="evenodd" />
            </svg>
            <span className="text-sm">Project Boundaries</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 p-2 rounded">
            <input
              type="checkbox"
              checked={layerToggles.labels}
              onChange={() => toggleLayer('labels')}
              className="rounded border-border"
            />
            <svg className="w-4 h-4 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
            <span className="text-sm">Site Labels</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 p-2 rounded">
            <input
              type="checkbox"
              checked={layerToggles.satellite}
              onChange={() => toggleLayer('satellite')}
              className="rounded border-border"
            />
            <svg className="w-4 h-4 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
              <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
            </svg>
            <span className="text-sm">Satellite View</span>
          </label>
        </div>

        {/* Legend */}
        <div className="mt-4 pt-3 border-t border-border">
          <h4 className="font-medium text-foreground mb-2 text-sm">Legend</h4>
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1 text-xs">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span>Partner A</span>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span>Default</span>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <div className="w-3 h-3 rounded-full bg-orange-500"></div>
              <span>Partner B</span>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span>Partner C</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Panel */}
      {mapStats && (
        <div className="absolute top-4 right-4 bg-background/95 backdrop-blur-sm border border-border rounded-lg p-4 shadow-lg">
          <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Statistics
          </h3>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{mapStats.total_projects}</div>
              <div className="text-muted-foreground">Projects</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{mapStats.total_plots}</div>
              <div className="text-muted-foreground">Total Sites</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{mapStats.sites_with_coords}</div>
              <div className="text-muted-foreground">With Coords</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{mapStats.sites_with_geojson}</div>
              <div className="text-muted-foreground">With GeoJSON</div>
            </div>
          </div>
        </div>
      )}
      </div>
    </DashboardLayout>
  );
}