"use client";
import { useEffect, useRef, useState } from "react";
import { Loader } from "@googlemaps/js-api-loader";

declare global {
  interface Window {
    google: any;
  }
}

export default function MapPage() {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const [googleMapsLoaded, setGoogleMapsLoaded] = useState(false);

  // Simulated example data
  const sites = [
    { id: 1, name: "Stockholm", lat: 59.3293, lng: 18.0686 },
    { id: 2, name: "Oslo", lat: 59.9139, lng: 10.7522 },
    { id: 3, name: "Copenhagen", lat: 55.6761, lng: 12.5683 },
  ];

  /** Load Google Maps once **/
  useEffect(() => {
    const init = async () => {
      if (window.google?.maps) {
        setGoogleMapsLoaded(true);
        return;
      }

      const loader = new Loader({
        apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
        version: "weekly",
        libraries: ["maps", "marker"], // ✅ critical
      });

      await loader.load();
      setGoogleMapsLoaded(true);
    };

    init().catch(console.error);
  }, []);

  /** Initialize Map **/
  useEffect(() => {
    if (!googleMapsLoaded || !mapRef.current) return;

    const map = new window.google.maps.Map(mapRef.current, {
      center: { lat: 57.5, lng: 15 },
      zoom: 5,
      mapId: "s42-map",
      gestureHandling: "greedy",
    });

    mapInstance.current = map;

    // Add Advanced Markers
    const { AdvancedMarkerElement } = window.google.maps.marker;
    sites.forEach((site) => {
      const marker = new AdvancedMarkerElement({
        map,
        position: { lat: site.lat, lng: site.lng },
        title: site.name,
        content: (() => {
          const div = document.createElement("div");
          div.style.width = "16px";
          div.style.height = "16px";
          div.style.borderRadius = "50%";
          div.style.background = "#3b82f6";
          div.style.border = "2px solid #fff";
          div.style.cursor = "pointer";
          return div;
        })(),
      });

      marker.addListener("click", () => {
        const infoWindow = new window.google.maps.InfoWindow({
          content: `<div style="font-family:sans-serif;"><strong>${site.name}</strong><br>Lat: ${site.lat}, Lng: ${site.lng}</div>`,
        });
        infoWindow.open({ anchor: marker, map });
      });
    });

    return () => {
      mapInstance.current = null;
    };
  }, [googleMapsLoaded]);

  return (
    <div
      style={{
        height: "100vh",
        width: "100%",
        position: "relative",
        background: "#f0f0f0",
      }}
    >
      {!googleMapsLoaded && (
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
          <p style={{ color: "#555", marginTop: "10px" }}>Loading map...</p>
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
  );
}
