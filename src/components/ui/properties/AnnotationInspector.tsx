import { useAppStore } from '../../../stores/appStore';
import {
  PointAnnotation,
  OrientedPointAnnotation,
  LineAnnotation,
  RectAnnotation,
  CircleAnnotation,
} from '../../../types/store';
import { FieldLabel } from '../common/FieldLabel';
import { Label } from '../common/Label';
import { Input } from '../common/Input';
import { LabeledNumericInput } from '../common/LabeledNumericInput';
import { Button } from '../common/Button';
import { ToggleSwitch } from '../common/ToggleSwitch';
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
} from 'lucide-react';
import { EmptyState } from '../common/EmptyState';

const COLOR_PRESETS = [
  { name: 'Blue', hex: '#3B82F6' },
  { name: 'Green', hex: '#10B981' },
  { name: 'Amber', hex: '#F59E0B' },
  { name: 'Red', hex: '#EF4444' },
  { name: 'Purple', hex: '#8B5CF6' },
  { name: 'Pink', hex: '#EC4899' },
  { name: 'White', hex: '#FFFFFF' },
];

export function AnnotationInspector() {
  const selectedAnnotationIds = useAppStore((state) => state.selectedAnnotationIds) || [];
  const annotationObjects = useAppStore((state) => state.annotationObjects) || {};
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

  const obj = annotationObjects[selectedAnnotationIds[0]];
  if (!obj) {
    return null;
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

  const currentColor = obj.color || '#3B82F6';

  return (
    <div className="flex-1 overflow-y-auto w-full p-4 space-y-6">
      {/* Header Info */}
      <div className="flex items-center justify-between pb-3 border-b border-border-base/40">
        <div className="flex items-center gap-2">
          {obj.type === 'point' && <CircleDot size={18} className="text-blue-400" />}
          {obj.type === 'oriented_point' && <Navigation size={18} className="text-emerald-400" />}
          {obj.type === 'line' && <Minus size={18} className="text-amber-400" />}
          {obj.type === 'rect' && <Square size={18} className="text-purple-400" />}
          {obj.type === 'circle' && <Circle size={18} className="text-pink-400" />}
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
            {COLOR_PRESETS.map((preset) => (
              <button
                key={preset.hex}
                type="button"
                onClick={() => handleColorChange(preset.hex)}
                className={`w-6 h-6 rounded-full border transition-all ${
                  currentColor.toUpperCase() === preset.hex.toUpperCase()
                    ? 'ring-2 ring-blue-500 scale-110 border-white shadow-sm'
                    : 'border-slate-600 hover:scale-105 opacity-80 hover:opacity-100'
                }`}
                style={{ backgroundColor: preset.hex }}
                title={preset.name}
              />
            ))}
            <label
              className="w-6 h-6 rounded-full border border-slate-600 cursor-pointer overflow-hidden relative flex items-center justify-center bg-surface-panel hover:scale-105 transition-all"
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
      </div>
    </div>
  );
}
