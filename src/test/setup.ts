import '@testing-library/jest-dom';
import { afterEach, expect } from 'vitest';
import { takeHistoryViolations } from '../stores/history/historyGuard';

// jsdom lacks the pointer-capture API used by canvas drag interactions.
if (typeof HTMLElement !== 'undefined') {
  HTMLElement.prototype.setPointerCapture ??= () => {};
  HTMLElement.prototype.releasePointerCapture ??= () => {};
  HTMLElement.prototype.hasPointerCapture ??= () => false;
}

// An undoable change that was not recorded fails the test that made it (src/stores/history/historyGuard.ts).
afterEach(() => {
  const violations = takeHistoryViolations();
  if (violations.length === 0) return;
  const test = expect.getState().currentTestName ?? '';
  const where = violations.map((v) => `  ${v.keys.join(', ')}\n${v.stack}`).join('\n');
  throw new Error(`An undoable change was not recorded (${test}):\n${where}`);
});
