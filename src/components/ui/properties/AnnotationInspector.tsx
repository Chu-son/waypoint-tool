import { useState, useEffect } from 'react';
import { useAppStore } from '../../../stores/appStore';
import {
  PointAnnotation,
  OrientedPointAnnotation,
  LineAnnotation,
  RectAnnotation,
  CircleAnnotation,
  AnnotationGroup,
} from '../../../types/store';
import { FieldLabel } from '../common/FieldLabel';
import { Label } from '../common/Label';
import { Input } from '../common/Input';
import { LabeledNumericInput } from '../common/LabeledNumericInput';
import { Button } from '../common/Button';
import { ToggleSwitch } from '../common/ToggleSwitch';
import { PluginPropertyEditor } from '../PluginPropertyEditor';
import { PluginInputEditor } from '../PluginInputEditor';
import { PluginDataViewer } from '../common/PluginDataViewer';
import {
  Palette,
  Trash2,
  CircleDot,
  Navigation,
  Minus,
  Square,
  Circle,
  Eye,
  Tag,
  Wand2,
  Folder,
  Unlink,
  RefreshCcw,
  Code2,
  Maximize2,
} from 'lucide-react';
import { EmptyState } from '../common/EmptyState';
import { ANNOTATION_COLOR_PRESETS, DEFAULT_ANNOTATION_COLOR } from '../../../utils/colorPresets';

