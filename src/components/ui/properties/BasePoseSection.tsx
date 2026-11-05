import { useMemo, useRef } from 'react';
import { Crosshair, Move, RotateCcw, RotateCw } from 'lucide-react';
import { useAppStore } from '../../../stores/appStore';
import { effectiveBasePose, groupMoveScope, type GroupDomain } from '../../../stores/groupMove';
import { useBasePose } from '../../../hooks/useBasePose';
import { followingOf } from '../../../utils/pluginInputTransform';
import { transformBetweenPoses, type RigidTransform } from '../../../utils/rigidTransform';
import type { Pose2D } from '../../../types/geometry';
import { AlertBox } from '../common/AlertBox';
import { Button } from '../common/Button';
import { LabeledNumericInput } from '../common/LabeledNumericInput';
import { PoseAdjuster, type PoseNudge } from '../common/PoseAdjuster';
import { PropertySectionHeader } from './PropertySectionHeader';

const toRadians = (deg: number) => (deg * Math.PI) / 180;

/** What the user should know before moving: how a rerun treats the move, and what else moves along. */
function useNotes(domain: GroupDomain, id: string) {
  const nodes = useAppStore((state) => state.nodes);
  const annotationGroups = useAppStore((state) => state.annotationGroups);
  const annotationObjects = useAppStore((state) => state.annotationObjects);
  const customLayers = useAppStore((state) => state.customLayers);
  const plugins = useAppStore((state) => state.plugins);

  return useMemo(() => {
    const state = { nodes, annotationGroups, annotationObjects, customLayers, plugins };
    const item = domain === 'node' ? nodes[id] : annotationGroups[id];
    const isGenerator = item?.type === 'generator';
    const pluginMissing = isGenerator && !(item.plugin_id && plugins[item.plugin_id]);
    const following = isGenerator ? followingOf(item, plugins) : undefined;

    const scope = groupMoveScope(state, domain, id);
    const otherDomainMoves = domain === 'node' ? scope.groupIds.length > 0 : scope.nodeIds.length > 0;
    const movesOthers = otherDomainMoves || scope.layerIds.length > 0;
    const insidePipeline =
      scope.nodeIds.some((n) => n !== id && nodes[n].pipeline_metadata) ||
      scope.groupIds.some((g) => g !== id && annotationGroups[g].pipeline_metadata);
    return { pluginMissing, following, movesOthers, insidePipeline };
  }, [domain, id, nodes, annotationGroups, annotationObjects, customLayers, plugins]);
}

/**
 * The reference pose of a waypoint group/generator or an annotation group, and the controls that move the
 * whole group with it: typed X / Y / Yaw (the new pose), quarter turns and a nudge pad, all turning around
 * the reference pose. A held nudge or a number being typed is one undo step.
 */
