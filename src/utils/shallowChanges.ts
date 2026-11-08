/**
 * Whether applying `updates` to `target` (as `{ ...target, ...updates }`) would change anything, comparing
 * each field by identity. Actions use it to skip no-op updates, so that they leave no undo step.
 */
export function changesAny<T extends object>(target: T, updates: Partial<T>): boolean {
  return (Object.keys(updates) as (keyof T)[]).some((key) => !Object.is(target[key], updates[key]));
}

/** `changesAny` that also looks inside the field `nested`, for updates that rebuild it as a new object. */
export function changesAnyWithin<T extends object, K extends keyof T>(
  target: T,
  updates: Partial<T>,
  nested: K,
): boolean {
  const { [nested]: inner, ...others } = updates;
  if (changesAny(target, others as Partial<T>)) return true;
  return inner !== undefined && changesAny(target[nested] as object, inner as object);
}
