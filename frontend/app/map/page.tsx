"use client";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import DashboardLayout from '@/components/DashboardLayout';

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
  [key: string]: any;
}

interface MapStats {
  total_projects: number;
  total_sites: number;
  sites_with_coords: number;
  sites_with_geojson: number;
}

interface MapData {
  projects: Project[];
  sites: Site[];
}

export default function MapPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [mapStats, setMapStats] = useState<MapStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [layerToggles, setLayerToggles] = useState({
    sites: true,
    projects: true,
    labels: true,
    satellite: false,
  });

  useEffect(() => {
    if (status !== "loading" && !session) {
      router.push('/');
    }
  }, [session, status, router]);

  useEffect(() => {
    if (session) {
      loadMapData();
    }
  }, [session]);

  const loadMapData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load map data and stats in parallel
      const [dataResponse, statsResponse] = await Promise.all([
        fetch('/api/map-data'),
        fetch('/api/map-stats')
      ]);

      if (!dataResponse.ok || !statsResponse.ok) {
        throw new Error('Failed to load map data');
      }

      const data = await dataResponse.json();
      const stats = await statsResponse.json();

      setMapData(data);
      setMapStats(stats);

      // Initialize map after data is loaded
      if (mapRef.current) {
        await initializeMap(data);
      }
    } catch (err) {
      console.error('Error loading map data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load map data');
    } finally {
      setLoading(false);
    }
  };

  const initializeMap = async (data: MapData) => {
    if (!mapRef.current) return;

    try {
      // Load Google Maps
      const { Map } = await google.maps.importLibrary("maps") as google.maps.MapsLibrary;
      const { AdvancedMarkerElement } = await google.maps.importLibrary("marker") as google.maps.MarkerLibrary;

      // Calculate center from sites with coordinates
      let center = { lat: 67.6397, lng: 15.9792 }; // Default Norway center
      let zoom = 8;

      if (data.sites.length > 0) {
        const bounds = new google.maps.LatLngBounds();
        data.sites.forEach(site => {
          if (site.latitude && site.longitude) {
            bounds.extend({ lat: site.latitude, lng: site.longitude });
          }
        });
        center = bounds.getCenter().toJSON();
      }

      const map = new Map(mapRef.current, {
        center,
        zoom,
        mapId: 's42-map',
        gestureHandling: 'greedy',
        mapTypeControl: true,
        mapTypeControlOptions: {
          style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
          position: google.maps.ControlPosition.TOP_CENTER,
        },
        fullscreenControl: true,
        streetViewControl: true,
      });

      googleMapRef.current = map;

      // Add site markers
      addSiteMarkers(data.sites, AdvancedMarkerElement, map);

    } catch (err) {
      console.error('Error initializing map:', err);
      setError('Failed to initialize Google Maps');
    }
  };

  const addSiteMarkers = (sites: Site[], AdvancedMarkerElement: any, map: google.maps.Map) => {
    sites.forEach(site => {
      if (!site.latitude || !site.longitude) return;

      // Determine marker color based on project status
      let markerColor = '#3b82f6'; // Default blue
      if (site.project_status) {
        switch (site.project_status.toLowerCase()) {
          case 'active':
            markerColor = '#10b981'; // Green
            break;
          case 'planned':
            markerColor = '#f59e0b'; // Orange
            break;
          case 'maintenance':
            markerColor = '#ef4444'; // Red
            break;
        }
      }

      // Create marker element
      const markerElement = document.createElement('div');
      markerElement.innerHTML = `
        <div style="
          background: ${markerColor};
          color: white;
          padding: 6px 10px;
          border-radius: 16px;
          font-size: 12px;
          font-weight: 600;
          font-family: 'Inter', sans-serif;
          border: 2px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          cursor: pointer;
          transition: transform 0.2s ease;
          min-width: 50px;
          text-align: center;
        "
        onmouseover="this.style.transform='scale(1.1)'"
        onmouseout="this.style.transform='scale(1)'">
          ${site.name || 'Site'}
        </div>
      `;

      const marker = new AdvancedMarkerElement({
        map: layerToggles.sites ? map : null,
        position: { lat: site.latitude, lng: site.longitude },
        content: markerElement,
        title: site.name
      });

      // Add click listener
      marker.addListener('click', () => {
        const infoWindow = new google.maps.InfoWindow({
          content: `
            <div style="min-width:300px; max-width:400px; font-family: 'Inter', sans-serif;">
              <h3 style="margin: 0 0 10px 0; color: #1f2937; font-weight: 600;">${site.name}</h3>
              <div style="margin-bottom: 12px; padding: 8px; background: #f3f4f6; border-radius: 6px; font-size: 12px; color: #6b7280;">
                <strong>Coordinates:</strong> ${site.latitude.toFixed(6)}, ${site.longitude.toFixed(6)}
                ${site.project_name ? `<br/><strong>Project:</strong> ${site.project_name}` : ''}
                ${site.project_status ? `<br/><strong>Status:</strong> <span style="color: ${markerColor}; font-weight: 600;">${site.project_status}</span>` : ''}
              </div>
              ${site.description ? `
              <div style="margin-bottom: 12px;">
                <strong style="color: #374151;">Description:</strong><br/>
                <span style="color: #6b7280;">${site.description.substring(0, 150)}${site.description.length > 150 ? '...' : ''}</span>
              </div>
              ` : ''}
              <div style="margin-top: 12px; text-align: center;">
                <button onclick="window.location.href='/sites?site=${site.id}'" style="
                  padding: 8px 16px;
                  border-radius: 6px;
                  border: 1px solid #d1d5db;
                  background: ${markerColor};
                  color: white;
                  cursor: pointer;
                  font-weight: 500;
                  transition: background-color 0.2s;
                "
                onmouseover="this.style.opacity='0.9'"
                onmouseout="this.style.opacity='1'">
                  View Site Details
                </button>
              </div>
            </div>
          `
        });

        infoWindow.open({ anchor: marker, map });
      });
    });
  };

  const toggleLayer = (layer: keyof typeof layerToggles) => {
    setLayerToggles(prev => {
      const newToggles = { ...prev, [layer]: !prev[layer] };

      if (layer === 'satellite') {
        googleMapRef.current?.setMapTypeId(newToggles.satellite ? 'satellite' : 'roadmap');
      }

      return newToggles;
    });
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
      <DashboardLayout>
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Map View</h1>
            <p className="mt-2 text-muted-foreground">Interactive map of project locations</p>
          </div>
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6">
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
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Map View</h1>
          <p className="mt-2 text-muted-foreground">Interactive map of project locations</p>
        </div>

        <div className="relative">
          {/* Map Container */}
          <div
            ref={mapRef}
            className="w-full rounded-lg shadow-lg border border-border"
            style={{ height: 'calc(100vh - 200px)' }}
          />

          {/* Control Panel */}
          <div className="absolute top-4 left-4 bg-background/95 backdrop-blur-sm border border-border rounded-lg p-4 shadow-lg max-w-sm">
            <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Map Layers
            </h3>

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
                  <span>Active</span>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span>Default</span>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                  <span>Planned</span>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span>Maintenance</span>
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
                  <div className="text-2xl font-bold text-blue-600">{mapStats.total_sites}</div>
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
      </div>
    </DashboardLayout>
  );
}