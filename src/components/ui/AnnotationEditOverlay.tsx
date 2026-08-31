import React from 'react';
import { useAppStore } from '../../stores/appStore';
import { FloatingActionBanner } from './common/FloatingActionBanner';
import { Button } from './common/Button';
import { CircleDot, Navigation, Minus, Square, Circle, MousePointer, Check, Trash2, Palette } from 'lucide-react';
import { AnnotationToolType } from '../../stores/slices/annotationSlice';
import { useResponsiveContainer } from '../../hooks/useResponsiveContainer';

import { ANNOTATION_COLOR_PRESETS } from '../../utils/colorPresets';

export function AnnotationEditOverlay() {
  const isAnnotationEditMode = useAppStore((state) => state.isAnnotationEditMode);
  const setAnnotationEditMode = useAppStore((state) => state.setAnnotationEditMode);
  const activeAnnotationSubTool = useAppStore((state) => state.activeAnnotationSubTool);
  const allowedAnnotationSubTools = useAppStore((state) => state.allowedAnnotationSubTools);
  const setActiveAnnotationSubTool = useAppStore((state) => state.setActiveAnnotationSubTool);
  const defaultAnnotationColor = useAppStore((state) => state.defaultAnnotationColor);
  const setDefaultAnnotationColor = useAppStore((state) => state.setDefaultAnnotationColor);
  const selectedAnnotationIds = useAppStore((state) => state.selectedAnnotationIds);
  const annotationObjects = useAppStore((state) => state.annotationObjects);
  const removeAnnotationObjects = useAppStore((state) => state.removeAnnotationObjects);
  const updateAnnotationObject = useAppStore((state) => state.updateAnnotationObject);

  const { containerRef, isCompact, isWide } = useResponsiveContainer<HTMLDivElement>({
    compact: 820,
    normal: 1080,
  });

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

  const allSubtools: { type: AnnotationToolType; label: string; shortLabel: string; icon: React.ReactNode }[] = [
    { type: 'point', label: '丸 (Point)', shortLabel: 'Point', icon: <CircleDot size={14} /> },
    { type: 'oriented_point', label: '三角 (Oriented)', shortLabel: 'Oriented', icon: <Navigation size={14} /> },
    { type: 'line', label: '線分 (Line)', shortLabel: 'Line', icon: <Minus size={14} /> },
    { type: 'rect', label: '矩形 (Rect)', shortLabel: 'Rect', icon: <Square size={14} /> },
    { type: 'circle', label: '円形 (Circle)', shortLabel: 'Circle', icon: <Circle size={14} /> },
    { type: 'select', label: '選択', shortLabel: '選択', icon: <MousePointer size={14} /> },
  ];

  const subtools = allowedAnnotationSubTools && allowedAnnotationSubTools.length > 0
    ? allSubtools.filter((st) => st.type === 'select' || allowedAnnotationSubTools.includes(st.type))
    : allSubtools;

  return (
    <FloatingActionBanner
      ref={containerRef}
      icon={<Palette size={16} className="animate-pulse text-primary-base" />}
      title={isCompact ? 'アノテーション' : 'アノテーション配置・編集モード'}
      subtitle={selectedObj ? `選択中: ${selectedObj.name} (${selectedObj.type})` : (isCompact ? undefined : 'ドラッグまたはクリックで配置')}
      statusText={
        <div className="flex items-center gap-1.5 sm:gap-2 px-1 flex-nowrap shrink-0">
          {/* Subtool Selector */}
          <div className="flex items-center gap-0.5 bg-surface-base/60 p-0.5 rounded-lg border border-border-base/30 flex-shrink-0">
            {subtools.map((st) => (
              <Button
                key={st.type}
                variant={activeAnnotationSubTool === st.type ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setActiveAnnotationSubTool(st.type)}
                className={`h-7 text-xs ${isCompact ? 'w-7 p-0 justify-center' : 'px-2 gap-1'}`}
                title={`${st.label}ツールを選択`}
              >
                {st.icon}
                {!isCompact && (
                  <span>{isWide ? st.label : st.shortLabel}</span>
                )}
              </Button>
            ))}
          </div>

          {/* Color Presets & Picker */}
          <div className="flex items-center gap-1 border-l border-border-base/30 pl-1.5 sm:pl-2 flex-shrink-0">
            {!isCompact && (
              <span className="text-[11px] font-semibold text-text-muted">カラー:</span>
            )}
            <div className="flex items-center gap-0.5">
              {ANNOTATION_COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.hex}
                  type="button"
                  onClick={() => handleColorChange(preset.hex)}
                  className={`w-4 h-4 sm:w-4.5 sm:h-4.5 rounded-full border transition-all ${
                    currentColor.toUpperCase() === preset.hex.toUpperCase()
                      ? 'ring-2 ring-border-focus scale-110 border-text-inverse'
                      : 'border-border-base hover:scale-105 opacity-80 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: preset.hex }}
                  title={preset.name}
                />
              ))}
              <label
                className="w-4 h-4 sm:w-4.5 sm:h-4.5 rounded-full border border-border-base cursor-pointer overflow-hidden relative flex items-center justify-center bg-surface-panel hover:scale-105 transition-all"
                title="カスタムカラー"
              >
                <input
                  type="color"
                  value={currentColor}
                  onChange={(e) => handleColorChange(e.target.value)}
                  className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                />
                <Palette size={9} className="text-text-muted" />
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
