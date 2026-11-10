/**
 * Change detection for store updates. Actions use it to skip updates that change nothing, so that they
 * leave no undo step.
 *
 * Comparison goes one level deep: a field counts as unchanged when it is the same value, or an array or
 * plain object whose entries are the same values. That is enough because store values are never changed
 * in place: a change further down always comes with a new object one level up.
 */

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

/** The same value, or arrays / plain objects with the same keys whose entries are the same values. */
export function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  }
  if (!isPlainObject(a) || !isPlainObject(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => key in b && Object.is(a[key], b[key]));
}

/** Whether applying `updates` to `target` (as `{ ...target, ...updates }`) would change anything. */
export function changesAny<T extends object>(target: T, updates: Partial<T>): boolean {
  return (Object.keys(updates) as (keyof T)[]).some((key) => !shallowEqual(target[key], updates[key]));
}

/** `items` with the item `id` updated, or undefined when there is no such item or nothing would change. */
export function updateById<T extends { id: string }>(
  items: readonly T[],
  id: string,
  updates: Partial<NoInfer<T>>,
): T[] | undefined {
  const index = items.findIndex((item) => item.id === id);
  if (index < 0 || !changesAny(items[index], updates)) return undefined;
  const next = [...items];
  next[index] = { ...items[index], ...updates };
  return next;
}
