import { useState, useEffect, useMemo } from "react";
import { useAppStore } from "../../../stores/appStore";
import { RobotFootprint, CircularFootprint, RectangularFootprint, PolygonFootprint } from "../../../types/store";
import { Button } from "../common/Button";
import { Input } from "../common/Input";
import { NumericInput } from "../NumericInput";
import { FormField } from "../common/FormField";
import { FieldLabel } from "../common/FieldLabel";
import { TabSectionHeader } from "./TabSectionHeader";
import { Save, Plus, Trash2, RotateCcw, Copy, Check } from "lucide-react";
import { cn } from "../../../utils/cn";
import { DEFAULT_ROBOT_FOOTPRINT } from "../../../stores/slices/projectSlice";

export function RobotFootprintTab() {
  const globalFootprint = useAppStore((state) => state.robotFootprint);
  const setGlobalFootprint = useAppStore((state) => state.setRobotFootprint);

  const [footprint, setFootprint] = useState<RobotFootprint>(globalFootprint || DEFAULT_ROBOT_FOOTPRINT);
  const [polygonText, setPolygonText] = useState<string>("");
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    setFootprint(globalFootprint || DEFAULT_ROBOT_FOOTPRINT);
  }, [globalFootprint]);

  useEffect(() => {
    if (footprint.type === "polygon") {
      setPolygonText(JSON.stringify(footprint.points));
    }
  }, [footprint]);

  const handleApply = () => {
    setGlobalFootprint(footprint);
    alert("ロボットフットプリント設定を適用しました。");
  };

  const handleReset = () => {
    setFootprint(DEFAULT_ROBOT_FOOTPRINT);
  };

  const handleTypeChange = (newType: 'circular' | 'rectangular' | 'polygon') => {
    if (newType === 'circular') {
      setFootprint({
        type: 'circular',
        radius: 0.3,
      });
    } else if (newType === 'rectangular') {
      setFootprint({
        type: 'rectangular',
        length: 0.6,
        width: 0.4,
        offset_x: 0.0,
        offset_y: 0.0,
      });
    } else if (newType === 'polygon') {
      setFootprint({
        type: 'polygon',
        points: [
          [0.3, 0.2],
          [-0.3, 0.2],
          [-0.3, -0.2],
          [0.3, -0.2],
        ],
      });
    }
  };

  // Polygon helpers
  const handleAddPoint = () => {
    if (footprint.type !== "polygon") return;
    const lastPoint = footprint.points[footprint.points.length - 1] || [0, 0];
    setFootprint({
      ...footprint,
      points: [...footprint.points, [lastPoint[0] + 0.1, lastPoint[1]]],
    });
  };

  const handleRemovePoint = (index: number) => {
    if (footprint.type !== "polygon") return;
    if (footprint.points.length <= 3) {
      alert("多角形フットプリントには最低3つの頂点が必要です。");
      return;
    }
    setFootprint({
      ...footprint,
      points: footprint.points.filter((_, i) => i !== index),
    });
  };

  const handleUpdatePoint = (index: number, x: number, y: number) => {
    if (footprint.type !== "polygon") return;
    const newPoints = footprint.points.map((pt, i) => (i === index ? [x, y] as [number, number] : pt));
    setFootprint({
      ...footprint,
      points: newPoints,
    });
  };

  const handleApplyPolygonText = () => {
    try {
      const parsed = JSON.parse(polygonText);
      if (Array.isArray(parsed) && parsed.length >= 3 && parsed.every(pt => Array.isArray(pt) && pt.length >= 2 && typeof pt[0] === 'number' && typeof pt[1] === 'number')) {
        const points: Array<[number, number]> = parsed.map(pt => [Number(pt[0]), Number(pt[1])]);
        setFootprint({
          type: 'polygon',
          points,
        });
      } else {
        alert("無効な頂点リストです。形式: [[x1, y1], [x2, y2], ...]");
      }
    } catch {
      alert("JSONパースに失敗しました。形式: [[x1, y1], [x2, y2], ...]");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <TabSectionHeader
        title="Robot Footprint Settings"
        subtitle="Define the robot's physical dimensions for canvas visualization and plugin collision checking."
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleReset}
              title="Reset to Default (0.3m Radius Circle)"
            >
              <RotateCcw size={14} className="mr-1" /> Reset
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleApply}
            >
              <Save size={14} className="mr-1" /> Apply
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-12 gap-6">
        {/* Left column: Controls & Forms */}
        <div className="col-span-7 space-y-5">
          {/* Footprint Type Selection */}
          <FormField
            label="Footprint Shape Type"
            description="Select the geometric model that best matches your robot."
          >
            <div className="grid grid-cols-3 gap-2">
              {[
                { type: 'circular', label: 'Circular (Radius)' },
                { type: 'rectangular', label: 'Rectangular (Box)' },
                { type: 'polygon', label: 'Polygon (Vertices)' },
              ].map((item) => (
                <Button
                  key={item.type}
                  type="button"
                  variant={footprint.type === item.type ? "secondary" : "ghost"}
                  onClick={() => handleTypeChange(item.type as any)}
                  className={cn(
                    "h-10 text-xs font-semibold justify-center border",
                    footprint.type === item.type
                      ? "bg-primary-base/15 border-primary-base text-primary-base shadow-sm"
                      : "border-border-base/50 text-text-muted hover:text-text-base hover:bg-surface-hover"
                  )}
                >
                  {item.label}
                </Button>
              ))}
            </div>
          </FormField>

          {/* Specific Parameters Form */}
          {footprint.type === "circular" && (
            <CircularEditor
              footprint={footprint}
              onChange={(radius) => setFootprint({ type: 'circular', radius })}
            />
          )}

          {footprint.type === "rectangular" && (
            <RectangularEditor
              footprint={footprint}
              onChange={(updates) => setFootprint({ ...footprint, ...updates })}
            />
          )}

          {footprint.type === "polygon" && (
            <PolygonEditor
              footprint={footprint}
              polygonText={polygonText}
              setPolygonText={setPolygonText}
              onAddPoint={handleAddPoint}
              onRemovePoint={handleRemovePoint}
              onUpdatePoint={handleUpdatePoint}
              onApplyText={handleApplyPolygonText}
              isCopied={isCopied}
              setIsCopied={setIsCopied}
            />
          )}
        </div>

        {/* Right column: SVG Visual Preview */}
        <div className="col-span-5">
          <div className="bg-surface-panel/50 border border-border-base/40 rounded-2xl p-4 flex flex-col items-center sticky top-0">
            <div className="w-full flex items-center justify-between mb-2">
              <FieldLabel className="text-xs font-bold text-text-base">Footprint Preview</FieldLabel>
              <span className="text-[10px] text-text-muted font-mono">X: Red (Forward), Y: Green</span>
            </div>
            
            <div className="w-full aspect-square bg-surface-base rounded-xl border border-border-base/50 relative overflow-hidden flex items-center justify-center shadow-inner">
              <FootprintSvgPreview footprint={footprint} />
            </div>

            <div className="mt-3 text-[11px] text-text-muted text-center leading-tight">
              {footprint.type === "circular" && `Circular: Radius ${footprint.radius.toFixed(3)} m (Diameter ${(footprint.radius * 2).toFixed(3)} m)`}
              {footprint.type === "rectangular" && `Rectangular: ${footprint.length.toFixed(3)} m (L) × ${footprint.width.toFixed(3)} m (W), Offset (${(footprint.offset_x ?? 0).toFixed(2)}, ${(footprint.offset_y ?? 0).toFixed(2)})`}
              {footprint.type === "polygon" && `Polygon: ${footprint.points.length} vertices`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Sub Editors
// -----------------------------------------------------------------------------

function CircularEditor({
  footprint,
  onChange,
}: {
  footprint: CircularFootprint;
  onChange: (radius: number) => void;
}) {
  return (
    <div className="p-4 bg-surface-panel/30 border border-border-base/30 rounded-xl space-y-4">
      <FormField
        label="Radius (m)"
        description="The distance from the robot center to its outer circular boundary."
      >
        <NumericInput
          step={0.01}
          min={0.01}
          max={10.0}
          precision={3}
          value={footprint.radius}
          onChange={onChange}
          className="h-10 text-sm font-mono"
          placeholder="0.3"
        />
      </FormField>
    </div>
  );
}

function RectangularEditor({
  footprint,
  onChange,
}: {
  footprint: RectangularFootprint;
  onChange: (updates: Partial<RectangularFootprint>) => void;
}) {
  return (
    <div className="p-4 bg-surface-panel/30 border border-border-base/30 rounded-xl space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <FormField
          label="Length (X direction / meters)"
          description="Front-to-back dimension."
        >
          <NumericInput
            step={0.01}
            min={0.01}
            precision={3}
            value={footprint.length}
            onChange={(val) => onChange({ length: val })}
            className="h-9 text-xs font-mono"
            placeholder="0.65"
          />
        </FormField>
        <FormField
          label="Width (Y direction / meters)"
          description="Left-to-right dimension."
        >
          <NumericInput
            step={0.01}
            min={0.01}
            precision={3}
            value={footprint.width}
            onChange={(val) => onChange({ width: val })}
            className="h-9 text-xs font-mono"
            placeholder="0.45"
          />
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border-base/30">
        <FormField
          label="Offset X (meters)"
          description="Offset of center from robot origin."
        >
          <NumericInput
            step={0.01}
            precision={3}
            value={footprint.offset_x ?? 0}
            onChange={(val) => onChange({ offset_x: val })}
            className="h-9 text-xs font-mono"
            placeholder="0.0"
          />
        </FormField>
        <FormField
          label="Offset Y (meters)"
          description="Offset of center from robot origin."
        >
          <NumericInput
            step={0.01}
            precision={3}
            value={footprint.offset_y ?? 0}
            onChange={(val) => onChange({ offset_y: val })}
            className="h-9 text-xs font-mono"
            placeholder="0.0"
          />
        </FormField>
      </div>
    </div>
  );
}

function PolygonEditor({
  footprint,
  polygonText,
  setPolygonText,
  onAddPoint,
  onRemovePoint,
  onUpdatePoint,
  onApplyText,
  isCopied,
  setIsCopied,
}: {
  footprint: PolygonFootprint;
  polygonText: string;
  setPolygonText: (text: string) => void;
  onAddPoint: () => void;
  onRemovePoint: (index: number) => void;
  onUpdatePoint: (index: number, x: number, y: number) => void;
  onApplyText: () => void;
  isCopied: boolean;
  setIsCopied: (v: boolean) => void;
}) {
  return (
    <div className="p-4 bg-surface-panel/30 border border-border-base/30 rounded-xl space-y-4">
      <div className="flex items-center justify-between">
        <FieldLabel className="text-xs font-bold text-text-base">Polygon Vertices (Robot Frame / m)</FieldLabel>
        <Button size="sm" variant="secondary" onClick={onAddPoint} className="h-7 text-xs">
          <Plus size={12} className="mr-1" /> Add Vertex
        </Button>
      </div>

      {/* Vertices List Table */}
      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
        {footprint.points.map((pt, idx) => (
          <div key={idx} className="flex items-center gap-2 bg-surface-panel/50 p-1.5 rounded-lg border border-border-base/30">
            <span className="w-6 text-[10px] text-text-muted font-mono text-center">{idx + 1}</span>
            <div className="flex-1 flex items-center gap-1">
              <span className="text-[10px] text-text-muted font-mono">X:</span>
              <NumericInput
                step={0.01}
                precision={3}
                value={pt[0]}
                onChange={(val) => onUpdatePoint(idx, val, pt[1])}
                className="h-7 text-xs font-mono px-2"
              />
            </div>
            <div className="flex-1 flex items-center gap-1">
              <span className="text-[10px] text-text-muted font-mono">Y:</span>
              <NumericInput
                step={0.01}
                precision={3}
                value={pt[1]}
                onChange={(val) => onUpdatePoint(idx, pt[0], val)}
                className="h-7 text-xs font-mono px-2"
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              disabled={footprint.points.length <= 3}
              onClick={() => onRemovePoint(idx)}
              className="h-7 w-7 text-text-muted hover:text-danger-base hover:bg-danger-base/10"
              title="Delete vertex"
            >
              <Trash2 size={13} />
            </Button>
          </div>
        ))}
      </div>

      {/* JSON / Text Quick Import & Export */}
      <div className="pt-3 border-t border-border-base/30 space-y-2">
        <div className="flex items-center justify-between">
          <FieldLabel className="text-[11px]">ROS Nav2 Footprint Format</FieldLabel>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-[10px] px-2 text-text-muted hover:text-text-base"
            onClick={() => {
              navigator.clipboard.writeText(polygonText);
              setIsCopied(true);
              setTimeout(() => setIsCopied(false), 2000);
            }}
          >
            {isCopied ? <Check size={11} className="mr-1 text-emerald-400" /> : <Copy size={11} className="mr-1" />}
            {isCopied ? "Copied" : "Copy"}
          </Button>
        </div>
        <div className="flex gap-2">
          <Input
            type="text"
            value={polygonText}
            onChange={(e) => setPolygonText(e.target.value)}
            placeholder="[[0.3, 0.2], [-0.3, 0.2], [-0.3, -0.2], [0.3, -0.2]]"
            className="h-8 text-[11px] font-mono"
          />
          <Button size="sm" variant="secondary" onClick={onApplyText} className="h-8 text-xs shrink-0">
            Import
          </Button>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// SVG Visual Preview Component
// -----------------------------------------------------------------------------

function FootprintSvgPreview({ footprint }: { footprint: RobotFootprint }) {
  // Determine bounds to compute viewBox
  const bounds = useMemo(() => {
    let minX = -0.5, maxX = 0.5, minY = -0.5, maxY = 0.5;
    if (footprint.type === "circular") {
      const r = Math.max(footprint.radius, 0.1);
      minX = -r; maxX = r; minY = -r; maxY = r;
    } else if (footprint.type === "rectangular") {
      const halfL = footprint.length / 2;
      const halfW = footprint.width / 2;
      const ox = footprint.offset_x || 0;
      const oy = footprint.offset_y || 0;
      minX = ox - halfL; maxX = ox + halfL;
      minY = oy - halfW; maxY = oy + halfW;
    } else if (footprint.type === "polygon") {
      if (footprint.points.length > 0) {
        minX = Math.min(...footprint.points.map((p) => p[0]));
        maxX = Math.max(...footprint.points.map((p) => p[0]));
        minY = Math.min(...footprint.points.map((p) => p[1]));
        maxY = Math.max(...footprint.points.map((p) => p[1]));
      }
    }

    const maxDim = Math.max(Math.abs(minX), Math.abs(maxX), Math.abs(minY), Math.abs(maxY), 0.3);
    const range = maxDim * 1.4; // 40% margin
    return { range };
  }, [footprint]);

  const size = 220;
  const scale = (size / 2) / bounds.range;
  const cx = size / 2;
  const cy = size / 2;

  // Screen Cartesian: +X right, +Y up (so SVG y = cy - y * scale)
  const toSvgX = (x: number) => cx + x * scale;
  const toSvgY = (y: number) => cy - y * scale;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="select-none">
      {/* Grid lines */}
      <defs>
        <pattern id="footprint-grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width={size} height={size} fill="url(#footprint-grid)" />

      {/* Coordinate Axes */}
      {/* X Axis (+X Forward/Right) */}
      <line x1={toSvgX(-bounds.range)} y1={cy} x2={toSvgX(bounds.range)} y2={cy} stroke="rgba(239, 68, 68, 0.4)" strokeWidth="1" strokeDasharray="3 3" />
      {/* Y Axis (+Y Left/Up) */}
      <line x1={cx} y1={toSvgY(-bounds.range)} x2={cx} y2={toSvgY(bounds.range)} stroke="rgba(34, 197, 94, 0.4)" strokeWidth="1" strokeDasharray="3 3" />

      {/* Center Origin Cross & Forward Arrow */}
      <line x1={cx} y1={cy} x2={cx + 30} y2={cy} stroke="#ef4444" strokeWidth="2" />
      <polygon points={`${cx + 35},${cy} ${cx + 27},${cy - 4} ${cx + 27},${cy + 4}`} fill="#ef4444" />

      <line x1={cx} y1={cy} x2={cx} y2={cy - 30} stroke="#22c55e" strokeWidth="2" />
      <polygon points={`${cx},${cy - 35} ${cx - 4},${cy - 27} ${cx + 4},${cy - 27}`} fill="#22c55e" />

      <circle cx={cx} cy={cy} r="3" fill="#38bdf8" />

      {/* Shape Rendering */}
      {footprint.type === "circular" && (
        <circle
          cx={cx}
          cy={cy}
          r={footprint.radius * scale}
          fill="rgba(56, 189, 248, 0.15)"
          stroke="#38bdf8"
          strokeWidth="2"
        />
      )}

      {footprint.type === "rectangular" && (
        <rect
          x={toSvgX((footprint.offset_x || 0) - footprint.length / 2)}
          y={toSvgY((footprint.offset_y || 0) + footprint.width / 2)}
          width={footprint.length * scale}
          height={footprint.width * scale}
          fill="rgba(56, 189, 248, 0.15)"
          stroke="#38bdf8"
          strokeWidth="2"
          rx="2"
        />
      )}

      {footprint.type === "polygon" && footprint.points.length >= 3 && (
        <polygon
          points={footprint.points.map((p) => `${toSvgX(p[0])},${toSvgY(p[1])}`).join(" ")}
          fill="rgba(56, 189, 248, 0.15)"
          stroke="#38bdf8"
          strokeWidth="2"
        />
      )}

      {/* Axis Labels */}
      <text x={cx + 38} y={cy + 4} fill="#ef4444" fontSize="10" fontWeight="bold" fontFamily="monospace">+X</text>
      <text x={cx + 4} y={cy - 38} fill="#22c55e" fontSize="10" fontWeight="bold" fontFamily="monospace">+Y</text>
    </svg>
  );
}
