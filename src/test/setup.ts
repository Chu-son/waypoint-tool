import '@testing-library/jest-dom';

// jsdom lacks the pointer-capture API used by canvas drag interactions.
if (typeof HTMLElement !== 'undefined') {
  HTMLElement.prototype.setPointerCapture ??= () => {};
  HTMLElement.prototype.releasePointerCapture ??= () => {};
  HTMLElement.prototype.hasPointerCapture ??= () => false;
}
