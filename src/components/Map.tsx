"use client";

import { useEffect, useRef } from "react";

interface OrgMarker {
  name: string;
  street: string;
  houseNumber: string;
  houseNumberPostfix?: string;
  postalCode: string;
  city: string;
  telephone?: string;
  chamberOfCommerceId: string;
  lat: number;
  lng: number;
  status: string;
  qualificationType: string;
  endDate?: string;
  distanceKm?: number;
}

interface MapProps {
  markers: OrgMarker[];
  center?: { lat: number; lng: number };
  radius?: number;
}

function formatDate(dateStr?: string): string {
  if (!dateStr || dateStr.length !== 8) return "-";
  return `${dateStr.slice(6, 8)}-${dateStr.slice(4, 6)}-${dateStr.slice(0, 4)}`;
}

export default function Map({ markers, center, radius }: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const circleRef = useRef<import("leaflet").Circle | null>(null);
  const markersLayerRef = useRef<import("leaflet").LayerGroup | null>(null);

  // Initial map setup
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");

      // Fix default marker icons (Next.js asset path issue)
      // @ts-expect-error - Leaflet internal
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      // Guard against double-init in React Strict Mode
      if ((containerRef.current as HTMLElement & { _leaflet_id?: number })._leaflet_id) return;

      const map = L.map(containerRef.current!).setView([52.1, 5.3], 7);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      const layer = L.layerGroup().addTo(map);
      mapRef.current = map;
      markersLayerRef.current = layer;
    })();

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      markersLayerRef.current = null;
      circleRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update markers + circle together so bounds logic is consistent
  useEffect(() => {
    if (!mapRef.current || !markersLayerRef.current) return;

    (async () => {
      const L = (await import("leaflet")).default;
      const layer = markersLayerRef.current!;
      layer.clearLayers();

      // Remove old circle
      if (circleRef.current) {
        circleRef.current.remove();
        circleRef.current = null;
      }

      const markerIcon = new L.Icon({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      });

      for (const m of markers) {
        if (!m.lat || !m.lng) continue;

        const distanceStr =
          m.distanceKm !== undefined
            ? `<div style="color:#2563eb;font-weight:500;margin-top:6px">📍 ${
                m.distanceKm < 1
                  ? Math.round(m.distanceKm * 1000) + " m"
                  : m.distanceKm.toFixed(1) + " km"
              } afstand</div>`
            : "";

        const popup = `
          <div style="min-width:210px;font-family:sans-serif;font-size:13px;line-height:1.5">
            <div style="font-weight:700;font-size:14px;margin-bottom:2px">${m.name}</div>
            <div style="color:#555">${m.street} ${m.houseNumber}${m.houseNumberPostfix?.trim() ?? ""}</div>
            <div style="color:#555;margin-bottom:6px">${m.postalCode} ${m.city}</div>
            ${m.telephone ? `<div style="color:#333">📞 ${m.telephone}</div>` : ""}
            <div style="margin-top:6px;margin-bottom:4px">
              <span style="display:inline-block;padding:1px 10px;border-radius:9999px;font-size:11px;font-weight:600;background:${
                m.status === "Actief" ? "#dcfce7" : "#fee2e2"
              };color:${m.status === "Actief" ? "#166534" : "#991b1b"}">${m.status}</span>
            </div>
            <div style="color:#888;font-size:11px">Geldig t/m: ${formatDate(m.endDate)}</div>
            <div style="color:#888;font-size:11px">KVK: ${m.chamberOfCommerceId}</div>
            ${distanceStr}
          </div>
        `;

        L.marker([m.lat, m.lng], { icon: markerIcon })
          .bindPopup(popup)
          .addTo(layer);
      }

      // Draw radius circle + center dot, then fit to circle bounds
      if (center && radius) {
        const circle = L.circle([center.lat, center.lng], {
          radius: radius * 1000,
          color: "#3b82f6",
          fillColor: "#3b82f6",
          fillOpacity: 0.06,
          weight: 2,
          dashArray: "6 4",
        }).addTo(mapRef.current!);

        L.circleMarker([center.lat, center.lng], {
          radius: 7,
          color: "#1d4ed8",
          fillColor: "#3b82f6",
          fillOpacity: 1,
          weight: 2,
        })
          .bindTooltip("Jouw locatie", { permanent: false })
          .addTo(mapRef.current!);

        circleRef.current = circle;
        mapRef.current!.fitBounds(circle.getBounds(), { padding: [30, 30] });
      } else if (markers.length > 0) {
        // No center: fit to all markers
        const valid = markers.filter((m) => m.lat && m.lng);
        if (valid.length > 0) {
          const bounds = L.latLngBounds(valid.map((m) => [m.lat, m.lng]));
          mapRef.current!.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
        }
      }
    })();
  }, [markers, center, radius]);

  return (
    <div
      ref={containerRef}
      className="w-full rounded-lg overflow-hidden border border-gray-200 shadow-sm"
      style={{ height: "520px" }}
    />
  );
}
