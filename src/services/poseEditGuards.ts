/**
 * Confirmations before a layer's pose is edited: moving something that is hidden, and moving a map that
 * other layers share. Answers that let the edit go on are remembered, so a held nudge asks once.
 */
import { useAppStore } from '../stores/appStore';
import type { SharedPoseMode } from '../stores/slices/mapSlice';
import { hiddenCauseOf } from '../utils/layerHidden';
import { chooseAction, confirmAction } from './notify';

// target id -> the hiding item whose warning the user already accepted
const acceptedHidden = new Map<string, string>();

// `${groupId}|${shared layer ids}` -> the answer to "move the other users of the map too?"
const sharedChoices = new Map<string, SharedPoseMode>();

/** Forgets every remembered answer (for tests that reuse layer ids). */
export function resetPoseEditGuards(): void {
  acceptedHidden.clear();
  sharedChoices.clear();
}

const askingHidden = new Map<string, Promise<boolean>>();

/** True when `id` can be edited without asking: it is shown, or the user already accepted the warning. */
export function canEditWithoutAsking(id: string): boolean {
  const cause = hiddenCauseOf(useAppStore.getState(), id);
  if (!cause) {
    acceptedHidden.delete(id);
    return true;
  }
  return acceptedHidden.get(id) === cause.id;
}

/**
 * Warns when `id` (a layer or group) is not shown, since its edits cannot be seen on the map. Resolves to
 * `true` to go on. A shown item resolves right away, and a hidden one asks once until it is shown again;
 * callers asking while the dialog is open share its answer.
 */
export function confirmEditWhileHidden(id: string): Promise<boolean> {
  if (canEditWithoutAsking(id)) return Promise.resolve(true);
  const open = askingHidden.get(id);
  if (open) return open;
  const asking = askHidden(id).finally(() => askingHidden.delete(id));
  askingHidden.set(id, asking);
  return asking;
}

async function askHidden(id: string): Promise<boolean> {
  const cause = hiddenCauseOf(useAppStore.getState(), id);
  if (!cause) return true;
  const state = useAppStore.getState();
  const target =
    state.layerGroups[id]?.name ?? [...state.mapLayers, ...state.customLayers].find((l) => l.id === id)?.name;
  const why = cause.isSelf ? '非表示です' : `グループ「${cause.name}」が非表示のため、表示されていません`;
  const proceed = await confirmAction(
    `「${target ?? cause.name}」は${why}。\n\n` +
      'マップには描かれないので、位置を変えても見た目では確かめられません。このまま位置を調整しますか？',
    { title: '非表示のレイヤー', kind: 'warning' },
  );
  if (proceed) acceptedHidden.set(id, cause.id);
  return proceed;
}

const sharedKey = (groupId: string, sharing: readonly { id: string }[]) =>
  `${groupId}|${sharing.map((l) => l.id).join(',')}`;

/** The way to move the group's maps without asking: nothing is shared, or the user already answered. */
export function rememberedSharedPoseMode(
  groupId: string,
  sharing: readonly { id: string }[],
): SharedPoseMode | undefined {
  return sharing.length === 0 ? 'move_all' : sharedChoices.get(sharedKey(groupId, sharing));
}

/**
 * Asks how to move maps that the group shares with layers outside it, once for as long as the same layers
 * stay shared. Resolves to `null` when the user cancels.
 */
export async function chooseSharedPoseMode(
  groupId: string,
  sharing: readonly { id: string; name: string }[],
): Promise<SharedPoseMode | null> {
  const remembered = rememberedSharedPoseMode(groupId, sharing);
  if (remembered) return remembered;
  const key = sharedKey(groupId, sharing);
  const names = [...new Set(sharing.map((l) => `「${l.name}」`))].join('、');
  const answer = await chooseAction(
    `${names} は、このグループの外のレイヤーと姿勢を共有しています。\n\n` +
      '外のレイヤーも一緒に動かすか、このグループのマップだけを動かす（姿勢の連動を外す）かを選んでください。',
    {
      title: 'グループの移動',
      labels: { yes: '外も一緒に動かす', no: 'このグループだけ動かす', cancel: 'キャンセル' },
    },
  );
  if (answer === 'cancel') return null;
  const mode: SharedPoseMode = answer === 'yes' ? 'move_all' : 'unlink';
  sharedChoices.set(key, mode);
  return mode;
}
