import { useState } from 'react';
import { Crop } from 'lucide-react';
import { Input } from '../common/Input';
import { LabeledNumericInput } from '../common/LabeledNumericInput';
import { ExportRegion } from '../../../types/store';
import { LayerCardShell } from './LayerCardShell';

interface RegionCardProps {
  region: ExportRegion;
  index: number;
  onToggleVisible: () => void;
  onRemove: () => void;
  onUpdateRegion: (updates: Partial<ExportRegion>) => void;
}

export function RegionCard({ region, index, onToggleVisible, onRemove, onUpdateRegion }: RegionCardProps) {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <LayerCardShell
      visible={region.visible}
      icon={<Crop size={14} className="text-accent-generator shrink-0" />}
      title={
        <Input
          value={region.name}
          onChange={(e) => onUpdateRegion({ name: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          placeholder="Region Name"
          className="h-6 text-sm font-bold bg-transparent border-none p-0 focus:ring-0 focus:bg-surface-base/50 truncate max-w-[140px]"
        />
      }
      subBadges={
        <span className="text-[9px] font-bold uppercase px-1 py-0.2 rounded bg-accent-generator/20 text-accent-generator">
          Region {index + 1}
        </span>
      }
      showSettings={showSettings}
      onToggleSettings={() => setShowSettings(!showSettings)}
      settingsTooltip="Region Bounds Settings"
      onToggleVisible={onToggleVisible}
      onRemove={onRemove}
      removeTooltip="Remove Region"
    >
      <div className="space-y-2">
        <span className="text-[11px] font-bold text-text-base">Region Bounds</span>
        <div className="grid grid-cols-2 gap-2">
          <LabeledNumericInput
            label="X (m)"
            value={region.rect.x}
            step={0.1}
            precision={2}
            onChange={(val) => onUpdateRegion({ rect: { ...region.rect, x: val } })}
          />
          <LabeledNumericInput
            label="Y (m)"
            value={region.rect.y}
            step={0.1}
            precision={2}
            onChange={(val) => onUpdateRegion({ rect: { ...region.rect, y: val } })}
          />
          <LabeledNumericInput
            label="Width (m)"
            value={region.rect.width}
            min={0}
            step={0.1}
            precision={2}
            onChange={(val) => onUpdateRegion({ rect: { ...region.rect, width: val } })}
          />
          <LabeledNumericInput
            label="Height (m)"
            value={region.rect.height}
            min={0}
            step={0.1}
            precision={2}
            onChange={(val) => onUpdateRegion({ rect: { ...region.rect, height: val } })}
          />
        </div>
      </div>
    </LayerCardShell>
  );
}
