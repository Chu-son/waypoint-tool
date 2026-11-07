/**
 * The edit boundaries of the input components, tied to the undo history: an input that changes a value
 * continuously (typing, dragging a slider, holding a nudge) reports one edit with `onEditStart` /
 * `onEditEnd`, and everything changed in between is undone in one step. The components guarantee
 * `onEditEnd` also when they unmount mid-edit, so a transaction never stays open.
 */
import { useAppStore } from '../appStore';

const begin = () => useAppStore.getState().beginHistoryTransaction();
const end = () => useAppStore.getState().endHistoryTransaction();

/** Spread into an input component: `<NumericInput {...historyEditHandlers} … />`. */
export const historyEditHandlers = { onEditStart: begin, onEditEnd: end } as const;

/** The same, in the shape of `ValueEditTransactionContext` (option value editors). */
export const historyEditTransactions = {
  begin,
  end,
  run: (fn: () => void) => useAppStore.getState().runInHistoryTransaction(fn),
} as const;