function AnnotationGroupPanel({ group }: { group: AnnotationGroup }) {
  const plugins = useAppStore((state) => state.plugins);
  const explodeAnnotationGroup = useAppStore((state) => state.explodeAnnotationGroup);
  const removeAnnotationObjects = useAppStore((state) => state.removeAnnotationObjects);
  const updateAnnotationGroup = useAppStore((state) => state.updateAnnotationGroup);
  const runWithLoading = useAppStore((state) => state.runWithLoading);
  const pluginInteractionData = useAppStore((state) => state.pluginInteractionData);
  const updatePluginInteractionData = useAppStore((state) => state.updatePluginInteractionData);

  const [genParams, setGenParams] = useState<Record<string, any>>({});
  const [isExecuting, setIsExecuting] = useState(false);

  const pluginId = group.plugin_id || '';
  const plugin = plugins[pluginId];
  const isGenerator = group.type === 'generator';

  useEffect(() => {
    if (group.generator_params?.properties) {
      setGenParams({ ...group.generator_params.properties });
    }
    if (group.generator_params?.interaction_data) {
      Object.entries(group.generator_params.interaction_data).forEach(([key, val]) => {
        updatePluginInteractionData(key, val);
      });
    }
  }, [group.id]);

  useEffect(() => {
    useAppStore.getState().setPluginActiveProperties(genParams);
  }, [genParams, group.id]);

  const handleRegenerate = async () => {
    if (!plugin) return;
    setIsExecuting(true);
    try {
      await runWithLoading(
        {
          message: 'アノテーションを再生成中...',
          detail: plugin.manifest.name || plugin.id,
          blocking: true,
        },
        async () => {
          const filteredInteractionData: Record<string, any> = {};
          plugin.manifest.inputs?.forEach((inp) => {
            const key = inp.name || inp.id;
            if (key && pluginInteractionData[key]) {
              filteredInteractionData[key] = pluginInteractionData[key];
            }
          });

          await useAppStore.getState().executeGeneratorPlugin({
            plugin,
            properties: genParams,
            interactionData: filteredInteractionData,
            existingExecutionId: group.source_execution_id,
            targetAnnotationGroupId: group.id,
          });
        }
      );
    } catch (err: any) {
      console.error('Annotation group regeneration failed:', err);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto w-full p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border-base/40">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-primary-base/10 text-primary-base border border-primary-base/20">
            {isGenerator ? <Wand2 size={18} /> : <Folder size={18} />}
          </div>
          <div>
            <h3 className="font-bold text-sm text-text-base leading-tight">{group.name}</h3>
            <span className="text-[11px] text-text-muted font-mono">
              {isGenerator ? 'Generator Group' : 'Manual Group'} ({group.children_ids?.length || 0} items)
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="danger"
            size="sm"
            onClick={() => removeAnnotationObjects([group.id])}
            className="w-7 h-7 p-0"
            title="グループ削除"
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </div>

      {/* Name Edit */}
      <div className="space-y-2">
        <Label>グループ名</Label>
        <Input
          type="text"
          value={group.name}
          onChange={(e) => updateAnnotationGroup(group.id, { name: e.target.value })}
        />
      </div>

      {/* Generator Controls */}
      {isGenerator && plugin && (
        <div className="space-y-5 bg-surface-panel/40 p-3.5 rounded-xl border border-border-base/30">
          <div className="space-y-1">
            <span className="text-xs font-bold text-text-base flex items-center gap-1.5">
              <Wand2 size={13} className="text-primary-base" />
              プラグイン: {plugin.manifest.name}
            </span>
            {plugin.manifest.description && (
              <p className="text-[11px] text-text-muted">{plugin.manifest.description}</p>
            )}
          </div>

          {plugin.manifest.inputs?.map((inp, idx) => {
            const key = inp.name || inp.id;
            if (!key) return null;
            return (
              <PluginInputEditor
                key={`input-${idx}`}
                input={inp}
                interactionData={pluginInteractionData[key]}
                onUpdate={(data) => updatePluginInteractionData(key, data)}
                mode="edit"
                decimalPrecision={2}
              />
            );
          })}

          {plugin.manifest.properties?.map((prop, idx) => {
            const key = prop.name;
            if (!key) return null;
            return (
              <PluginPropertyEditor
                key={`prop-${idx}`}
                property={prop}
                value={genParams[key]}
                onChange={(val) => setGenParams((prev) => ({ ...prev, [key]: val }))}
              />
            );
          })}

          <Button
            variant="primary"
            onClick={handleRegenerate}
            disabled={isExecuting}
            className="w-full gap-2 shadow-xs text-xs font-bold"
          >
            <RefreshCcw size={14} className={isExecuting ? 'animate-spin' : ''} />
            <span>{isExecuting ? '再生成中...' : 'アノテーションを再生成'}</span>
          </Button>
        </div>
      )}

      {/* Internal Properties (Read-only Metadata) */}
      <div className="space-y-2 pt-3 border-t border-border-base/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Code2 size={13} className="text-accent-automation" />
            <span className="text-[11px] font-bold text-text-base">内部プロパティ (Internal Properties)</span>
          </div>
          <span className="text-[9px] px-1.5 py-0.2 rounded bg-surface-hover text-text-muted border border-border-base/30 font-mono">
            Read-only
          </span>
        </div>

        {group.plugin_data && Object.keys(group.plugin_data).length > 0 ? (
          <div className="space-y-1.5">
            <PluginDataViewer data={group.plugin_data} title="Annotation Group Plugin Data" defaultExpanded={true} />
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                useAppStore.getState().openPluginDataModal(
                  `アノテーショングループ: ${group.name}`,
                  group.plugin_data,
                  `プラグイン: ${group.plugin_id || 'Manual'} • 内部メタデータ (Read-only)`
                )
              }
              className="w-full text-[10px] text-accent-automation hover:bg-accent-automation/10 gap-1 h-6"
            >
              <Maximize2 size={11} />
              <span>全画面ダイアログで開く</span>
            </Button>
          </div>
        ) : (
          <p className="text-[10px] text-text-muted/60 bg-surface-base/30 p-2 rounded-lg border border-border-base/20 italic">
            内部プロパティ（plugin_data）はありません。
          </p>
        )}
      </div>

      {/* Group Operations */}
      <div className="space-y-2 pt-2 border-t border-border-base/30">
        <Button
          variant="secondary"
          onClick={() => explodeAnnotationGroup(group.id)}
          className="w-full gap-2 text-xs"
        >
          <Unlink size={13} className="text-accent-anchor" />
          <span>グループ解除 (Explode)</span>
        </Button>
      </div>
    </div>
  );
}

