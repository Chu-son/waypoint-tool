import { useAppStore } from "../../../stores/appStore";
import { Select } from "../common/Select";
import { Input } from "../common/Input";
import { Checkbox } from "../common/Checkbox";
import { FormField } from "../common/FormField";
import { Slider } from "../common/Slider";
import { BrowseInput } from "../common/BrowseInput";
import { SectionDivider } from "../common/SectionDivider";
import { Button } from "../common/Button";
import { DEFAULT_PATH_COLOR } from '../../../utils/colorPresets';
import { ACCENT_THEME_PRESETS } from '../../../utils/themePresets';
import { NumericInput } from "../NumericInput";
import { Moon, Sun } from "lucide-react";
import { cn } from "../../../utils/cn";

export function GeneralTab() {
  const themeMode = useAppStore((state) => state.themeMode);
  const setThemeMode = useAppStore((state) => state.setThemeMode);
  const themePreset = useAppStore((state) => state.themePreset);
  const setThemePreset = useAppStore((state) => state.setThemePreset);
  const isCustomUiMode = useAppStore((state) => state.isCustomUiMode);
  const customUiConfig = useAppStore((state) => state.customUiConfig);

  const defaultMapOpacity = useAppStore((state) => state.defaultMapOpacity);
  const setDefaultMapOpacity = useAppStore((state) => state.setDefaultMapOpacity);
  const lastDirectory = useAppStore((state) => state.lastDirectory);
  const indexStartIndex = useAppStore((state) => state.indexStartIndex);
  const decimalPrecision = useAppStore((state) => state.decimalPrecision);
  const globalPythonPath = useAppStore((state) => state.globalPythonPath);

  const pathColor = useAppStore((state) => state.pathColor);
  const setPathColor = useAppStore((state) => state.setPathColor);
  const pathOpacity = useAppStore((state) => state.pathOpacity);
  const setPathOpacity = useAppStore((state) => state.setPathOpacity);
  const pathWidth = useAppStore((state) => state.pathWidth);
  const setPathWidth = useAppStore((state) => state.setPathWidth);
  const syncPathWidthWithFootprint = useAppStore((state) => state.syncPathWidthWithFootprint);
  const setSyncPathWidthWithFootprint = useAppStore((state) => state.setSyncPathWidthWithFootprint);
  const occupancySettings = useAppStore((state) => state.occupancySettings);
  const updateOccupancySettings = useAppStore((state) => state.updateOccupancySettings);

  const setIndexStartIndex = useAppStore((state) => state.setIndexStartIndex);
  const setGlobalPythonPath = useAppStore((state) => state.setGlobalPythonPath);

  return (
    <div className="space-y-6 max-w-lg animate-in fade-in slide-in-from-bottom-2 duration-300">
      <FormField
        label="Color Theme"
        description="Choose between Dark mode (Linear Dark) and Light mode (Linear Light)."
      >
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Color Theme">
          <Button
            type="button"
            variant={themeMode === "dark" ? "secondary" : "ghost"}
            onClick={() => setThemeMode("dark")}
            aria-pressed={themeMode === "dark"}
            className={cn(
              "h-8 text-[13px] font-medium justify-center rounded-md border flex items-center gap-2 transition-all",
              themeMode === "dark"
                ? "bg-primary-base/15 border-primary-base text-primary-base shadow-xs hover:bg-primary-base/20 hover:border-primary-base"
                : "border-border-base/50 text-text-muted hover:text-text-base hover:bg-surface-hover"
            )}
          >
            <Moon className="w-4 h-4 shrink-0" />
            <span>Dark (Linear Dark)</span>
          </Button>
          <Button
            type="button"
            variant={themeMode === "light" ? "secondary" : "ghost"}
            onClick={() => setThemeMode("light")}
            aria-pressed={themeMode === "light"}
            className={cn(
              "h-8 text-[13px] font-medium justify-center rounded-md border flex items-center gap-2 transition-all",
              themeMode === "light"
                ? "bg-primary-base/15 border-primary-base text-primary-base shadow-xs hover:bg-primary-base/20 hover:border-primary-base"
                : "border-border-base/50 text-text-muted hover:text-text-base hover:bg-surface-hover"
            )}
          >
            <Sun className="w-4 h-4 shrink-0" />
            <span>Light (Linear Light)</span>
          </Button>
        </div>
        <div className="mt-3 pt-3 border-t border-border-base/40 space-y-1.5">
          <div className="text-[11px] font-medium text-text-muted">
            Accent Theme
          </div>
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Accent Theme Presets">
            {ACCENT_THEME_PRESETS.map((preset) => {
              const currentPreset =
                themePreset === "roomba"
                  ? "emerald"
                  : themePreset === "dark"
                  ? "default"
                  : themePreset || "default";
              const isSelected = currentPreset === preset.id;
              return (
                <Button
                  key={preset.id}
                  type="button"
                  variant={isSelected ? "secondary" : "ghost"}
                  onClick={() => setThemePreset(preset.id)}
                  aria-pressed={isSelected}
                  className={cn(
                    "h-8 text-xs font-medium justify-start px-2.5 rounded-md border flex items-center gap-2 transition-all",
                    isSelected
                      ? "bg-primary-base/15 border-primary-base text-text-base shadow-xs hover:bg-primary-base/20 hover:border-primary-base"
                      : "border-border-base/50 text-text-muted hover:text-text-base hover:bg-surface-hover"
                  )}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs ring-1 ring-black/20"
                    style={{ backgroundColor: preset.primaryColor }}
                  />
                  <span className="truncate">{preset.title}</span>
                </Button>
              );
            })}
          </div>
        </div>
        {isCustomUiMode && customUiConfig?.theme && (
          <p className="text-[11px] text-text-muted/80 mt-1">
            Custom UI theme is active and overriding default appearance.
          </p>
        )}
      </FormField>
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
        <SectionDivider title="Path Appearance" />

        <FormField
          label="Path Color"
          description="Color used to render paths across the canvas."
        >
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={pathColor || DEFAULT_PATH_COLOR}
              onChange={(e) => setPathColor(e.target.value)}
              className="w-8 h-8 rounded-md border border-border-base cursor-pointer bg-transparent p-0 shrink-0"
            />
            <Input
              value={pathColor || DEFAULT_PATH_COLOR}
              onChange={(e) => setPathColor(e.target.value)}
              className="w-32 font-mono"
            />
          </div>
        </FormField>

        <FormField
          label="Path Opacity"
          labelRight={`${Math.round((pathOpacity ?? 0.7) * 100)}%`}
          description="Transparency of path line and corridor ribbon."
        >
          <Slider
            min={0.1}
            max={1}
            step={0.05}
            value={pathOpacity ?? 0.7}
            onChange={(e) => setPathOpacity(parseFloat(e.target.value))}
          />
        </FormField>

        <FormField
          label="Path Width & Footprint Sync"
          description="Width of the path corridor in meters. When synced, path width automatically matches robot dimensions."
        >
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs text-text-muted cursor-pointer hover:text-text-base">
              <Checkbox
                checked={syncPathWidthWithFootprint}
                onChange={(e) => setSyncPathWidthWithFootprint(e.target.checked)}
              />
              <span>Sync width with Robot Footprint</span>
            </label>
            <div className="flex items-center gap-2">
              <NumericInput
                min={0.01}
                step={0.01}
                precision={2}
                value={pathWidth ?? 0.1}
                disabled={syncPathWidthWithFootprint}
                onChange={(val) => setPathWidth(val)}
                className="w-32 h-8 text-xs font-mono"
              />
              <span className="text-xs text-text-muted font-mono">meters</span>
            </div>
          </div>
        </FormField>
      </div>

      <div className="pt-4 border-t border-border-base/40 space-y-4">
        <SectionDivider title="Occupancy Grid & Map Thresholds" />

        {/* Visual Threshold Bar */}
        <div className="p-3 bg-surface-base/60 border border-border-base/40 rounded-xl space-y-2">
          <div className="flex justify-between text-[11px] font-semibold text-text-muted">
            <span className="text-occupancy-free flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-occupancy-free inline-block" />
              Free Space (&lt;= {occupancySettings.defaultFreeThresh.toFixed(2)})
            </span>
            <span className="text-occupancy-unknown flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-occupancy-unknown inline-block" />
              Unknown
            </span>
            <span className="text-occupancy-obstacle flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-occupancy-obstacle inline-block" />
              Obstacle (&gt;= {occupancySettings.defaultOccupiedThresh.toFixed(2)})
            </span>
          </div>

          <div className="h-4 w-full rounded-md overflow-hidden flex border border-border-base/40 text-[9px] font-bold text-text-inverse text-center leading-4">
            <div
              style={{ width: `${Math.min(100, Math.max(0, occupancySettings.defaultFreeThresh * 100))}%` }}
              className="bg-occupancy-free/80 transition-all"
              title={`Free Space: 0.00 ~ ${occupancySettings.defaultFreeThresh.toFixed(2)}`}
            >
              Free
            </div>
            <div
              style={{
                width: `${Math.max(
                  0,
                  (occupancySettings.defaultOccupiedThresh -
                    occupancySettings.defaultFreeThresh) *
                    100
                )}%`,
              }}
              className="bg-occupancy-unknown/80 transition-all"
              title={`Unknown: ${occupancySettings.defaultFreeThresh.toFixed(2)} ~ ${occupancySettings.defaultOccupiedThresh.toFixed(2)}`}
            >
              Unknown
            </div>
            <div
              style={{
                width: `${Math.max(
                  0,
                  (1.0 - occupancySettings.defaultOccupiedThresh) * 100
                )}%`,
              }}
              className="bg-occupancy-obstacle/80 transition-all"
              title={`Obstacle: ${occupancySettings.defaultOccupiedThresh.toFixed(2)} ~ 1.00`}
            >
              Obstacle
            </div>
          </div>
        </div>

        <FormField
          label="Default Occupied Threshold"
          labelRight={occupancySettings.defaultOccupiedThresh.toFixed(2)}
          description="Occupancy probability above which a cell is classified as an Obstacle (Standard: 0.65)."
        >
          <Slider
            min={0}
            max={1}
            step={0.01}
            value={occupancySettings.defaultOccupiedThresh}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              const curFree = occupancySettings.defaultFreeThresh;
              updateOccupancySettings({
                defaultOccupiedThresh: Math.max(val, curFree),
              });
            }}
          />
        </FormField>

        <FormField
          label="Default Free Space Threshold"
          labelRight={occupancySettings.defaultFreeThresh.toFixed(2)}
          description="Occupancy probability below which a cell is classified as Free space (Standard: 0.196 ~ 0.25)."
        >
          <Slider
            min={0}
            max={1}
            step={0.01}
            value={occupancySettings.defaultFreeThresh}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              const curOcc = occupancySettings.defaultOccupiedThresh;
              updateOccupancySettings({
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
            value={occupancySettings.defaultNegate}
            onChange={(e) =>
              updateOccupancySettings({
                defaultNegate: parseInt(e.target.value) as 0 | 1,
              })
            }
          >
            <option value={0}>0 (Standard: Black = Obstacle, White = Free)</option>
            <option value={1}>1 (Inverted: White = Obstacle, Black = Free)</option>
          </Select>
        </FormField>
      </div>
    </div>
  );
}
