"use client";

import Map from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";

export default function MapTest() {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  console.log("Mapbox token present:", !!token, "length:", token?.length);

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <Map
        initialViewState={{
          longitude: 12.4964,
          latitude: 41.9028,
          zoom: 12
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        mapboxAccessToken={token}
        onError={(e: any) => console.error("Mapbox error:", e)}
        onLoad={() => console.log("Mapbox loaded successfully")}
      />
    </div>
  );
}
