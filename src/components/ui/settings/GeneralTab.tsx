import { useAppStore } from "../../../stores/appStore";
import { Label } from "../common/Label";
import { Input } from "../common/Input";
import { Select } from "../common/Select";
import { Button } from "../common/Button";

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
    <div className="space-y-6 max-w-lg animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="space-y-3">
        <Label className="flex justify-between text-sm font-semibold text-text-base">
          <span>Default Map Opacity</span>
          <span className="text-primary-base">{Math.round(defaultMapOpacity * 100)}%</span>
        </Label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={defaultMapOpacity}
          onChange={(e) => setDefaultMapOpacity(parseFloat(e.target.value))}
          className="w-full h-1.5 bg-surface-hover rounded-lg appearance-none cursor-pointer accent-primary-base transition-all hover:accent-primary-hover"
        />
        <p className="text-[11px] text-text-muted opacity-80 leading-relaxed px-1">
          The default transparency applied to newly loaded map layers.
        </p>
      </div>
      <div className="space-y-3">
        <Label className="text-sm font-semibold text-text-base">
          Last Used Directory
        </Label>
        <div className="p-3 bg-surface-base/50 border border-border-base/50 rounded-lg text-[11px] text-text-muted font-mono break-all line-clamp-2 shadow-inner">
          {lastDirectory || "None"}
        </div>
        <p className="text-[11px] text-text-muted opacity-80 leading-relaxed px-1">
          Remembered location for Save/Open dialogs across sessions.
        </p>
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-semibold text-text-base">
          Waypoint Index Start
        </Label>
        <Select
          value={indexStartIndex}
          onChange={(e) => setIndexStartIndex(parseInt(e.target.value) as 0 | 1)}
          className="h-10 text-sm"
        >
          <option value={0}>0 (0-indexed)</option>
          <option value={1}>1 (1-indexed)</option>
        </Select>
        <p className="text-[11px] text-text-muted opacity-80 leading-relaxed px-1">
          Determines the starting index count for Waypoints across the Canvas
          and Exports.
        </p>
      </div>

      <div className="space-y-3">
        <Label className="flex justify-between text-sm font-semibold text-text-base">
          <span>Decimal Precision</span>
          <span className="text-primary-base">{decimalPrecision}</span>
        </Label>
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
          className="w-full h-1.5 bg-surface-hover rounded-lg appearance-none cursor-pointer accent-primary-base transition-all hover:accent-primary-hover"
        />
        <p className="text-[11px] text-text-muted opacity-80 leading-relaxed px-1">
          Number of decimal places shown in numeric input fields (Inspector,
          Properties).
        </p>
      </div>

      <div className="space-y-3">
        <Label className="flex justify-between text-sm font-semibold text-text-base">
          <span>Toolbar Max Columns</span>
          <span className="text-primary-base">{toolPanelMaxColumns}</span>
        </Label>
        <input
          type="range"
          min="1"
          max="5"
          step="1"
          value={toolPanelMaxColumns}
          onChange={(e) => setToolPanelMaxColumns(parseInt(e.target.value))}
          className="w-full h-1.5 bg-surface-hover rounded-lg appearance-none cursor-pointer accent-primary-base transition-all hover:accent-primary-hover"
        />
        <p className="text-[11px] text-text-muted opacity-80 leading-relaxed px-1">
          Maximum column wrapping allowed on the Main Tool Panel before
          overflowing.
        </p>
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-semibold text-text-base">
          Global Python Interpreter Path
        </Label>
        <div className="flex gap-2">
          <Input
            type="text"
            list="python-envs"
            value={globalPythonPath}
            onChange={(e) => setGlobalPythonPath(e.target.value)}
            className="h-10 text-sm"
            placeholder="e.g. python, python3, /usr/bin/python3.10"
          />
          <Button
            variant="secondary"
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
            className="h-10 px-6 shrink-0"
          >
            Browse
          </Button>
        </div>
        <p className="text-[11px] text-text-muted opacity-80 leading-relaxed px-1">
          The default command or path used to execute Python plugins (e.g.{" "}
          `python`, `python3` or absolute path to a virtual environment).
        </p>
      </div>
    </div>
  );
}
