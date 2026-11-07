import '@testing-library/jest-dom';
import { afterEach, expect } from 'vitest';
import { getHistoryGuardMode, takeHistoryViolations } from '../stores/history/historyGuard';

// jsdom lacks the pointer-capture API used by canvas drag interactions.
if (typeof HTMLElement !== 'undefined') {
  HTMLElement.prototype.setPointerCapture ??= () => {};
  HTMLElement.prototype.releasePointerCapture ??= () => {};
  HTMLElement.prototype.hasPointerCapture ??= () => false;
}

// Undoable changes that were not recorded (src/stores/history/historyGuard.ts). In `strict` mode they fail the
// test; in `report` mode they are appended as JSON lines to the file named by
// VITE_HISTORY_GUARD_REPORT, if set.
const NODE_FS = 'node:fs';

afterEach(async () => {
  const violations = takeHistoryViolations();
  if (violations.length === 0) return;
  const mode = getHistoryGuardMode();
  const test = expect.getState().currentTestName ?? '';
  if (mode === 'strict') {
    const where = violations.map((v) => `  ${v.keys.join(', ')}\n${v.stack}`).join('\n');
    throw new Error(`An undoable change was not recorded (${test}):\n${where}`);
  }
  const reportFile = import.meta.env.VITE_HISTORY_GUARD_REPORT;
  if (mode === 'report' && reportFile) {
    const file = expect.getState().testPath ?? '';
    const lines = violations.map((v) => JSON.stringify({ file, test, keys: v.keys, stack: v.stack }) + '\n');
    // The app's tsconfig has no Node types; this file only runs under Vitest, on Node.
    const fs: { appendFileSync: (path: string, data: string) => void } = await import(/* @vite-ignore */ NODE_FS);
    fs.appendFileSync(reportFile, lines.join(''));
  }
});
