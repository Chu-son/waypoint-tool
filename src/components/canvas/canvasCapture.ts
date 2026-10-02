/**
 * PNG capture of the map canvas, for the map image attached to exports.
 *
 * The canvas does not keep its drawing buffer after a frame is shown (`preserveDrawingBuffer` is
 * off, which costs every frame), so reading it at an arbitrary time could give a blank image.
 * MapCanvas registers a capture that draws the scene and reads the canvas in the same task, which
 * gives exactly what is on screen.
 */
type Capture = () => string;

let capture: Capture | null = null;

/** Registers the capture of the mounted map canvas; returns the function that unregisters it. */
export function registerCanvasCapture(fn: Capture): () => void {
  capture = fn;
  return () => {
    if (capture === fn) capture = null;
  };
}

/** The map canvas as it is shown now, as a PNG data URL, or `null` when no map canvas is mounted. */
export function captureCanvasPng(): string | null {
  return capture ? capture() : null;
}