export function AnnotationInspector() {
  const selectedAnnotationIds = useAppStore((state) => state.selectedAnnotationIds) || [];
  const annotationObjects = useAppStore((state) => state.annotationObjects) || {};
  const annotationGroups = useAppStore((state) => state.annotationGroups) || {};
  const updateAnnotationObject = useAppStore((state) => state.updateAnnotationObject);
  const removeAnnotationObjects = useAppStore((state) => state.removeAnnotationObjects);
  const decimalPrecision = useAppStore((state) => state.decimalPrecision) ?? 2;

  if (selectedAnnotationIds.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto w-full p-4">
        <EmptyState
          message="アノテーション未選択：リストまたはマップ上でアノテーションを選択するとプロパティが表示されます。"
        />
      </div>
    );
  }

  if (selectedAnnotationIds.length > 1) {
    return (
      <div className="flex-1 overflow-y-auto w-full p-4 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-text-base">複数アノテーション選択中</span>
          <Button
            variant="danger"
            size="sm"
            onClick={() => removeAnnotationObjects(selectedAnnotationIds)}
            className="gap-1 text-xs"
          >
            <Trash2 size={12} />
            <span>一括削除 ({selectedAnnotationIds.length})</span>
          </Button>
        </div>
        <p className="text-xs text-text-muted">
          {selectedAnnotationIds.length} 個のアノテーションが選択されています。
        </p>
      </div>
    );
  }

  const selectedId = selectedAnnotationIds[0];

  // If a group is selected, show group inspector
  if (annotationGroups[selectedId]) {
    return <AnnotationGroupPanel group={annotationGroups[selectedId]} />;
  }

  const obj = annotationObjects[selectedId];
  if (!obj) {
    return (
      <div className="flex-1 overflow-y-auto w-full p-4">
        <EmptyState
          message="アノテーション未選択：リストまたはマップ上でアノテーションを選択するとプロパティが表示されます。"
        />
      </div>
    );
  }

  const handleNameChange = (name: string) => {
    updateAnnotationObject(obj.id, { name });
  };

  const handleColorChange = (colorHex: string) => {
    updateAnnotationObject(obj.id, { color: colorHex });
  };

  const handleDelete = () => {
    removeAnnotationObjects([obj.id]);
  };

  const currentColor = obj.color || DEFAULT_ANNOTATION_COLOR;

  return (
    <div className="flex-1 overflow-y-auto w-full p-4 space-y-6">
      {/* Header Info */}
      <div className="flex items-center justify-between pb-3 border-b border-border-base/40">
        <div className="flex items-center gap-2">
          {obj.type === 'point' && <CircleDot size={18} className="text-primary-base" />}
          {obj.type === 'oriented_point' && <Navigation size={18} className="text-accent-generator" />}
          {obj.type === 'line' && <Minus size={18} className="text-accent-anchor" />}
          {obj.type === 'rect' && <Square size={18} className="text-accent-reference" />}
          {obj.type === 'circle' && <Circle size={18} className="text-accent-reference" />}
          <div>
            <span className="text-xs font-bold text-text-base block">Annotation Inspector</span>
            <span className="text-[10px] text-text-muted font-mono uppercase">{obj.type}</span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          className="text-danger-base hover:bg-danger-base/10 h-7 px-2 text-xs gap-1"
          title="アノテーションを削除"
        >
          <Trash2 size={12} />
          <span>削除</span>
        </Button>
      </div>

      {/* General Settings */}
      <div className="space-y-3">
        <FieldLabel>General</FieldLabel>
        <div>
          <Label className="text-[11px] mb-1">名前 (Name)</Label>
          <Input
            value={obj.name}
            onChange={(e) => handleNameChange(e.target.value)}
            className="h-8 text-xs"
            placeholder="Annotation Name"
          />
        </div>

        {/* Visibility Toggles */}
        <div className="bg-surface-panel/40 p-3 rounded-xl border border-border-base/30 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted flex items-center gap-1.5">
              <Eye size={13} />
              <span>図形の表示</span>
            </span>
            <ToggleSwitch
              checked={obj.visible}
              onChange={(checked) => updateAnnotationObject(obj.id, { visible: checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted flex items-center gap-1.5">
              <Tag size={13} />
              <span>ラベル（名前）の表示</span>
            </span>
            <ToggleSwitch
              checked={obj.labelVisible}
              onChange={(checked) => updateAnnotationObject(obj.id, { labelVisible: checked })}
            />
          </div>
        </div>

        {/* Color Palette */}
        <div>
          <Label className="text-[11px] mb-1.5 flex items-center gap-1">
            <Palette size={12} />
            <span>カラー (Color)</span>
          </Label>
          <div className="flex items-center gap-1.5">
            {ANNOTATION_COLOR_PRESETS.map((preset) => (
              <button
                key={preset.hex}
                type="button"
                onClick={() => handleColorChange(preset.hex)}
                className={`w-6 h-6 rounded-full border transition-all ${
                  currentColor.toUpperCase() === preset.hex.toUpperCase()
                    ? 'ring-2 ring-border-focus scale-110 border-text-inverse shadow-sm'
                    : 'border-border-base hover:scale-105 opacity-80 hover:opacity-100'
                }`}
                style={{ backgroundColor: preset.hex }}
                title={preset.name}
              />
            ))}
            <label
              className="w-6 h-6 rounded-full border border-border-base cursor-pointer overflow-hidden relative flex items-center justify-center bg-surface-panel hover:scale-105 transition-all"
              title="カスタムカラー"
            >
              <input
                type="color"
                value={currentColor}
                onChange={(e) => handleColorChange(e.target.value)}
                className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
              />
              <Palette size={12} className="text-text-muted" />
            </label>
          </div>
        </div>
      </div>

      {/* Geometry Settings */}
      <div className="space-y-3">
        <FieldLabel>Geometry</FieldLabel>

        {obj.type === 'point' && (
          <div className="grid grid-cols-2 gap-2">
            <LabeledNumericInput
              label="X (m)"
              value={(obj as PointAnnotation).x}
              precision={decimalPrecision}
              onChange={(val) => updateAnnotationObject(obj.id, { x: val })}
            />
            <LabeledNumericInput
              label="Y (m)"
              value={(obj as PointAnnotation).y}
              precision={decimalPrecision}
              onChange={(val) => updateAnnotationObject(obj.id, { y: val })}
            />
          </div>
        )}

        {obj.type === 'oriented_point' && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <LabeledNumericInput
                label="X (m)"
                value={(obj as OrientedPointAnnotation).x}
                precision={decimalPrecision}
                onChange={(val) => updateAnnotationObject(obj.id, { x: val })}
              />
              <LabeledNumericInput
                label="Y (m)"
                value={(obj as OrientedPointAnnotation).y}
                precision={decimalPrecision}
                onChange={(val) => updateAnnotationObject(obj.id, { y: val })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <LabeledNumericInput
                label="Yaw (deg)"
                value={(((obj as OrientedPointAnnotation).yaw || 0) * 180) / Math.PI}
                precision={1}
                step={5}
                onChange={(valDeg) =>
                  updateAnnotationObject(obj.id, { yaw: (valDeg * Math.PI) / 180 })
                }
              />
              <LabeledNumericInput
                label="Yaw (rad)"
                value={(obj as OrientedPointAnnotation).yaw || 0}
                precision={decimalPrecision}
                step={0.1}
                onChange={(valRad) => updateAnnotationObject(obj.id, { yaw: valRad })}
              />
            </div>
          </div>
        )}

        {obj.type === 'line' && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <LabeledNumericInput
                label="Start X1 (m)"
                value={(obj as LineAnnotation).x1}
                precision={decimalPrecision}
                onChange={(val) => updateAnnotationObject(obj.id, { x1: val })}
              />
              <LabeledNumericInput
                label="Start Y1 (m)"
                value={(obj as LineAnnotation).y1}
                precision={decimalPrecision}
                onChange={(val) => updateAnnotationObject(obj.id, { y1: val })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <LabeledNumericInput
                label="End X2 (m)"
                value={(obj as LineAnnotation).x2}
                precision={decimalPrecision}
                onChange={(val) => updateAnnotationObject(obj.id, { x2: val })}
              />
              <LabeledNumericInput
                label="End Y2 (m)"
                value={(obj as LineAnnotation).y2}
                precision={decimalPrecision}
                onChange={(val) => updateAnnotationObject(obj.id, { y2: val })}
              />
            </div>
            {/* Computed Length */}
            {(() => {
              const ln = obj as LineAnnotation;
              const dx = ln.x2 - ln.x1;
              const dy = ln.y2 - ln.y1;
              const len = Math.sqrt(dx * dx + dy * dy);
              return (
                <div className="flex items-center justify-between text-xs text-text-muted px-1 pt-1">
                  <span>線分長 (Length):</span>
                  <span className="font-mono text-text-base">{len.toFixed(decimalPrecision)} m</span>
                </div>
              );
            })()}
          </div>
        )}

        {obj.type === 'rect' && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <LabeledNumericInput
                label="Center X (m)"
                value={(obj as RectAnnotation).cx}
                precision={decimalPrecision}
                onChange={(val) => updateAnnotationObject(obj.id, { cx: val })}
              />
              <LabeledNumericInput
                label="Center Y (m)"
                value={(obj as RectAnnotation).cy}
                precision={decimalPrecision}
                onChange={(val) => updateAnnotationObject(obj.id, { cy: val })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <LabeledNumericInput
                label="Width (m)"
                value={(obj as RectAnnotation).width}
                precision={decimalPrecision}
                min={0.01}
                onChange={(val) => updateAnnotationObject(obj.id, { width: Math.max(0.01, val) })}
              />
              <LabeledNumericInput
                label="Height (m)"
                value={(obj as RectAnnotation).height}
                precision={decimalPrecision}
                min={0.01}
                onChange={(val) => updateAnnotationObject(obj.id, { height: Math.max(0.01, val) })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <LabeledNumericInput
                label="Angle (deg)"
                value={(((obj as RectAnnotation).angle || 0) * 180) / Math.PI}
                precision={1}
                step={5}
                onChange={(valDeg) =>
                  updateAnnotationObject(obj.id, { angle: (valDeg * Math.PI) / 180 })
                }
              />
              <LabeledNumericInput
                label="Angle (rad)"
                value={(obj as RectAnnotation).angle || 0}
                precision={decimalPrecision}
                step={0.1}
                onChange={(valRad) => updateAnnotationObject(obj.id, { angle: valRad })}
              />
            </div>
          </div>
        )}

        {obj.type === 'circle' && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <LabeledNumericInput
                label="Center X (m)"
                value={(obj as CircleAnnotation).cx}
                precision={decimalPrecision}
                onChange={(val) => updateAnnotationObject(obj.id, { cx: val })}
              />
              <LabeledNumericInput
                label="Center Y (m)"
                value={(obj as CircleAnnotation).cy}
                precision={decimalPrecision}
                onChange={(val) => updateAnnotationObject(obj.id, { cy: val })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <LabeledNumericInput
                label="Radius (m)"
                value={(obj as CircleAnnotation).radius}
                precision={decimalPrecision}
                min={0.01}
                onChange={(val) => updateAnnotationObject(obj.id, { radius: Math.max(0.01, val) })}
              />
              <div className="flex flex-col justify-center text-xs text-text-muted px-1">
                <span>直径 (Diameter):</span>
                <span className="font-mono text-text-base">
                  {((obj as CircleAnnotation).radius * 2).toFixed(decimalPrecision)} m
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Internal Properties (Read-only Metadata) */}
        {obj.plugin_data && Object.keys(obj.plugin_data).length > 0 && (
          <div className="space-y-2 pt-3 border-t border-border-base/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Code2 size={13} className="text-accent-automation" />
                <span className="text-[11px] font-bold text-text-base">内部プロパティ (Internal Properties)</span>
              </div>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-surface-hover text-text-muted border border-border-base/30 font-mono">
                Read-only
              </span>
            </div>
            <div className="space-y-1.5">
              <PluginDataViewer data={obj.plugin_data} title="Annotation Plugin Data" defaultExpanded={true} />
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  useAppStore.getState().openPluginDataModal(
                    `アノテーション: ${obj.name}`,
                    obj.plugin_data,
                    `タイプ: ${obj.type} • 内部メタデータ (Read-only)`
                  )
                }
                className="w-full text-[10px] text-accent-automation hover:bg-accent-automation/10 gap-1 h-6"
              >
                <Maximize2 size={11} />
                <span>全画面ダイアログで開く</span>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
