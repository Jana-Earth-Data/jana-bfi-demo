"use client";

/**
 * Leaflet-based facility map. Imported dynamically (ssr:false) from
 * facility-map.tsx because Leaflet touches window during module init.
 */
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import { useEffect, useMemo } from "react";
import { MatchedFacility } from "@/lib/types/bfi";

type MarkerPoint = {
  facility: MatchedFacility;
  color: "red" | "amber" | "green" | "slate";
};

function divIcon(color: MarkerPoint["color"]) {
  const fill =
    color === "red"
      ? "#fca5a5"
      : color === "amber"
        ? "#fcd34d"
        : color === "green"
          ? "#86efac"
          : "#94a3b8";
  return L.divIcon({
    className: "",
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -10],
    html: `
      <span style="
        display:block; width:22px; height:22px; border-radius:9999px;
        background:${fill}; border:2px solid #0b1220;
        box-shadow:0 0 0 2px ${fill}66;
      "></span>
    `,
  });
}

function FitBounds({ points }: { points: MarkerPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    const valid = points.filter(
      (p) => Number.isFinite(p.facility.lat) && Number.isFinite(p.facility.lng)
    );
    if (valid.length === 0) return;
    if (valid.length === 1) {
      map.setView([valid[0].facility.lat, valid[0].facility.lng], 9);
      return;
    }
    const bounds = L.latLngBounds(
      valid.map((p) => [p.facility.lat, p.facility.lng] as [number, number])
    );
    map.fitBounds(bounds, { padding: [30, 30] });
  }, [points, map]);
  return null;
}

export type FacilityMapInnerProps = {
  points: MarkerPoint[];
  height?: number | string;
};

export function FacilityMapInner({
  points,
  height = 360,
}: FacilityMapInnerProps) {
  const valid = useMemo(
    () =>
      points.filter(
        (p) => Number.isFinite(p.facility.lat) && Number.isFinite(p.facility.lng)
      ),
    [points]
  );
  // Default to Nepal central view
  const center: [number, number] =
    valid.length > 0
      ? [valid[0].facility.lat, valid[0].facility.lng]
      : [28.0, 84.0];

  return (
    <div
      className="overflow-hidden rounded-lg border border-line"
      style={{ height }}
    >
      <MapContainer
        center={center}
        zoom={7}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%", background: "#0b1220" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        {valid.map((p, i) => (
          <Marker
            key={`${p.facility.assetId}-${i}`}
            position={[p.facility.lat, p.facility.lng]}
            icon={divIcon(p.color)}
          >
            <Popup>
              <div style={{ minWidth: 200 }}>
                <div style={{ fontWeight: 600 }}>{p.facility.facilityName}</div>
                {p.facility.municipality && (
                  <div style={{ fontSize: 12, color: "#475569" }}>
                    {p.facility.municipality}
                    {p.facility.subnationalUnit
                      ? `, ${p.facility.subnationalUnit}`
                      : ""}
                  </div>
                )}
                <div style={{ marginTop: 6, fontSize: 12 }}>
                  {p.facility.annualCo2eTonnes.toLocaleString()} tCO₂e /{" "}
                  {p.facility.emissionsYear}
                </div>
                {p.facility.cementCapacityMtpa != null && (
                  <div style={{ fontSize: 12, color: "#475569" }}>
                    {p.facility.cementCapacityMtpa.toFixed(2)} Mt/yr cement
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
        <FitBounds points={valid} />
      </MapContainer>
    </div>
  );
}
