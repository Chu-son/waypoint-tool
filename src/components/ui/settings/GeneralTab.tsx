import { useAppStore } from "../../../stores/appStore";
import { Select } from "../common/Select";
import { FormField } from "../common/FormField";
import { Slider } from "../common/Slider";
import { BrowseInput } from "../common/BrowseInput";

export function GeneralTab() {
  const defaultMapOpacity = useAppStore((state) => state.defaultMapOpacity);
  const setDefaultMapOpacity = (opacity: number) =>
    useAppStore.setState({ defaultMapOpacity: opacity, isDirty: true });
  const lastDirectory = useAppStore((state) => state.lastDirectory);
  const indexStartIndex = useAppStore((state) => state.indexStartIndex);
  const decimalPrecision = useAppStore((state) => state.decimalPrecision);
  const globalPythonPath = useAppStore((state) => state.globalPythonPath);

  const setIndexStartIndex = useAppStore((state) => state.setIndexStartIndex);
  const setGlobalPythonPath = useAppStore((state) => state.setGlobalPythonPath);

  return (
    <div className="space-y-6 max-w-lg animate-in fade-in slide-in-from-bottom-2 duration-300">
      <FormField
        label="Default Map Opacity"
        labelRight={`${Math.round(defaultMapOpacity * 100)}%`}
        description="The default transparency applied to newly loaded map layers."
      >
        <Slider
          min={0}
          max={1}
          step={0.05}
          value={defaultMapOpacity}
          onChange={(e) => setDefaultMapOpacity(parseFloat(e.target.value))}
        />
      </FormField>

      <FormField
        label="Last Used Directory"
        description="Remembered location for Save/Open dialogs across sessions."
      >
        <div className="p-3 bg-surface-base/50 border border-border-base/50 rounded-lg text-[11px] text-text-muted font-mono break-all line-clamp-2 shadow-inner">
          {lastDirectory || "None"}
        </div>
      </FormField>

      <FormField
        label="Waypoint Index Start"
        description="Determines the starting index count for Waypoints across the Canvas and Exports."
      >
        <Select
          value={indexStartIndex}
          onChange={(e) => setIndexStartIndex(parseInt(e.target.value) as 0 | 1)}
          className="h-10 text-sm"
        >
          <option value={0}>0 (0-indexed)</option>
          <option value={1}>1 (1-indexed)</option>
        </Select>
      </FormField>

      <FormField
        label="Decimal Precision"
        labelRight={String(decimalPrecision)}
        description="Number of decimal places shown in numeric input fields (Inspector, Properties)."
      >
        <Slider
          min={0}
          max={12}
          step={1}
          value={decimalPrecision}
          onChange={(e) =>
            useAppStore.setState({
              decimalPrecision: parseInt(e.target.value),
              isDirty: true,
            })
          }
        />
      </FormField>

      <FormField
        label="Global Python Interpreter Path"
        description="The default command or path used to execute Python plugins (e.g. `python`, `python3` or absolute path to a virtual environment)."
      >
        <BrowseInput
          value={globalPythonPath}
          onChange={setGlobalPythonPath}
          placeholder="e.g. python, python3, /usr/bin/python3.10"
          list="python-envs"
        />
      </FormField>

      <div className="pt-4 border-t border-border-base/40 space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-text-base">
          Path Appearance
        </h4>

        <FormField
          label="Path Color"
          description="Color used to render paths across the canvas."
        >
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={useAppStore.getState().pathColor || '#10b981'}
              onChange={(e) => useAppStore.getState().setPathColor(e.target.value)}
              className="w-9 h-9 rounded border border-border-base cursor-pointer bg-transparent p-0"
            />
            <input
              type="text"
              value={useAppStore.getState().pathColor || '#10b981'}
              onChange={(e) => useAppStore.getState().setPathColor(e.target.value)}
              className="px-3 py-1.5 text-xs font-mono bg-surface-base border border-border-base rounded-lg text-text-base focus:outline-none focus:border-primary-base w-32"
            />
          </div>
        </FormField>

        <FormField
          label="Path Opacity"
          labelRight={`${Math.round((useAppStore.getState().pathOpacity ?? 0.7) * 100)}%`}
          description="Transparency of path line and corridor ribbon."
        >
          <Slider
            min={0.1}
            max={1}
            step={0.05}
            value={useAppStore.getState().pathOpacity ?? 0.7}
            onChange={(e) => useAppStore.getState().setPathOpacity(parseFloat(e.target.value))}
          />
        </FormField>

        <FormField
          label="Path Width & Footprint Sync"
          description="Width of the path corridor in meters. When synced, path width automatically matches robot dimensions."
        >
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs text-text-muted cursor-pointer hover:text-text-base">
              <input
                type="checkbox"
                checked={useAppStore.getState().syncPathWidthWithFootprint}
                onChange={(e) => useAppStore.getState().setSyncPathWidthWithFootprint(e.target.checked)}
                className="rounded border-border-base text-primary-base focus:ring-primary-base"
              />
              <span>Sync width with Robot Footprint</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.01"
                value={useAppStore.getState().pathWidth ?? 0.1}
                disabled={useAppStore.getState().syncPathWidthWithFootprint}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val)) useAppStore.getState().setPathWidth(val);
                }}
                className="w-32 px-3 py-1.5 text-xs bg-surface-base border border-border-base rounded-lg text-text-base focus:outline-none focus:border-primary-base disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <span className="text-xs text-text-muted font-mono">meters</span>
            </div>
          </div>
        </FormField>
      </div>
    </div>
  );
}
