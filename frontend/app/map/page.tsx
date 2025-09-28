"use client";
import { useEffect, useRef, useState } from "react";
import { Loader } from "@googlemaps/js-api-loader";
import DashboardLayout from '@/components/DashboardLayout';

declare global {
  interface Window {
    google: any;
  }
}

export default function MapPage() {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const [googleMapsLoaded, setGoogleMapsLoaded] = useState(false);

  // Real plot data from backend
  const [sites, setSites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);

  /** Fetch map data from backend **/
  useEffect(() => {
    const fetchMapData = async () => {
      try {
        console.log('Fetching map data...');
        const response = await fetch('/api/proxy/map-data', {
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch map data: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('Map data received:', data);
        
        if (data.sites && data.sites.length > 0) {
          setSites(data.sites);
        } else {
          // Use fallback data if no real data available
          console.log('No real plot data found, using fallback locations');
          setSites([
            { id: 1, name: "Stockholm", lat: 59.3293, lng: 18.0686 },
            { id: 2, name: "Oslo", lat: 59.9139, lng: 10.7522 },
            { id: 3, name: "Copenhagen", lat: 55.6761, lng: 12.5683 },
          ]);
        }
        setLoading(false);
      } catch (error) {
        console.error('Error fetching map data:', error);
        setMapError(error instanceof Error ? error.message : 'Failed to load map data');
        
        // Always use fallback data if fetch fails
        console.log('Using fallback locations due to error');
        setSites([
          { id: 1, name: "Stockholm", lat: 59.3293, lng: 18.0686 },
          { id: 2, name: "Oslo", lat: 59.9139, lng: 10.7522 },
          { id: 3, name: "Copenhagen", lat: 55.6761, lng: 12.5683 },
        ]);
        setLoading(false);
      }
    };

    fetchMapData();
  }, []);

  /** Load Google Maps once **/
  useEffect(() => {
    const init = async () => {
      try {
        if (window.google?.maps) {
          console.log('Google Maps already loaded');
          setGoogleMapsLoaded(true);
          return;
        }

        // Prevent multiple loader instances
        if ((window as any).__gmapsLoading) {
          console.log('Google Maps already loading, waiting...');
          return;
        }

        (window as any).__gmapsLoading = true;

        console.log('Loading Google Maps API...');
        
        // Load Google Maps directly via script tag to avoid module conflicts
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
        if (!apiKey) {
          throw new Error('Google Maps API key not found');
        }

        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=maps&v=weekly`;
        script.async = true;
        script.defer = true;

        script.onload = () => {
          console.log('Google Maps API loaded successfully via script tag');
          console.log('window.google exists:', !!window.google);
          console.log('window.google.maps exists:', !!window.google?.maps);
          setGoogleMapsLoaded(true);
          (window as any).__gmapsLoading = false;
        };

        script.onerror = (error) => {
          console.error('Failed to load Google Maps via script tag:', error);
          setMapError('Failed to load Google Maps API');
          setLoading(false);
          (window as any).__gmapsLoading = false;
        };

        document.head.appendChild(script);

      } catch (error) {
        console.error('Failed to load Google Maps:', error);
        setMapError('Failed to load Google Maps API');
        setLoading(false);
        (window as any).__gmapsLoading = false;
      }
    };

    init();
  }, []); // Remove dependencies to prevent re-running

  /** Initialize Map **/
  useEffect(() => {
    console.log('Map useEffect:', { googleMapsLoaded, mapRefCurrent: !!mapRef.current, sitesCount: sites.length });
    // Wait until we have data to render to avoid initializing an empty map and potential API hiccups
    if (!googleMapsLoaded || !mapRef.current || sites.length === 0) return;

    try {
      console.log('Initializing Google Map with sites:', sites);
      const map = new window.google.maps.Map(mapRef.current, {
        center: { lat: 57.5, lng: 15 },
        zoom: 5,
        gestureHandling: "greedy",
        // Removed mapId since we're not using Advanced Markers
      });

      mapInstance.current = map;

      // Add markers using regular Marker class
      console.log('Creating markers for', sites.length, 'sites');
      let markerCount = 0;
      sites.forEach((site, index) => {
        try {
          console.log(`Creating marker ${index + 1}/${sites.length} for site:`, site.name, 'at', site.lat, site.lng);
          
          // Use regular Marker class
          const marker = new google.maps.Marker({
            map,
            position: { lat: site.lat, lng: site.lng },
            title: site.name || `Plot ${site.id}`,
          });

          markerCount++;
          
          // For InfoWindow, we can add a click listener
          marker.addListener("click", () => {
            const infoWindow = new google.maps.InfoWindow({
              content: `
                <div style="font-family:sans-serif; max-width: 300px;">
                  <strong>${site.name || `Plot ${site.id}`}</strong><br>
                  ${site.project_name ? `<div style="color: #666; margin: 4px 0;"><strong>Project:</strong> ${site.project_name}</div>` : ''}
                  ${site.project_code ? `<div style="color: #666; margin: 4px 0;"><strong>Code:</strong> ${site.project_code}</div>` : ''}
                  ${site.address ? `<div style="color: #666; margin: 4px 0;"><strong>Address:</strong> ${site.address}</div>` : ''}
                  ${site.country ? `<div style="color: #666; margin: 4px 0;"><strong>Country:</strong> ${site.country}</div>` : ''}
                  <div style="color: #888; margin: 4px 0; font-size: 0.9em;">
                    <strong>Coordinates:</strong> ${site.lat.toFixed(6)}, ${site.lng.toFixed(6)}
                  </div>
                </div>
              `,
            });
            infoWindow.open(map, marker);
          });
        } catch (error) {
          console.error(`Error creating marker for site ${site.name}:`, error);
        }
      });
      console.log('Successfully created', markerCount, 'markers');

      return () => {
        mapInstance.current = null;
      };
    } catch (error) {
      console.error('Error initializing map:', error);
      setMapError('Failed to initialize map');
    }
  }, [googleMapsLoaded, sites]);

  return (
    <DashboardLayout initialSidebarCollapsed={true} contentClassName="p-0">
      <div
        style={{
          height: "100vh",
          width: "100%",
          position: "relative",
          background: "#f0f0f0",
        }}
      >
        {/* Map Info Bar */}
        {!loading && sites.length > 0 && (
          <div
            style={{
              position: "absolute",
              top: "10px",
              left: "190px",
              background: "rgba(255, 255, 255, 0.95)",
              padding: "8px 12px",
              borderRadius: "4px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              zIndex: 1000,
              fontSize: "14px",
              color: "#333",
            }}
          >
            <strong>{sites.length}</strong> plot locations loaded
          </div>
        )}
      {(!googleMapsLoaded || loading) && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              border: "4px solid #ccc",
              borderTop: "4px solid #3b82f6",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "auto",
            }}
          />
          <p style={{ color: "#555", marginTop: "10px" }}>
            {loading ? "Loading plot data..." : "Loading map..."}
          </p>
          {mapError && (
            <p style={{ color: "#e53e3e", marginTop: "10px", fontSize: "0.9em" }}>
              {mapError}
            </p>
          )}
          <style>{`
            @keyframes spin { from {transform: rotate(0deg);} to {transform: rotate(360deg);} }
          `}</style>
        </div>
      )}
        <div
          ref={mapRef}
          style={{
            width: "100%",
            height: "100%",
            position: "absolute",
            top: 0,
            left: 0,
          }}
        />
      </div>
    </DashboardLayout>
  );
}
