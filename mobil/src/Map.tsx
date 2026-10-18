import { lazy, Suspense, type ComponentProps } from "react";
import type { LocationMap as MapComponent } from "./LocationMap";
const LazyMap = lazy(() =>
  import("./LocationMap").then((module) => ({ default: module.LocationMap })),
);
export function LocationMap(props: ComponentProps<typeof MapComponent>) {
  return (
    <Suspense
      fallback={
        <div className="map-wrap map-placeholder" role="status">
          Harita hazırlanıyor…
        </div>
      }
    >
      <LazyMap {...props} />
    </Suspense>
  );
}
