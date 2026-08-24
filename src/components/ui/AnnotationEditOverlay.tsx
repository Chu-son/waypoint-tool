import React from 'react';
import { useAppStore } from '../../stores/appStore';
import { FloatingActionBanner } from './common/FloatingActionBanner';
import { Button } from './common/Button';
import { CircleDot, Navigation, Minus, Square, Circle, MousePointer, Check, Trash2, Palette } from 'lucide-react';
import { AnnotationToolType } from '../../stores/slices/annotationSlice';

const COLOR_PRESETS = [
  { name: 'Blue', hex: '#3B82F6' },
  { name: 'Green', hex: '#10B981' },
  { name: 'Amber', hex: '#F59E0B' },
  { name: 'Red', hex: '#EF4444' },
  { name: 'Purple', hex: '#8B5CF6' },
  { name: 'Pink', hex: '#EC4899' },
  { name: 'White', hex: '#FFFFFF' },
];

export function AnnotationEditOverlay() {
  const isAnnotationEditMode = useAppStore((state) => state.isAnnotationEditMode);
  const setAnnotationEditMode = useAppStore((state) => state.setAnnotationEditMode);
  const activeAnnotationSubTool = useAppStore((state) => state.activeAnnotationSubTool);
  const setActiveAnnotationSubTool = useAppStore((state) => state.setActiveAnnotationSubTool);
  const defaultAnnotationColor = useAppStore((state) => state.defaultAnnotationColor);
  const setDefaultAnnotationColor = useAppStore((state) => state.setDefaultAnnotationColor);
  const selectedAnnotationIds = useAppStore((state) => state.selectedAnnotationIds);
  const annotationObjects = useAppStore((state) => state.annotationObjects);
  const removeAnnotationObjects = useAppStore((state) => state.removeAnnotationObjects);
  const updateAnnotationObject = useAppStore((state) => state.updateAnnotationObject);

  if (!isAnnotationEditMode) return null;

  const selectedObj =
    selectedAnnotationIds.length === 1 ? annotationObjects[selectedAnnotationIds[0]] : null;

  const currentColor = selectedObj?.color || defaultAnnotationColor;

  const handleColorChange = (colorHex: string) => {
    setDefaultAnnotationColor(colorHex);
    if (selectedObj) {
      updateAnnotationObject(selectedObj.id, { color: colorHex });
    }
  };

  const handleDeleteSelected = () => {
    if (selectedAnnotationIds.length > 0) {
      removeAnnotationObjects(selectedAnnotationIds);
    }
  };

  const subtools: { type: AnnotationToolType; label: string; icon: React.ReactNode }[] = [
    { type: 'point', label: '丸 (Point)', icon: <CircleDot size={14} /> },
    { type: 'oriented_point', label: '三角 (Oriented)', icon: <Navigation size={14} /> },
    { type: 'line', label: '線分 (Line)', icon: <Minus size={14} /> },
    { type: 'rect', label: '矩形 (Rect)', icon: <Square size={14} /> },
    { type: 'circle', label: '円形 (Circle)', icon: <Circle size={14} /> },
    { type: 'select', label: '選択', icon: <MousePointer size={14} /> },
  ];

  return (
    <FloatingActionBanner
      icon={<Palette size={16} className="animate-pulse text-blue-400" />}
      title="アノテーション配置・編集モード"
      subtitle={selectedObj ? `選択中: ${selectedObj.name} (${selectedObj.type})` : 'ドラッグまたはクリックで配置'}
      statusText={
        <div className="flex items-center gap-3 px-2 flex-wrap">
          {/* Subtool Selector */}
          <div className="flex items-center gap-1 bg-surface-base/60 p-1 rounded-lg border border-border-base/30">
            {subtools.map((st) => (
              <Button
                key={st.type}
                variant={activeAnnotationSubTool === st.type ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setActiveAnnotationSubTool(st.type)}
                className="h-7 text-xs px-2 gap-1.5"
                title={`${st.label}ツールを選択`}
              >
                {st.icon}
                <span>{st.label}</span>
              </Button>
            ))}
          </div>

          {/* Color Presets & Picker */}
          <div className="flex items-center gap-1.5 border-l border-border-base/30 pl-3">
            <span className="text-[11px] font-semibold text-text-muted">カラー:</span>
            <div className="flex items-center gap-1">
              {COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.hex}
                  type="button"
                  onClick={() => handleColorChange(preset.hex)}
                  className={`w-5 h-5 rounded-full border transition-all ${
                    currentColor.toUpperCase() === preset.hex.toUpperCase()
                      ? 'ring-2 ring-blue-500 scale-110 border-white'
                      : 'border-slate-600 hover:scale-105 opacity-80 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: preset.hex }}
                  title={preset.name}
                />
              ))}
              <label
                className="w-5 h-5 rounded-full border border-slate-600 cursor-pointer overflow-hidden relative flex items-center justify-center bg-surface-panel hover:scale-105 transition-all"
                title="カスタムカラー"
              >
                <input
                  type="color"
                  value={currentColor}
                  onChange={(e) => handleColorChange(e.target.value)}
                  className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                />
                <Palette size={10} className="text-text-muted" />
              </label>
            </div>
          </div>
        </div>
      }
      actions={[
        ...(selectedAnnotationIds.length > 0
          ? [
              {
                label: '削除',
                icon: <Trash2 size={14} />,
                variant: 'danger' as const,
                onClick: handleDeleteSelected,
                title: '選択中のアノテーションを削除 (Delete)',
              },
            ]
          : []),
        {
          label: '完了',
          icon: <Check size={14} />,
          variant: 'primary' as const,
          onClick: () => setAnnotationEditMode(false),
          title: '配置モードを終了',
        },
      ]}
    />
  );
}
