
import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { FreightRequest } from '../../types';
import { MapPin } from 'lucide-react';

// Coordinates Database (Major Ports & Cities)
const PORT_COORDINATES: Record<string, [number, number]> = {
  // Asia
  'SHANGHAI': [31.2304, 121.4737],
  'SHA': [31.2304, 121.4737],
  'SINGAPORE': [1.29027, 103.85196],
  'SIN': [1.3521, 103.8198],
  'HONG KONG': [22.3193, 114.1694],
  'HKG': [22.3193, 114.1694],
  'NINGBO': [29.8683, 121.5440],
  'NGB': [29.8683, 121.5440],
  'SHENZHEN': [22.5431, 114.0579],
  'SZX': [22.5431, 114.0579],
  'BUSAN': [35.1796, 129.0756],
  'PUS': [35.1796, 129.0756],
  'TOKYO': [35.6762, 139.6503],
  'TYO': [35.6762, 139.6503],
  'MUMBAI': [19.0760, 72.8777],
  'BOM': [19.0760, 72.8777],
  
  // North America
  'LOS ANGELES': [33.7423, -118.2773], // Port of LA approx
  'LAX': [33.9416, -118.4085],
  'LONG BEACH': [33.7701, -118.1937],
  'LGB': [33.8121, -118.1564],
  'NEW YORK': [40.7128, -74.0060],
  'NYC': [40.7128, -74.0060],
  'VANCOUVER': [49.2827, -123.1207],
  'YVR': [49.1967, -123.1815],
  'CHICAGO': [41.8781, -87.6298],
  'ORD': [41.9742, -87.9073],
  'TORONTO': [43.6532, -79.3832],
  'SAVANNAH': [32.0809, -81.0912],
  
  // Europe
  'ROTTERDAM': [51.9244, 4.4777],
  'RTM': [51.9244, 4.4777],
  'RMD': [51.9244, 4.4777],
  'HAMBURG': [53.5511, 9.9937],
  'HAM': [53.5511, 9.9937],
  'ANTWERP': [51.2194, 4.4025],
  'ANR': [51.2194, 4.4025],
  'LONDON': [51.5074, -0.1278],
  'LHR': [51.4700, -0.4543],
  'FELIXSTOWE': [51.9617, 1.3513],
  
  // Middle East
  'DUBAI': [25.2048, 55.2708],
  'DXB': [25.276987, 55.296249],
  'JEBEL ALI': [24.9857, 55.0273],
};

const getCoords = (query: string): [number, number] | null => {
  if (!query) return null;
  const upper = query.toUpperCase().trim();
  // Try direct match
  if (PORT_COORDINATES[upper]) return PORT_COORDINATES[upper];
  
  // Try finding a key that contains the query or vice versa
  const key = Object.keys(PORT_COORDINATES).find(k => k.includes(upper) || upper.includes(k));
  if (key) return PORT_COORDINATES[key];
  
  return null;
};

// Math Helpers for Geodesic Interpolation
const toRad = (d: number) => d * Math.PI / 180;
const toDeg = (r: number) => r * 180 / Math.PI;

const getIntermediatePoint = (start: [number, number], end: [number, number], f: number): [number, number] => {
  const lat1 = toRad(start[0]);
  const lon1 = toRad(start[1]);
  const lat2 = toRad(end[0]);
  const lon2 = toRad(end[1]);

  const d = 2 * Math.asin(Math.sqrt(Math.pow(Math.sin((lat1 - lat2) / 2), 2) + Math.cos(lat1) * Math.cos(lat2) * Math.pow(Math.sin((lon1 - lon2) / 2), 2)));
  const A = Math.sin((1 - f) * d) / Math.sin(d);
  const B = Math.sin(f * d) / Math.sin(d);
  const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
  const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
  const z = A * Math.sin(lat1) + B * Math.sin(lat2);
  const lat3 = Math.atan2(z, Math.sqrt(x * x + y * y));
  const lon3 = Math.atan2(y, x);

  return [toDeg(lat3), toDeg(lon3)];
};

const generateGeodesicPath = (start: [number, number], end: [number, number], segments = 50) => {
  const path = [];
  for (let i = 0; i <= segments; i++) {
    path.push(getIntermediatePoint(start, end, i / segments));
  }
  return path;
};

