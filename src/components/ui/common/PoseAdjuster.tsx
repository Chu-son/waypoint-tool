import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Move, RotateCcw, RotateCw } from 'lucide-react';
import { Button } from './Button';
import { cn } from '../../../utils/cn';

/** A relative pose change in world axes: +X right, +Y up, +yaw counter-clockwise. */
export interface PoseNudge {
  dx: number;
  dy: number;
  dyawDeg: number;
}

interface PoseAdjusterProps {
  onNudge: (nudge: PoseNudge) => void;
  /** Called when a press (or key hold) begins, so the whole gesture can be one Undo entry. */
  onEditStart?: () => void;
  /** Called when the press (or key hold) ends. */
  onEditEnd?: () => void;
  className?: string;
}

const STEP_PRESETS = [
  { id: 'coarse', label: 'Coarse', move: 1, rotate: 15 },
  { id: 'normal', label: 'Normal', move: 0.1, rotate: 1 },
  { id: 'fine', label: 'Fine', move: 0.01, rotate: 0.1 },
] as const;

const HOLD_DELAY_MS = 400;
const REPEAT_INTERVAL_MS = 60;

type Direction = 'up' | 'down' | 'left' | 'right' | 'ccw' | 'cw';

const KEY_DIRECTIONS: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  q: 'ccw',
  e: 'cw',
};

/** Rounds away floating point noise (0.1 + 0.2) so repeated nudges stay tidy. */
function tidy(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

/**
 * Nudge pad for aligning something by eye: arrow buttons move it, rotate buttons turn it.
 * Hold a button to repeat. While the pad has focus, arrow keys move and Q / E rotate;
 * Shift multiplies the step by 10 and Alt divides it by 10.
 */
export function PoseAdjuster({ onNudge, onEditStart, onEditEnd, className }: PoseAdjusterProps) {
  const [presetId, setPresetId] = useState<(typeof STEP_PRESETS)[number]['id']>('normal');
  const preset = STEP_PRESETS.find((p) => p.id === presetId) ?? STEP_PRESETS[1];

  // Timers and repeated pointer/key callbacks always need the latest props, not the ones from when the press began.
  const latest = useRef({ onNudge, onEditStart, onEditEnd, preset });
  latest.current = { onNudge, onEditStart, onEditEnd, preset };

  const isEditing = useRef(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeatTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const beginEdit = () => {
    if (isEditing.current) return;
    isEditing.current = true;
    latest.current.onEditStart?.();
  };

  const stopRepeat = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    if (repeatTimer.current) clearInterval(repeatTimer.current);
    holdTimer.current = null;
    repeatTimer.current = null;
  };

  const endEdit = () => {
    stopRepeat();
    if (!isEditing.current) return;
    isEditing.current = false;
    latest.current.onEditEnd?.();
  };

  useEffect(() => stopRepeat, []);

  const nudge = (direction: Direction, multiplier: number) => {
    const { move, rotate } = latest.current.preset;
    const m = move * multiplier;
    const r = rotate * multiplier;
    const delta: Record<Direction, PoseNudge> = {
      up: { dx: 0, dy: m, dyawDeg: 0 },
      down: { dx: 0, dy: -m, dyawDeg: 0 },
      left: { dx: -m, dy: 0, dyawDeg: 0 },
      right: { dx: m, dy: 0, dyawDeg: 0 },
      ccw: { dx: 0, dy: 0, dyawDeg: r },
      cw: { dx: 0, dy: 0, dyawDeg: -r },
    };
    const { dx, dy, dyawDeg } = delta[direction];
    latest.current.onNudge({ dx: tidy(dx), dy: tidy(dy), dyawDeg: tidy(dyawDeg) });
  };

  const modifierMultiplier = (e: { shiftKey: boolean; altKey: boolean }) => (e.shiftKey ? 10 : e.altKey ? 0.1 : 1);

  const handlePointerDown = (direction: Direction) => (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    const multiplier = modifierMultiplier(e);
    beginEdit();
    nudge(direction, multiplier);
    stopRepeat();
    holdTimer.current = setTimeout(() => {
      repeatTimer.current = setInterval(() => nudge(direction, multiplier), REPEAT_INTERVAL_MS);
    }, HOLD_DELAY_MS);
  };

  // Enter / Space on a focused button arrives as a click without a preceding pointer press.
  const handleKeyboardClick = (direction: Direction) => (e: React.MouseEvent<HTMLButtonElement>) => {
    if (e.detail !== 0) return;
    beginEdit();
    nudge(direction, modifierMultiplier(e));
    endEdit();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) return;
    const direction = KEY_DIRECTIONS[e.key.length === 1 ? e.key.toLowerCase() : e.key];
    if (!direction) return;
    e.preventDefault();
    beginEdit();
    nudge(direction, modifierMultiplier(e));
  };

  const handleKeyUp = (e: KeyboardEvent<HTMLDivElement>) => {
    if (KEY_DIRECTIONS[e.key.length === 1 ? e.key.toLowerCase() : e.key]) endEdit();
  };

  const padButton = (direction: Direction, label: string, icon: React.ReactNode) => (
    <Button
      type="button"
      variant="secondary"
      size="icon"
      className="h-7 w-full touch-none"
      aria-label={label}
      title={label}
      onPointerDown={handlePointerDown(direction)}
      onPointerUp={endEdit}
      onPointerLeave={endEdit}
      onPointerCancel={endEdit}
      onClick={handleKeyboardClick(direction)}
    >
      {icon}
    </Button>
  );

  return (
    <div
      role="group"
      aria-label="Pose adjuster"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      onBlur={endEdit}
      className={cn(
        'space-y-1.5 rounded-md p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-base/60',
        className,
      )}
    >
      <div role="group" aria-label="Step size" className="grid grid-cols-3 gap-1">
        {STEP_PRESETS.map((p) => (
          <Button
            key={p.id}
            type="button"
            size="sm"
            variant={p.id === presetId ? 'primary' : 'secondary'}
            className="h-auto flex-col gap-0 px-1 py-0.5 text-[10px] leading-tight"
            aria-pressed={p.id === presetId}
            title={`${p.label}: ${p.move} m / ${p.rotate}°`}
            onClick={() => setPresetId(p.id)}
          >
            <span>{p.label}</span>
            <span className="text-[9px] font-normal opacity-70">
              {p.move} m · {p.rotate}°
            </span>
          </Button>
        ))}
      </div>

      <div className="mx-auto grid max-w-44 grid-cols-3 gap-1">
        {padButton('ccw', 'Rotate counter-clockwise (Q)', <RotateCcw size={14} />)}
        {padButton('up', 'Move up (↑)', <ArrowUp size={14} />)}
        {padButton('cw', 'Rotate clockwise (E)', <RotateCw size={14} />)}
        {padButton('left', 'Move left (←)', <ArrowLeft size={14} />)}
        <div className="flex items-center justify-center text-text-muted" aria-hidden="true">
          <Move size={13} />
        </div>
        {padButton('right', 'Move right (→)', <ArrowRight size={14} />)}
        <div />
        {padButton('down', 'Move down (↓)', <ArrowDown size={14} />)}
        <div />
      </div>

      <p className="text-center text-[9px] text-text-muted">
        Focus here: arrows move, Q / E rotate, Shift ×10, Alt ÷10
      </p>
    </div>
  );
}
