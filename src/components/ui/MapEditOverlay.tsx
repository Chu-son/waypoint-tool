import { useAppStore } from '../../stores/appStore';
import { FloatingActionBanner } from './common/FloatingActionBanner';
import { Button } from './common/Button';
import { Slider } from './common/Slider';
import { Pencil, Square, Circle, Slash, Check, Trash2 } from 'lucide-react';
import { EditObjectType } from '../../types/store';

export function MapEditOverlay() {
  const isMapEditMode = useAppStore((state) => state.isMapEditMode);
  const setMapEditMode = useAppStore((state) => state.setMapEditMode);
  const activeCustomLayerId = useAppStore((state) => state.activeCustomLayerId);
  const customLayers = useAppStore((state) => state.customLayers);
  const selectedEditObjectId = useAppStore((state) => state.selectedEditObjectId);
  const setSelectedEditObjectId = useAppStore((state) => state.setSelectedEditObjectId);
  const updateEditObject = useAppStore((state) => state.updateEditObject);
  const removeEditObject = useAppStore((state) => state.removeEditObject);
  const pushHistorySnapshot = useAppStore((state) => state.pushHistorySnapshot);

  const mapEditSubTool = useAppStore((state) => state.mapEditSubTool);
  const setMapEditSubTool = useAppStore((state) => state.setMapEditSubTool);
  const mapEditFillValue = useAppStore((state) => state.mapEditFillValue);
  const setMapEditFillValue = useAppStore((state) => state.setMapEditFillValue);
  const mapEditBrushSize = useAppStore((state) => state.mapEditBrushSize);
  const setMapEditBrushSize = useAppStore((state) => state.setMapEditBrushSize);

  if (!isMapEditMode || !activeCustomLayerId) return null;

  const activeLayer = customLayers.find((l) => l.id === activeCustomLayerId && l.type === 'manual') as import('../../types/store').ManualCustomLayer | undefined;
  const selectedObject = activeLayer?.editObjects.find((o) => o.id === selectedEditObjectId);

  const currentFillValue = selectedObject !== undefined ? selectedObject.fillValue : mapEditFillValue;

  const handleFillValueChange = (val: number) => {
    setMapEditFillValue(val);
    if (activeCustomLayerId && selectedEditObjectId) {
      updateEditObject(activeCustomLayerId, selectedEditObjectId, { fillValue: val });
      pushHistorySnapshot();
    }
  };

  const handleDeleteSelectedObject = () => {
    if (activeCustomLayerId && selectedEditObjectId) {
      removeEditObject(activeCustomLayerId, selectedEditObjectId);
      setSelectedEditObjectId(null);
      pushHistorySnapshot();
    }
  };

  const subtools: { type: EditObjectType; label: string; icon: React.ReactNode }[] = [
    { type: 'line', label: '直線', icon: <Slash size={14} /> },
    { type: 'rect', label: '矩形', icon: <Square size={14} /> },
    { type: 'circle', label: '円形', icon: <Circle size={14} /> },
    { type: 'freehand', label: 'フリー', icon: <Pencil size={14} /> },
  ];

  return (
    <FloatingActionBanner
      icon={<Pencil size={16} className="animate-pulse" />}
      title={`編集中: ${activeLayer?.name || 'Edit Layer'}`}
      subtitle={selectedObject ? `選択中: ${selectedObject.type}` : "マップ編集モード"}
      statusText={
        <div className="flex items-center gap-4 px-2">
          {/* Subtool Selector */}
          <div className="flex items-center gap-1 bg-surface-base/60 p-1 rounded-lg border border-border-base/30">
            {subtools.map((st) => (
              <Button
                key={st.type}
                variant={mapEditSubTool === st.type ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setMapEditSubTool(st.type)}
                className="h-7 text-xs px-2 gap-1"
                title={`${st.label}ツールを選択`}
              >
                {st.icon}
                <span>{st.label}</span>
              </Button>
            ))}
          </div>

          {/* Fill Value Controls */}
          <div className="flex items-center gap-2 border-l border-border-base/30 pl-3">
            <span className="text-[11px] font-semibold text-text-muted">塗りつぶし:</span>
            <div className="flex items-center gap-1">
              <Button
                variant={currentFillValue === 0 ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => handleFillValueChange(0)}
                className={`h-6 text-[10px] px-1.5 font-bold ${
                  currentFillValue === 0 ? 'bg-slate-900 text-white border border-slate-700' : ''
                }`}
                title="障害物 (黒: 0)"
              >
                黒 (0)
              </Button>
              <Button
                variant={currentFillValue === 255 ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => handleFillValueChange(255)}
                className={`h-6 text-[10px] px-1.5 font-bold ${
                  currentFillValue === 255 ? 'bg-slate-100 text-slate-900 border border-slate-300' : ''
                }`}
                title="自由領域 (白: 255)"
              >
                白 (255)
              </Button>
            </div>
            <div className="w-24 ml-1">
              <Slider
                min="0"
                max="255"
                step="1"
                value={currentFillValue}
                onChange={(e) => handleFillValueChange(parseInt(e.target.value, 10))}
              />
            </div>
          </div>

          {/* Brush Size (Freehand mode only) */}
          {mapEditSubTool === 'freehand' && (
            <div className="flex items-center gap-2 border-l border-border-base/30 pl-3">
              <span className="text-[11px] font-semibold text-text-muted">ブラシサイズ:</span>
              <div className="w-24">
                <Slider
                  min="1"
                  max="100"
                  step="1"
                  value={mapEditBrushSize}
                  onChange={(e) => setMapEditBrushSize(parseInt(e.target.value, 10))}
                />
              </div>
              <span className="text-[11px] font-mono text-text-base w-6 text-right">
                {mapEditBrushSize}
              </span>
            </div>
          )}
        </div>
      }
      actions={[
        ...(selectedObject
          ? [
              {
                label: '削除',
                icon: <Trash2 size={14} />,
                variant: 'danger' as const,
                onClick: handleDeleteSelectedObject,
                title: '選択中のオブジェクトを削除 (Delete / Backspace)',
              },
            ]
          : []),
        {
          label: '完了',
          icon: <Check size={14} />,
          variant: 'primary',
          onClick: () => setMapEditMode(false),
          title: '編集モードを終了',
        },
      ]}
    />
  );
}
