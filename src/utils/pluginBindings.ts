/**
 * Resolution of pipeline step bindings such as `$steps.filter.custom_layers[0]` or `$inputs.roi`.
 */

/** Follow a dotted/indexed path (`a.b[0].c`). Falls back to the step's `raw` output for each key. */
export function getPathValue(obj: any, path: string): any {
  if (!obj || !path) return undefined;
  const tokens = path.match(/[^.[\]]+/g) || [];
  let current = obj;
  for (const token of tokens) {
    if (current == null) return undefined;
    if (current[token] !== undefined) {
      current = current[token];
    } else if (current.raw && current.raw[token] !== undefined) {
      current = current.raw[token];
    } else {
      return undefined;
    }
  }
  return current;
}

/**
 * Resolve a binding expression against previous step outputs and the user's manual inputs.
 *
 * - `$steps.<stepId>[.<path>]` reads an earlier step's output (throws if the step or path is missing,
 *   except for optional `inputs.*` paths).
 * - `$inputs.<key>` reads a manual input of any step.
 * - A bare identifier is looked up in the manual inputs; anything else is returned as a literal.
 */
export function resolveBindingExpression(
  expr: string,
  stepOutputs: Record<string, any>,
  manualInputs: Record<string, Record<string, any>>,
): any {
  if (expr.startsWith('$steps.')) {
    const rest = expr.slice(7);
    const dotIndex = rest.indexOf('.');
    if (dotIndex === -1) {
      const stepId = rest;
      return stepOutputs[stepId]?.raw;
    }
    const stepId = rest.slice(0, dotIndex);
    const path = rest.slice(dotIndex + 1);

    const stepOut = stepOutputs[stepId];
    if (!stepOut) {
      throw new Error(`Referenced step "${stepId}" output was not found for binding "${expr}".`);
    }

    const val = getPathValue(stepOut, path);
    if (val === undefined) {
      if (path.startsWith('inputs.') || path.startsWith('inputs[')) {
        return undefined;
      }
      throw new Error(
        `Binding "${expr}" could not be resolved: path "${path}" in step "${stepId}" evaluated to undefined.`,
      );
    }

    return val;
  }

  if (expr.startsWith('$inputs.')) {
    const key = expr.slice(8);
    for (const sInputs of Object.values(manualInputs)) {
      if (sInputs[key] !== undefined) {
        return sInputs[key];
      }
    }
    return undefined;
  }

  if (manualInputs[expr] !== undefined) {
    return manualInputs[expr];
  }
  for (const sInputs of Object.values(manualInputs)) {
    if (sInputs[expr] !== undefined) {
      return sInputs[expr];
    }
  }

  // If it looks like an identifier rather than a literal value, do not return it as a raw string if missing
  if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(expr)) {
    return undefined;
  }

  return expr;
}
