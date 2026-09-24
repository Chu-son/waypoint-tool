import { ConditionalStyleRule, WaypointShape } from '../../../types/store';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { Label } from '../common/Label';

interface StyleOverrideEditorProps {
  rule: ConditionalStyleRule;
  onChange: (rule: ConditionalStyleRule) => void;
  optionsList: string[];
}

export function StyleOverrideEditor({ rule, onChange, optionsList }: StyleOverrideEditorProps) {
  const targetElement = rule.targetElement;

  if (targetElement === 'waypoint') {
    const wpStyle = rule.style?.waypoint || {};
    const shapes: { value: WaypointShape; label: string }[] = [
      { value: 'default', label: '矢印 (Arrow)' },
      { value: 'circle', label: '円 (Circle)' },
      { value: 'square', label: '四角形 (Square)' },
      { value: 'diamond', label: '菱形 (Diamond)' },
      { value: 'star', label: '星形 (Star)' },
    ];

    const updateWp = (updates: Partial<typeof wpStyle>) => {
      onChange({
        ...rule,
        style: {
          ...rule.style,
          waypoint: { ...wpStyle, ...updates },
        },
      });
    };

    return (
      <div className="space-y-3 bg-surface-panel/30 p-3 rounded-xl border border-border-base/40">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs mb-1">形状 (Shape)</Label>
            <Select
              value={wpStyle.shape || 'default'}
              onChange={(e) => updateWp({ shape: e.target.value as WaypointShape })}
              className="h-8 text-xs w-full"
            >
              {shapes.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label className="text-xs mb-1">ラベル表示 (Label)</Label>
            <Select
              value={wpStyle.labelVisible === undefined ? 'default' : wpStyle.labelVisible ? 'show' : 'hide'}
              onChange={(e) => {
                const val = e.target.value;
                updateWp({ labelVisible: val === 'default' ? undefined : val === 'show' });
              }}
              className="h-8 text-xs w-full"
            >
              <option value="default">通常（デフォルト設定に従う）</option>
              <option value="show">強制表示 (Show)</option>
              <option value="hide">強制非表示 (Hide)</option>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs mb-1">枠線色 (Border Color)</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={wpStyle.color || '#3b82f6'}
                onChange={(e) => updateWp({ color: e.target.value })}
                className="w-8 h-8 rounded border border-border-base cursor-pointer bg-transparent p-0 shrink-0"
              />
              <Input
                type="text"
                value={wpStyle.color || ''}
                onChange={(e) => updateWp({ color: e.target.value })}
                placeholder="Hex (例: #ff0000)"
                className="h-8 text-xs font-mono flex-1 min-w-0"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs mb-1">塗り色 (Fill Color)</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={wpStyle.fillColor || '#60a5fa'}
                onChange={(e) => updateWp({ fillColor: e.target.value })}
                className="w-8 h-8 rounded border border-border-base cursor-pointer bg-transparent p-0 shrink-0"
              />
              <Input
                type="text"
                value={wpStyle.fillColor || ''}
                onChange={(e) => updateWp({ fillColor: e.target.value })}
                placeholder="Hex (未指定なら枠色同等)"
                className="h-8 text-xs font-mono flex-1 min-w-0"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs mb-1">スケール倍率 (Scale: 0.1 ~ 5.0)</Label>
            <Input
              type="number"
              step="0.1"
              min="0.1"
              max="5.0"
              value={wpStyle.scale !== undefined ? String(wpStyle.scale) : ''}
              onChange={(e) => updateWp({ scale: e.target.value ? parseFloat(e.target.value) : undefined })}
              placeholder="1.0"
              className="h-8 text-xs font-mono w-full"
            />
          </div>

          <div>
            <Label className="text-xs mb-1">不透明度 (Opacity: 0.0 ~ 1.0)</Label>
            <Input
              type="number"
              step="0.05"
              min="0.0"
              max="1.0"
              value={wpStyle.opacity !== undefined ? String(wpStyle.opacity) : ''}
              onChange={(e) => updateWp({ opacity: e.target.value ? parseFloat(e.target.value) : undefined })}
              placeholder="1.0"
              className="h-8 text-xs font-mono w-full"
            />
          </div>
        </div>
      </div>
    );
  }

  if (targetElement === 'path') {
    const pStyle = rule.style?.path || {};

    const updatePath = (updates: Partial<typeof pStyle>) => {
      onChange({
        ...rule,
        style: {
          ...rule.style,
          path: { ...pStyle, ...updates },
        },
      });
    };

    return (
      <div className="space-y-3 bg-surface-panel/30 p-3 rounded-xl border border-border-base/40">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs mb-1">適用方向 (Direction)</Label>
            <Select
              value={pStyle.direction || 'outgoing'}
              onChange={(e) => updatePath({ direction: e.target.value as any })}
              className="h-8 text-xs w-full"
            >
              <option value="outgoing">このノードから出る線 (Outgoing)</option>
              <option value="incoming">このノードへ入る線 (Incoming)</option>
            </Select>
          </div>

          <div>
            <Label className="text-xs mb-1">線種 (Dash Pattern)</Label>
            <Select
              value={pStyle.dashPattern || 'solid'}
              onChange={(e) => updatePath({ dashPattern: e.target.value as any })}
              className="h-8 text-xs w-full"
            >
              <option value="solid">実線 (Solid)</option>
              <option value="dashed">破線 (Dashed)</option>
              <option value="dotted">点線 (Dotted)</option>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs mb-1">線の色 (Path Color)</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={pStyle.color || '#3b82f6'}
                onChange={(e) => updatePath({ color: e.target.value })}
                className="w-8 h-8 rounded border border-border-base cursor-pointer bg-transparent p-0 shrink-0"
              />
              <Input
                type="text"
                value={pStyle.color || ''}
                onChange={(e) => updatePath({ color: e.target.value })}
                placeholder="Hex (例: #10b981)"
                className="h-8 text-xs font-mono flex-1 min-w-0"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs mb-1">不透明度 (Opacity)</Label>
            <Input
              type="number"
              step="0.05"
              min="0.0"
              max="1.0"
              value={pStyle.opacity !== undefined ? String(pStyle.opacity) : ''}
              onChange={(e) => updatePath({ opacity: e.target.value ? parseFloat(e.target.value) : undefined })}
              placeholder="0.7"
              className="h-8 text-xs font-mono w-full"
            />
          </div>
        </div>

        <div className="space-y-2 pt-2 border-t border-border-base/30">
          <Label className="text-xs">線幅の設定方法</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-[11px] text-text-muted mb-1">固定線幅 (m)</Label>
              <Input
                type="number"
                step="0.05"
                min="0.01"
                max="5.0"
                value={pStyle.width !== undefined ? String(pStyle.width) : ''}
                disabled={Boolean(pStyle.widthFromOption)}
                onChange={(e) => updatePath({ width: e.target.value ? parseFloat(e.target.value) : undefined })}
                placeholder="0.2"
                className="h-8 text-xs font-mono w-full"
              />
            </div>

            <div>
              <Label className="text-[11px] text-text-muted mb-1">オプションから直接参照</Label>
              <Select
                value={pStyle.widthFromOption || ''}
                onChange={(e) => updatePath({ widthFromOption: e.target.value || undefined })}
                className="h-8 text-xs font-mono w-full"
              >
                <option value="">(使用しない: 固定値)</option>
                {optionsList.map((opt) => (
                  <option key={opt} value={opt}>
                    options.{opt}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (targetElement === 'footprint') {
    const fpStyle = rule.style?.footprint || {};

    const updateFp = (updates: Partial<typeof fpStyle>) => {
      onChange({
        ...rule,
        style: {
          ...rule.style,
          footprint: { ...fpStyle, ...updates },
        },
      });
    };

    return (
      <div className="space-y-3 bg-surface-panel/30 p-3 rounded-xl border border-border-base/40">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs mb-1">表示モード (Visibility)</Label>
            <Select
              value={fpStyle.visibleMode || 'default'}
              onChange={(e) => updateFp({ visibleMode: e.target.value as any })}
              className="h-8 text-xs w-full"
            >
              <option value="default">通常設定に従う</option>
              <option value="force_show">強制表示 (Force Show)</option>
              <option value="force_hide">強制非表示 (Force Hide)</option>
            </Select>
          </div>

          <div>
            <Label className="text-xs mb-1">寸法モード (Size Mode)</Label>
            <Select
              value={fpStyle.sizeMode || 'default'}
              onChange={(e) => updateFp({ sizeMode: e.target.value as any })}
              className="h-8 text-xs w-full"
            >
              <option value="default">デフォルト寸法</option>
              <option value="scale">倍率スケーリング (Scale)</option>
              <option value="from_option">オプションから直接参照</option>
              <option value="custom_value">カスタム固定値</option>
            </Select>
          </div>
        </div>

        {fpStyle.sizeMode === 'scale' && (
          <div>
            <Label className="text-xs mb-1">スケール倍率 (Scale: 0.1 ~ 10.0)</Label>
            <Input
              type="number"
              step="0.1"
              min="0.1"
              max="10.0"
              value={fpStyle.scale !== undefined ? String(fpStyle.scale) : ''}
              onChange={(e) => updateFp({ scale: e.target.value ? parseFloat(e.target.value) : undefined })}
              placeholder="1.5"
              className="h-8 text-xs font-mono w-full"
            />
          </div>
        )}

        {fpStyle.sizeMode === 'from_option' && (
          <div>
            <Label className="text-xs mb-1">参照オプションキー (Option Key)</Label>
            <Select
              value={fpStyle.sizeOptionKey || ''}
              onChange={(e) => updateFp({ sizeOptionKey: e.target.value || undefined })}
              className="h-8 text-xs font-mono w-full"
            >
              <option value="">(キーを選択)</option>
              {optionsList.map((opt) => (
                <option key={opt} value={opt}>
                  options.{opt}
                </option>
              ))}
            </Select>
          </div>
        )}

        {fpStyle.sizeMode === 'custom_value' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <Label className="text-xs mb-1">半径 (Radius: m)</Label>
              <Input
                type="number"
                step="0.05"
                min="0.01"
                value={fpStyle.customRadius !== undefined ? String(fpStyle.customRadius) : ''}
                onChange={(e) => updateFp({ customRadius: e.target.value ? parseFloat(e.target.value) : undefined })}
                placeholder="0.3"
                className="h-8 text-xs font-mono w-full"
              />
            </div>
            <div>
              <Label className="text-xs mb-1">長さ (Length: m)</Label>
              <Input
                type="number"
                step="0.05"
                min="0.01"
                value={fpStyle.customLength !== undefined ? String(fpStyle.customLength) : ''}
                onChange={(e) => updateFp({ customLength: e.target.value ? parseFloat(e.target.value) : undefined })}
                placeholder="0.6"
                className="h-8 text-xs font-mono w-full"
              />
            </div>
            <div>
              <Label className="text-xs mb-1">幅 (Width: m)</Label>
              <Input
                type="number"
                step="0.05"
                min="0.01"
                value={fpStyle.customWidth !== undefined ? String(fpStyle.customWidth) : ''}
                onChange={(e) => updateFp({ customWidth: e.target.value ? parseFloat(e.target.value) : undefined })}
                placeholder="0.4"
                className="h-8 text-xs font-mono w-full"
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs mb-1">枠線色</Label>
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                value={fpStyle.strokeColor || '#f59e0b'}
                onChange={(e) => updateFp({ strokeColor: e.target.value })}
                className="w-7 h-7 rounded border border-border-base cursor-pointer bg-transparent p-0 shrink-0"
              />
              <Input
                type="text"
                value={fpStyle.strokeColor || ''}
                onChange={(e) => updateFp({ strokeColor: e.target.value })}
                placeholder="Hex"
                className="h-8 text-xs font-mono flex-1 min-w-0"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs mb-1">塗り色</Label>
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                value={fpStyle.fillColor || '#fbbf24'}
                onChange={(e) => updateFp({ fillColor: e.target.value })}
                className="w-7 h-7 rounded border border-border-base cursor-pointer bg-transparent p-0 shrink-0"
              />
              <Input
                type="text"
                value={fpStyle.fillColor || ''}
                onChange={(e) => updateFp({ fillColor: e.target.value })}
                placeholder="Hex"
                className="h-8 text-xs font-mono flex-1 min-w-0"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs mb-1">塗り不透明度</Label>
            <Input
              type="number"
              step="0.05"
              min="0.0"
              max="1.0"
              value={fpStyle.fillAlpha !== undefined ? String(fpStyle.fillAlpha) : ''}
              onChange={(e) => updateFp({ fillAlpha: e.target.value ? parseFloat(e.target.value) : undefined })}
              placeholder="0.2"
              className="h-8 text-xs font-mono w-full"
            />
          </div>
        </div>
      </div>
    );
  }

  if (targetElement === 'annotation') {
    const annStyle = rule.style?.annotation || {};

    const updateAnn = (updates: Partial<typeof annStyle>) => {
      onChange({
        ...rule,
        style: {
          ...rule.style,
          annotation: { ...annStyle, ...updates },
        },
      });
    };

    return (
      <div className="space-y-3 bg-surface-panel/30 p-3 rounded-xl border border-border-base/40">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs mb-1">表示/非表示 (Visibility)</Label>
            <Select
              value={annStyle.visible === undefined ? 'default' : annStyle.visible ? 'show' : 'hide'}
              onChange={(e) => {
                const val = e.target.value;
                updateAnn({ visible: val === 'default' ? undefined : val === 'show' });
              }}
              className="h-8 text-xs w-full"
            >
              <option value="default">通常設定に従う</option>
              <option value="show">強制表示 (Show)</option>
              <option value="hide">強制非表示 (Hide)</option>
            </Select>
          </div>

          <div>
            <Label className="text-xs mb-1">線幅 (px)</Label>
            <Input
              type="number"
              step="0.5"
              min="0.5"
              max="20"
              value={annStyle.strokeWidth !== undefined ? String(annStyle.strokeWidth) : ''}
              onChange={(e) => updateAnn({ strokeWidth: e.target.value ? parseFloat(e.target.value) : undefined })}
              placeholder="2.0"
              className="h-8 text-xs font-mono w-full"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs mb-1">枠線色</Label>
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                value={annStyle.strokeColor || '#ec4899'}
                onChange={(e) => updateAnn({ strokeColor: e.target.value })}
                className="w-7 h-7 rounded border border-border-base cursor-pointer bg-transparent p-0 shrink-0"
              />
              <Input
                type="text"
                value={annStyle.strokeColor || ''}
                onChange={(e) => updateAnn({ strokeColor: e.target.value })}
                placeholder="Hex"
                className="h-8 text-xs font-mono flex-1 min-w-0"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs mb-1">塗り色</Label>
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                value={annStyle.fillColor || '#f472b6'}
                onChange={(e) => updateAnn({ fillColor: e.target.value })}
                className="w-7 h-7 rounded border border-border-base cursor-pointer bg-transparent p-0 shrink-0"
              />
              <Input
                type="text"
                value={annStyle.fillColor || ''}
                onChange={(e) => updateAnn({ fillColor: e.target.value })}
                placeholder="Hex"
                className="h-8 text-xs font-mono flex-1 min-w-0"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs mb-1">不透明度</Label>
            <Input
              type="number"
              step="0.05"
              min="0.0"
              max="1.0"
              value={annStyle.opacity !== undefined ? String(annStyle.opacity) : ''}
              onChange={(e) => updateAnn({ opacity: e.target.value ? parseFloat(e.target.value) : undefined })}
              placeholder="1.0"
              className="h-8 text-xs font-mono w-full"
            />
          </div>
        </div>
      </div>
    );
  }

  return null;
}