export function BasePoseSection({ domain, id }: { domain: GroupDomain; id: string }) {
  const { pose, isStored } = useBasePose(domain, id);
  const notes = useNotes(domain, id);
  // A held nudge, a number being typed or a turn records one undo step: only its first move does.
  const gestureRecorded = useRef(false);

  if (!pose) return null;
  if (notes.pluginMissing) {
    return (
      <AlertBox variant="warning" title="位置を調整できません">
        プラグインが読み込まれていないため、入力をどう動かすか分かりません。
      </AlertBox>
    );
  }

  const move = (build: (current: Pose2D) => RigidTransform) => {
    const state = useAppStore.getState();
    const current = effectiveBasePose(state, domain, id);
    if (!current) return;
    const recordHistory = !gestureRecorded.current;
    gestureRecorded.current = true;
    const t = build(current);
    if (domain === 'node') state.transformNodeGroup(id, t, { recordHistory });
    else state.transformAnnotationGroup(id, t, { recordHistory });
  };
  const startGesture = () => {
    gestureRecorded.current = false;
  };

  const turn = (dyawDeg: number) => {
    startGesture();
    move((current) => ({ dx: 0, dy: 0, dyaw: toRadians(dyawDeg), pivot: current }));
  };
  const nudge = ({ dx, dy, dyawDeg }: PoseNudge) =>
    move((current) => ({ dx, dy, dyaw: toRadians(dyawDeg), pivot: current }));
  /** A typed value is the new reference pose: the group moves (and turns around it) to get there. */
  const setPose = (changes: Partial<Pose2D>) =>
    move((current) => transformBetweenPoses(current, { ...current, ...changes }, current));
  const recenter = () => {
    const state = useAppStore.getState();
    if (domain === 'node') state.clearNodeBasePose(id);
    else state.clearAnnotationBasePose(id);
  };

  return (
    <div className="space-y-2 pt-4 border-t border-border-base">
      <PropertySectionHeader
        title={
          <>
            <Move size={12} />
            <span title="中身と一緒に動く基準点。書き換えると、中身ごとその位置・向きへ動きます。">基準位置</span>
          </>
        }
      />

      <div className="grid grid-cols-3 gap-1.5">
        <LabeledNumericInput
          label="基準 X (m)"
          value={pose.x}
          step={0.05}
          precision={3}
          onEditStart={startGesture}
          onChange={(x) => setPose({ x })}
        />
        <LabeledNumericInput
          label="基準 Y (m)"
          value={pose.y}
          step={0.05}
          precision={3}
          onEditStart={startGesture}
          onChange={(y) => setPose({ y })}
        />
        <LabeledNumericInput
          label="基準 Yaw (°)"
          value={(pose.yaw * 180) / Math.PI}
          step={1}
          precision={1}
          onEditStart={startGesture}
          onChange={(deg) => setPose({ yaw: toRadians(deg) })}
        />
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-7 text-[10px] text-text-muted hover:text-text-base gap-1"
          onClick={() => turn(-90)}
          title="基準位置を中心に、中身ごと反時計回りに 90° 回す"
        >
          <RotateCcw size={12} />
          <span>-90°</span>
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-7 text-[10px] text-text-muted hover:text-text-base gap-1"
          onClick={() => turn(90)}
          title="基準位置を中心に、中身ごと時計回りに 90° 回す"
        >
          <RotateCw size={12} />
          <span>+90°</span>
        </Button>
      </div>

      <div title="移動はワールドの X / Y 軸に沿い、回転は基準位置を中心にします">
        <PoseAdjuster onNudge={nudge} onEditStart={startGesture} />
      </div>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-6 w-full text-[10px] text-text-muted hover:text-text-base gap-1"
        disabled={!isStored}
        onClick={recenter}
        title="中身は動かさず、基準位置を中身の中心（向き 0°）に戻す"
      >
        <Crosshair size={11} />
        <span>基準位置を中身の中心に置き直す</span>
      </Button>

      {notes.movesOthers && (
        <AlertBox variant="info" title="同じ実行の出力も一緒に動きます">
          このプラグイン実行で作られたアノテーション・ウェイポイント・レイヤーも同じだけ動きます。
        </AlertBox>
      )}
      {notes.following === 'partial' && (
        <AlertBox variant="info" title="再実行の結果が変わることがあります">
          入力は一緒に動きますが、参照しているオブジェクトや地図は動かないため、再実行すると形が変わることがあります。
        </AlertBox>
      )}
      {notes.following === 'none' && (
        <AlertBox variant="warning" title="再実行すると元の位置に生成されます">
          {domain === 'node'
            ? 'このプラグインは動かせる入力を持たないため、移動は手動編集として扱われます。再生成時に当て直せます。'
            : 'このプラグインは動かせる入力を持たないため、再生成すると移動前の位置に作り直されます。'}
        </AlertBox>
      )}
      {notes.insidePipeline && (
        <AlertBox variant="warning" title="パイプラインの出力を含みます">
          パイプラインを再実行すると、その出力は移動前の位置に作り直されます。
        </AlertBox>
      )}
    </div>
  );
}
