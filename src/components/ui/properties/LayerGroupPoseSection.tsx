import { useMemo, useRef, useState } from 'react';
import { Move, RotateCcw, RotateCw } from 'lucide-react';
import { useAppStore } from '../../../stores/appStore';
import { descendantLayerIds } from '../../../utils/layerTree';
import {
  groupWorldBounds,
  isZeroOffset,
  mapsSharingPoseWithOutside,
  transformBetweenOffsets,
  type RigidTransform,
} from '../../../utils/layerGroupTransform';
import {
  canEditWithoutAsking,
  chooseSharedPoseMode,
  confirmEditWhileHidden,
  rememberedSharedPoseMode,
} from '../../../services/poseEditGuards';
import type { SharedPoseMode } from '../../../stores/slices/mapSlice';
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
  // A held nudge or a number being typed records one undo step: only its first move does.
  const gestureRecorded = useRef(false);
  // The user cancelled a question while typing a number: the rest of that edit does nothing.
  const declined = useRef(false);
  // A question is open (hidden group, shared maps); numbers typed meanwhile wait for its answer.
  const asking = useRef(false);
  const queuedTotal = useRef<Partial<{ x: number; y: number; yawDeg: number }> | null>(null);
  const offset = layerGroups[groupId]?.pose_offset;
  const shown = { x: offset?.x ?? 0, y: offset?.y ?? 0, yawDeg: ((offset?.yaw ?? 0) * 180) / Math.PI };

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

  /** Moves the group after the questions (hidden, shared maps) are answered. Resolves to false when cancelled. */
  const apply = (buildTransform: () => RigidTransform, recordHistory = true): boolean | Promise<boolean> => {
    const move = (sharedPose: SharedPoseMode) => {
      useAppStore.getState().transformLayerGroup(groupId, buildTransform(), { sharedPose, recordHistory });
      return true;
    };
    // With nothing to ask, move at once: several edits in a row must see each other's result.
    const known = canEditWithoutAsking(groupId) ? rememberedSharedPoseMode(groupId, sharing) : undefined;
    if (known) return move(known);
    return (async () => {
      if (!(await confirmEditWhileHidden(groupId))) return false;
      const sharedPose = await chooseSharedPoseMode(groupId, sharing);
      return sharedPose ? move(sharedPose) : false;
    })();
  };

  const recordsHistory = () => {
    const record = !gestureRecorded.current;
    gestureRecorded.current = true;
    return record;
  };

  const turnAroundPivot = (dyawDeg: number) =>
    apply(() => ({ dx: 0, dy: 0, dyaw: toRadians(dyawDeg), pivot: pivotOf() }), recordsHistory());

  const nudge = ({ dx, dy, dyawDeg }: PoseNudge) =>
    apply(() => ({ dx, dy, dyaw: toRadians(dyawDeg), pivot: pivotOf() }), recordsHistory());

  /** A typed value is the new total: the group moves by the difference from the total at that moment. */
  const setTotal = (changes: Partial<typeof shown>) => {
    if (declined.current) return;
    // A question is open: keep the latest typed value for when it is answered.
    if (asking.current) {
      queuedTotal.current = { ...queuedTotal.current, ...changes };
      return;
    }
    const build = () => {
      const current = useAppStore.getState().layerGroups[groupId]?.pose_offset;
      return transformBetweenOffsets(current, {
        x: changes.x ?? current?.x ?? 0,
        y: changes.y ?? current?.y ?? 0,
        yaw: changes.yawDeg === undefined ? (current?.yaw ?? 0) : toRadians(changes.yawDeg),
      });
    };
    const result = apply(build, recordsHistory());
    if (result instanceof Promise) {
      asking.current = true;
      void result.then((accepted) => {
        asking.current = false;
        const queued = queuedTotal.current;
        queuedTotal.current = null;
        if (!accepted) declined.current = true;
        else if (queued) setTotal(queued);
      });
    }
  };
  const startTyping = () => {
    gestureRecorded.current = false;
    declined.current = false;
  };

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
          onClick={() => {
            gestureRecorded.current = false;
            void turnAroundPivot(-90);
          }}
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
          onClick={() => {
            gestureRecorded.current = false;
            void turnAroundPivot(90);
          }}
          title="グループを時計回りに 90° 回す"
        >
          <RotateCw size={12} />
          <span>+90°</span>
        </Button>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span
          className="text-[10px] text-text-muted"
          title="このグループの位置調整で動かした合計。原点まわりに回し、そのあと平行移動した量です。数値を書き換えると、差の分だけ動きます。"
        >
          これまでの移動量
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 text-[10px] text-text-muted hover:text-text-base gap-1"
          disabled={isZeroOffset(offset)}
          onClick={() => {
            startTyping();
            setTotal({ x: 0, y: 0, yawDeg: 0 });
          }}
          title="動かした分をすべて元に戻す"
        >
          <RotateCcw size={11} />
          <span>Reset</span>
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <LabeledNumericInput
          label="ΔX (m)"
          value={shown.x}
          step={0.05}
          precision={3}
          onEditStart={startTyping}
          onChange={(x) => setTotal({ x })}
        />
        <LabeledNumericInput
          label="ΔY (m)"
          value={shown.y}
          step={0.05}
          precision={3}
          onEditStart={startTyping}
          onChange={(y) => setTotal({ y })}
        />
        <LabeledNumericInput
          label="ΔYaw (°)"
          value={shown.yawDeg}
          step={1}
          precision={1}
          onEditStart={startTyping}
          onChange={(yawDeg) => setTotal({ yawDeg })}
        />
      </div>

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
