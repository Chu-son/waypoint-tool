import React from 'react';
import { Label } from '../common/Label';
import { cn } from '../../../utils/cn';
import { useAppStore } from '../../../stores/appStore';
import { PointForm } from './PointInputForm';
import { RectangleForm } from './RectangleInputForm';
import { WaypointSelectForm } from './WaypointSelectInputForm';
import { PointsListForm } from './PointsListInputForm';
import { AnnotationSelectForm } from './AnnotationSelectInputForm';
import { CustomLayerSelectForm } from './CustomLayerSelectInputForm';

export interface PluginInput {
  id: string;
  name?: string;
  label?: string;
  type: string;
  object_type?: 'point' | 'oriented_point' | 'line' | 'rect' | 'circle' | 'any';
  multiple?: boolean;
  required?: boolean;
  description?: string;
  min_points?: number;
  max_points?: number;
  allow_yaw?: boolean;
}

interface PluginInputEditorProps {
  input: PluginInput;
  interactionData: any;
  onUpdate: (data: any) => void;
  mode: 'creation' | 'edit';
  index?: number;
  totalSteps?: number;
  isActive?: boolean;
  hasData?: boolean;
  decimalPrecision?: number;
  onSelect?: () => void;
}

export const PluginInputEditor: React.FC<PluginInputEditorProps> = ({
  input,
  interactionData,
  onUpdate,
  mode,
  index = 0,
  totalSteps = 1,
  isActive = false,
  hasData = false,
  decimalPrecision = 2,
  onSelect,
}) => {
  const rootNodeIds = useAppStore((state) => state.rootNodeIds);
  const nodes = useAppStore((state) => state.nodes);
  const indexStartIndex = useAppStore((state) => state.indexStartIndex);

  const key = input.name || input.id;
  const label = input.label || key;
  const isPointsType = input.type === 'points' || input.type === 'point_list';

  if (mode === 'creation') {
    return (
      <div
        onClick={onSelect}
        className={cn(
          'space-y-2 rounded-lg p-2.5 transition-all border',
          onSelect && 'cursor-pointer',
          isActive
            ? 'bg-primary-base/10 border-primary-base ring-2 ring-primary-base/30 shadow-sm'
            : 'bg-surface-base/40 border-border-base/40 hover:bg-surface-hover/60',
        )}
      >
        <Label className="text-[13px] font-semibold text-text-base flex items-center gap-2 cursor-pointer">
          {totalSteps > 1 && (
            <span
              className={cn(
                'w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-bold shrink-0',
                isActive
                  ? 'bg-primary-base text-text-inverse shadow-sm'
                  : hasData
                    ? 'bg-status-success text-text-inverse'
                    : 'bg-surface-hover text-text-muted',
              )}
            >
              {index + 1}
            </span>
          )}
          {label} {input.required && <span className="text-danger-base">*</span>}
        </Label>

        {isActive && !hasData && (
          <p className="text-[10px] text-primary-base font-medium opacity-80">
            {input.type === 'rectangle'
              ? '▶ Click and drag on map to draw'
              : isPointsType
                ? '▶ Click on map to add points'
                : input.type === 'point'
                  ? '▶ Click on map to place'
                  : input.type === 'waypoint'
                    ? '▶ Select a waypoint from list or map'
                    : input.type === 'annotation'
                      ? '▶ Select annotation object(s)'
                      : ''}
          </p>
        )}

        {input.description && <p className="text-[10px] text-text-muted/70 leading-tight mb-1">{input.description}</p>}

        {input.type === 'point' && (
          <div className="bg-surface-base p-2 rounded-md border border-border-base/50">
            {interactionData ? (
              <PointForm data={interactionData} onChange={onUpdate} precision={decimalPrecision} />
            ) : (
              <div className="py-1 text-center text-text-muted/50 italic text-[11px]">Click on map to define</div>
            )}
          </div>
        )}

        {isPointsType && (
          <div className="bg-surface-base p-2 rounded-md border border-border-base/50">
            <PointsListForm
              data={Array.isArray(interactionData) ? interactionData : []}
              onChange={onUpdate}
              precision={decimalPrecision}
              allowYaw={input.allow_yaw}
              maxPoints={input.max_points}
              minPoints={input.min_points}
            />
          </div>
        )}

        {input.type === 'rectangle' && (
          <div className="bg-surface-base p-2 rounded-md border border-border-base/50">
            {interactionData?.center ? (
              <RectangleForm data={interactionData} onChange={onUpdate} precision={decimalPrecision} showFooterHint />
            ) : (
              <div className="py-1 text-center text-text-muted/50 italic text-[11px]">
                Click and drag on map to draw
              </div>
            )}
          </div>
        )}

        {input.type === 'waypoint' && (
          <div className="bg-surface-base border border-border-base/50 rounded-md p-2">
            <WaypointSelectForm
              value={interactionData}
              onChange={onUpdate}
              rootNodeIds={rootNodeIds}
              nodes={nodes}
              indexStartIndex={indexStartIndex}
              showDirectInput
            />
          </div>
        )}

        {input.type === 'annotation' && (
          <div className="bg-surface-base border border-border-base/50 rounded-md p-2">
            <AnnotationSelectForm input={input} value={interactionData} onChange={onUpdate} />
          </div>
        )}

        {input.type === 'custom_layer' && (
          <div className="bg-surface-base border border-border-base/50 rounded-md p-2">
            <CustomLayerSelectForm input={input} value={interactionData} onChange={onUpdate} />
          </div>
        )}
      </div>
    );
  }

  // Edit Mode (PropertiesPanel)
  return (
    <div className="space-y-2 pt-3 border-t border-border-base/50">
      <Label className="text-[13px] font-bold text-primary-base flex items-center justify-between uppercase tracking-tight">
        <span>{label}</span>
        <span className="text-[10px] text-text-muted font-normal opacity-70 normal-case">
          (
          {input.type === 'point'
            ? 'Point'
            : isPointsType
              ? 'Points List'
              : input.type === 'waypoint'
                ? 'Waypoint Reference'
                : input.type === 'annotation'
                  ? 'Annotation Reference'
                  : input.type === 'custom_layer'
                    ? 'Custom Layer Reference'
                    : 'Rectangle Area'}
          )
        </span>
      </Label>

      {input.type === 'waypoint' && (
        <div className="space-y-2">
          <WaypointSelectForm
            value={interactionData}
            onChange={onUpdate}
            rootNodeIds={rootNodeIds}
            nodes={nodes}
            indexStartIndex={indexStartIndex}
          />
        </div>
      )}

      {input.type === 'annotation' && (
        <div className="space-y-2">
          <AnnotationSelectForm input={input} value={interactionData} onChange={onUpdate} />
        </div>
      )}

      {input.type === 'custom_layer' && (
        <div className="space-y-2">
          <CustomLayerSelectForm input={input} value={interactionData} onChange={onUpdate} />
        </div>
      )}

      {input.type === 'point' && interactionData && (
        <PointForm
          data={interactionData}
          onChange={onUpdate}
          precision={decimalPrecision}
          includeYaw
          columns={3}
          inputSize="md"
        />
      )}

      {isPointsType && (
        <PointsListForm
          data={Array.isArray(interactionData) ? interactionData : []}
          onChange={onUpdate}
          precision={decimalPrecision}
          allowYaw={input.allow_yaw}
          maxPoints={input.max_points}
          minPoints={input.min_points}
          inputSize="md"
        />
      )}

      {input.type === 'rectangle' && (interactionData?.center || interactionData?.origin) && (
        <RectangleForm data={interactionData} onChange={onUpdate} precision={decimalPrecision} inputSize="md" />
      )}
    </div>
  );
};

// ----------------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------------
