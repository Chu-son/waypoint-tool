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
        label="Toolbar Max Columns"
        labelRight={String(toolPanelMaxColumns)}
        description="Maximum column wrapping allowed on the Main Tool Panel before overflowing."
      >
        <Slider
          min={1}
          max={5}
          step={1}
          value={toolPanelMaxColumns}
          onChange={(e) => setToolPanelMaxColumns(parseInt(e.target.value))}
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
    </div>
  );
}
