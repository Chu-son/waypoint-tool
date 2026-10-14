import { useMemo, useRef, useState } from 'react';
import { Move, RotateCcw, RotateCw } from 'lucide-react';
import { useAppStore } from '../../../stores/appStore';
import type { SharedPoseMode } from '../../../stores/slices/mapSlice';
import { descendantLayerIds } from '../../../utils/layerTree';
import { groupWorldBounds, mapsSharingPoseWithOutside, type RigidTransform } from '../../../utils/layerGroupTransform';
import { confirmAction } from '../../../services/notify';
import { resolveMapLayers } from '../../../utils/layerStack';
import { Button } from '../common/Button';
import { LabeledNumericInput } from '../common/LabeledNumericInput';
import { PoseAdjuster, type PoseNudge } from '../common/PoseAdjuster';

type PivotMode = 'center' | 'origin';

const toRadians = (deg: number) => (deg * Math.PI) / 180;

/**
 * Moves everything in a layer group as one body: numbers to apply, quick turns and a nudge pad. A held
 * nudge is one undo step. Plugin layers move with the group, so running the plugin again puts them back.
 */
export function LayerGroupPoseSection({ groupId }: { groupId: string }) {
  const rootLayerIds = useAppStore((state) => state.rootLayerIds);
  const layerGroups = useAppStore((state) => state.layerGroups);
  const mapLayers = useAppStore((state) => state.mapLayers);
  const mapSources = useAppStore((state) => state.mapSources);
  const customLayers = useAppStore((state) => state.customLayers);

  const [pivotMode, setPivotMode] = useState<PivotMode>('center');
  const [delta, setDelta] = useState({ dx: 0, dy: 0, dyawDeg: 0 });
  // A held nudge records one undo step: only its first move does.
  const gestureRecorded = useRef(false);
  // The answer to "move the other users of the map too?", kept while the same maps are shared.
  const sharedChoice = useRef<{ key: string; mode: SharedPoseMode } | null>(null);

  const tree = useMemo(() => ({ rootLayerIds, layerGroups }), [rootLayerIds, layerGroups]);
  const contents = useMemo(() => new Set(descendantLayerIds(tree, groupId)), [tree, groupId]);
  const insideMaps = useMemo(
    () =>
      resolveMapLayers(
        mapSources,
        mapLayers.filter((l) => contents.has(l.id)),
      ),
    [mapSources, mapLayers, contents],
  );
  const insideCustoms = useMemo(() => customLayers.filter((l) => contents.has(l.id)), [customLayers, contents]);
  const sharing = useMemo(
    () => mapsSharingPoseWithOutside({ ...tree, mapLayers }, groupId),
    [tree, mapLayers, groupId],
  );
  const hasPlugin = insideCustoms.some((l) => l.type === 'plugin');

  if (insideMaps.length === 0 && insideCustoms.length === 0) return null;

  const pivotOf = () => {
    if (pivotMode === 'origin') return { x: 0, y: 0 };
    const bounds = groupWorldBounds(insideMaps, insideCustoms);
    return bounds ? { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 } : { x: 0, y: 0 };
  };

  /** How to treat maps shared with layers outside the group: asked once while the same maps stay shared. */
  const sharedPoseMode = async (): Promise<SharedPoseMode> => {
    if (sharing.length === 0) return 'move_all';
    const key = sharing.map((l) => l.id).join(',');
    if (sharedChoice.current?.key === key) return sharedChoice.current.mode;
    const names = [...new Set(sharing.map((l) => `「${l.name}」`))].join('、');
    const moveAll = await confirmAction(
      `${names} は、このグループの外のレイヤーと姿勢を共有しています。\n\n` +
        'はい：外のレイヤーも一緒に動かす（位置関係が保たれます）\n' +
        'いいえ：このグループのマップだけ動かす（姿勢の連動を外します）',
      { title: 'Move Group', kind: 'info' },
    );
    const mode: SharedPoseMode = moveAll ? 'move_all' : 'unlink';
    sharedChoice.current = { key, mode };
    return mode;
  };

  const apply = async (change: { dx: number; dy: number; dyawDeg: number }, recordHistory = true) => {
    const transform: RigidTransform = {
      dx: change.dx,
      dy: change.dy,
      dyaw: toRadians(change.dyawDeg),
      pivot: pivotOf(),
    };
    const sharedPose = await sharedPoseMode();
    useAppStore.getState().transformLayerGroup(groupId, transform, { sharedPose, recordHistory });
  };

  const nudge = ({ dx, dy, dyawDeg }: PoseNudge) => {
    const record = !gestureRecorded.current;
    gestureRecorded.current = true;
    void apply({ dx, dy, dyawDeg }, record);
  };

  const applyDelta = async () => {
    await apply(delta);
    setDelta({ dx: 0, dy: 0, dyawDeg: 0 });
  };
  const isZero = delta.dx === 0 && delta.dy === 0 && delta.dyawDeg === 0;

  return (
    <div className="space-y-2">
      <span className="text-[11px] font-bold text-text-base flex items-center gap-1.5">
        <Move size={12} className="text-accent-generator" />
        グループの位置調整
      </span>

      <div className="flex items-center gap-1.5 text-[10px] text-text-muted">
        <span>回転の中心</span>
        {(
          [
            ['center', 'グループの中心'],
            ['origin', '原点 (0, 0)'],
          ] as const
        ).map(([mode, label]) => (
          <Button
            key={mode}
            variant={pivotMode === mode ? 'primary' : 'secondary'}
            size="sm"
            className="h-6 px-2 text-[10px]"
            aria-pressed={pivotMode === mode}
            onClick={() => setPivotMode(mode)}
          >
            {label}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-7 text-[10px] text-text-muted hover:text-text-base gap-1"
          onClick={() => void apply({ dx: 0, dy: 0, dyawDeg: -90 })}
          title="グループを反時計回りに 90° 回す"
        >
          <RotateCcw size={12} />
          <span>-90°</span>
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-7 text-[10px] text-text-muted hover:text-text-base gap-1"
          onClick={() => void apply({ dx: 0, dy: 0, dyawDeg: 90 })}
          title="グループを時計回りに 90° 回す"
        >
          <RotateCw size={12} />
          <span>+90°</span>
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <LabeledNumericInput
          label="ΔX (m)"
          value={delta.dx}
          step={0.05}
          precision={3}
          onChange={(dx) => setDelta((d) => ({ ...d, dx }))}
        />
        <LabeledNumericInput
          label="ΔY (m)"
          value={delta.dy}
          step={0.05}
          precision={3}
          onChange={(dy) => setDelta((d) => ({ ...d, dy }))}
        />
        <LabeledNumericInput
          label="ΔYaw (°)"
          value={delta.dyawDeg}
          step={1}
          precision={1}
          onChange={(dyawDeg) => setDelta((d) => ({ ...d, dyawDeg }))}
        />
      </div>
      <Button
        variant="primary"
        size="sm"
        className="w-full h-7 text-[11px]"
        disabled={isZero}
        onClick={() => void applyDelta()}
      >
        適用
      </Button>

      <PoseAdjuster
        onNudge={nudge}
        onEditStart={() => {
          gestureRecorded.current = false;
        }}
      />

      {hasPlugin && (
        <p className="text-[10px] text-text-muted/80">
          プラグインのレイヤーも一緒に動きます。プラグインを再実行すると、元の位置に生成されます。
        </p>
      )}
    </div>
  );
}
