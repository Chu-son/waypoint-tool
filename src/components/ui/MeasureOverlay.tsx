import { useState, useEffect } from 'react';
import { useAppStore } from '../../stores/appStore';
import { FloatingActionBanner, FloatingBannerAction } from './common/FloatingActionBanner';
import { ToggleSwitch } from './common/ToggleSwitch';
import { Ruler, BookmarkPlus, RotateCcw, Check } from 'lucide-react';
import { computeDistance } from '../../stores/slices/measureSlice';
import { useResponsiveContainer } from '../../hooks/useResponsiveContainer';

export function MeasureOverlay() {
  const activeTool = useAppStore((state) => state.activeTool);
  const appMode = useAppStore((state) => state.appMode);
  const transitionToMode = useAppStore((state) => state.transitionToMode);

  const measureStartPoint = useAppStore((state) => state.measureStartPoint);
  const measureEndPoint = useAppStore((state) => state.measureEndPoint);
  const measureHoverPoint = useAppStore((state) => state.measureHoverPoint);
  const autoSaveMeasureAnnotation = useAppStore((state) => state.autoSaveMeasureAnnotation);
  const setAutoSaveMeasureAnnotation = useAppStore((state) => state.setAutoSaveMeasureAnnotation);
  const resetMeasure = useAppStore((state) => state.resetMeasure);
  const saveCurrentMeasureAsAnnotation = useAppStore((state) => state.saveCurrentMeasureAsAnnotation);
  const decimalPrecision = useAppStore((state) => state.decimalPrecision) ?? 2;

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isAltPressed, setIsAltPressed] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        setIsAltPressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        setIsAltPressed(false);
      }
    };
    const handleBlur = () => {
      setIsAltPressed(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  const { containerRef, isCompact } = useResponsiveContainer<HTMLDivElement>({
    compact: 720,
    normal: 960,
  });

  const isMeasureMode = activeTool === 'measure' || appMode.mode === 'measure';
  if (!isMeasureMode) return null;

  const p1 = measureStartPoint;
  const p2 = measureEndPoint || measureHoverPoint;
  const isCommitted = measureEndPoint !== null;

  let distance: number | null = null;
  if (p1 && p2) {
    distance = computeDistance(p1, p2);
  }

  const handleManualSave = () => {
    const id = saveCurrentMeasureAsAnnotation();
    if (id) {
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
    }
  };

  const handleClose = () => {
    resetMeasure();
    transitionToMode({ mode: 'select' });
  };

  // Status subtitle
  let subtitle: string | undefined;
  if (!p1) {
    if (isAltPressed) {
      subtitle = isCompact ? 'Alt吸着: オブジェクトをクリック' : 'Alt吸着中: オブジェクトをクリックして始点を指定';
    } else {
      subtitle = isCompact ? undefined : 'クリック: 任意点 / [Alt]+クリック: オブジェクト吸着';
    }
  } else if (!isCommitted) {
    if (isAltPressed) {
      subtitle = isCompact ? 'Alt吸着: オブジェクトをクリック' : 'Alt吸着中: オブジェクトをクリックして終点を確定';
    } else {
      subtitle = isCompact ? '2点目を指定' : '2点目をクリックして距離を確定（[Alt]+クリックで吸着、Escでキャンセル）';
    }
  } else {
    const p1Label = p1.objectName ? `${p1.objectName}` : `(${p1.x.toFixed(2)}, ${p1.y.toFixed(2)})`;
    const p2Label = measureEndPoint?.objectName ? `${measureEndPoint.objectName}` : measureEndPoint ? `(${measureEndPoint.x.toFixed(2)}, ${measureEndPoint.y.toFixed(2)})` : '';
    subtitle = isCompact ? undefined : `始点: ${p1Label} → 終点: ${p2Label}`;
  }

  const actions: FloatingBannerAction[] = [
    {
      label: savedSuccess ? '保存完了' : '保存',
      icon: <BookmarkPlus size={14} />,
      variant: savedSuccess ? 'primary' : 'secondary',
      disabled: !isCommitted,
      onClick: handleManualSave,
      title: '現在の計測結果をLineアノテーションとして保存',
    },
    {
      label: 'クリア',
      icon: <RotateCcw size={14} />,
      variant: 'ghost',
      onClick: resetMeasure,
      title: '計測をクリアしてやり直す',
    },
    {
      label: '完了',
      icon: <Check size={14} />,
      variant: 'primary',
      onClick: handleClose,
      title: '計測を終了して選択ツールに戻る',
    },
  ];

  return (
    <FloatingActionBanner
      ref={containerRef}
      icon={<Ruler size={16} className="text-primary-base animate-pulse" />}
      title={
        isAltPressed
          ? (isCompact ? '距離計測 [Alt吸着]' : '実寸距離計測 [Alt吸着]')
          : (isCompact ? '距離計測' : '実寸距離計測 (Measure)')
      }
      subtitle={subtitle}
      valueDisplay={distance !== null ? `${distance.toFixed(decimalPrecision)} m` : '--- m'}
      statusText={
        <div className="flex items-center gap-2 border-l border-border-base/30 pl-2">
          {isAltPressed && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse whitespace-nowrap">
              Alt 吸着中
            </span>
          )}
          <div
            className="flex items-center gap-1.5 cursor-pointer select-none"
            onClick={() => setAutoSaveMeasureAnnotation(!autoSaveMeasureAnnotation)}
          >
            <ToggleSwitch
              checked={autoSaveMeasureAnnotation}
              onChange={setAutoSaveMeasureAnnotation}
              title="2点確定時にアノテーション(Line)として自動保存"
            />
            <span className="text-[11px] text-text-muted whitespace-nowrap">
              {isCompact ? '自動保存' : 'アノテーション保存'}
            </span>
          </div>
        </div>
      }
      actions={actions}
    />
  );
}
