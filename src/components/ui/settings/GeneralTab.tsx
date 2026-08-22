import { useAppStore } from "../../../stores/appStore";
import { Select } from "../common/Select";
import { FormField } from "../common/FormField";
import { Slider } from "../common/Slider";
import { BrowseInput } from "../common/BrowseInput";

export function GeneralTab() {
  const defaultMapOpacity = useAppStore((state) => state.defaultMapOpacity);
  const setDefaultMapOpacity = useAppStore((state) => state.setDefaultMapOpacity);
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

      <div className="pt-4 border-t border-border-base/40 space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-text-base">
          Occupancy Grid & Map Thresholds
        </h4>

        {/* Visual Threshold Bar */}
        <div className="p-3 bg-surface-base/60 border border-border-base/40 rounded-xl space-y-2">
          <div className="flex justify-between text-[11px] font-semibold text-text-muted">
            <span className="text-emerald-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              Free Space (&lt;= {useAppStore.getState().occupancySettings.defaultFreeThresh.toFixed(2)})
            </span>
            <span className="text-purple-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />
              Unknown
            </span>
            <span className="text-rose-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
              Obstacle (&gt;= {useAppStore.getState().occupancySettings.defaultOccupiedThresh.toFixed(2)})
            </span>
          </div>

          <div className="h-4 w-full rounded-md overflow-hidden flex border border-border-base/40 text-[9px] font-bold text-white text-center leading-4">
            <div
              style={{ width: `${Math.min(100, Math.max(0, useAppStore.getState().occupancySettings.defaultFreeThresh * 100))}%` }}
              className="bg-emerald-600/80 transition-all"
              title={`Free Space: 0.00 ~ ${useAppStore.getState().occupancySettings.defaultFreeThresh.toFixed(2)}`}
            >
              Free
            </div>
            <div
              style={{
                width: `${Math.max(
                  0,
                  (useAppStore.getState().occupancySettings.defaultOccupiedThresh -
                    useAppStore.getState().occupancySettings.defaultFreeThresh) *
                    100
                )}%`,
              }}
              className="bg-purple-600/80 transition-all"
              title={`Unknown: ${useAppStore.getState().occupancySettings.defaultFreeThresh.toFixed(2)} ~ ${useAppStore.getState().occupancySettings.defaultOccupiedThresh.toFixed(2)}`}
            >
              Unknown
            </div>
            <div
              style={{
                width: `${Math.max(
                  0,
                  (1.0 - useAppStore.getState().occupancySettings.defaultOccupiedThresh) * 100
                )}%`,
              }}
              className="bg-rose-600/80 transition-all"
              title={`Obstacle: ${useAppStore.getState().occupancySettings.defaultOccupiedThresh.toFixed(2)} ~ 1.00`}
            >
              Obstacle
            </div>
          </div>
        </div>

        <FormField
          label="Default Occupied Threshold"
          labelRight={useAppStore.getState().occupancySettings.defaultOccupiedThresh.toFixed(2)}
          description="Occupancy probability above which a cell is classified as an Obstacle (Standard: 0.65)."
        >
          <Slider
            min={0}
            max={1}
            step={0.01}
            value={useAppStore.getState().occupancySettings.defaultOccupiedThresh}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              const curFree = useAppStore.getState().occupancySettings.defaultFreeThresh;
              useAppStore.getState().updateOccupancySettings({
                defaultOccupiedThresh: Math.max(val, curFree),
              });
            }}
          />
        </FormField>

        <FormField
          label="Default Free Space Threshold"
          labelRight={useAppStore.getState().occupancySettings.defaultFreeThresh.toFixed(2)}
          description="Occupancy probability below which a cell is classified as Free space (Standard: 0.196 ~ 0.25)."
        >
          <Slider
            min={0}
            max={1}
            step={0.01}
            value={useAppStore.getState().occupancySettings.defaultFreeThresh}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              const curOcc = useAppStore.getState().occupancySettings.defaultOccupiedThresh;
              useAppStore.getState().updateOccupancySettings({
                defaultFreeThresh: Math.min(val, curOcc),
              });
            }}
          />
        </FormField>

        <FormField
          label="Default Negate"
          description="Inverts pixel meaning when calculating occupancy (0: Black=Obstacle, 1: White=Obstacle)."
        >
          <Select
            value={useAppStore.getState().occupancySettings.defaultNegate}
            onChange={(e) =>
              useAppStore.getState().updateOccupancySettings({
                defaultNegate: parseInt(e.target.value) as 0 | 1,
              })
            }
            className="h-10 text-sm"
          >
            <option value={0}>0 (Standard: Black = Obstacle, White = Free)</option>
            <option value={1}>1 (Inverted: White = Obstacle, Black = Free)</option>
          </Select>
        </FormField>
      </div>
    </div>
  );
}
