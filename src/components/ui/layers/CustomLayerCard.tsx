import { useState } from 'react';
import { Pencil, Sparkles, Settings2, Bookmark } from 'lucide-react';
import { Button } from '../common/Button';
import { Slider } from '../common/Slider';
import { Select } from '../common/Select';
import { Input } from '../common/Input';
import { FieldLabel } from '../common/FieldLabel';
import { CustomLayer } from '../../../types/store';
import { cn } from '../../../utils/cn';
import { LayerCardShell } from './LayerCardShell';

interface CustomLayerCardProps {
  layer: CustomLayer;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  isActive: boolean;
  isEditing: boolean;
  onSelect: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onToggleEdit: () => void;
  onOpenInspector: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggleVisible: () => void;
  onRemove: () => void;
  onUpdateLayer: (updates: Partial<CustomLayer>) => void;
}

export function CustomLayerCard({
  layer,
  index,
  isFirst,
  isLast,
  isActive,
  isEditing,
  onSelect,
  onContextMenu,
  onToggleEdit,
  onOpenInspector,
  onMoveUp,
  onMoveDown,
  onToggleVisible,
  onRemove,
  onUpdateLayer,
}: CustomLayerCardProps) {
  const isManual = layer.type === 'manual';
  const [showSettings, setShowSettings] = useState(false);

  return (
    <LayerCardShell
      visible={layer.visible}
      isActive={isActive || isEditing}
      onClick={onSelect}
      onContextMenu={onContextMenu}
      onMoveUp={onMoveUp}
      onMoveDown={onMoveDown}
      isFirst={isFirst}
      isLast={isLast}
      icon={
        isManual ? (
          <Pencil size={14} className="text-primary-base shrink-0" />
        ) : (
          <Sparkles size={14} className="text-accent-automation shrink-0" />
        )
      }
      title={
        <Input
          value={layer.name}
          onChange={(e) => onUpdateLayer({ name: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          className="h-6 text-sm font-bold bg-transparent border-none p-0 focus:ring-0 focus:bg-surface-base/50 truncate max-w-[140px]"
        />
      }
      subBadges={
        <>
          <span
            className={cn(
              'text-[9px] font-bold uppercase px-1 py-0.2 rounded',
              isManual ? 'bg-primary-base/15 text-primary-base' : 'bg-accent-automation/20 text-accent-automation',
            )}
          >
            {isManual ? 'Manual' : 'Plugin'}
          </span>
          {layer.is_reference && (
            <span
              className="text-[9px] font-bold uppercase px-1 py-0.2 rounded bg-accent-reference/20 text-accent-reference border border-accent-reference/30"
              title="Reference Layer (Excluded from Merge/Export)"
            >
              REF
            </span>
          )}
          <span className="text-[10px] text-text-muted uppercase tracking-wider font-medium">
            Layer {index + 1} {isManual ? `• ${layer.editObjects.length} obj` : ''}
          </span>
        </>
      }
      headerActions={
        <>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'h-7 w-7 transition-all',
              layer.is_reference
                ? 'text-accent-reference bg-accent-reference/20 hover:bg-accent-reference/30 border border-accent-reference/40'
                : 'text-text-muted hover:text-accent-reference hover:bg-accent-reference/10',
            )}
            onClick={(e) => {
              e.stopPropagation();
              onUpdateLayer({ is_reference: !layer.is_reference });
            }}
            title={
              layer.is_reference
                ? 'Reference Layer: ON (マージ除外・オーバーレイ参照用)'
                : 'Reference Layer: OFF (通常レイヤー)'
            }
          >
            <Bookmark size={14} className={layer.is_reference ? 'fill-accent-reference' : ''} />
          </Button>

          {isManual ? (
            <Button
              variant={isEditing ? 'primary' : 'ghost'}
              size="icon"
              className="h-7 w-7 text-text-muted hover:text-primary-base hover:bg-primary-base/10"
              onClick={(e) => {
                e.stopPropagation();
                onToggleEdit();
              }}
              title={isEditing ? 'Stop Vector Editing' : 'Start Vector Editing'}
            >
              <Pencil size={14} className={isEditing ? 'text-primary-base' : ''} />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-text-muted hover:text-accent-automation hover:bg-accent-automation/10"
              onClick={(e) => {
                e.stopPropagation();
                onOpenInspector();
              }}
              title="Edit Parameters / Re-generate in Inspector"
            >
              <Settings2 size={15} />
            </Button>
          )}
        </>
      }
      showSettings={showSettings}
      onToggleSettings={() => setShowSettings(!showSettings)}
      settingsTooltip="Edit Layer Settings (Opacity, Blend Mode)"
      onToggleVisible={onToggleVisible}
      onRemove={onRemove}
      removeTooltip="Remove Layer"
    >
      {/* Display Settings */}
      <div className="space-y-2">
        <span className="text-[11px] font-bold text-text-base">Display</span>
        <Slider
          label="Opacity"
          valueDisplay={`${Math.round((layer.opacity ?? 1) * 100)}%`}
          min="0"
          max="1"
          step="0.05"
          value={layer.opacity ?? 1}
          onChange={(e) => onUpdateLayer({ opacity: parseFloat(e.target.value) })}
        />

        <div className="flex flex-col gap-1 mt-1">
          <FieldLabel>Blend Mode</FieldLabel>
          <Select
            value={layer.blend_mode || 'overwrite'}
            disabled={!!layer.is_reference}
            onChange={(e) => onUpdateLayer({ blend_mode: e.target.value as any })}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'h-7 text-xs bg-surface-base border-border-base/50',
              layer.is_reference && 'opacity-50 cursor-not-allowed bg-surface-base/30',
            )}
          >
            <option value="overwrite">Overwrite</option>
            <option value="merge_obstacles">Merge Obstacles</option>
            <option value="merge_free">Merge Free Space</option>
          </Select>
          {layer.is_reference && (
            <p className="text-[9px] text-accent-reference/80 text-right">※ 参照レイヤーのため合成されません</p>
          )}
        </div>
      </div>

      {/* Layer Actions */}
      <div className="pt-2 border-t border-border-base/30 flex items-center justify-between gap-2">
        {isManual ? (
          <span className="text-[10px] text-text-muted">
            Objects: <span className="font-semibold text-text-base">{layer.editObjects.length}</span>
          </span>
        ) : (
          <span className="text-[10px] text-text-muted truncate">
            Plugin: <span className="font-semibold text-text-base">{layer.plugin_id || 'Generator'}</span>
          </span>
        )}
        {!isManual && (
          <Button
            variant="secondary"
            size="sm"
            className="h-6 text-[10px] px-2"
            onClick={(e) => {
              e.stopPropagation();
              onOpenInspector();
            }}
          >
            <Settings2 size={12} />
            <span>Inspector</span>
          </Button>
        )}
      </div>
    </LayerCardShell>
  );
}
