import { useAppStore } from '../../../stores/appStore';
import { ToggleSwitch } from '../common/ToggleSwitch';

/** Chooses whether selecting an item brings the Inspector forward. Shown while nothing is selected. */
export function InspectorFocusToggle() {
  const enabled = useAppStore((state) => state.autoFocusInspector);
  const setAutoFocusInspector = useAppStore((state) => state.setAutoFocusInspector);

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border-base/40 px-3 py-2">
      <span className="text-[11px] text-text-muted" title="オフにすると、項目を選んでも今のパネルのままになります">
        選択したら Inspector に切り替える
      </span>
      <ToggleSwitch
        checked={enabled}
        onChange={setAutoFocusInspector}
        aria-label="選択時に Inspector へ切り替える"
        title={enabled ? '選択しても Inspector に切り替えない' : '選択したら Inspector に切り替える'}
      />
    </div>
  );
}
