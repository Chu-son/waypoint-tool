import { useAppStore } from '../../../stores/appStore';
import { Select } from '../common/Select';
import { FormField } from '../common/FormField';
import { Slider } from '../common/Slider';
import { BrowseInput } from '../common/BrowseInput';
import { Sliders, Terminal, Settings2 } from 'lucide-react';
import { TabSectionHeader } from './TabSectionHeader';
import { SettingsSection } from './SettingsSection';

export function GeneralTab() {
  const lastDirectory = useAppStore((state) => state.lastDirectory);
  const indexStartIndex = useAppStore((state) => state.indexStartIndex);
  const decimalPrecision = useAppStore((state) => state.decimalPrecision);
  const globalPythonPath = useAppStore((state) => state.globalPythonPath);

  const setIndexStartIndex = useAppStore((state) => state.setIndexStartIndex);
  const setGlobalPythonPath = useAppStore((state) => state.setGlobalPythonPath);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <TabSectionHeader
        title="General Settings"
        subtitle="Configure waypoint indexing conventions, numerical precision, and environment execution paths."
        icon={Sliders}
      />

      {/* 1. System & Coordinate Conventions */}
      <SettingsSection
        title="System & Coordinate Conventions"
        description="General application behaviors and coordinate display rules."
        icon={Settings2}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            label="Waypoint Index Start"
            description="Determines whether Waypoint numbers start from 0 or 1 on the Canvas and Exports."
          >
            <Select
              value={indexStartIndex}
              onChange={(e) => setIndexStartIndex(parseInt(e.target.value) as 0 | 1)}
              className="w-full"
            >
              <option value={0}>0 (0-indexed: 0, 1, 2...)</option>
              <option value={1}>1 (1-indexed: 1, 2, 3...)</option>
            </Select>
          </FormField>

          <FormField
            label="Decimal Precision"
            labelRight={String(decimalPrecision)}
            description="Number of decimal places displayed in coordinates and numeric fields."
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
        </div>

        <FormField
          label="Last Used Directory"
          description="Remembered file system location for Open/Save dialogs across sessions."
        >
          <div className="p-3 bg-surface-base/50 border border-border-base/50 rounded-lg text-xs text-text-muted font-mono break-all line-clamp-2 shadow-inner">
            {lastDirectory || 'None'}
          </div>
        </FormField>
      </SettingsSection>

      {/* 2. Python Environment */}
      <SettingsSection
        title="Python Environment"
        description="Execution command or virtual environment path for Generator plugins."
        icon={Terminal}
      >
        <FormField
          label="Global Python Interpreter Path"
          description="The default command or absolute path used to execute Python plugins (e.g. `python`, `python3` or `/path/to/venv/bin/python`)."
        >
          <BrowseInput
            value={globalPythonPath}
            onChange={setGlobalPythonPath}
            placeholder="e.g. python, python3, /usr/bin/python3.10"
            list="python-envs"
          />
        </FormField>
      </SettingsSection>
    </div>
  );
}