interface RouteMapProps {
  request: FreightRequest;
}

const RouteMap: React.FC<RouteMapProps> = ({ request }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  
  const originCoords = getCoords(request.originCode || '') || getCoords(request.origin);
  const destCoords = getCoords(request.destCode || '') || getCoords(request.destination);

  useEffect(() => {
    if (!mapRef.current || !originCoords || !destCoords) return;

    // Cleanup previous map if exists
    if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
    }

    // Initialize Map
    const map = L.map(mapRef.current, {
      center: [20, 0],
      zoom: 2,
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: false
    });
    
    // Add Tiles (CartoDB Voyager for clean look)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19
    }).addTo(map);

    // Calculate Geodesic Line
    const pathCoords = generateGeodesicPath(originCoords, destCoords);
    
    // Draw Path (Dashed Grey)
    L.polyline(pathCoords, {
      color: '#6366f1', // Indigo 500
      weight: 3,
      opacity: 0.6,
      dashArray: '5, 10'
    }).addTo(map);

    // Fit Bounds
    const bounds = L.latLngBounds([originCoords, destCoords]);
    // Pad bounds to ensure markers aren't on edge
    map.fitBounds(bounds, { padding: [50, 50] });

    // Icons
    const portIcon = L.divIcon({
      className: 'bg-transparent',
      html: `<div style="background-color: white; border: 2px solid #475569; border-radius: 50%; width: 12px; height: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"></div>`,
      iconSize: [12, 12],
      iconAnchor: [6, 6]
    });

    const vehicleIconSvg = request.shippingMethod?.toLowerCase().includes('air') 
      ? `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-plane"><path d="M2 12h20"/><path d="M13 2l9 10-9 10"/><path d="M12 2v20"/></svg>` // Simplified plane shape
      : `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.14"/><path d="M10 14L2 9.27l1-1.27 10-4.73L23 8l-8 5.27Z"/></svg>`; // Ship

    const activeIcon = L.divIcon({
      className: 'bg-transparent',
      html: `<div style="background-color: #4f46e5; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px rgba(79, 70, 229, 0.4); transform: rotate(0deg);">${vehicleIconSvg}</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    // Add Port Markers
    L.marker(originCoords, { icon: portIcon }).addTo(map).bindPopup(`<b>Origin</b><br>${request.origin}`);
    L.marker(destCoords, { icon: portIcon }).addTo(map).bindPopup(`<b>Destination</b><br>${request.destination}`);

    // Calculate Current Position based on Dates
    let progress = 0; // 0 to 1
    const etd = request.etd ? new Date(request.etd).getTime() : 0;
    const eta = request.eta ? new Date(request.eta).getTime() : 0;
    const now = Date.now();

    if (etd && eta && eta > etd) {
        progress = (now - etd) / (eta - etd);
        progress = Math.max(0, Math.min(1, progress));
    }

    // Find position on path
    const currentPosIndex = Math.floor(progress * (pathCoords.length - 1));
    const currentLatLng = pathCoords[currentPosIndex] || originCoords;

    L.marker(currentLatLng as [number, number], { icon: activeIcon }).addTo(map)
      .bindPopup(`<b>Current Status</b><br>${Math.round(progress * 100)}% Complete`);

    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [request.id, originCoords, destCoords, request.etd, request.eta, request.origin, request.destination, request.shippingMethod]);

  if (!originCoords || !destCoords) {
    return (
        <div className="bg-slate-50 border border-slate-200 rounded-xl h-64 flex items-center justify-center flex-col text-slate-400">
            <MapPin size={32} className="mb-2 opacity-50" />
            <p className="text-sm font-medium">Map visualization unavailable</p>
            <p className="text-xs">Locations not mapped to coordinates.</p>
        </div>
    );
  }

  return (
    <div className="relative w-full h-80 rounded-xl overflow-hidden shadow-sm border border-slate-200 z-0">
      <div ref={mapRef} className="w-full h-full bg-slate-100" />
      <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg shadow-sm text-xs font-bold text-slate-700 z-[1000] border border-slate-200 pointer-events-none">
         Live Tracking
      </div>
    </div>
  );
};

export default RouteMap;
