import { WaypointTree } from './WaypointTree';
import { AnnotationTree } from './AnnotationTree';

export function ObjectsPanel() {
  return (
    <div className="flex-1 overflow-y-auto w-full flex flex-col p-3 space-y-6 bg-surface-base/10">
      {/* Waypoints Section */}
      <div className="space-y-2 flex flex-col">
        <WaypointTree />
      </div>

      {/* Divider */}
      <div className="h-px bg-border-base/30 shrink-0" />

      {/* Annotations Section */}
      <div className="space-y-2 flex flex-col">
        <AnnotationTree />
      </div>
    </div>
  );
}
