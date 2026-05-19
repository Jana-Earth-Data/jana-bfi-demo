"use client";

import dynamic from "next/dynamic";
import type { FacilityMapInnerProps } from "./facility-map-inner";

const FacilityMapInner = dynamic(
  () => import("./facility-map-inner").then((m) => m.FacilityMapInner),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex items-center justify-center rounded-lg border border-line bg-panel/40 text-sm text-slate-500"
        style={{ height: 360 }}
      >
        Loading map...
      </div>
    ),
  }
);

export function FacilityMap(props: FacilityMapInnerProps) {
  return <FacilityMapInner {...props} />;
}
