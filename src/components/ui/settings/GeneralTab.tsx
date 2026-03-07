import { useAppStore } from "../../../stores/appStore";

export function GeneralTab() {
  const defaultMapOpacity = useAppStore((state) => state.defaultMapOpacity);
  const setDefaultMapOpacity = (opacity: number) =>
    useAppStore.setState({ defaultMapOpacity: opacity, isDirty: true });
  const lastDirectory = useAppStore((state) => state.lastDirectory);
  const indexStartIndex = useAppStore((state) => state.indexStartIndex);
  const toolPanelMaxColumns = useAppStore((state) => state.toolPanelMaxColumns);
  const decimalPrecision = useAppStore((state) => state.decimalPrecision);
  const globalPythonPath = useAppStore((state) => state.globalPythonPath);

  const setIndexStartIndex = useAppStore((state) => state.setIndexStartIndex);
  const setToolPanelMaxColumns = useAppStore(
    (state) => state.setToolPanelMaxColumns,
  );
  const setGlobalPythonPath = useAppStore((state) => state.setGlobalPythonPath);

  return (
    <div className="space-y-6 max-w-lg">
      <div className="space-y-2">
        <label className="flex justify-between text-sm font-medium text-slate-300">
          <span>Default Map Opacity</span>
          <span>{Math.round(defaultMapOpacity * 100)}%</span>
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={defaultMapOpacity}
          onChange={(e) => setDefaultMapOpacity(parseFloat(e.target.value))}
          className="ui-range"
        />
        <p className="text-xs text-slate-500">
          The default transparency applied to newly loaded map layers.
        </p>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-300">
          Last Used Directory
        </label>
        <div className="p-2 bg-slate-900 border border-slate-700 rounded text-xs text-slate-400 font-mono break-all line-clamp-2">
          {lastDirectory || "None"}
        </div>
        <p className="text-xs text-slate-500">
          Remembered location for Save/Open dialogs across sessions.
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-300">
          Waypoint Index Start
        </label>
        <select
          value={indexStartIndex}
          onChange={(e) => setIndexStartIndex(parseInt(e.target.value) as 0 | 1)}
          className="ui-select"
        >
          <option value={0}>0 (0-indexed)</option>
          <option value={1}>1 (1-indexed)</option>
        </select>
        <p className="text-xs text-slate-500">
          Determines the starting index count for Waypoints across the Canvas
          and Exports.
        </p>
      </div>

      <div className="space-y-2">
        <label className="flex justify-between text-sm font-medium text-slate-300">
          <span>Decimal Precision</span>
          <span>{decimalPrecision}</span>
        </label>
        <input
          type="range"
          min="0"
          max="12"
          step="1"
          value={decimalPrecision}
          onChange={(e) =>
            useAppStore.setState({
              decimalPrecision: parseInt(e.target.value),
              isDirty: true,
            })
          }
          className="ui-range"
        />
        <p className="text-xs text-slate-500">
          Number of decimal places shown in numeric input fields (Inspector,
          Properties).
        </p>
      </div>

      <div className="space-y-2">
        <label className="flex justify-between text-sm font-medium text-slate-300">
          <span>Toolbar Max Columns</span>
          <span>{toolPanelMaxColumns}</span>
        </label>
        <input
          type="range"
          min="1"
          max="5"
          step="1"
          value={toolPanelMaxColumns}
          onChange={(e) => setToolPanelMaxColumns(parseInt(e.target.value))}
          className="ui-range"
        />
        <p className="text-xs text-slate-500">
          Maximum column wrapping allowed on the Main Tool Panel before
          overflowing.
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-300">
          Global Python Interpreter Path
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            list="python-envs"
            value={globalPythonPath}
            onChange={(e) => setGlobalPythonPath(e.target.value)}
            className="ui-input"
            placeholder="e.g. python, python3, /usr/bin/python3.10"
          />
          <button
            onClick={async () => {
              const { DialogAPI } = await import("../../../api");
              const selectedPath = await DialogAPI.open({
                multiple: false,
                directory: false,
              });
              if (selectedPath) {
                setGlobalPythonPath(
                  typeof selectedPath === "string"
                    ? selectedPath
                    : (selectedPath as any).path,
                );
              }
            }}
            className="ui-btn ui-btn-secondary ui-btn-md"
          >
            Browse
          </button>
        </div>
        <p className="text-xs text-slate-500">
          The default command or path used to execute Python plugins (e.g.{" "}
          `python`, `python3` or absolute path to a virtual environment).
        </p>
      </div>
    </div>
  );
}
