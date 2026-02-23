import { useAppStore } from '../../stores/appStore';
import { v4 as uuidv4 } from 'uuid';

export function MapCanvasPlaceholder() {
  const activeTool = useAppStore(state => state.activeTool);
  const addNode = useAppStore(state => state.addNode);
  const selectNodes = useAppStore(state => state.selectNodes);

  // Simulated click handler on the "canvas"
  const handleCanvasClick = () => {
    if (activeTool === 'add_point') {
      const id = uuidv4();
      addNode({
        id,
        type: 'manual',
        transform: {
          x: Math.round(Math.random() * 10 - 5), // Fake world coords
          y: Math.round(Math.random() * 10 - 5),
          z: 0,
          qx: 0,
          qy: 0,
          qz: 0,
          qw: 1
        },
        options: {}
      });
      // Optionally auto-select the new point
      selectNodes([id]);
    } else if (activeTool === 'select') {
      // Clicking empty canvas clears selection
      selectNodes([]);
    }
  };

  return (
    <div 
      className={`absolute inset-0 flex items-center justify-center 
        ${activeTool === 'add_point' ? 'cursor-crosshair' : 'cursor-default'}`}
      onClick={handleCanvasClick}
    >
      <div className="text-slate-500 border-2 border-dashed border-slate-700 rounded-xl p-8 max-w-md text-center pointer-events-none bg-slate-900/50 backdrop-blur-sm">
        <p className="mb-4 text-white font-medium">Map Viewport Placeholder</p>
        <p className="text-sm text-slate-400 mb-2">PixiJS / WebGL canvas will be mounted here.</p>
        <div className="text-xs text-amber-500 font-mono bg-slate-950 p-2 rounded">
          Active Tool: {activeTool}
        </div>
        {activeTool === 'add_point' && (
          <p className="mt-4 text-sm text-primary animate-pulse">
            Click anywhere in the black area to add a dummy waypoint!
          </p>
        )}
      </div>
    </div>
  );
}
