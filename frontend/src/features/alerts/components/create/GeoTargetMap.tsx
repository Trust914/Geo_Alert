import { useCallback, useRef, useState } from "react";
import Map, { NavigationControl, ScaleControl } from "react-map-gl";
import * as turf from "@turf/turf"; // Ensure you have this: npm install @turf/turf
import { TargetType, type AlertTarget } from "../../types/alert.types";
import { Button } from "../../../../components/ui/Button";
import DrawControl from "./DrawControl";
import { ENV } from "../../../../config";

import "mapbox-gl/dist/mapbox-gl.css";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";

interface GeoTargetMapProps {
  onTargetChange: (target: AlertTarget) => void;
}

export function GeoTargetMap({ onTargetChange }: GeoTargetMapProps) {
  const [mode, setMode] = useState<TargetType>(TargetType.POLYGON);
  const [radius, setRadius] = useState(5000);
  const [pathWidth, setPathWidth] = useState(1000);

  const [viewState, setViewState] = useState({
    latitude: 9.082,
    longitude: 8.6753,
    zoom: 5,
  });

  const onUpdate = useCallback(
    (e: { features: any[] }) => {
      const data = e.features[0]; // The shape the user just drew
      if (!data) return;

      // 1. POLYGON (User draws a custom shape)
      if (mode === TargetType.POLYGON) {
        onTargetChange({
          targetType: TargetType.POLYGON,
          geometry: data.geometry,
          locationName: "Custom Polygon Area",
        });
      }
      // 2. PATH (User draws a line -> We inflate it)
      else if (mode === TargetType.PATH) {
        // Convert the line string into a polygon "buffer"
        const buffered = turf.buffer(data.geometry, pathWidth / 1000, { units: "kilometers" });
        onTargetChange({
          targetType: TargetType.PATH,
          geometry: buffered?.geometry,
          bufferMeters: pathWidth,
          locationName: `Path Area (+${pathWidth}m buffer)`,
        });
      }
      // 3. RADIUS (User drops a point -> We circle it)
      else if (mode === TargetType.RADIUS) {
        // Data.geometry is a "Point". We convert it to a "Polygon" (Circle)
        const center = data.geometry.coordinates; // [lng, lat]
        const circle = turf.circle(center, radius / 1000, { units: "kilometers" });

        onTargetChange({
          targetType: TargetType.RADIUS,
          geometry: circle.geometry,
          radiusMeters: radius,
          locationName: `Radius Area (${(radius/1000).toFixed(1)}km)`,
        });
      }
    },
    [mode, pathWidth, radius, onTargetChange],
  );

  // Helper to determine the drawing mode for Mapbox Draw
  const getDrawMode = () => {
    if (mode === TargetType.PATH) return "draw_line_string";
    if (mode === TargetType.RADIUS) return "draw_point"; // FIX: Enable point mode
    return "draw_polygon";
  };

  return (
    <div className="flex flex-col h-[600px] border rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-900">
      {/* Controls Bar */}
      <div className="bg-white dark:bg-gray-800 p-3 border-b flex flex-wrap items-center gap-4 z-10 shadow-sm">
        <div className="flex gap-2">
          {/* Buttons to switch modes */}
          <Button size="sm" variant={mode === TargetType.POLYGON ? "default" : "outline"} onClick={() => setMode(TargetType.POLYGON)}>Draw Shape</Button>
          <Button size="sm" variant={mode === TargetType.RADIUS ? "default" : "outline"} onClick={() => setMode(TargetType.RADIUS)}>Radius Point</Button>
          <Button size="sm" variant={mode === TargetType.PATH ? "default" : "outline"} onClick={() => setMode(TargetType.PATH)}>Path / Line</Button>
        </div>

        {/* Sliders appear dynamically */}
        {mode === TargetType.RADIUS && (
          <div className="flex items-center gap-3 text-sm pl-4 border-l">
            <span className="font-medium">Radius: {(radius / 1000).toFixed(1)} km</span>
            <input type="range" min="100" max="50000" step="100" value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="w-32" />
          </div>
        )}
        {mode === TargetType.PATH && (
          <div className="flex items-center gap-3 text-sm pl-4 border-l">
            <span className="font-medium">Buffer: {(pathWidth / 1000).toFixed(1)} km</span>
            <input type="range" min="100" max="10000" step="100" value={pathWidth} onChange={(e) => setPathWidth(Number(e.target.value))} className="w-32" />
          </div>
        )}
      </div>

      {/* Map */}
      <div className="relative flex-1 w-full h-full">
        <Map
          {...viewState}
          onMove={evt => setViewState(evt.viewState)}
          style={{ width: "100%", height: "100%" }}
          mapStyle="mapbox://styles/mapbox/streets-v12"
          mapboxAccessToken={ENV.MAPBOX_PUBLIC_TOKEN}
        >
          <NavigationControl position="bottom-right" />
          <ScaleControl unit="metric" position="bottom-left" />

          <DrawControl
            key={mode} // FORCE RENDER: This is crucial. When mode changes, we must reset the draw tool.
            position="top-right"
            displayControlsDefault={false}
            controls={{
              polygon: mode === TargetType.POLYGON,
              line_string: mode === TargetType.PATH,
              point: mode === TargetType.RADIUS, // FIX: Enable point tool for Radius
              trash: true,
            }}
            defaultMode={getDrawMode()} // FIX: Use helper to switch to 'draw_point'
            onCreate={onUpdate}
            onUpdate={onUpdate}
            onDelete={() => {}}
          />
        </Map>
      </div>
    </div>
  );
}